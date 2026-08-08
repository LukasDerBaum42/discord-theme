#!/usr/bin/env node
/**
 * Generates the Revenge theme JSON files from the system24 palettes.
 *
 * Output uses Vendetta manifest spec 2. Revenge also supports spec 3, but its
 * parser resolves spec 3's base reference theme from the top-level `type` field
 * (which is always "color"), so a spec 3 dark theme falls back to Discord's
 * *light* base for any token the manifest does not override. spec 2 resolves to
 * the dark base correctly and is understood by Revenge, Bunny, Pyoncord,
 * Vendetta and Enmity alike.
 *
 * Usage: node scripts/build.mjs
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fontPacks, themeFonts } from '../src/fonts.mjs';
import { buildColorMaps } from '../src/mapping.mjs';
import { palettes, resolvePalette } from '../src/palettes.mjs';
import { plugins } from '../src/plugins.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* refact0r designed the palettes; the port to Revenge's color tokens is ours */
const AUTHORS = [{ name: 'refact0r' }, { name: 'LukasDerBaum42' }];
const BASE_DESCRIPTION = 'a tui-style discord theme. ported from refact0r/system24.';

const themes = [
    {
        out: 'themes/system24.json',
        palette: 'monochrome-green',
        name: 'system24',
        description: `${BASE_DESCRIPTION} monochrome surfaces, teal accent.`,
    },
    {
        out: 'themes/system24-purple.json',
        palette: 'monochrome',
        name: 'system24 (purple)',
        description: `${BASE_DESCRIPTION} monochrome surfaces, purple accent (upstream default).`,
    },
    {
        out: 'themes/flavors/system24-catppuccin-mocha.json',
        palette: 'catppuccin-mocha',
        name: 'system24 (catppuccin mocha)',
        description: BASE_DESCRIPTION,
    },
    {
        out: 'themes/flavors/system24-tokyo-night.json',
        palette: 'tokyo-night',
        name: 'system24 (tokyo night)',
        description: BASE_DESCRIPTION,
    },
    {
        out: 'themes/flavors/system24-rose-pine.json',
        palette: 'rose-pine',
        name: 'system24 (rosé pine)',
        description: BASE_DESCRIPTION,
    },
    {
        out: 'themes/flavors/system24-nord.json',
        palette: 'nord',
        name: 'system24 (nord)',
        description: BASE_DESCRIPTION,
    },
    {
        out: 'themes/flavors/system24-everforest.json',
        palette: 'everforest',
        name: 'system24 (everforest)',
        description: BASE_DESCRIPTION,
    },
];

for (const theme of themes) {
    const palette = palettes[theme.palette];
    if (!palette) throw new Error(`unknown palette: ${theme.palette}`);

    const { semantic, raw } = buildColorMaps(resolvePalette(palette));

    const manifest = {
        name: theme.name,
        description: theme.description,
        authors: AUTHORS,
        spec: 2,
        /* spec 2 semantic values are [dark, light] tuples; these are dark-only */
        semanticColors: Object.fromEntries(
            Object.entries(semantic).map(([key, value]) => [key, [value]])
        ),
        rawColors: raw,
        /* not part of the color spec; Revenge's Fonts page offers to install
           these with one tap while the theme is selected */
        fonts: themeFonts,
    };

    write(theme.out, manifest);
    console.log(
        `${theme.out.padEnd(48)} ${Object.keys(semantic).length} semantic, ${Object.keys(raw).length} raw`
    );
}

for (const pack of fontPacks) {
    write(pack.out, {
        spec: 1,
        name: pack.name,
        description: pack.description,
        main: pack.main,
    });
    console.log(`${pack.out.padEnd(48)} ${Object.keys(pack.main).length} font entries`);
}

for (const plugin of plugins) {
    const script = readFileSync(join(root, plugin.dir, plugin.main), 'utf8');
    const hash = createHash('sha256').update(script).digest('hex').slice(0, 16);

    const manifest = {
        name: plugin.name,
        description: plugin.description,
        authors: plugin.authors,
        main: plugin.main,
        hash,
    };
    if (plugin.icon) manifest.vendetta = { icon: plugin.icon };

    write(join(plugin.dir, 'manifest.json'), manifest);
    console.log(`${join(plugin.dir, 'manifest.json').padEnd(48)} hash ${hash}`);
}

function write(relativePath, data) {
    const path = join(root, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(data, null, 4)}\n`);
}
