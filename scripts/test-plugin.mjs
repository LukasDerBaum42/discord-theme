#!/usr/bin/env node
/**
 * Runs the unrounding plugin against a mock Revenge API.
 *
 * The plugin can only really be judged on a device, but the sweep, the undo log,
 * the StyleSheet patch and the inline-style stripping are all plain JS and can
 * be driven here — including the awkward cases (throwing getters, frozen style
 * objects, cyclic exports) that would otherwise only show up as a plugin that
 * silently disables itself on the phone.
 *
 * Usage: node scripts/test-plugin.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = readFileSync(join(root, 'plugins/unrounding/index.js'), 'utf8');

/** Minimal stand-in for the pieces of `vendetta` the plugin touches. */
function createMockApi({
    modules = {},
    storage = {},
    jsxRuntime = null,
    extraJsxRuntimes = [],
    nativePayloads = [],
    maskedView = null,
    tokens = null,
} = {}) {
    const log = [];
    const clipboardContents = [];
    const patchCalls = [];
    const jsxRuntimes = jsxRuntime ? [jsxRuntime, ...extraJsxRuntimes] : extraJsxRuntimes;

    const patcher = {
        after(prop, object, callback) {
            patchCalls.push({ prop, object, kind: 'after' });
            const original = object[prop];
            object[prop] = function (...args) {
                const result = original.apply(this, args);
                const replaced = callback(args, result);
                return replaced === undefined ? result : replaced;
            };
            return () => {
                object[prop] = original;
            };
        },
        instead(prop, object, callback) {
            patchCalls.push({ prop, object, kind: 'instead' });
            const original = object[prop];
            object[prop] = function (...args) {
                return callback(args, original.bind(this));
            };
            return () => {
                object[prop] = original;
            };
        },
    };

    const StyleSheet = { create: (styles) => styles };
    const React = { createElement: (type, props, ...children) => ({ type, props, children }) };

    return {
        api: {
            patcher,
            metro: {
                modules,
                findByProps: (...props) => {
                    if (props.includes('unsafe_rawColors')) return tokens;
                    return jsxRuntime && props.every((p) => p in jsxRuntime) ? jsxRuntime : null;
                },
                findByPropsAll: (...props) => {
                    if (props.includes('create') && props.includes('diff')) {
                        return nativePayloads;
                    }
                    return jsxRuntimes.filter((m) => props.every((p) => p in m));
                },
                findByName: (name) => (name === 'MaskedView' ? maskedView : null),
                findByDisplayName: () => null,
                common: {
                    React,
                    ReactNative: { StyleSheet, ScrollView: 'ScrollView', View: 'View' },
                    clipboard: {
                        setString: (text) => {
                            clipboardContents.push(text);
                        },
                    },
                },
            },
            storage: { useProxy: () => {} },
            ui: {
                toasts: { showToast: (text) => log.push(text) },
                components: {
                    Forms: { FormSwitchRow: 'FormSwitchRow', FormRow: 'FormRow', FormDivider: 'FormDivider' },
                },
            },
            logger: {
                log: (...m) => log.push(m.join(' ')),
                warn: (...m) => log.push(m.join(' ')),
                error: (...m) => log.push(m.join(' ')),
            },
            plugin: { storage },
        },
        StyleSheet,
        React,
        log,
        clipboardContents,
        patchCalls,
    };
}

/** A JSX runtime that records the props each element was created with. */
function createJsxRuntime() {
    const calls = [];
    const runtime = {
        jsx: (type, props) => {
            calls.push({ type, props });
            return { type, props };
        },
        jsxs: (type, props) => {
            calls.push({ type, props });
            return { type, props };
        },
    };
    return { runtime, calls };
}

const load = (api) => new Function('vendetta', `return ${script}`)(api);

/** Wrap exports the way Metro does. */
const asModule = (exports, extra = {}) => ({
    isInitialized: true,
    publicModule: { exports },
    ...extra,
});

let passed = 0;
function test(name, fn) {
    try {
        fn();
        passed++;
    } catch (error) {
        console.error(`FAIL ${name}\n  ${error.message}`);
        process.exitCode = 1;
    }
}

