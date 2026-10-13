/**
 * Built-in desktop themes. Names match the CLI skins / dashboard presets.
 * Add new themes here — no code changes needed elsewhere.
 *
 * The palette-bearing skins (nous, catppuccin, everforest, solarized) are forks
 * of their VS Code originals, converted by `buildThemeFromMarketplace` (see
 * ./install.ts) from the extensions below — the same path a Marketplace import
 * takes, so each is identical to installing the extension by hand and costs the
 * user neither the download nor the install step.
 *
 *   nous       ← github.github-vscode-theme   (Light Default / Dark Default)
 *   catppuccin ← Catppuccin.catppuccin-vsc    (Latte / Mocha)
 *   everforest ← sainnhe.everforest
 *   solarized  ← ryanolsonx.solarized
 *
 * Re-convert marketplace forks from the upstream extension rather than
 * hand-editing hexes; hand edits drift from upstream silently and can't be
 * re-derived. `nous-alt` is first-party — do not re-derive it from GitHub.
 */

import { THEME_PRESET_PALETTES } from '@hermes/shared'

import { skinToDesktopTheme } from './skin'
import type { DesktopTheme, DesktopThemeColors, DesktopThemeTypography } from './types'

// Color-emoji fonts to append to every stack as a last resort. None of the UI
// text/mono fonts carry emoji glyphs, so without this emoji render as tofu
// boxes on platforms whose default text font lacks them (e.g. Linux/#40364).
// Covers macOS, Windows, Linux, plus the `emoji` generic for anything else.
export const EMOJI_FALLBACK = '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", emoji'

const SYSTEM_SANS =
  '"Segoe WPC", "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif, ' +
  EMOJI_FALLBACK

// Keep the bundled JetBrains Mono first in every mono fallback chain. Several
// theme display fonts (Courier Prime, IBM Plex Mono) do not cover Vietnamese /
// Latin Extended glyphs; falling directly to platform UI fonts makes code
// blocks visibly non-monospace. JetBrains Mono is bundled with the app and
// covers those glyphs, while the Linux fallbacks catch distros without it.
const SYSTEM_MONO =
  '"JetBrains Mono", "Cascadia Code", "Cascadia Mono", "DejaVu Sans Mono", "Liberation Mono", "Noto Sans Mono", ' +
  '"Noto Mono", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace, ' +
  EMOJI_FALLBACK

export const DEFAULT_TYPOGRAPHY: DesktopThemeTypography = { fontSans: SYSTEM_SANS, fontMono: SYSTEM_MONO }

/**
 * Nous — the canonical Hermes desktop identity, forked from the GitHub VS Code
 * theme (github.github-vscode-theme). Light is GitHub Light Default, dark is
 * GitHub Dark Default, both converted through the same path a Marketplace
 * install takes, so the palette here is byte-identical to importing the
 * extension yourself.
 *
 * Typography stays Hermes's own: a VS Code theme carries no font opinion, and
 * these are the stacks every skin has been rendering with.
 */
/**
 * GitHub — the upstream palette, unmodified.
 *
 * `nous` is a fork of this with its own accent, so shipping both keeps the
 * original available on its own terms instead of only existing as the thing
 * nous diverged from. Everything but the accent family is identical between
 * them; separate presets are what let nous's accent move without silently
 * redefining what "GitHub" means.
 */
export const githubTheme: DesktopTheme = {
  name: 'github',
  label: 'GitHub',
  description: 'GitHub Light Default and Dark Default',
  ...THEME_PRESET_PALETTES.github,
  typography: {
    fontSans: SYSTEM_SANS,
    fontMono: SYSTEM_MONO,
    fontUrl: 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap'
  },
  terminal: {
    foreground: '#1f2328',
    black: '#24292f',
    red: '#cf222e',
    green: '#116329',
    yellow: '#4d2d00',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#57606a',
    brightRed: '#a40e26',
    brightGreen: '#1a7f37',
    brightYellow: '#633c01',
    brightBlue: '#218bff',
    brightMagenta: '#a475f9',
    brightCyan: '#3192aa',
    brightWhite: '#8c959f'
  },
  darkTerminal: {
    foreground: '#e6edf3',
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#ffffff'
  }
}

/** Catppuccin — Latte in light, Mocha in dark (Catppuccin.catppuccin-vsc). */

