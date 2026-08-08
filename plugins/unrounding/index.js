(() => {
    /**
     * system24 unrounding — squares off Discord mobile's rounded corners.
     *
     * The desktop theme does this with one CSS rule (`* { border-radius: 0 }`,
     * see src/unrounding.css upstream). Mobile has no CSS, so corners have to be
     * taken away at four different places, because Discord rounds things in four
     * different ways:
     *
     *   1. REGISTRY SWEEP — walk Metro's module registry and zero every radius
     *      on every style object that already exists, in place. Cheap, and
     *      components holding a reference pick it up on their next render.
     *      Misses anything whose styles live in a closure rather than on module
     *      exports, which is most of Discord's design system.
     *   2. StyleSheet.create — catches stylesheets built after startup (Discord
     *      builds most screens' styles lazily, on first navigation).
     *   3. ELEMENT PROPS — patch the JSX runtime and `React.createElement` and
     *      strip radii from the `style` prop of every element. This is the
     *      catch-all: however a radius was authored, it arrives here. Design
     *      system components (option groups, cards, buttons) need this one.
     *   4. MASKS — avatars and server icons aren't rounded by `borderRadius` at
     *      all; they're masked, so no amount of style stripping touches them.
     *      This drops `mask`/`clipPath` props, zeroes SVG `rx`/`ry`, and swaps
     *      MaskedView for a plain View that renders its children unmasked.
     *
     * Everything layers 1 and 2 touch is recorded, so `onUnload` puts it back.
     * Layers 3 and 4 are pure patches and simply stop applying.
     *
     * NOTE: the loader evals this file as `vendetta=>{return <file>}`, so the
     * file must *start* with the expression — a leading comment would put a line
     * terminator after `return` and ASI would hand back undefined. Hence the
     * header living inside the IIFE. `vendetta` comes from the wrapper.
     */

    const { patcher, metro, storage: storageApi, ui, logger } = vendetta;
    const { React, ReactNative } = metro.common;
    const { StyleSheet, ScrollView, View } = ReactNative;
    const { showToast } = ui.toasts;
    const store = vendetta.plugin.storage;

    /* React Native's full set of corner-radius style props */
    const RADIUS_KEYS = [
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
    ];
    const RADIUS_KEY_SET = new Set(RADIUS_KEYS);

    /* Discord's design tokens keep their radii in objects under these keys */
    const TOKEN_KEYS = new Set(['radii', 'radius', 'borderRadii']);

    /* Props that mask an element into a shape instead of rounding it */
    const MASK_PROPS = ['mask', 'clipPath'];

    /* A radius this large is a pill or a circle, not a panel corner */
    const CIRCLE_THRESHOLD = 100;

    const MAX_DEPTH = 6;
    const MAX_VISITS = 400000;
    const MAX_UNDO = 50000;

    /* Bumped when defaults change, so an existing install picks them up */
    const CONFIG_VERSION = 2;
    if (store.configVersion !== CONFIG_VERSION) {
        store.keepCircles = store.keepCircles === true;
        store.stripElementStyles = true;
        store.squareMasks = true;
        store.configVersion = CONFIG_VERSION;
        /* v1's name for what is now stripElementStyles, and it defaulted off */
        if ('patchInlineStyles' in store) delete store.patchInlineStyles;
    }

    /** Recorded mutations: [object, key, originalValue]. */
    let undoLog = [];
    let unpatches = [];
    let visits = 0;

    /** Memoized style stripping, so repeat renders don't re-clone. */
    let styleCache = new WeakMap();

    let stats = {};
    const resetStats = () => {
        stats = {
            modules: 0,
            sweptValues: 0,
            styleProps: 0,
            masksDropped: 0,
            maskedViews: 0,
            hooks: [],
        };
    };
    resetStats();

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

    const zeroFor = (value) => (typeof value === 'string' ? '0%' : 0);

    function setZero(object, key, value) {
        try {
            object[key] = zeroFor(value);
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

            if (RADIUS_KEY_SET.has(key)) {
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
            stats.modules++;
        }

        stats.sweptValues = undoLog.length;
    }

    /* ── layer 3/4: element props ─────────────────────────────────────── */

    /** Copy-on-write, memoized: only allocates when there is a radius to remove. */
    function stripStyle(style) {
        if (!style || typeof style !== 'object') return style;

        const cached = styleCache.get(style);
        if (cached !== undefined) return cached;

        let result = style;

        if (Array.isArray(style)) {
            let changed = false;
            const next = style.map((entry) => {
                const stripped = stripStyle(entry);
                if (stripped !== entry) changed = true;
                return stripped;
            });
            if (changed) result = next;
        } else {
            let clone = null;
            for (const key of RADIUS_KEYS) {
                const value = style[key];
                if (value === undefined || !isZeroableRadius(value)) continue;
                if (!clone) clone = Object.assign({}, style);
                clone[key] = zeroFor(value);
            }
            if (clone) result = clone;
        }

        /* caching the identity result matters as much as caching the clone: it
           turns every later render of an unrounded style into one map lookup */
        styleCache.set(style, result);
        return result;
    }

    /**
     * Rewrite an element's props. Returns the same object when there is nothing
     * to change, so React's identity checks are unaffected.
     */
    function transformProps(props) {
        if (!props || typeof props !== 'object') return props;

        let next = props;
        const edit = () => {
            if (next === props) next = Object.assign({}, props);
            return next;
        };

        if (store.stripElementStyles && props.style) {
            const stripped = stripStyle(props.style);
            if (stripped !== props.style) {
                edit().style = stripped;
                stats.styleProps++;
            }
        }

        if (store.squareMasks && !store.keepCircles) {
            for (const key of MASK_PROPS) {
                if (props[key] === undefined || props[key] === null) continue;
                delete edit()[key];
                stats.masksDropped++;
            }
            /* rounded corners of an SVG <Rect>, which is how a squircle mask is
               usually drawn */
            for (const key of ['rx', 'ry']) {
                const value = props[key];
                if (value === undefined || value === null || value === 0) continue;
                edit()[key] = 0;
            }
        }

        return next;
    }

    /** Renders MaskedView's children with no mask applied. */
    function UnmaskedView(props) {
        return React.createElement(View, { style: props.style }, props.children);
    }

    /** MaskedView is what gives avatars their status-notch cutout. */
    function findMaskedView() {
        const attempts = [
            () => metro.findByName('MaskedView'),
            () => metro.findByDisplayName('MaskedView'),
            () => {
                const module = metro.findByProps('MaskedViewIOS');
                return module && module.MaskedViewIOS;
            },
        ];

        for (const attempt of attempts) {
            try {
                const found = attempt();
                if (typeof found === 'function' || (found && typeof found === 'object')) {
                    return found;
                }
            } catch {
                /* finder threw; try the next one */
            }
        }
        return null;
    }

    function patchElementCreation() {
        const maskedView = store.squareMasks ? findMaskedView() : null;
        if (store.squareMasks) {
            stats.hooks.push(maskedView ? 'MaskedView found' : 'MaskedView NOT found');
        }

        const rewrite = (args) => {
            if (maskedView && args[0] === maskedView) {
                args[0] = UnmaskedView;
                stats.maskedViews++;
            }
            const props = transformProps(args[1]);
            if (props !== args[1]) args[1] = props;
            return args;
        };

        /* the automatic JSX runtime, which is what Discord's bundle compiles to */
        const runtime = metro.findByProps('jsx', 'jsxs');
        if (runtime) {
            for (const name of ['jsx', 'jsxs']) {
                if (typeof runtime[name] !== 'function') continue;
                unpatches.push(
                    patcher.instead(name, runtime, (args, original) => original(...rewrite(args)))
                );
                stats.hooks.push(name);
            }
        } else {
            logger.warn('JSX runtime not found');
        }

        /* the classic runtime, still used by plugins and older screens */
        if (React && typeof React.createElement === 'function') {
            unpatches.push(
                patcher.instead('createElement', React, (args, original) => original(...rewrite(args)))
            );
            stats.hooks.push('createElement');
        }
    }

    /* ── lifecycle ────────────────────────────────────────────────────── */

    function apply() {
        resetStats();
        styleCache = new WeakMap();

        sweepRegistry();

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

        if (store.stripElementStyles || store.squareMasks) patchElementCreation();

        logger.log(
            `swept ${stats.sweptValues} radii across ${stats.modules} modules; hooks: ${
                stats.hooks.join(', ') || 'none'
            }`
        );
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
        styleCache = new WeakMap();

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

    function reapply() {
        revert();
        apply();
    }

    /* ── settings ─────────────────────────────────────────────────────── */

    function Settings() {
        const { FormSwitchRow, FormRow, FormDivider } = ui.components.Forms;
        storageApi.useProxy(store);

        const toggle = (key, label) => (value) => {
            store[key] = value;
            reapply();
            showToast(label);
        };

        return React.createElement(
            ScrollView,
            null,
            React.createElement(FormSwitchRow, {
                label: 'Square masked shapes',
                subLabel:
                    'Avatars and server icons are masked, not rounded, so this is what squares them. Turn off if a gradient or overlay looks wrong.',
                value: store.squareMasks,
                onValueChange: toggle('squareMasks', 'Masks updated · reload to apply fully'),
            }),
            React.createElement(FormDivider, null),
            React.createElement(FormSwitchRow, {
                label: 'Square design system components',
                subLabel:
                    'Strips radii from every element as it renders. Needed for option groups, cards and buttons, whose styles a sweep cannot reach.',
                value: store.stripElementStyles,
                onValueChange: toggle('stripElementStyles', 'Element styles updated'),
            }),
            React.createElement(FormDivider, null),
            React.createElement(FormSwitchRow, {
                label: 'Keep circles and pills round',
                subLabel:
                    'Leaves radii of 100 or more alone and keeps masks intact, so avatars stay round. system24 squares these too.',
                value: store.keepCircles,
                onValueChange: toggle('keepCircles', 'Circle handling updated'),
            }),
            React.createElement(FormDivider, null),
            React.createElement(FormRow, {
                label: 'Re-run now',
                subLabel: 'Sweeps screens opened since the plugin started.',
                onPress: () => {
                    reapply();
                    showToast(`${stats.sweptValues} radii swept`);
                },
            }),
            React.createElement(FormDivider, null),
            React.createElement(FormRow, {
                label: 'Show what it hooked',
                subLabel:
                    'If something is still round, this says which mechanisms were found — useful in a bug report.',
                onPress: () => {
                    const summary =
                        `hooks: ${stats.hooks.join(', ') || 'none'} · ` +
                        `${stats.sweptValues} swept · ${stats.styleProps} style props · ` +
                        `${stats.masksDropped} masks · ${stats.maskedViews} MaskedViews`;
                    logger.log(summary);
                    showToast(summary);
                },
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