/* ── the basic sweep, and putting it back ────────────────────────────── */
test('zeroes nested style radii and restores them on unload', () => {
    const styles = { card: { borderRadius: 8, backgroundColor: '#141414' } };
    const nested = { deep: { panel: { borderTopLeftRadius: 12, borderBottomEndRadius: '50%' } } };
    const { api } = createMockApi({ modules: { 1: asModule({ styles }), 2: asModule(nested) } });

    const plugin = load(api);
    plugin.onLoad();

    assert.equal(styles.card.borderRadius, 0);
    assert.equal(styles.card.backgroundColor, '#141414', 'unrelated props untouched');
    assert.equal(nested.deep.panel.borderTopLeftRadius, 0);
    assert.equal(nested.deep.panel.borderBottomEndRadius, '0%', 'percentages stay percentages');

    plugin.onUnload();
    assert.equal(styles.card.borderRadius, 8);
    assert.equal(nested.deep.panel.borderTopLeftRadius, 12);
    assert.equal(nested.deep.panel.borderBottomEndRadius, '50%');
});

test('zeroes design-token radii maps', () => {
    const tokens = { radii: { none: 0, sm: 4, md: 8, round: 9999 } };
    const { api } = createMockApi({ modules: { 1: asModule(tokens) } });

    const plugin = load(api);
    plugin.onLoad();
    assert.deepEqual(tokens.radii, { none: 0, sm: 0, md: 0, round: 0 });

    plugin.onUnload();
    assert.deepEqual(tokens.radii, { none: 0, sm: 4, md: 8, round: 9999 });
});

test('keepCircles leaves large radii alone', () => {
    const styles = { pill: { borderRadius: 9999 }, panel: { borderRadius: 8 } };
    const { api } = createMockApi({
        modules: { 1: asModule(styles) },
        storage: { keepCircles: true, patchInlineStyles: false },
    });

    load(api).onLoad();
    assert.equal(styles.pill.borderRadius, 9999, 'circle preserved');
    assert.equal(styles.panel.borderRadius, 0, 'panel still squared');
});

/* ── layer 2: styles created after start ─────────────────────────────── */
test('patches StyleSheet.create for later stylesheets', () => {
    const { api, StyleSheet } = createMockApi();
    const plugin = load(api);
    plugin.onLoad();

    const created = StyleSheet.create({ row: { borderRadius: 16 } });
    assert.equal(created.row.borderRadius, 0);

    plugin.onUnload();
    assert.equal(StyleSheet.create({ row: { borderRadius: 16 } }).row.borderRadius, 16, 'unpatched');
});

/* ── layer 3: element style props ────────────────────────────────────── */
test('strips style radii from elements by default', () => {
    const { runtime, calls } = createJsxRuntime();
    const { api } = createMockApi({ jsxRuntime: runtime });

    const plugin = load(api);
    plugin.onLoad();

    runtime.jsx('View', { style: { borderRadius: 10, flex: 1 } });
    assert.equal(calls[0].props.style.borderRadius, 0);
    assert.equal(calls[0].props.style.flex, 1);

    /* arrays of styles are handled */
    runtime.jsx('View', { style: [{ flex: 1 }, { borderRadius: 4 }] });
    assert.equal(calls[1].props.style[1].borderRadius, 0);

    plugin.onUnload();
    runtime.jsx('View', { style: { borderRadius: 10 } });
    assert.equal(calls[2].props.style.borderRadius, 10, 'unpatched');
});

test('memoizes stripping so repeat renders keep a stable style identity', () => {
    const { runtime, calls } = createJsxRuntime();
    const { api } = createMockApi({ jsxRuntime: runtime });
    load(api).onLoad();

    /* the same StyleSheet object rendered twice, as React.memo would see it */
    const sheetStyle = { borderRadius: 8 };
    runtime.jsx('View', { style: sheetStyle });
    runtime.jsx('View', { style: sheetStyle });
    assert.equal(calls[0].props.style, calls[1].props.style, 'same clone reused');

    /* nothing to strip means the original object passes straight through */
    const plain = { flex: 1 };
    runtime.jsx('View', { style: plain });
    assert.equal(calls[2].props.style, plain, 'no needless reallocation');

    /* and props objects without a style are never copied */
    const props = { collapsable: false };
    runtime.jsx('View', props);
    assert.equal(calls[3].props, props);
});

test('patches the classic createElement runtime too', () => {
    const { api, React } = createMockApi();
    const plugin = load(api);
    plugin.onLoad();

    const element = React.createElement('View', { style: { borderRadius: 12 } });
    assert.equal(element.props.style.borderRadius, 0);

    plugin.onUnload();
    assert.equal(React.createElement('View', { style: { borderRadius: 12 } }).props.style.borderRadius, 12);
});

