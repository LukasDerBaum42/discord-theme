/**
 * system24 palettes, transcribed verbatim from the CSS flavors.
 *
 * Values use system24's own notation (`oklch()`, `hsl()`, hex, `var(--x)`) so
 * they can be diffed against upstream:
 *   https://github.com/refact0r/system24/tree/main/theme
 *
 * `resolvePalette()` flattens the `var()` references and converts everything to
 * hex. Keys mirror the CSS variable names minus the leading `--`.
 */

import { parseColor } from './color.mjs';

/* Shared by every flavor: roles system24 derives rather than picks. */
const shared = {
    'accent-new': 'var(--red-2)',
    online: 'var(--green-2)',
    dnd: 'var(--red-2)',
    idle: 'var(--yellow-2)',
    streaming: 'var(--purple-2)',
    offline: 'var(--text-4)',
    'border-light': 'var(--hover)',
    border: 'var(--active)',
    'border-hover': 'var(--accent-2)',
    'button-border': 'hsla(0, 0%, 100%, 0.1)',
};

/* The upstream default: neutral greyscale surfaces, purple accent. */
const monochrome = {
    ...shared,

    'text-0': 'var(--bg-4)',
    'text-1': 'oklch(95% 0 0)',
    'text-2': 'oklch(85% 0 0)',
    'text-3': 'oklch(75% 0 0)',
    'text-4': 'oklch(60% 0 0)',
    'text-5': 'oklch(40% 0 0)',

    'bg-1': 'oklch(31% 0 0)',
    'bg-2': 'oklch(27% 0 0)',
    'bg-3': 'oklch(23% 0 0)',
    'bg-4': 'oklch(19% 0 0)',
    hover: 'oklch(54% 0 0 / 0.1)',
    active: 'oklch(54% 0 0 / 0.2)',
    'active-2': 'oklch(54% 0 0 / 0.3)',
    'message-hover': 'var(--hover)',

    'accent-1': 'var(--purple-1)',
    'accent-2': 'var(--purple-2)',
    'accent-3': 'var(--purple-3)',
    'accent-4': 'var(--purple-4)',
    'accent-5': 'var(--purple-5)',

    'red-1': 'oklch(75% 0.13 0)',
    'red-2': 'oklch(70% 0.13 0)',
    'red-3': 'oklch(65% 0.13 0)',
    'red-4': 'oklch(60% 0.13 0)',
    'red-5': 'oklch(55% 0.13 0)',

    'green-1': 'oklch(75% 0.12 170)',
    'green-2': 'oklch(70% 0.12 170)',
    'green-3': 'oklch(65% 0.12 170)',
    'green-4': 'oklch(60% 0.12 170)',
    'green-5': 'oklch(55% 0.12 160)',

    'blue-1': 'oklch(75% 0.11 215)',
    'blue-2': 'oklch(70% 0.11 215)',
    'blue-3': 'oklch(65% 0.11 215)',
    'blue-4': 'oklch(60% 0.11 215)',
    'blue-5': 'oklch(55% 0.11 215)',

    'yellow-1': 'oklch(80% 0.12 90)',
    'yellow-2': 'oklch(75% 0.12 90)',
    'yellow-3': 'oklch(70% 0.12 90)',
    'yellow-4': 'oklch(65% 0.12 90)',
    'yellow-5': 'oklch(60% 0.12 90)',

    'purple-1': 'oklch(75% 0.12 310)',
    'purple-2': 'oklch(70% 0.12 310)',
    'purple-3': 'oklch(65% 0.12 310)',
    'purple-4': 'oklch(60% 0.12 310)',
    'purple-5': 'oklch(55% 0.12 310)',
};

/* Matches ~/.config/vesktop/themes/system24.theme.css: teal/green accent. */
const monochromeGreen = {
    ...monochrome,
    'accent-1': 'var(--green-1)',
    'accent-2': 'var(--green-2)',
    'accent-3': 'var(--green-3)',
    'accent-4': 'var(--green-4)',
    'accent-5': 'var(--green-5)',
    streaming: 'var(--green-2)',
};

