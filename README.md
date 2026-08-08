# system24 for Revenge

[refact0r/system24](https://github.com/refact0r/system24) — the tui-style Discord theme — ported to
[Revenge](https://github.com/revenge-mod/revenge-bundle) on Discord mobile.

The palettes are transcribed verbatim from the upstream CSS flavors and mapped onto Discord mobile's
color tokens. `themes/system24.json` matches the local Vesktop config
(`~/.config/vesktop/themes/system24.theme.css`): monochrome greyscale surfaces, teal accent.

## What carries over, and what can't

Revenge themes are **color maps in JSON** — two dictionaries of hex values, no CSS and no stylesheet
injection. So the port covers the palette and the flat, near-single-tone surface treatment, plus the
monospace font via a separate font pack. It cannot reproduce system24's layout work:

| system24 feature | mobile |
| --- | --- |
| color palette (all flavors) | ✅ ported |
| flat single-tone surfaces | ✅ ported (Discord's 3-step elevation ramp collapsed) |
| monospace UI + code font | ✅ via the font packs below |
| light body weight (`font-weight: 300`) | ✅ approximated — each weight slot maps one cut lighter |
| panel borders / `--border-thickness` | ❌ no CSS |
| square corners (`--unrounding`) | ✅ via the **plugin** below, not the theme |
| panel labels, ASCII titles, ASCII loader | ❌ no CSS |
| custom Spotify bar, top-bar tweaks | ❌ no CSS, and no such chrome on mobile |

The border look is partly faked by pushing `BORDER_*` and `BACKGROUND_MODIFIER_ACCENT` toward
system24's `--active`, which is as far as a color-only theme goes.

## Install

Revenge fetches themes over HTTP — there's no local-file import — so the JSON has to be reachable
from the phone.

1. Discord → **Settings → Revenge → Themes → `+`**
2. Paste:
   `https://raw.githubusercontent.com/LukasDerBaum42/discord-theme/main/themes/system24.json`
3. Select the theme, then **reload Discord** (Settings → Revenge → Reload).

Swap the filename for any other theme, e.g.
`.../main/themes/flavors/system24-nord.json`.

**From this machine, for testing:**

```sh
npm run serve            # prints LAN URLs to paste into Revenge
```

Revenge caches per URL, so add a changing query string (`?v=2`) after each rebuild, or remove and
re-add the theme.

### Font

The monospace font is the single biggest part of the system24 look, and it's a separate Revenge
feature from themes:

- **Settings → Revenge → Fonts → `+`** → paste
  `https://raw.githubusercontent.com/LukasDerBaum42/discord-theme/main/fonts/dm-mono.json`
  (system24's default) or `.../fonts/jetbrains-mono.json`, then select it and reload.
- Or, with a system24 theme already selected, the Fonts page offers **"extract fonts from theme"** —
  the theme manifests embed the DM Mono map for exactly this.

### Unrounding plugin

`--unrounding` needs code, not colors, so it ships as a plugin. Install the
**directory** URL (trailing slash matters — the loader resolves `manifest.json` against it):

**Settings → Revenge → Plugins → `+`** →
`https://raw.githubusercontent.com/LukasDerBaum42/discord-theme/main/plugins/unrounding/`

Then reload Discord. Screens already rendered keep their old corners until they re-render, which is
why a reload is the reliable way to see it.

Mobile has no `* { border-radius: 0 }`, and Discord rounds things in four different ways, so there
are four layers:

1. **Registry sweep** — walks Metro's module registry and zeroes every radius on every style object
   that already exists, in place. In-place mutation means components holding a reference pick it up
   on their next render, with no wrapper components and no re-render cost. Misses anything whose
   styles live in a closure rather than on module exports — which is most of the design system.
2. **`StyleSheet.create` patch** — Discord builds most screens' styles lazily on first navigation, so
   anything created after startup gets the same treatment.
3. **Element props** — patches every JSX runtime module (`jsx`/`jsxs`/`jsxDEV`) and
   `React.createElement`, stripping radii from every element's `style` prop as it renders. Results are
   memoized in a `WeakMap` keyed on the style object, so a repeat render is one lookup and the style
   keeps a stable identity (React's memoization is unaffected).
3b. **Native view props** — patches `ReactNativeAttributePayload`'s `create`/`diff`, the funnel every
   native view's props pass through on mount and update. This is the layer that does not care how the
   bundle was compiled: patching a module's exported function only affects callers that look the
   property up at call time, and anything that captured the reference when it first required the
   module keeps calling the original forever. Both sides of `diff` are sanitized identically, or the
   diff would report a change straight back to the rounded value.
4. **Masks** — **avatars and server icons aren't rounded by `borderRadius` at all**, they're masked,
   so no amount of style stripping touches them. This drops `mask`/`clipPath` props, zeroes SVG
   `rx`/`ry`, and swaps MaskedView for a plain View that renders its children unmasked.

Layers 1–2 record every mutation, so disabling the plugin restores the original radii; layers 3–4 are
pure patches and just stop applying.

Settings:

- **Square masked shapes** (on) — layer 4. Turn it off if a gradient or overlay looks wrong; mask
  dropping is deliberately broad.
- **Square design system components** (on) — layer 3.
- **Keep circles and pills round** (off) — leaves radii ≥ 100 alone *and* keeps masks intact, so
  avatars stay round. Off by default because system24 squares those too (upstream zeroes
  `--radius-round` as well).
- **Record what looks rounded** (off) — notes the shape-related props of every element rendered,
  handled or not.
- **Re-run now** — re-sweeps screens opened since startup.
- **Copy diagnostics** — puts the whole report on the clipboard.

### If something is still round

Guessing at mechanisms is worthless next to knowing which props Discord actually put on the element,
so the plugin can tell you:

1. Turn on **Record what looks rounded**.
2. Open the screen that's still round, and scroll it so the element renders.
3. Come back and hit **Copy diagnostics**.

The report lists which hooks were installed, how many jsx and native-payload modules were patched,
whether MaskedView resolved, the design system's live radius token values, counts of everything
changed, and — per component name — every prop whose name suggests a shape.

**Read `elements seen` first.** If it's 0, interception isn't working at all and nothing else in the
report means anything; if it's large while `style props` is 0, the hooks fire but the radii are coming
from somewhere else. Counters are cumulative for the session and survive a re-apply, so flipping a
setting doesn't discard what you gathered.

Deliberate non-fixes, both visible in that report:

- **Ambiguous props are recorded, never changed.** A bare `radius` prop could be a blur or shadow
  radius, so zeroing it on sight would break unrelated things. Only `borderRadius`, `cornerRadius`,
  `borderRadii` and Fresco's `roundAsCircle` are changed outright.
- **Native drawables are unreachable.** If a shape is drawn by Android rather than by React Native —
  a real possibility for parts of the chat list — no JS plugin can touch it, and the report will show
  no round-ish props on the element at all.

## Files

```
themes/system24.json                  monochrome + teal accent (matches the desktop config)
themes/system24-purple.json           monochrome + purple accent (upstream default)
themes/flavors/*.json                 catppuccin mocha, tokyo night, rosé pine, nord, everforest
fonts/dm-mono.json                    DM Mono font pack
fonts/jetbrains-mono.json             JetBrains Mono font pack
plugins/unrounding/                   the --unrounding plugin (index.js + generated manifest.json)
```

## Development

```sh
npm run build             # regenerate themes/, fonts/ and plugin manifests
npm run verify            # validate manifests, check every font URL resolves
npm run verify -- --offline
npm test                  # run the plugin against a mock Revenge API
```

- `src/palettes.mjs` — the system24 flavors, in system24's own `oklch()`/`hsl()` notation so they can
  be diffed against upstream. Add a flavor here, then register it in `scripts/build.mjs`.
- `src/mapping.mjs` — system24 role → Discord mobile token. This is where the porting decisions live
  (surface strategy, which raw palette steps get which shade).
- `src/color.mjs` — `oklch`/`hsl`/hex → hex, since Revenge only takes hex.
- `src/fonts.mjs`, `src/plugins.mjs` — font pack and plugin metadata.
- `plugins/unrounding/index.js` — hand-authored, shipped as-is. Only `manifest.json` is generated
  (its `hash` is what tells the loader to re-download the script).

Colors and manifests are generated; edit `src/`, not `themes/`.

### Writing plugin code for this loader

The Vendetta loader evals the script as `vendetta=>{return <file>}`, which has two consequences:

- The file must be a single **expression** — hence the one big IIFE — and `vendetta` is in scope from
  the wrapper.
- The file must **start** with `(`. A leading comment or blank line puts a line terminator right
  after `return`, ASI closes the statement, and the plugin loads as `undefined` with no error. Both
  are checked by `npm run verify`.

No bundler is involved, so there's no JSX; the settings component uses `React.createElement`.

### Notes on the manifest format

Output is **Vendetta manifest spec 2**, not Revenge's newer spec 3. Revenge's parser derives spec 3's
base reference theme from the manifest's top-level `type` field, which is always the literal
`"color"` — so a spec 3 dark theme falls back to Discord's *light* base for any token the manifest
doesn't override ([parser.ts](https://github.com/revenge-mod/revenge-bundle/blob/main/src/lib/addons/themes/colors/parser.ts)).
Spec 2 resolves to the dark base correctly and is also understood by Bunny, Pyoncord, Vendetta and
Enmity.

Both dictionaries are populated on purpose: large parts of the Discord Android UI read `rawColors`
(Discord's palette steps) directly and never consult the semantic tokens.

## Credits

system24 by [refact0r](https://github.com/refact0r) (MIT). This is only a port of its palettes to a
different client mod.