/* ── layer 4: masks (avatars, server icons) ──────────────────────────── */
test('drops mask and clipPath props and squares SVG rects', () => {
    const { runtime, calls } = createJsxRuntime();
    const { api } = createMockApi({ jsxRuntime: runtime });

    const plugin = load(api);
    plugin.onLoad();

    runtime.jsx('RNSVGImage', { mask: 'url(#avatar)', href: 'x' });
    assert.equal('mask' in calls[0].props, false, 'mask removed');
    assert.equal(calls[0].props.href, 'x', 'other props kept');

    runtime.jsx('RNSVGPath', { clipPath: 'url(#squircle)' });
    assert.equal('clipPath' in calls[1].props, false);

    runtime.jsx('RNSVGRect', { rx: 12, ry: 12, width: 48 });
    assert.equal(calls[2].props.rx, 0);
    assert.equal(calls[2].props.ry, 0);
    assert.equal(calls[2].props.width, 48);

    plugin.onUnload();
    runtime.jsx('RNSVGImage', { mask: 'url(#avatar)' });
    assert.equal(calls[3].props.mask, 'url(#avatar)', 'unpatched');
});

test('replaces MaskedView with an unmasked View', () => {
    const MaskedView = function MaskedView() {};
    const { runtime, calls } = createJsxRuntime();
    const { api } = createMockApi({ jsxRuntime: runtime, maskedView: MaskedView });

    load(api).onLoad();

    const maskElement = { type: 'Circle' };
    runtime.jsx(MaskedView, { maskElement, style: { flex: 1 }, children: 'avatar' });

    assert.notEqual(calls[0].type, MaskedView, 'MaskedView swapped out');
    const rendered = calls[0].type(calls[0].props);
    assert.equal(rendered.type, 'View');
    assert.equal(rendered.children[0], 'avatar', 'children render unmasked');
});

test('keepCircles leaves masks intact', () => {
    const { runtime, calls } = createJsxRuntime();
    const { api } = createMockApi({ jsxRuntime: runtime, storage: { keepCircles: true } });

    load(api).onLoad();
    runtime.jsx('RNSVGImage', { mask: 'url(#avatar)' });
    assert.equal(calls[0].props.mask, 'url(#avatar)', 'avatar mask preserved');
});

test('does not hook element creation when both element layers are off', () => {
    const { runtime } = createJsxRuntime();
    const original = runtime.jsx;
    const { api } = createMockApi({
        jsxRuntime: runtime,
        storage: {
            configVersion: 3,
            stripElementStyles: false,
            squareMasks: false,
            keepCircles: false,
            recordElements: false,
        },
    });

    load(api).onLoad();
    assert.equal(runtime.jsx, original, 'jsx runtime untouched');
});

test('zeroes radius props passed outside of style', () => {
    const { runtime, calls } = createJsxRuntime();
    const { api } = createMockApi({ jsxRuntime: runtime });
    load(api).onLoad();

    runtime.jsx('Card', { borderRadius: 16, cornerRadius: 8 });
    assert.equal(calls[0].props.borderRadius, 0);
    assert.equal(calls[0].props.cornerRadius, 0);

    /* Fresco's native circle crop, which nothing else can reach */
    runtime.jsx('Image', { roundAsCircle: true, source: 'x' });
    assert.equal(calls[1].props.roundAsCircle, false);
    assert.equal(calls[1].props.source, 'x');

    /* a bare `radius` is ambiguous (blur/shadow radius) and must be left alone */
    runtime.jsx('BlurView', { radius: 12 });
    assert.equal(calls[2].props.radius, 12, 'ambiguous prop untouched');
});

/* ── shape flags and components found via the diagnostics recorder ───── */
test('flips the boolean shape flags Discord actually uses', () => {
    const { runtime, calls } = createJsxRuntime();
    const { api } = createMockApi({ jsxRuntime: runtime });
    load(api).onLoad();

    /* the guild bar item wrapper, i.e. the server icons */
    runtime.jsx('GuildsBarAnimatedItemWrapper', { circle: true, preventClipping: true });
    assert.equal(calls[0].props.circle, false);
    assert.equal(calls[0].props.preventClipping, true, 'unrelated prop untouched');

    runtime.jsx('TextInput', { isRound: true, value: 'hi' });
    assert.equal(calls[1].props.isRound, false);
    assert.equal(calls[1].props.value, 'hi');

    /* only flipped when strictly true, so other uses of the name are safe */
    runtime.jsx('Chart', { circle: { r: 4 } });
    assert.deepEqual(calls[2].props.circle, { r: 4 });
});