const catppuccinMocha = {
    ...shared,
    'accent-new': 'var(--accent-2)',
    streaming: 'var(--purple-2)',

    'text-0': 'var(--bg-3)',
    'text-1': 'hsl(226, 64%, 95%)',
    'text-2': '#cdd6f4',
    'text-3': '#bac2de',
    'text-4': '#7f849c',
    'text-5': '#585b70',

    'bg-1': '#45475a',
    'bg-2': '#313244',
    'bg-3': '#181825',
    'bg-4': '#1e1e2e',
    hover: 'hsla(235, 15%, 53%, 0.1)',
    active: 'hsla(235, 15%, 53%, 0.2)',
    'active-2': 'hsla(235, 15%, 53%, 0.3)',
    'message-hover': 'hsla(235, 0%, 0%, 0.1)',

    'accent-1': 'var(--purple-1)',
    'accent-2': 'var(--purple-2)',
    'accent-3': 'var(--purple-3)',
    'accent-4': 'var(--purple-4)',
    'accent-5': 'var(--purple-5)',

    'red-1': 'hsl(343, 81%, 80%)',
    'red-2': 'hsl(343, 81%, 75%)',
    'red-3': 'hsl(343, 81%, 75%)',
    'red-4': 'hsl(343, 81%, 70%)',
    'red-5': 'hsl(343, 81%, 65%)',

    'green-1': 'hsl(115, 54%, 81%)',
    'green-2': 'hsl(115, 54%, 76%)',
    'green-3': 'hsl(115, 54%, 76%)',
    'green-4': 'hsl(115, 54%, 71%)',
    'green-5': 'hsl(115, 54%, 66%)',

    'blue-1': 'hsl(199, 76%, 74%)',
    'blue-2': 'hsl(199, 76%, 69%)',
    'blue-3': 'hsl(199, 76%, 69%)',
    'blue-4': 'hsl(199, 76%, 64%)',
    'blue-5': 'hsl(199, 76%, 59%)',

    'yellow-1': 'hsl(41, 86%, 88%)',
    'yellow-2': 'hsl(41, 86%, 83%)',
    'yellow-3': 'hsl(41, 86%, 83%)',
    'yellow-4': 'hsl(41, 86%, 78%)',
    'yellow-5': 'hsl(41, 86%, 73%)',

    'purple-1': 'hsl(267, 84%, 86%)',
    'purple-2': 'hsl(267, 84%, 81%)',
    'purple-3': 'hsl(267, 84%, 81%)',
    'purple-4': 'hsl(267, 84%, 76%)',
    'purple-5': 'hsl(267, 84%, 71%)',
};

const tokyoNight = {
    ...shared,
    'accent-new': 'var(--accent-2)',

    'text-0': 'var(--bg-3)',
    'text-1': 'hsl(229, 73%, 95%)',
    'text-2': '#c0caf5',
    'text-3': '#a9b1d6',
    'text-4': 'hsl(229, 21%, 54%)',
    'text-5': '#414868',

    'bg-1': 'hsl(230, 22%, 25%)',
    'bg-2': 'hsl(230, 21%, 19%)',
    'bg-3': '#16161d',
    'bg-4': '#1a1b26',
    hover: 'hsla(225, 22%, 41%, 0.125)',
    active: 'hsla(225, 22%, 41%, 0.267)',
    'active-2': 'hsla(225, 22%, 41%, 0.333)',
    'message-hover': 'var(--hover)',

    'accent-1': 'var(--blue-1)',
    'accent-2': 'var(--blue-2)',
    'accent-3': 'var(--blue-3)',
    'accent-4': 'var(--blue-4)',
    'accent-5': 'var(--blue-5)',

    'red-1': 'hsl(349, 99%, 78%)',
    'red-2': 'hsl(349, 89%, 72%)',
    'red-3': 'hsl(349, 79%, 66%)',
    'red-4': 'hsl(349, 69%, 60%)',
    'red-5': 'hsl(349, 59%, 54%)',

    'green-1': 'hsl(89, 56%, 67%)',
    'green-2': 'hsl(89, 51%, 61%)',
    'green-3': 'hsl(89, 46%, 56%)',
    'green-4': 'hsl(89, 41%, 51%)',
    'green-5': 'hsl(89, 36%, 46%)',

    'blue-1': 'hsl(221, 99%, 78%)',
    'blue-2': 'hsl(221, 89%, 72%)',
    'blue-3': 'hsl(221, 79%, 66%)',
    'blue-4': 'hsl(221, 69%, 60%)',
    'blue-5': 'hsl(221, 59%, 54%)',

    'yellow-1': 'hsl(36, 71%, 72%)',
    'yellow-2': 'hsl(36, 66%, 64%)',
    'yellow-3': 'hsl(36, 61%, 59%)',
    'yellow-4': 'hsl(36, 56%, 54%)',
    'yellow-5': 'hsl(36, 51%, 49%)',

    'purple-1': 'hsl(261, 95%, 85%)',
    'purple-2': 'hsl(261, 85%, 79%)',
    'purple-3': 'hsl(261, 75%, 73%)',
    'purple-4': 'hsl(261, 65%, 67%)',
    'purple-5': 'hsl(261, 55%, 61%)',
};