/**
 * Nous — the canonical Hermes desktop identity: GitHub's chrome carrying Nous
 * blue. Forked from github.github-vscode-theme (Light Default / Dark Default),
 * with only the accent family re-seeded; every neutral is upstream's.
 *
 * Two seeds, one blue. `#0053FD` is the brand color and reads at 5.4:1 on the
 * light sidebar, but only 3.6:1 on the near-black dark one — so dark carries
 * `#4a84fe`, the same hue (263°) lifted to clear AA at 5.9:1. The soft
 * surfaces below are mixed from those seeds in OKLab, which is what keeps a
 * saturated blue from drifting violet on its way to white.
 */
export const nousTheme: DesktopTheme = {
  name: 'nous',
  label: 'Nous',
  description: 'GitHub chrome, Nous blue accent',
  ...THEME_PRESET_PALETTES.nous,
  typography: {
    fontSans: SYSTEM_SANS,
    fontMono: SYSTEM_MONO,
    fontUrl: 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap'
  },
  terminal: {
    foreground: '#1f2328',
    black: '#24292f',
    red: '#cf222e',
    green: '#116329',
    yellow: '#4d2d00',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#57606a',
    brightRed: '#a40e26',
    brightGreen: '#1a7f37',
    brightYellow: '#633c01',
    brightBlue: '#218bff',
    brightMagenta: '#a475f9',
    brightCyan: '#3192aa',
    brightWhite: '#8c959f'
  },
  darkTerminal: {
    foreground: '#e6edf3',
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#ffffff'
  }
}

/** Catppuccin — Latte in light, Mocha in dark (Catppuccin.catppuccin-vsc). */
export const catppuccinTheme: DesktopTheme = {
  name: 'catppuccin',
  label: 'Catppuccin',
  description: 'Soothing pastels — Latte and Mocha',
  ...THEME_PRESET_PALETTES.catppuccin,
  terminal: {
    foreground: '#4c4f69',
    cursor: '#dc8a78',
    selectionBackground: '#acb0be',
    black: '#5c5f77',
    red: '#d20f39',
    green: '#40a02b',
    yellow: '#df8e1d',
    blue: '#1e66f5',
    magenta: '#ea76cb',
    cyan: '#179299',
    white: '#acb0be',
    brightBlack: '#6c6f85',
    brightRed: '#de293e',
    brightGreen: '#49af3d',
    brightYellow: '#eea02d',
    brightBlue: '#456eff',
    brightMagenta: '#fe85d8',
    brightCyan: '#2d9fa8',
    brightWhite: '#bcc0cc'
  },
  darkTerminal: {
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    selectionBackground: '#585b70',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#a6adc8',
    brightBlack: '#585b70',
    brightRed: '#f37799',
    brightGreen: '#89d88b',
    brightYellow: '#ebd391',
    brightBlue: '#74a8fc',
    brightMagenta: '#f2aede',
    brightCyan: '#6bd7ca',
    brightWhite: '#bac2de'
  }
}

/** Everforest — warm, low-contrast forest greens (sainnhe.everforest). */
export const everforestTheme: DesktopTheme = {
  name: 'everforest',
  label: 'Everforest',
  description: 'Warm, low-contrast forest greens',
  ...THEME_PRESET_PALETTES.everforest,
  terminal: {
    foreground: '#5c6a72',
    cursor: '#5c6a72',
    black: '#5c6a72',
    red: '#f85552',
    green: '#8da101',
    yellow: '#dfa000',
    blue: '#3a94c5',
    magenta: '#df69ba',
    cyan: '#35a77c',
    white: '#939f91',
    brightBlack: '#5c6a72',
    brightRed: '#f85552',
    brightGreen: '#8da101',
    brightYellow: '#dfa000',
    brightBlue: '#3a94c5',
    brightMagenta: '#df69ba',
    brightCyan: '#35a77c',
    brightWhite: '#f4f0d9'
  },
  darkTerminal: {
    foreground: '#d3c6aa',
    cursor: '#d3c6aa',
    black: '#343f44',
    red: '#e67e80',
    green: '#a7c080',
    yellow: '#dbbc7f',
    blue: '#7fbbb3',
    magenta: '#d699b6',
    cyan: '#83c092',
    white: '#d3c6aa',
    brightBlack: '#859289',
    brightRed: '#e67e80',
    brightGreen: '#a7c080',
    brightYellow: '#dbbc7f',
    brightBlue: '#7fbbb3',
    brightMagenta: '#d699b6',
    brightCyan: '#83c092',
    brightWhite: '#d3c6aa'
  }
}