test('zeroes sheetCornerRadius and strips maskStyle radii', () => {
    const { runtime, calls } = createJsxRuntime();
    const { api } = createMockApi({ jsxRuntime: runtime });
    load(api).onLoad();

    runtime.jsx('ReanimatedNativeStackScreen', { sheetCornerRadius: 16 });
    assert.equal(calls[0].props.sheetCornerRadius, 0);

    runtime.jsx('MaskedBadge', { maskStyle: { borderRadius: 12, width: 20 } });
    assert.equal(calls[1].props.maskStyle.borderRadius, 0);
    assert.equal(calls[1].props.maskStyle.width, 20);
});

test('matches MaskedView by name, not just identity', () => {
    /* the component a finder returns is not necessarily the one rendered — this
       is why the MaskedView counter sat at zero while MaskedView elements were
       being recorded */
    const foundByFinder = function MaskedView() {};
    const actuallyRendered = function MaskedView() {};
    const { runtime, calls } = createJsxRuntime();
    const { api } = createMockApi({ jsxRuntime: runtime, maskedView: foundByFinder });

    load(api).onLoad();

    runtime.jsx(actuallyRendered, { maskElement: { type: 'Circle' }, children: 'pfp' });
    assert.notEqual(calls[0].type, actuallyRendered, 'swapped despite a different identity');
    assert.equal(calls[0].type(calls[0].props).children[0], 'pfp');
});

test('patches each jsx factory once even when finders return duplicates', () => {
    const { runtime } = createJsxRuntime();
    /* the real finders returned the same module for jsx and jsxs, so it got
       wrapped four times over and every element was processed four times */
    const { api, patchCalls } = createMockApi({
        jsxRuntime: runtime,
        extraJsxRuntimes: [runtime, runtime],
    });

    load(api).onLoad();

    const jsxPatches = patchCalls.filter((c) => c.prop === 'jsx' && c.object === runtime);
    assert.equal(jsxPatches.length, 1, 'wrapped exactly once');
});

/* ── diagnostics ─────────────────────────────────────────────────────── */
test('records real shape props and ignores lookalikes', () => {
    const { runtime } = createJsxRuntime();
    const { api, clipboardContents } = createMockApi({ jsxRuntime: runtime });

    const plugin = load(api);
    plugin.onLoad();
    plugin
        .settings()
        .children.find((c) => c.type === 'FormSwitchRow' && c.props.label.includes('Record'))
        .props.onValueChange(true);

    function Noisy() {}
    runtime.jsx(Noisy, {
        backgroundColor: '#000',
        ios_backgroundColor: '#000',
        removeClippedSubviews: true,
        ellipsizeMode: 'tail',
        onTapSoundmoji: () => {},
        preventClipping: true,
    });
    function Real() {}
    runtime.jsx(Real, { isRound: true, sheetCornerRadius: 8, maskElement: null, circle: true });

    plugin.settings().children.filter((c) => c.type === 'FormRow')[1].props.onPress();
    const report = clipboardContents[0];

    assert.doesNotMatch(report, /Noisy/, 'lookalike prop names no longer bury the findings');
    assert.match(report, /Real: isRound, sheetCornerRadius, maskElement, circle/);
});
test('records shape props only when recording is enabled', () => {
    const { runtime } = createJsxRuntime();
    const { api, clipboardContents } = createMockApi({
        jsxRuntime: runtime,
        storage: { configVersion: 3, squareMasks: true, stripElementStyles: true, keepCircles: false, recordElements: false },
    });

    const plugin = load(api);
    plugin.onLoad();

    function ChatAvatar() {}
    runtime.jsx(ChatAvatar, { roundAsCircle: true, someShape: 'circle' });

    const rows = () => plugin.settings().children.filter((c) => c.type === 'FormRow');
    rows()[1].props.onPress();
    assert.match(clipboardContents[0], /observed: recording is off/);

    /* turn recording on through the switch, then render again */
    const recordSwitch = plugin
        .settings()
        .children.find((c) => c.type === 'FormSwitchRow' && c.props.label.includes('Record'));
    recordSwitch.props.onValueChange(true);

    runtime.jsx(ChatAvatar, { roundAsCircle: true, borderRadius: 4 });
    rows()[1].props.onPress();
    assert.match(clipboardContents[1], /ChatAvatar: roundAsCircle, borderRadius/);
});

