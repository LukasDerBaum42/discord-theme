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
function createMockApi({ modules = {}, storage = {}, jsxRuntime = null } = {}) {
    const log = [];

    const patcher = {
        after(prop, object, callback) {
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

    return {
        api: {
            patcher,
            metro: {
                modules,
                findByProps: (...props) =>
                    jsxRuntime && props.every((p) => p in jsxRuntime) ? jsxRuntime : null,
                common: {
                    React: { createElement: (type, props, ...children) => ({ type, props, children }) },
                    ReactNative: { StyleSheet, ScrollView: 'ScrollView' },
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
        log,
    };
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

/* ── layer 3: inline styles ──────────────────────────────────────────── */
test('strips inline style radii only when enabled', () => {
    const calls = [];
    const jsxRuntime = {
        jsx: (type, props) => {
            calls.push(props);
            return { type, props };
        },
        jsxs: (type, props) => ({ type, props }),
    };
    const { api } = createMockApi({
        jsxRuntime,
        storage: { keepCircles: false, patchInlineStyles: true },
    });

    const plugin = load(api);
    plugin.onLoad();

    jsxRuntime.jsx('View', { style: { borderRadius: 10, flex: 1 } });
    assert.equal(calls[0].style.borderRadius, 0);
    assert.equal(calls[0].style.flex, 1);

    /* no radius means no reallocation — the original object comes through */
    const plain = { flex: 1 };
    jsxRuntime.jsx('View', { style: plain });
    assert.equal(calls[1].style, plain, 'style object reused when nothing to strip');

    /* arrays of styles are handled */
    jsxRuntime.jsx('View', { style: [{ flex: 1 }, { borderRadius: 4 }] });
    assert.equal(calls[2].style[1].borderRadius, 0);

    plugin.onUnload();
    const after = { borderRadius: 10 };
    jsxRuntime.jsx('View', { style: after });
    assert.equal(calls[3].style.borderRadius, 10, 'unpatched');
});

test('leaves inline styles alone when disabled', () => {
    const jsxRuntime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    const original = jsxRuntime.jsx;
    const { api } = createMockApi({ jsxRuntime, storage: { patchInlineStyles: false } });

    load(api).onLoad();
    assert.equal(jsxRuntime.jsx, original, 'jsx runtime untouched');
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
    const rows = tree.children.filter((c) => c.type === 'FormSwitchRow');
    assert.equal(rows.length, 2);

    /* flipping keepCircles must revert then re-apply, not double-zero */
    rows[0].props.onValueChange(true);
    assert.equal(storage.keepCircles, true);
    assert.equal(styles.card.borderRadius, 0, 'panel radius still squared');
    assert.ok(log.some((line) => line.includes('Circles kept round')));

    plugin.onUnload();
    assert.equal(styles.card.borderRadius, 8, 'original value survived the toggle');
});

console.log(`${passed} plugin test(s) passed`);