/** Solarized — Ethan Schoonover's fixed-contrast pair (ryanolsonx.solarized). */
export const solarizedTheme: DesktopTheme = {
  name: 'solarized',
  label: 'Solarized',
  description: 'Fixed-contrast light and dark',
  ...THEME_PRESET_PALETTES.solarized,
  terminal: {
    foreground: '#657b83',
    black: '#657b83',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#657b83',
    brightRed: '#cb4b16',
    brightGreen: '#859900',
    brightYellow: '#657b83',
    brightBlue: '#839496',
    brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1',
    brightWhite: '#eee8d5'
  },
  darkTerminal: {
    foreground: '#839496',
    cursor: '#ffffff',
    selectionBackground: '#ffffff40',
    black: '#14181d',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#e5e5e5',
    brightBlack: '#676767',
    brightRed: '#dc322f',
    brightGreen: '#859900',
    brightYellow: '#b58900',
    brightBlue: '#268bd2',
    brightMagenta: '#d33682',
    brightCyan: '#2aa198',
    brightWhite: '#e5e5e5'
  }
}

/**
 * Nous Alt — the hand-authored Nous from before the GitHub fork. Light is
 * glass neutrals with brand blue; dark is cream on mission-blue.
 */
export const nousAltTheme: DesktopTheme = {
  name: 'nous-alt',
  label: 'Nous Alt',
  description: 'Glass neutrals, cream on mission-blue',
  ...THEME_PRESET_PALETTES['nous-alt'],
  typography: {
    fontSans: SYSTEM_SANS,
    fontMono: SYSTEM_MONO,
    fontUrl: 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap'
  }
}

// The converter's input: the keys it reads from `hermes_cli/skin_engine.py`'s
// `default` skin. Light is that skin's `light_colors` overlay (its goldenrod
// ladder for white backgrounds; `banner_border` is not overridden there) with
// one change: the ink. The CLI's `#5C4718` is a single-weight terminal color,
// but Desktop sets secondary and tertiary text at 74% / 54% of it, which left
// them at 4.2:1 / 2.7:1. A deeper ink of the same brown gives 6.5:1 / 3.5:1,
// the levels Nous Light has.
const CLASSIC_DARK_SKIN_COLORS = {
  status_bar_bg: '#1a1a2e',
  banner_text: '#FFF8DC',
  ui_accent: '#FFBF00',
  banner_border: '#CD7F32',
  banner_dim: '#B8860B',
  ui_error: '#ef5350',
  completion_menu_bg: '#1a1a2e'
}

const CLASSIC_LIGHT_SKIN_COLORS = {
  status_bar_bg: '#F5F5F5',
  banner_text: '#2B2109',
  ui_accent: '#D89B04',
  banner_border: '#CD7F32',
  banner_dim: '#B8860B',
  ui_error: '#C62828',
  completion_menu_bg: '#F5F5F5'
}

const classicPalette = (colors: Record<string, string>) => skinToDesktopTheme({ name: 'classic', colors })!.colors

/**
 * Classic Hermes — the CLI's stock `default` skin (gold on navy), offered as a
 * Desktop pick under its OWN id. Never `default`: stock config ships
 * `display.skin: default`, and Desktop reads that as "no pick" (→ nous), so a
 * user only ever gets Classic by choosing it (#76579). Both palettes go through
 * the converter a backend skin takes, so each mode paints what the CLI paints
 * in a dark or light terminal.
 */
export const classicTheme: DesktopTheme = {
  name: 'classic',
  label: 'Classic Hermes',
  description: "Gold on navy, the CLI's original look",
  colors: classicPalette(CLASSIC_LIGHT_SKIN_COLORS),
  darkColors: classicPalette(CLASSIC_DARK_SKIN_COLORS)
}

/**
 * Midnight — deep blue-violet, near-monotone. Dark only: it has no light
 * palette because the whole idea is the dark end of the spectrum.
 */
export const midnightTheme: DesktopTheme = {
  name: 'midnight',
  label: 'Midnight',
  description: 'Deep blue-violet with cool accents',
  ...THEME_PRESET_PALETTES.midnight,
  typography: {
    fontMono: `"JetBrains Mono", ${SYSTEM_MONO}`,
    fontUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap'
  }
}

export const emberTheme: DesktopTheme = {
  name: 'ember',
  label: 'Ember',
  description: 'Warm crimson and bronze — forge vibes',
  ...THEME_PRESET_PALETTES.ember,
  typography: {
    fontMono: `"IBM Plex Mono", ${SYSTEM_MONO}`,
    fontUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap'
  }
}