test('report copies to the clipboard and includes the token probe', () => {
    const { runtime } = createJsxRuntime();
    const { api, clipboardContents, log } = createMockApi({
        jsxRuntime: runtime,
        tokens: { unsafe_rawColors: {}, colors: {}, radii: { sm: 4, lg: 16 } },
    });

    const plugin = load(api);
    plugin.onLoad();

    /* the tokens module is zeroed directly, not via the registry sweep */
    const report = (() => {
        plugin.settings().children.filter((c) => c.type === 'FormRow')[1].props.onPress();
        return clipboardContents[0];
    })();

    assert.match(report, /system24 unrounding diagnostics/);
    assert.match(report, /hooks: .*jsx, jsxs, createElement/);
    assert.match(report, /radii=\{sm:0,lg:0\}/, 'token radii zeroed and reported');
    assert.ok(log.some((line) => line.includes('system24 unrounding diagnostics')), 'also logged');
});

test('report survives a missing clipboard', () => {
    const { api, log } = createMockApi();
    api.metro.common.clipboard = {
        setString() {
            throw new Error('no clipboard module');
        },
    };

    const plugin = load(api);
    plugin.onLoad();
    plugin.settings().children.filter((c) => c.type === 'FormRow')[1].props.onPress();

    assert.ok(log.some((line) => line.includes('clipboard unavailable')));
});

/* ── the stale-reference problem ─────────────────────────────────────── */
test('patches every jsx module, not just the first match', () => {
    /* a bundle has several: react/jsx-runtime, jsx-dev-runtime, re-export shims.
       Patching only the first installs a hook nothing calls. */
    const first = createJsxRuntime();
    const second = createJsxRuntime();
    const { api } = createMockApi({
        jsxRuntime: first.runtime,
        extraJsxRuntimes: [second.runtime],
    });

    load(api).onLoad();

    second.runtime.jsx('View', { style: { borderRadius: 9 } });
    assert.equal(second.calls[0].props.style.borderRadius, 0, 'second runtime also patched');
});

test('sanitizes native view props, surviving captured jsx references', () => {
    /* mirrors ReactNativeAttributePayload: create(props, validAttributes) and
       diff(prev, next, validAttributes) */
    const payload = {
        create: (props, _validAttributes) => props,
        diff: (prev, next, _validAttributes) => [prev, next],
    };
    /* a decoy with the right names but the wrong shape must be left alone */
    const decoy = { create: (a) => a, diff: (a) => a };
    const { api } = createMockApi({ nativePayloads: [decoy, payload] });
    const originalDecoy = decoy.create;

    load(api).onLoad();
    assert.equal(decoy.create, originalDecoy, 'decoy module not patched');

    const mounted = payload.create({ style: { borderRadius: 14 } }, {});
    assert.equal(mounted.style.borderRadius, 0, 'mount path sanitized');

    const [prev, next] = payload.diff(
        { style: { borderRadius: 14 } },
        { style: { borderRadius: 14 } },
        {}
    );
    assert.equal(prev.style.borderRadius, 0, 'both sides of the diff sanitized');
    assert.equal(next.style.borderRadius, 0);

    /* SVG masks reach native through the same funnel */
    const masked = payload.create({ mask: 'url(#avatar)' }, {});
    assert.equal('mask' in masked, false);
});

test('report exposes whether interception happens at all', () => {
    const { runtime } = createJsxRuntime();
    const payload = { create: (p, _v) => p, diff: (a, b, _v) => [a, b] };
    const { api, clipboardContents } = createMockApi({
        jsxRuntime: runtime,
        nativePayloads: [payload],
    });

    const plugin = load(api);
    plugin.onLoad();

    const copy = () =>
        plugin.settings().children.filter((c) => c.type === 'FormRow')[1].props.onPress();

    copy();
    assert.match(clipboardContents[0], /jsx modules patched: 1, native payload modules: 1/);

    const seen = (report) => Number(/elements seen: (\d+)/.exec(report)[1]);
    const before = seen(clipboardContents[0]);

    runtime.jsx('View', { style: { borderRadius: 4 } });
    copy();
    assert.ok(seen(clipboardContents[1]) > before, 'counter tracks intercepted elements');
});