const rosePine = {
    ...shared,

    'text-0': 'var(--bg-3)',
    'text-1': 'hsl(245, 50%, 95%)',
    'text-2': 'hsl(245, 50%, 91%)',
    'text-3': 'hsl(246, 30%, 80%)',
    'text-4': 'hsl(248, 15%, 61%)',
    'text-5': 'hsl(249, 12%, 47%)',

    'bg-1': 'hsl(248, 25%, 24%)',
    'bg-2': 'hsl(248, 25%, 18%)',
    'bg-3': 'hsl(247, 23%, 15%)',
    'bg-4': 'hsl(249, 22%, 12%)',
    hover: 'hsla(250, 20%, 40%, 0.1)',
    active: 'hsla(250, 20%, 40%, 0.2)',
    'active-2': 'hsla(250, 20%, 40%, 0.3)',
    'message-hover': 'hsla(250, 0%, 0%, 0.1)',

    'accent-1': 'hsl(2, 65%, 88%)',
    'accent-2': '#ebbcba',
    'accent-3': '#ebbcba',
    'accent-4': 'hsl(2, 55%, 78%)',
    'accent-5': 'hsl(2, 55%, 73%)',

    'red-1': 'hsl(343, 76%, 73%)',
    'red-2': '#eb6f92',
    'red-3': '#eb6f92',
    'red-4': 'hsl(343, 76%, 63%)',
    'red-5': 'hsl(343, 76%, 58%)',

    'green-1': 'hsl(197, 49%, 43%)',
    'green-2': '#31748f',
    'green-3': '#31748f',
    'green-4': 'hsl(197, 49%, 34%)',
    'green-5': 'hsl(197, 49%, 30%)',

    'blue-1': 'hsl(189, 48%, 78%)',
    'blue-2': '#9ccfd8',
    'blue-3': '#9ccfd8',
    'blue-4': 'hsl(189, 43%, 68%)',
    'blue-5': 'hsl(189, 43%, 63%)',

    'yellow-1': 'hsl(35, 88%, 77%)',
    'yellow-2': '#f6c177',
    'yellow-3': '#f6c177',
    'yellow-4': 'hsl(35, 88%, 67%)',
    'yellow-5': 'hsl(35, 88%, 62%)',

    'purple-1': 'hsl(267, 57%, 83%)',
    'purple-2': '#c4a7e7',
    'purple-3': '#c4a7e7',
    'purple-4': 'hsl(267, 57%, 73%)',
    'purple-5': 'hsl(267, 57%, 68%)',
};

const nord = {
    ...shared,
    'accent-new': 'var(--accent-2)',

    'text-0': 'var(--bg-3)',
    'text-1': '#eceff4',
    'text-2': '#e5e9f0',
    'text-3': '#d8dee9',
    'text-4': 'hsl(220, 20%, 67%)',
    'text-5': '#4c566a',

    'bg-1': '#434c5e',
    'bg-2': '#3b4252',
    'bg-3': '#272b35',
    'bg-4': '#2e3440',
    hover: 'hsla(220, 20%, 50%, 0.1)',
    active: 'hsla(220, 20%, 50%, 0.2)',
    'active-2': 'hsla(220, 20%, 50%, 0.3)',
    'message-hover': 'hsla(0, 0%, 0%, 0.1)',

    'accent-1': 'var(--blue-1)',
    'accent-2': 'var(--blue-2)',
    'accent-3': 'var(--blue-3)',
    'accent-4': 'var(--blue-4)',
    'accent-5': 'var(--blue-5)',

    'red-1': 'hsl(354, 42%, 61%)',
    'red-2': '#bf616a',
    'red-3': '#bf616a',
    'red-4': 'hsl(354, 42%, 51%)',
    'red-5': 'hsl(354, 42%, 46%)',

    'green-1': 'hsl(92, 28%, 70%)',
    'green-2': '#a3be8c',
    'green-3': '#a3be8c',
    'green-4': 'hsl(92, 28%, 60%)',
    'green-5': 'hsl(92, 28%, 55%)',

    'blue-1': 'hsl(193, 43%, 72%)',
    'blue-2': '#88c0d0',
    'blue-3': '#88c0d0',
    'blue-4': 'hsl(193, 43%, 62%)',
    'blue-5': 'hsl(193, 43%, 57%)',

    'yellow-1': 'hsl(40, 71%, 78%)',
    'yellow-2': '#ebcb8b',
    'yellow-3': '#ebcb8b',
    'yellow-4': 'hsl(40, 71%, 68%)',
    'yellow-5': 'hsl(40, 71%, 63%)',

    'purple-1': 'hsl(311, 20%, 68%)',
    'purple-2': '#b48ead',
    'purple-3': '#b48ead',
    'purple-4': 'hsl(311, 20%, 58%)',
    'purple-5': 'hsl(311, 20%, 53%)',
};

