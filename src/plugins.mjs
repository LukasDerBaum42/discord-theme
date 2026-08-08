/**
 * Plugin metadata.
 *
 * Revenge accepts two plugin formats. This uses the Vendetta "polymanifest"
 * format — a directory URL containing `manifest.json` plus the `main` script —
 * because it installs from a single URL. Revenge's own spec 3 format requires
 * publishing a whole repository (`repo.json` + `builds/<id>/...`), which is
 * overkill for one plugin.
 *
 * `hash` is what the loader compares to decide whether to re-download the
 * script, so the build fills it with a content hash of the script itself.
 */

export const plugins = [
    {
        dir: 'plugins/unrounding',
        main: 'index.js',
        name: 'system24 unrounding',
        description:
            "Squares off Discord's rounded corners, the mobile counterpart to system24's --unrounding option.",
        authors: [{ name: 'LukasDerBaum42' }],
    },
];
