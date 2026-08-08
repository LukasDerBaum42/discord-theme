/**
 * Font packs (Revenge font spec 1).
 *
 * Keys are Discord Android's PostScript font names; values are direct .ttf URLs
 * that Revenge downloads on install. system24's look leans heavily on a
 * monospace UI font, so these are the mobile stand-in for the desktop theme's
 * `--font` / `--code-font` variables.
 *
 * Each slot is deliberately mapped one step lighter than Discord's own weight
 * for it, mirroring system24's `font-weight: 300` body text. Discord ships no
 * light cut of ggsans, so this is the only way to get that thin TUI feel.
 */

const GOOGLE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/dmmono';
const JETBRAINS = 'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/ttf';

/* DM Mono is system24's default. It has only Light/Regular/Medium, so the
   heavier slots reuse Medium — bold text stays legible via size and color. */
const dmMono = {
    'ggsans-Normal': `${GOOGLE}/DMMono-Light.ttf`,
    'ggsans-NormalItalic': `${GOOGLE}/DMMono-LightItalic.ttf`,
    'ggsans-Medium': `${GOOGLE}/DMMono-Regular.ttf`,
    'ggsans-MediumItalic': `${GOOGLE}/DMMono-Italic.ttf`,
    'ggsans-Semibold': `${GOOGLE}/DMMono-Medium.ttf`,
    'ggsans-SemiboldItalic': `${GOOGLE}/DMMono-MediumItalic.ttf`,
    'ggsans-Bold': `${GOOGLE}/DMMono-Medium.ttf`,
    'ggsans-BoldItalic': `${GOOGLE}/DMMono-MediumItalic.ttf`,
    'ggsans-ExtraBold': `${GOOGLE}/DMMono-Medium.ttf`,
    'ggsans-ExtraBoldItalic': `${GOOGLE}/DMMono-MediumItalic.ttf`,
    'SourceCodePro-Semibold': `${GOOGLE}/DMMono-Regular.ttf`,
};

/* JetBrains Mono has the full weight range, so every slot gets a real cut. */
const jetbrainsMono = {
    'ggsans-Normal': `${JETBRAINS}/JetBrainsMono-Light.ttf`,
    'ggsans-NormalItalic': `${JETBRAINS}/JetBrainsMono-LightItalic.ttf`,
    'ggsans-Medium': `${JETBRAINS}/JetBrainsMono-Regular.ttf`,
    'ggsans-MediumItalic': `${JETBRAINS}/JetBrainsMono-Italic.ttf`,
    'ggsans-Semibold': `${JETBRAINS}/JetBrainsMono-Medium.ttf`,
    'ggsans-SemiboldItalic': `${JETBRAINS}/JetBrainsMono-MediumItalic.ttf`,
    'ggsans-Bold': `${JETBRAINS}/JetBrainsMono-SemiBold.ttf`,
    'ggsans-BoldItalic': `${JETBRAINS}/JetBrainsMono-SemiBoldItalic.ttf`,
    'ggsans-ExtraBold': `${JETBRAINS}/JetBrainsMono-Bold.ttf`,
    'ggsans-ExtraBoldItalic': `${JETBRAINS}/JetBrainsMono-BoldItalic.ttf`,
    'SourceCodePro-Semibold': `${JETBRAINS}/JetBrainsMono-Regular.ttf`,
};

export const fontPacks = [
    {
        out: 'fonts/dm-mono.json',
        name: 'DM Mono (system24)',
        description: "system24's default font, mono UI and code blocks.",
        main: dmMono,
    },
    {
        out: 'fonts/jetbrains-mono.json',
        name: 'JetBrains Mono (system24)',
        description: 'JetBrains Mono across the whole UI, full weight range.',
        main: jetbrainsMono,
    },
];

/** Embedded in the theme manifests for Revenge's "extract fonts from theme" flow. */
export const themeFonts = dmMono;