const everforest = {
    ...shared,
    streaming: 'var(--purple-2)',

    'text-0': 'var(--bg-4)',
    'text-1': 'oklch(0.9 0.0405 86.05)',
    'text-2': 'oklch(0.83 0.0405 86.05)',
    'text-3': 'oklch(0.83 0.0405 86.05)',
    'text-4': 'oklch(0.7 0.0405 86.05)',
    'text-5': 'var(--green-5)',

    'bg-1': 'oklch(0.39 0.0166 226.98)',
    'bg-2': 'oklch(0.36 0.0169 227.06)',
    'bg-3': 'oklch(0.28 0.0123 232.92)',
    'bg-4': 'oklch(0.32 0.0153 240.42)',
    hover: 'var(--bg-2)',
    active: 'var(--bg-1)',
    'active-2': 'oklch(0.43 0.0172 231.6)',
    'message-hover': 'var(--hover)',

    'accent-1': 'var(--green-1)',
    'accent-2': 'var(--green-2)',
    'accent-3': 'var(--green-3)',
    'accent-4': 'var(--green-4)',
    'accent-5': 'var(--green-5)',

    'red-1': 'oklch(0.71 0.1285 19.62)',
    'red-2': 'var(--red-1)',
    'red-3': 'var(--red-1)',
    'red-4': 'oklch(0.55 0.1285 19.62)',
    'red-5': 'oklch(0.38 0.0425 345.78)',

    'green-1': 'oklch(0.77 0.0906 125.78)',
    'green-2': 'var(--green-1)',
    'green-3': 'var(--green-1)',
    'green-4': 'oklch(0.6 0.0906 125.78)',
    'green-5': 'oklch(0.42 0.0231 157.06)',

    'blue-1': 'oklch(0.75 0.0631 185.49)',
    'blue-2': 'var(--blue-1)',
    'blue-3': 'var(--blue-1)',
    'blue-4': 'oklch(0.6 0.0631 185.49)',
    'blue-5': 'oklch(0.42 0.0345 231.32)',

    'yellow-1': 'oklch(0.81 0.0863 83.7)',
    'yellow-2': 'var(--yellow-1)',
    'yellow-3': 'var(--yellow-1)',
    'yellow-4': 'oklch(0.61 0.0863 83.7)',
    'yellow-5': 'oklch(0.41 0.0146 101.82)',

    'purple-1': 'oklch(0.75 0.0818 349.18)',
    'purple-2': 'var(--purple-1)',
    'purple-3': 'var(--purple-1)',
    'purple-4': 'oklch(0.57 0.0818 349.18)',
    'purple-5': 'var(--red-5)',
};

export const palettes = {
    monochrome,
    'monochrome-green': monochromeGreen,
    'catppuccin-mocha': catppuccinMocha,
    'tokyo-night': tokyoNight,
    'rose-pine': rosePine,
    nord,
    everforest,
};

/** Flatten `var(--x)` references and convert every entry to hex. */
export function resolvePalette(palette) {
    const out = {};

    const resolve = (key, seen = new Set()) => {
        if (key in out) return out[key];
        if (seen.has(key)) throw new Error(`circular reference on --${key}`);
        seen.add(key);

        const raw = palette[key];
        if (raw === undefined) throw new Error(`undefined palette key: --${key}`);

        const match = /^var\(--([\w-]+)\)$/.exec(raw.trim());
        out[key] = match ? resolve(match[1], seen) : parseColor(raw);
        return out[key];
    };

    for (const key of Object.keys(palette)) resolve(key);
    return out;
}