/** Clean grayscale. Matches the CLI mono skin and dashboard mono theme. */
export const monoTheme: DesktopTheme = {
  name: 'mono',
  label: 'Mono',
  description: 'Clean grayscale — minimal and focused',
  ...THEME_PRESET_PALETTES.mono
}

/** Neon green on black. Matches the CLI cyberpunk skin and dashboard theme. */
export const cyberpunkTheme: DesktopTheme = {
  name: 'cyberpunk',
  label: 'Cyberpunk',
  description: 'Neon green on black — matrix terminal',
  ...THEME_PRESET_PALETTES.cyberpunk,
  typography: {
    fontMono: `"Courier New", Courier, ${SYSTEM_MONO}`,
    fontSans: `"Courier New", Courier, ${SYSTEM_MONO}`
  }
}

/** Cool slate blue for developers. Matches the CLI slate skin. */
export const slateTheme: DesktopTheme = {
  name: 'slate',
  label: 'Slate',
  description: 'Cool slate blue — focused developer theme',
  ...THEME_PRESET_PALETTES.slate,
  typography: {
    fontMono: `"JetBrains Mono", ${SYSTEM_MONO}`
  }
}

/**
 * Gold Night — the app-wide Desktop default (D5, G18, G76).
 *
 * Hexes are the P0-05 freeze (`docs/ops-panel/gold-night-tokens.md` §5).
 * `colors` and `darkColors` are the same object, so light, dark, and system
 * all paint this sheet. The retired name `gold` stays retired. This is not
 * the installed `aizurg-gold-night` plugin and does not edit it.
 *
 * Accent variants are `gold-night` (deep `#C9A55A`) and `gold-night-hi`
 * (`#E8C77A`). Both keep the graphite surfaces. The dev scratch atom in
 * `accent-override.ts` is not persisted; production paint uses these objects
 * with the override null.
 */
export const GOLD_NIGHT_INK = '#0E0D0B'
export const GOLD_NIGHT_IVORY = '#F2E8D5'
export const GOLD_NIGHT_PANEL = '#16140F'
export const GOLD_NIGHT_RAISED = '#1F1B14'
export const GOLD_NIGHT_DEEP = '#C9A55A'
export const GOLD_NIGHT_HI = '#E8C77A'
export const GOLD_NIGHT_BORDER = '#2F291C'
export const GOLD_NIGHT_MUTED = '#9A8F7A'
export const GOLD_NIGHT_GARNET = '#B4533C'

/** O79 motion-row description. Ops does not render this row in this slice. */
export const GOLD_NIGHT_MOTION_COPY = 'States still change and stay readable'

/** Text tiers from the freeze §6.1. Body copy, not action fills. */
export const GOLD_NIGHT_TEXT = {
  primary: GOLD_NIGHT_IVORY,
  secondary: '#CDBB98',
  tertiary: GOLD_NIGHT_MUTED,
  working: GOLD_NIGHT_HI,
  stale: '#A89880',
  needsYou: '#D4893A',
  blocked: '#BF6D59',
  offline: '#8A8376',
  connected: '#6F8F72'
} as const

export const GOLD_NIGHT_SURFACES = {
  base: GOLD_NIGHT_INK,
  panel: GOLD_NIGHT_PANEL,
  raised: GOLD_NIGHT_RAISED
} as const

function goldNightColors(accent: string): DesktopThemeColors {
  return {
    background: GOLD_NIGHT_INK,
    foreground: GOLD_NIGHT_IVORY,
    card: GOLD_NIGHT_PANEL,
    cardForeground: GOLD_NIGHT_IVORY,
    muted: GOLD_NIGHT_PANEL,
    mutedForeground: GOLD_NIGHT_MUTED,
    popover: GOLD_NIGHT_RAISED,
    popoverForeground: GOLD_NIGHT_IVORY,
    primary: accent,
    primaryForeground: GOLD_NIGHT_INK,
    secondary: GOLD_NIGHT_RAISED,
    secondaryForeground: GOLD_NIGHT_IVORY,
    accent,
    accentForeground: GOLD_NIGHT_INK,
    border: GOLD_NIGHT_BORDER,
    input: GOLD_NIGHT_RAISED,
    ring: GOLD_NIGHT_HI,
    midground: GOLD_NIGHT_HI,
    midgroundForeground: GOLD_NIGHT_INK,
    composerRing: GOLD_NIGHT_HI,
    destructive: GOLD_NIGHT_GARNET,
    destructiveForeground: '#FFFFFF',
    sidebarBackground: GOLD_NIGHT_INK,
    sidebarBorder: GOLD_NIGHT_BORDER,
    userBubble: GOLD_NIGHT_RAISED,
    userBubbleBorder: GOLD_NIGHT_BORDER
  }
}

