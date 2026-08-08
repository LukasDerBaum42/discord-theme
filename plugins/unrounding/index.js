(() => {
    /**
     * system24 unrounding — squares off Discord mobile's rounded corners.
     *
     * The desktop theme does this with one CSS rule (`* { border-radius: 0 }`,
     * see src/unrounding.css upstream). Mobile has no CSS, so radii have to be
     * removed from React Native style objects instead. Three layers, in order of
     * coverage:
     *
     *   1. Sweep Metro's module registry and zero every radius on every style
     *      object that already exists, in place. Mutating in place means
     *      components holding a reference pick it up on their next render, with
     *      no re-render cost and no wrapper components.
     *   2. Patch `StyleSheet.create` so style objects created later (Discord
     *      builds most screens' styles lazily, on first navigation) get the same
     *      treatment.
     *   3. Optionally patch the JSX runtime to strip radii from inline `style`
     *      props. Off by default: it runs on every element creation.
     *
     * Everything layer 1 touches is recorded so `onUnload` can put it back.
     *
     * NOTE: the loader evals this file as `vendetta=>{return <file>}`, so the
     * file must *start* with the expression — a leading comment would put a line
     * terminator after `return` and ASI would hand back undefined. Hence the
     * header living inside the IIFE. `vendetta` comes from the wrapper.
     */

    const { patcher, metro, storage: storageApi, ui, logger } = vendetta;
    const { React, ReactNative } = metro.common;
    const { StyleSheet, ScrollView } = ReactNative;
    const { showToast } = ui.toasts;
    const store = vendetta.plugin.storage;

    /* React Native's full set of corner-radius style props */
    const RADIUS_KEYS = new Set([
        'borderRadius',
        'borderTopLeftRadius',
        'borderTopRightRadius',
        'borderBottomLeftRadius',
        'borderBottomRightRadius',
        'borderTopStartRadius',
        'borderTopEndRadius',
        'borderBottomStartRadius',
        'borderBottomEndRadius',
        'borderStartStartRadius',
        'borderStartEndRadius',
        'borderEndStartRadius',
        'borderEndEndRadius',
    ]);

    /* Discord's design tokens keep their radii in objects under these keys */
    const TOKEN_KEYS = new Set(['radii', 'radius', 'borderRadii']);

    /* A radius this large is a pill or a circle, not a panel corner */
    const CIRCLE_THRESHOLD = 100;

    const MAX_DEPTH = 6;
    const MAX_VISITS = 400000;
    const MAX_UNDO = 50000;

    if (typeof store.keepCircles !== 'boolean') store.keepCircles = false;
    if (typeof store.patchInlineStyles !== 'boolean') store.patchInlineStyles = false;

    /** Recorded mutations: [object, key, originalValue]. */
    let undoLog = [];
    let unpatches = [];
    let visits = 0;

    /* ── zeroing ──────────────────────────────────────────────────────── */

    /** A value is a radius worth zeroing (respecting the keepCircles option). */
    function isZeroableRadius(value) {
        if (typeof value === 'number') {
            if (value === 0) return false;
            return !(store.keepCircles && value >= CIRCLE_THRESHOLD);
        }
        /* percentages are always circles/pills */
        if (typeof value === 'string' && value.endsWith('%')) return !store.keepCircles;
        return false;
    }

    function setZero(object, key, value) {
        try {
            object[key] = typeof value === 'string' ? '0%' : 0;
        } catch {
            return; /* frozen or getter-only; nothing to undo */
        }
        if (undoLog.length < MAX_UNDO) undoLog.push([object, key, value]);
    }

    /** Zero every numeric entry of a design-token radii object. */
    function zeroTokenObject(tokens) {
        if (!tokens || typeof tokens !== 'object') return;
        for (const key of Object.keys(tokens)) {
            let value;
            try {
                value = tokens[key];
            } catch {
                continue;
            }
            if (isZeroableRadius(value)) setZero(tokens, key, value);
        }
    }

    /**
     * Walk an arbitrary value looking for style objects and token maps.
     *
     * Enumerable getters are read (Discord's transpiled modules expose exports
     * that way) but always guarded — some throw, and a throwing export must not
     * take the whole sweep down.
     */
    function sweep(node, depth, seen) {
        if (!node || typeof node !== 'object') return;
        if (depth > MAX_DEPTH || visits > MAX_VISITS) return;
        if (seen.has(node)) return;
        seen.add(node);
        visits++;

        if (Array.isArray(node)) {
            for (const item of node) sweep(item, depth + 1, seen);
            return;
        }

        let keys;
        try {
            keys = Object.keys(node);
        } catch {
            return;
        }

        for (const key of keys) {
            let value;
            try {
                value = node[key];
            } catch {
                continue;
            }

            if (RADIUS_KEYS.has(key)) {
                if (isZeroableRadius(value)) setZero(node, key, value);
            } else if (TOKEN_KEYS.has(key)) {
                zeroTokenObject(value);
            } else if (value && typeof value === 'object') {
                sweep(value, depth + 1, seen);
            }
        }
    }

    /** Layer 1: every style object that already exists. */
    function sweepRegistry() {
        const modules = metro.modules;
        const seen = new WeakSet();
        visits = 0;
        let scanned = 0;

        for (const id in modules) {
            const module = modules[id];
            /* only initialized modules — forcing a require here would run
               module side effects at an arbitrary point in the app's life */
            if (!module || !module.isInitialized || module.hasError) continue;

            let exports;
            try {
                exports = module.publicModule && module.publicModule.exports;
            } catch {
                continue;
            }
            if (!exports || exports === globalThis) continue;

            sweep(exports, 0, seen);
            scanned++;
        }

        return { scanned, changed: undoLog.length };
    }

    /* ── inline styles (optional layer 3) ─────────────────────────────── */

    /** Copy-on-write: only allocates when the style actually carries a radius. */
    function stripStyle(style) {
        if (!style || typeof style !== 'object') return style;

        if (Array.isArray(style)) {
            let changed = false;
            const next = style.map((entry) => {
                const stripped = stripStyle(entry);
                if (stripped !== entry) changed = true;
                return stripped;
            });
            return changed ? next : style;
        }

        let clone = null;
        for (const key of RADIUS_KEYS) {
            if (!(key in style)) continue;
            const value = style[key];
            if (!isZeroableRadius(value)) continue;
            if (!clone) clone = Object.assign({}, style);
            clone[key] = typeof value === 'string' ? '0%' : 0;
        }
        return clone || style;
    }

    function patchInlineStyles() {
        const runtime = metro.findByProps('jsx', 'jsxs');
        if (!runtime) {
            logger.warn('could not find the JSX runtime; inline styles left alone');
            return;
        }

        for (const name of ['jsx', 'jsxs']) {
            if (typeof runtime[name] !== 'function') continue;
            unpatches.push(
                patcher.instead(name, runtime, (args, original) => {
                    const props = args[1];
                    if (props && props.style) {
                        const stripped = stripStyle(props.style);
                        /* props may be frozen, so replace rather than mutate */
                        if (stripped !== props.style) {
                            args[1] = Object.assign({}, props, { style: stripped });
                        }
                    }
                    return original(...args);
                })
            );
        }
    }

    /* ── lifecycle ────────────────────────────────────────────────────── */

    function apply() {
        const { scanned, changed } = sweepRegistry();
        logger.log(`unrounded ${changed} values across ${scanned} modules`);

        /* Layer 2: anything created from here on */
        unpatches.push(
            patcher.after('create', StyleSheet, (_args, styles) => {
                try {
                    visits = 0;
                    sweep(styles, 0, new WeakSet());
                } catch (error) {
                    logger.error('failed to unround a new stylesheet', error);
                }
                return styles;
            })
        );

        if (store.patchInlineStyles) patchInlineStyles();

        return { scanned, changed };
    }

    function revert() {
        for (const unpatch of unpatches) {
            try {
                unpatch();
            } catch {
                /* already unpatched */
            }
        }
        unpatches = [];

        /* restore in reverse so repeated writes to one key land back on the
           value it had before this plugin ever touched it */
        for (let i = undoLog.length - 1; i >= 0; i--) {
            const [object, key, value] = undoLog[i];
            try {
                object[key] = value;
            } catch {
                /* frozen since; nothing we can do */
            }
        }
        undoLog = [];
    }

    /* ── settings ─────────────────────────────────────────────────────── */

    function Settings() {
        const { FormSwitchRow, FormRow, FormDivider } = ui.components.Forms;
        storageApi.useProxy(store);

        const restart = (label) => {
            revert();
            const { changed } = apply();
            showToast(`${label} · ${changed} values unrounded`);
        };

        return React.createElement(
            ScrollView,
            null,
            React.createElement(FormSwitchRow, {
                label: 'Keep circles and pills round',
                subLabel:
                    'Leave radii of 100 or more alone, so avatars and pill buttons stay round. system24 squares these too.',
                value: store.keepCircles,
                onValueChange: (value) => {
                    store.keepCircles = value;
                    restart(value ? 'Circles kept round' : 'Everything squared');
                },
            }),
            React.createElement(FormDivider, null),
            React.createElement(FormSwitchRow, {
                label: 'Also strip inline styles',
                subLabel:
                    'Catches radii written directly in JSX instead of a stylesheet. More thorough, but runs on every element created.',
                value: store.patchInlineStyles,
                onValueChange: (value) => {
                    store.patchInlineStyles = value;
                    restart(value ? 'Inline styles patched' : 'Inline patch removed');
                },
            }),
            React.createElement(FormDivider, null),
            React.createElement(FormRow, {
                label: 'Re-run now',
                subLabel:
                    'Sweeps screens that have been opened since the plugin started. Reloading Discord is the thorough option.',
                onPress: () => restart('Swept again'),
            })
        );
    }

    return {
        onLoad() {
            apply();
        },
        onUnload() {
            revert();
        },
        settings: Settings,
    };
})()