test('toggling recording keeps the evidence already gathered', () => {
    const { runtime } = createJsxRuntime();
    const { api, clipboardContents } = createMockApi({ jsxRuntime: runtime });

    const plugin = load(api);
    plugin.onLoad();

    function GuildIcon() {}
    const recordSwitch = plugin
        .settings()
        .children.find((c) => c.type === 'FormSwitchRow' && c.props.label.includes('Record'));
    recordSwitch.props.onValueChange(true);

    runtime.jsx(GuildIcon, { borderRadius: 16 });

    /* flipping another setting re-applies the patches; that must not erase what
       has been observed, which is what made the first real report unreadable */
    const masksSwitch = plugin
        .settings()
        .children.find((c) => c.type === 'FormSwitchRow' && c.props.label.includes('masked'));
    masksSwitch.props.onValueChange(false);

    plugin.settings().children.filter((c) => c.type === 'FormRow')[1].props.onPress();
    assert.match(clipboardContents[0], /GuildIcon: borderRadius/, 'observation survived re-apply');
});

/* ── settings migration ──────────────────────────────────────────────── */
test('migrates an older install onto the new defaults', () => {
    const storage = { keepCircles: false, patchInlineStyles: false };
    const { api } = createMockApi({ storage });

    load(api);
    assert.equal(storage.stripElementStyles, true, 'element stripping now on by default');
    assert.equal(storage.squareMasks, true, 'mask squaring now on by default');
    assert.equal(storage.recordElements, false, 'recording stays opt-in');
    assert.equal('patchInlineStyles' in storage, false, 'old key removed');
    assert.equal(storage.configVersion, 3);
});

test('migration preserves an explicit keepCircles choice', () => {
    const storage = { keepCircles: true, patchInlineStyles: false };
    load(createMockApi({ storage }).api);
    assert.equal(storage.keepCircles, true);
});

/* ── hostile module shapes ───────────────────────────────────────────── */
test('survives throwing getters, frozen styles, cycles and bad modules', () => {
    const throwing = {};
    Object.defineProperty(throwing, 'boom', {
        enumerable: true,
        get() {
            throw new Error('nope');
        },
    });

    const frozen = Object.freeze({ borderRadius: 8 });
    const cyclic = { borderRadius: 6 };
    cyclic.self = cyclic;

    const reachable = { borderRadius: 8 };
    const modules = {
        1: asModule(throwing),
        2: asModule({ frozen }),
        3: asModule(cyclic),
        4: asModule(null),
        5: { isInitialized: false, publicModule: { exports: { borderRadius: 8 } } },
        6: asModule({ borderRadius: 8 }, { hasError: true }),
        7: asModule(reachable),
    };
    const uninitialized = modules[5].publicModule.exports;
    const errored = modules[6].publicModule.exports;

    const { api } = createMockApi({ modules });
    const plugin = load(api);
    plugin.onLoad();

    assert.equal(cyclic.borderRadius, 0, 'cycle did not stop the sweep');
    assert.equal(reachable.borderRadius, 0, 'kept going after the throwing module');
    assert.equal(frozen.borderRadius, 8, 'frozen object left as-is');
    assert.equal(uninitialized.borderRadius, 8, 'uninitialized module not forced');
    assert.equal(errored.borderRadius, 8, 'errored module skipped');

    plugin.onUnload();
    assert.equal(cyclic.borderRadius, 6);
});

/* ── settings surface ────────────────────────────────────────────────── */
test('settings component renders and re-applies on toggle', () => {
    const styles = { card: { borderRadius: 8 } };
    const storage = { keepCircles: false, patchInlineStyles: false };
    const { api, log } = createMockApi({ modules: { 1: asModule({ styles }) }, storage });

    const plugin = load(api);
    plugin.onLoad();

    const tree = plugin.settings();
    assert.equal(tree.type, 'ScrollView');
    const switches = tree.children.filter((c) => c.type === 'FormSwitchRow');
    const rows = tree.children.filter((c) => c.type === 'FormRow');
    assert.equal(switches.length, 4);
    assert.equal(rows.length, 2, 're-run and diagnostics rows');

    /* toggling must revert then re-apply, not zero an already-zeroed value */
    const keepCircles = switches.find((s) => s.props.label.includes('Keep circles'));
    keepCircles.props.onValueChange(true);
    assert.equal(storage.keepCircles, true);
    assert.equal(styles.card.borderRadius, 0, 'panel radius still squared');

    rows[1].props.onPress();
    assert.ok(
        log.some((line) => line.includes('hooks:')),
        'diagnostics row reports what was hooked'
    );

    plugin.onUnload();
    assert.equal(styles.card.borderRadius, 8, 'original value survived the toggle');
});

console.log(`${passed} plugin test(s) passed`);
