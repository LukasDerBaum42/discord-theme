#!/usr/bin/env node
/**
 * Sanity-checks the generated output:
 *   - every manifest parses and satisfies Revenge's validateTheme/validateFont
 *   - every color is a hex string Revenge's normalizeToHex will accept
 *   - every font URL actually resolves (HEAD 200) and ends in .ttf/.otf
 *
 * Usage: node scripts/verify.mjs [--offline]
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { plugins } from '../src/plugins.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const offline = process.argv.includes('--offline');

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;
let failures = 0;

function fail(file, message) {
    console.error(`FAIL ${file}: ${message}`);
    failures++;
}

function jsonFiles(dir) {
    const out = [];
    for (const entry of readdirSync(join(root, dir))) {
        const rel = join(dir, entry);
        if (statSync(join(root, rel)).isDirectory()) out.push(...jsonFiles(rel));
        else if (entry.endsWith('.json')) out.push(rel);
    }
    return out;
}

/* ── themes ──────────────────────────────────────────────────────────── */
const themeFiles = jsonFiles('themes');
for (const file of themeFiles) {
    const theme = JSON.parse(readFileSync(join(root, file), 'utf8'));

    if (theme.spec !== 2 && theme.spec !== 3) fail(file, `bad spec: ${theme.spec}`);
    if (!theme.name) fail(file, 'missing name');

    for (const [key, values] of Object.entries(theme.semanticColors ?? {})) {
        if (!Array.isArray(values)) fail(file, `${key}: semantic value must be an array`);
        else if (!HEX.test(values[0])) fail(file, `${key}: not a hex color (${values[0]})`);
    }
    for (const [key, value] of Object.entries(theme.rawColors ?? {})) {
        if (!HEX.test(value)) fail(file, `${key}: not a hex color (${value})`);
    }
}

/* ── font packs ──────────────────────────────────────────────────────── */
const fontFiles = jsonFiles('fonts');
const urls = new Set();
for (const file of fontFiles) {
    const pack = JSON.parse(readFileSync(join(root, file), 'utf8'));

    if (pack.spec !== 1) fail(file, `font packs must be spec 1, got ${pack.spec}`);
    if (!pack.name || !pack.main) fail(file, 'missing name or main');
    if (pack.name?.startsWith('__')) fail(file, 'font name cannot start with __');

    for (const [slot, url] of Object.entries(pack.main ?? {})) {
        if (!/\.(ttf|otf)$/.test(url)) fail(file, `${slot}: url must end in .ttf or .otf`);
        urls.add(url);
    }
}

/* ── plugins ─────────────────────────────────────────────────────────── */
for (const plugin of plugins) {
    const manifestPath = join(plugin.dir, 'manifest.json');
    const scriptPath = join(plugin.dir, plugin.main);
    const manifest = JSON.parse(readFileSync(join(root, manifestPath), 'utf8'));
    const script = readFileSync(join(root, scriptPath), 'utf8');

    for (const field of ['name', 'description', 'authors', 'main', 'hash']) {
        if (!manifest[field]) fail(manifestPath, `missing ${field}`);
    }
    if (manifest.main !== plugin.main) fail(manifestPath, 'main does not match the script');

    const hash = createHash('sha256').update(script).digest('hex').slice(0, 16);
    if (manifest.hash !== hash) fail(manifestPath, 'stale hash — run npm run build');

    /* Revenge evals the script as `vendetta=>{return <script>}`, so it has to be
       a single expression. Compiling it here catches a syntax error before the
       phone silently disables the plugin. */
    try {
        new Function('vendetta', `return ${script}`);
    } catch (e) {
        fail(scriptPath, `not a valid expression: ${e.message}`);
    }

    /* ...and it must start with the expression. A leading comment or blank line
       puts a line terminator after the wrapper's `return`, ASI closes the
       statement, and the plugin loads as undefined. */
    if (!script.startsWith('(')) {
        fail(scriptPath, 'must begin with "(" — a leading comment breaks the loader via ASI');
    }
}

/* theme-embedded font maps share the same URL pool */
for (const file of themeFiles) {
    const theme = JSON.parse(readFileSync(join(root, file), 'utf8'));
    for (const url of Object.values(theme.fonts ?? {})) urls.add(url);
}

if (!offline) {
    const results = await Promise.all(
        [...urls].map(async (url) => {
            try {
                const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
                return [url, res.status];
            } catch (e) {
                return [url, e.message];
            }
        })
    );
    for (const [url, status] of results) {
        if (status !== 200) fail('fonts', `${status} for ${url}`);
    }
    console.log(`checked ${urls.size} font urls`);
}

console.log(
    `${themeFiles.length} themes, ${fontFiles.length} font packs, ${failures} failure(s)`
);
process.exit(failures ? 1 : 0);
