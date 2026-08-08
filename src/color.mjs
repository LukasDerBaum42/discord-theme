/**
 * Color parsing / conversion.
 *
 * system24 writes its palette in `oklch()`, `hsl()`/`hsla()` and hex. Revenge
 * themes are plain JSON and are normalized with chroma-js on the device, so
 * everything has to come out as `#rrggbb` or `#rrggbbaa`.
 */

const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));

function toHex(r, g, b, a = 1) {
    const byte = (n) => Math.round(clamp(n) * 255).toString(16).padStart(2, '0');
    const rgb = `#${byte(r)}${byte(g)}${byte(b)}`;
    return a >= 1 ? rgb : `${rgb}${byte(a)}`;
}

/* gamma encode a linear-light sRGB channel */
function gamma(c) {
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/* Björn Ottosson's oklab -> linear sRGB, then gamma encoded and clipped */
function oklchToRgb(L, C, hDeg) {
    const h = (hDeg * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l = l_ ** 3;
    const m = m_ ** 3;
    const s = s_ ** 3;

    return [
        gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ].map((c) => clamp(c));
}

function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const seg = [
        [c, x, 0],
        [x, c, 0],
        [0, c, x],
        [0, x, c],
        [x, 0, c],
        [c, 0, x],
    ][Math.floor(h / 60) % 6];
    return seg.map((v) => v + m);
}

/* "50%" -> 0.5, "0.5" -> 0.5, "180deg" -> 180 */
function num(token, percentBase = 1) {
    const t = token.trim().replace(/deg$/, '');
    if (t.endsWith('%')) return (parseFloat(t) / 100) * percentBase;
    return parseFloat(t);
}

function args(str) {
    const inner = str.slice(str.indexOf('(') + 1, str.lastIndexOf(')'));
    const [main, alpha] = inner.split('/');
    const parts = main.trim().split(/[\s,]+/).filter(Boolean);
    return { parts, alpha: alpha === undefined ? undefined : num(alpha) };
}

/** Parse any color notation system24 uses into `#rrggbb`/`#rrggbbaa`. */
export function parseColor(input) {
    const value = String(input).trim();

    if (value.startsWith('#')) {
        const hex = value.slice(1);
        const expand = (s) => s.split('').map((c) => c + c).join('');
        if (hex.length === 3 || hex.length === 4) return `#${expand(hex)}`;
        return value.toLowerCase();
    }

    if (value.startsWith('oklch')) {
        const { parts, alpha } = args(value);
        const [r, g, b] = oklchToRgb(num(parts[0]), parseFloat(parts[1]), parseFloat(parts[2] ?? 0));
        return toHex(r, g, b, alpha ?? 1);
    }

    if (value.startsWith('hsl')) {
        const { parts, alpha } = args(value);
        const [r, g, b] = hslToRgb(num(parts[0]), num(parts[1]), num(parts[2]));
        // hsl()/hsla() may carry alpha as a 4th positional arg
        const a = alpha ?? (parts[3] !== undefined ? num(parts[3]) : 1);
        return toHex(r, g, b, a);
    }

    if (value === 'transparent') return '#00000000';

    throw new Error(`unsupported color notation: ${value}`);
}

/** Override a color's alpha channel. `a` is 0..1. */
export function alpha(color, a) {
    const hex = parseColor(color).slice(1, 7);
    const byte = Math.round(clamp(a) * 255).toString(16).padStart(2, '0');
    return a >= 1 ? `#${hex}` : `#${hex}${byte}`;
}

/**
 * Flatten a translucent color onto an opaque backdrop.
 *
 * Discord mobile renders some tokens (status dots, badges, list rows) without a
 * predictable parent, so system24's translucent `--hover`/`--active` layers are
 * baked against the background instead of being passed through as alpha.
 */
export function flatten(color, backdrop) {
    const fg = parseColor(color);
    const bg = parseColor(backdrop);
    const ch = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    const a = fg.length === 9 ? ch(fg, 3) : 1;
    const mixed = [0, 1, 2].map((i) => ch(fg, i) * a + ch(bg, i) * (1 - a));
    return toHex(...mixed);
}
