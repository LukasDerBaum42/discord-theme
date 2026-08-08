#!/usr/bin/env node
/**
 * Serves this directory over HTTP so the phone can install the theme.
 *
 * Revenge installs themes and fonts by URL only — there is no "open local file"
 * path — so during development the file has to be reachable from the device.
 * Prints the LAN URLs to paste into Revenge.
 *
 * Usage: node scripts/serve.mjs [port]
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] ?? 8724);

const server = createServer((req, res) => {
    const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const path = join(root, rel);

    if (!path.startsWith(root) || !existsSync(path) || statSync(path).isDirectory()) {
        res.writeHead(404).end('not found');
        return;
    }

    res.writeHead(200, {
        'content-type': path.endsWith('.js')
            ? 'application/javascript; charset=utf-8'
            : 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    createReadStream(path).pipe(res);
});

server.listen(port, () => {
    const addresses = Object.values(networkInterfaces())
        .flat()
        .filter((i) => i.family === 'IPv4' && !i.internal)
        .map((i) => i.address);

    console.log(`serving ${root} on port ${port}\n`);
    for (const address of [...addresses, 'localhost']) {
        console.log(`  theme:   http://${address}:${port}/themes/system24.json`);
        console.log(`  font:    http://${address}:${port}/fonts/dm-mono.json`);
        console.log(`  plugin:  http://${address}:${port}/plugins/unrounding/`);
    }
    console.log('\nRevenge caches by URL, so bump a query string (?v=2) after rebuilding.');
});
