/**
 * Maps system24's semantic roles onto Discord mobile's color tokens.
 *
 * Discord mobile has no CSS, so a Revenge theme is only a color map: two
 * dictionaries, `semanticColors` (Discord's design tokens) and `rawColors`
 * (Discord's underlying palette steps). Both are needed — large parts of the
 * Android UI read the raw palette directly and ignore semantic tokens.
 *
 * Surface strategy: desktop system24 paints panels with --bg-4 and lets --bg-3
 * show through the gaps between them. Mobile has no gaps, so --bg-4 becomes
 * every primary surface and --bg-3 is kept for things that sit *behind* or
 * *above* the chat (server rail, sheets, popovers), which keeps the flat
 * near-single-tone look instead of Discord's three-step elevation ramp.
 */

import { alpha, flatten } from './color.mjs';

/* Discord's palette steps, lightest to darkest. */
const STEPS = [
    100, 130, 160, 200, 230, 260, 300, 330, 345, 360, 400, 430, 460, 500,
    530, 560, 600, 630, 660, 700, 730, 760, 800, 830, 860, 900,
];

/**
 * Spread a system24 five-shade ramp across a raw color family.
 *
 * Discord's accent families run light -> dark, and the steps actually used by
 * the Android UI cluster around 300-500, so those get the mid shades.
 */
function family(prefix, [c1, c2, c3, c4, c5]) {
    const out = {};
    for (const step of STEPS) {
        if (step <= 260) out[`${prefix}_${step}`] = c1;
        else if (step <= 400) out[`${prefix}_${step}`] = c2;
        else if (step <= 530) out[`${prefix}_${step}`] = c3;
        else if (step <= 660) out[`${prefix}_${step}`] = c4;
        else out[`${prefix}_${step}`] = c5;
    }
    return out;
}