const GOLD_NIGHT_TYPOGRAPHY: DesktopThemeTypography = {
  // Geist is named first, then the stacks already bundled with the app.
  // `fontUrl` is set (to undefined) so the nous Google Fonts URL in the
  // applyTheme merge cannot leak onto this skin. No remote stylesheet.
  fontSans: `Geist, ${SYSTEM_SANS}`,
  fontMono: `"Geist Mono", ${SYSTEM_MONO}`,
  fontUrl: undefined
}

/** Gutter (R32), focus ring, and text tokens. Not a route-specific skin. */
export const GOLD_NIGHT_CUSTOM_CSS = `
:root {
  --gn-gutter: 24px;
  --gn-text-primary: ${GOLD_NIGHT_TEXT.primary};
  --gn-text-secondary: ${GOLD_NIGHT_TEXT.secondary};
  --gn-text-tertiary: ${GOLD_NIGHT_TEXT.tertiary};
  --gn-text-working: ${GOLD_NIGHT_TEXT.working};
  --gn-text-stale: ${GOLD_NIGHT_TEXT.stale};
  --gn-text-needs-you: ${GOLD_NIGHT_TEXT.needsYou};
  --gn-text-blocked: ${GOLD_NIGHT_TEXT.blocked};
  --gn-text-offline: ${GOLD_NIGHT_TEXT.offline};
  --gn-text-connected: ${GOLD_NIGHT_TEXT.connected};
  --gn-focus-inner: ${GOLD_NIGHT_IVORY};
  --gn-focus-outer: ${GOLD_NIGHT_HI};
  --gn-focus-width: 2px;
  --gn-focus-offset: 2px;
  --gn-highlight: ${GOLD_NIGHT_HI};
  --gn-hairline-separator: ${GOLD_NIGHT_HI};
  --gn-hairline-card: ${GOLD_NIGHT_HI};
}
html[data-hermes-theme^="gold-night"] :focus-visible {
  outline: var(--gn-focus-width) solid var(--gn-focus-outer);
  outline-offset: var(--gn-focus-offset);
  box-shadow: inset 0 0 0 var(--gn-focus-width) var(--gn-focus-inner);
}
`.trim()

const goldNightDeepColors = goldNightColors(GOLD_NIGHT_DEEP)
const goldNightHiColors = goldNightColors(GOLD_NIGHT_HI)

export const goldNightTheme: DesktopTheme = {
  name: 'gold-night',
  label: 'Gold Night',
  description: 'Ivory on graphite, deep gold accent',
  colors: goldNightDeepColors,
  darkColors: goldNightDeepColors,
  typography: GOLD_NIGHT_TYPOGRAPHY
}

export const goldNightHiTheme: DesktopTheme = {
  name: 'gold-night-hi',
  label: 'Gold Night Hi',
  description: 'Ivory on graphite, hi gold accent',
  colors: goldNightHiColors,
  darkColors: goldNightHiColors,
  typography: GOLD_NIGHT_TYPOGRAPHY
}

export const BUILTIN_THEMES: Record<string, DesktopTheme> = {
  'gold-night': goldNightTheme,
  'gold-night-hi': goldNightHiTheme,
  nous: nousTheme,
  github: githubTheme,
  catppuccin: catppuccinTheme,
  everforest: everforestTheme,
  solarized: solarizedTheme,
  'nous-alt': nousAltTheme,
  classic: classicTheme,
  midnight: midnightTheme,
  ember: emberTheme,
  mono: monoTheme,
  slate: slateTheme,
  cyberpunk: cyberpunkTheme
}

export const BUILTIN_THEME_LIST = Object.values(BUILTIN_THEMES)

/** Skin used when nothing is persisted or the persisted name is retired.
 *  Gold Night is the app-wide fallback (D5). An explicit stored pick of any
 *  other built-in, including `nous`, is left alone — this constant is not a
 *  migration. */
export const DEFAULT_SKIN_NAME = 'gold-night'

/** Names that no longer resolve to a skin of their own. A stored pick of one
 *  falls back to DEFAULT_SKIN_NAME, and a cached backend theme under one is
 *  dropped (the reverted #130015 build cached the CLI `default` skin as a
 *  second "Classic Hermes"). `gold` stays retired; it is not `gold-night`. */
export const RETIRED_SKINS = new Set(['nous-light', 'default', 'gold'])