export function buildColorMaps(p) {
    /* system24 roles, in mapping-friendly names */
    const text0 = p['text-0'];
    const [text1, text2, text3, text4, text5] = [1, 2, 3, 4, 5].map((n) => p[`text-${n}`]);
    const [bg1, bg2, bg3, bg4] = [1, 2, 3, 4].map((n) => p[`bg-${n}`]);
    const { hover, active, border, offline, online, dnd, idle, streaming } = p;
    const active2 = p['active-2'];
    const messageHover = p['message-hover'];
    const buttonBorder = p['button-border'];
    const [accent1, accent2, accent3, accent4, accent5] = [1, 2, 3, 4, 5].map((n) => p[`accent-${n}`]);
    const accentNew = p['accent-new'];
    const shades = (name) => [1, 2, 3, 4, 5].map((n) => p[`${name}-${n}`]);
    const [red1, red2, red3, red4, red5] = shades('red');
    const [green1, green2, green3, green4, green5] = shades('green');
    const [blue1, blue2, blue3, blue4, blue5] = shades('blue');
    const [yellow1, yellow2, yellow3, yellow4, yellow5] = shades('yellow');
    const [purple1, purple2, purple3, purple4, purple5] = shades('purple');

    /* system24 tints mentions/replies with a gradient; mobile gets a flat wash */
    const mention = alpha(accent2, 0.1);
    const mentionHover = alpha(accent2, 0.15);
    const reply = alpha(text3, 0.08);

    const semantic = {
        /* ── base surfaces ─────────────────────────────────────────────── */
        BACKGROUND_PRIMARY: bg4,
        BACKGROUND_SECONDARY: bg4,
        BACKGROUND_SECONDARY_ALT: bg3,
        BACKGROUND_TERTIARY: bg3,
        BACKGROUND_ACCENT: bg2,
        BACKGROUND_FLOATING: bg3,
        BACKGROUND_NESTED_FLOATING: bg3,
        BACKGROUND_MOBILE_PRIMARY: bg4,
        BACKGROUND_MOBILE_SECONDARY: bg4,
        CHAT_BACKGROUND: bg4,
        KEYBOARD: bg3,

        BG_BASE_PRIMARY: bg4,
        BG_BASE_SECONDARY: bg4,
        BG_BASE_TERTIARY: bg3,
        BG_BASE_QUATERNARY: bg2,
        BG_SURFACE_RAISED: bg3,
        BG_SURFACE_OVERLAY: bg3,
        BG_SURFACE_OVERLAY_TMP: bg3,
        BG_BACKDROP: '#000000cc',

        CARD_PRIMARY_BG: bg3,
        CARD_SECONDARY_BG: bg2,
        MODAL_BACKGROUND: bg3,
        MODAL_FOOTER_BACKGROUND: bg3,
        POPOVER_BACKGROUND: bg3,
        TOOLTIP_BACKGROUND: bg2,
        REDESIGN_ACTIVITY_CARD_BACKGROUND: bg3,
        DEPRECATED_CARD_BG: bg3,
        SPOILER_HIDDEN_BACKGROUND: bg2,
        SPOILER_REVEALED_BACKGROUND: bg3,

        /* ── interaction layers ───────────────────────────────────────── */
        BACKGROUND_MODIFIER_HOVER: hover,
        BACKGROUND_MODIFIER_ACTIVE: active,
        BACKGROUND_MODIFIER_SELECTED: active2,
        BACKGROUND_MODIFIER_ACCENT: border,
        BACKGROUND_MESSAGE_HOVER: messageHover,
        BACKGROUND_MESSAGE_AUTOMOD: mention,
        BACKGROUND_MENTIONED: mention,
        BACKGROUND_MENTIONED_HOVER: mentionHover,
        BG_MOD_FAINT: hover,
        BG_MOD_SUBTLE: active,
        BG_MOD_STRONG: active2,
        BG_MOD_STRONGER: active2,
        ANDROID_RIPPLE: active,
        MENTION_BACKGROUND: mention,
        MENTION_FOREGROUND: accent1,

        /* ── text ─────────────────────────────────────────────────────── */
        TEXT_NORMAL: text3,
        TEXT_PRIMARY: text3,
        TEXT_DEFAULT: text3,
        TEXT_SECONDARY: text4,
        TEXT_TERTIARY: text5,
        TEXT_MUTED: text5,
        HEADER_PRIMARY: text2,
        HEADER_SECONDARY: text4,
        TEXTBOX_MARKDOWN_SYNTAX: text5,
        TEXT_LINK: accent1,
        TEXT_LINK_LOW_SATURATION: accent1,
        TEXT_BRAND: accent1,
        TEXT_POSITIVE: green2,
        TEXT_WARNING: yellow2,
        TEXT_DANGER: red2,
        TEXT_FEEDBACK_POSITIVE: green2,
        TEXT_FEEDBACK_WARNING: yellow2,
        TEXT_FEEDBACK_CRITICAL: red2,

        /* ── icons / interactive ──────────────────────────────────────── */
        INTERACTIVE_NORMAL: text4,
        INTERACTIVE_HOVER: text3,
        INTERACTIVE_ACTIVE: text1,
        INTERACTIVE_MUTED: text5,
        ICON_PRIMARY: text3,
        ICON_SECONDARY: text4,
        ICON_TERTIARY: text5,
        ICON_MUTED: text5,

        /* ── channels & guild list ────────────────────────────────────── */
        CHANNELS_DEFAULT: text4,
        CHANNEL_ICON: text4,
        CHANNEL_TEXT_AREA_PLACEHOLDER: text5,
        REDESIGN_CHANNEL_NAME_TEXT: text4,
        REDESIGN_CHANNEL_NAME_MUTED_TEXT: text5,
        REDESIGN_CHANNEL_NAME_SELECTED_TEXT: text1,
        REDESIGN_CHANNEL_CATEGORY_NAME_TEXT: text5,
        THREAD_CHANNEL_SPINE: text5,
        GUILD_BOOSTING_PINK: purple2,
        GUILD_BOOSTING_PURPLE: purple2,

        /* ── inputs ───────────────────────────────────────────────────── */
        INPUT_BACKGROUND: bg2,
        INPUT_PLACEHOLDER_TEXT: text5,
        REDESIGN_CHAT_INPUT_BACKGROUND: bg2,
        REDESIGN_CHAT_INPUT_PLACEHOLDER_TEXT: text5,
        REDESIGN_TEXT_INPUT_BG: bg2,
        REDESIGN_TEXT_INPUT_BORDER: buttonBorder,
        REDESIGN_TEXT_INPUT_BORDER_HOVER: text5,
        REDESIGN_TEXT_INPUT_BORDER_ACTIVE: accent2,
        REDESIGN_TEXT_INPUT_PREFIX: text5,

        /* ── buttons ──────────────────────────────────────────────────── */
        REDESIGN_BUTTON_PRIMARY_BACKGROUND: accent3,
        REDESIGN_BUTTON_PRIMARY_PRESSED_BACKGROUND: accent5,
        REDESIGN_BUTTON_PRIMARY_TEXT: text0,
        REDESIGN_BUTTON_SECONDARY_BACKGROUND: bg2,
        REDESIGN_BUTTON_SECONDARY_PRESSED_BACKGROUND: bg1,
        REDESIGN_BUTTON_SECONDARY_BORDER: buttonBorder,
        REDESIGN_BUTTON_SECONDARY_TEXT: text3,
        REDESIGN_BUTTON_TERTIARY_BACKGROUND: bg2,
        REDESIGN_BUTTON_TERTIARY_PRESSED_BACKGROUND: bg1,
        REDESIGN_BUTTON_TERTIARY_TEXT: text3,
        REDESIGN_BUTTON_DANGER_BACKGROUND: red3,
        REDESIGN_BUTTON_DANGER_PRESSED_BACKGROUND: red5,
        BUTTON_SECONDARY_BACKGROUND: bg2,
        BUTTON_POSITIVE_BACKGROUND: green3,
        BUTTON_POSITIVE_BACKGROUND_ACTIVE: green5,
        BUTTON_POSITIVE_TEXT: text0,
        BUTTON_DANGER_BACKGROUND: red3,
        BUTTON_DANGER_BACKGROUND_ACTIVE: red5,
        BUTTON_DANGER_TEXT: text0,
        BUTTON_OUTLINE_DANGER_TEXT: red2,
        BUTTON_OUTLINE_DANGER_BORDER: red3,
        CONTROL_BRAND_FOREGROUND: accent2,
        CONTROL_BRAND_FOREGROUND_NEW: accent2,

        /* ── borders: system24's defining feature, kept as visible as JSON allows */
        BORDER_FAINT: border,
        BORDER_SUBTLE: active2,
        BORDER_STRONG: flatten(active2, bg4),
        BORDER_MUTED: border,
        REDESIGN_BORDER: active2,

        /* ── status ───────────────────────────────────────────────────── */
        STATUS_ONLINE: online,
        STATUS_IDLE: idle,
        STATUS_DND: dnd,
        STATUS_OFFLINE: offline,
        STATUS_STREAMING: streaming,
        STATUS_POSITIVE_BACKGROUND: green3,
        STATUS_POSITIVE_TEXT: text0,
        STATUS_DANGER: red2,
        STATUS_DANGER_BACKGROUND: red3,
        STATUS_DANGER_TEXT: text0,
        STATUS_WARNING: yellow2,
        STATUS_WARNING_BACKGROUND: yellow3,
        STATUS_WARNING_TEXT: text0,

        /* ── misc ─────────────────────────────────────────────────────── */
        SCROLLBAR_THIN_THUMB: active2,
        SCROLLBAR_THIN_TRACK: '#00000000',
        SCROLLBAR_AUTO_THUMB: active2,
        SCROLLBAR_AUTO_TRACK: bg4,
        REDESIGN_CHAT_MENTION_BACKGROUND: mention,
        REDESIGN_CHAT_REPLY_BACKGROUND: reply,
        FOCUS_PRIMARY: accent2,
        DEPRECATED_QUICKSWITCHER_INPUT_BACKGROUND: bg2,
        DEPRECATED_QUICKSWITCHER_INPUT_PLACEHOLDER: text5,
    };

    const raw = {
        BLACK: bg4,
        WHITE: text1,
        WHITE_500: text1,
        WHITE_630: text4,

        /* greyscale — Discord's PRIMARY runs light (100) to dark (900) */
        PRIMARY_100: text1,
        PRIMARY_130: text1,
        PRIMARY_160: text2,
        PRIMARY_200: text2,
        PRIMARY_230: text2,
        PRIMARY_260: text2,
        PRIMARY_300: text3,
        PRIMARY_330: text3,
        PRIMARY_345: text3,
        PRIMARY_360: text4,
        PRIMARY_400: text4,
        PRIMARY_430: text5,
        PRIMARY_460: text5,
        PRIMARY_500: text5,
        PRIMARY_530: bg1,
        PRIMARY_560: bg1,
        PRIMARY_600: bg2,
        PRIMARY_630: bg2,
        PRIMARY_645: bg2,
        PRIMARY_660: bg3,
        PRIMARY_700: bg3,
        PRIMARY_730: bg3,
        PRIMARY_760: bg4,
        PRIMARY_800: bg4,
        PRIMARY_830: bg4,
        PRIMARY_860: bg4,
        PRIMARY_900: bg4,

        ...family('BRAND', [accent1, accent2, accent3, accent4, accent5]),
        ...family('BRAND_NEW', [accent1, accent2, accent3, accent4, accent5]),
        ...family('GREEN', [green1, green2, green3, green4, green5]),
        ...family('RED', [red1, red2, red3, red4, red5]),
        ...family('YELLOW', [yellow1, yellow2, yellow3, yellow4, yellow5]),
        ...family('BLUE', [blue1, blue2, blue3, blue4, blue5]),
        ...family('PURPLE', [purple1, purple2, purple3, purple4, purple5]),

        GUILD_BOOSTING_PINK: purple2,
        GUILD_BOOSTING_PURPLE: purple2,
        GUILD_BOOSTING_PURPLE_FOR_GRADIENTS: purple3,
        /* mute/deafen and other normally-red chrome follows --accent-new */
        STATUS_RED_500: accentNew,
        STATUS_GREEN_500: green3,
        STATUS_YELLOW_500: yellow3,
        STATUS_GREY_500: offline,
    };

    /* PRIMARY_DARK_* mirrors PRIMARY_* on Android builds */
    for (const [key, value] of Object.entries(raw)) {
        if (key.startsWith('PRIMARY_') && !key.startsWith('PRIMARY_DARK_')) {
            raw[`PRIMARY_DARK_${key.slice('PRIMARY_'.length)}`] = value;
        }
    }

    return { semantic, raw };
}
