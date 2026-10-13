import { describe, expect, it } from 'vitest'

import { BUILTIN_THEME_LIST, BUILTIN_THEMES, DEFAULT_SKIN_NAME, DEFAULT_TYPOGRAPHY, goldNightHiTheme, goldNightTheme, GOLD_NIGHT_CUSTOM_CSS, GOLD_NIGHT_MOTION_COPY, nousTheme, RETIRED_SKINS } from './presets'

// #40364: none of the UI text/mono fonts carry emoji glyphs, so every font
// stack must end with a color-emoji fallback or emoji render as tofu on
// platforms whose default font lacks them (e.g. Linux).
describe('theme typography emoji fallback (#40364)', () => {
  const stacks: Array<[string, string]> = [
    ['DEFAULT_TYPOGRAPHY.fontSans', DEFAULT_TYPOGRAPHY.fontSans],
    ['DEFAULT_TYPOGRAPHY.fontMono', DEFAULT_TYPOGRAPHY.fontMono],
    // A theme may override only fontMono (fontSans then falls back to the
    // default, which already carries the emoji stack), so skip undefined.
    ...BUILTIN_THEME_LIST.flatMap(theme =>
      (
        [
          [`${theme.name}.fontSans`, theme.typography?.fontSans],
          [`${theme.name}.fontMono`, theme.typography?.fontMono]
        ] as Array<[string, string | undefined]>
      ).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )
  ]

  it.each(stacks)('%s includes a color-emoji font', (_label, stack) => {
    expect(stack).toMatch(/Apple Color Emoji|Segoe UI Emoji|Noto Color Emoji|(^|,\s*)emoji\b/)
  })
})

describe('theme typography Latin Extended fallback (#61392)', () => {
  const monoStacks: Array<[string, string]> = [
    ['DEFAULT_TYPOGRAPHY.fontMono', DEFAULT_TYPOGRAPHY.fontMono],
    ...BUILTIN_THEME_LIST.map(
      theme =>
        [
          `${theme.name}.effectiveFontMono`,
          theme.typography?.fontMono ?? nousTheme.typography?.fontMono ?? DEFAULT_TYPOGRAPHY.fontMono
        ] as [string, string]
    )
  ]

  it.each(monoStacks)('%s falls back to bundled JetBrains Mono before generic fonts', (_label, stack) => {
    const jetbrains = stack.indexOf('JetBrains Mono')

    expect(jetbrains).toBeGreaterThanOrEqual(0)

    const genericIndexes = [
      stack.indexOf('ui-monospace'),
      stack.indexOf('monospace'),
      stack.indexOf('Apple Color Emoji'),
      stack.indexOf('Segoe UI Emoji'),
      stack.indexOf('Noto Color Emoji')
    ].filter(index => index >= 0)

    expect(genericIndexes.length).toBeGreaterThan(0)
    expect(jetbrains).toBeLessThan(Math.min(...genericIndexes))
  })

  it('default stack includes common Linux monospace glyph fallbacks', () => {
    expect(DEFAULT_TYPOGRAPHY.fontMono).toContain('DejaVu Sans Mono')
    expect(DEFAULT_TYPOGRAPHY.fontMono).toContain('Liberation Mono')
    expect(DEFAULT_TYPOGRAPHY.fontMono).toContain('Noto Sans Mono')
  })
})

const KEPT = [
  'nous',
  'github',
  'catppuccin',
  'everforest',
  'solarized',
  'nous-alt',
  'classic',
  'midnight',
  'ember',
  'mono',
  'slate',
  'cyberpunk'
]

describe('gold-night registration', () => {
  it('is the app-wide fallback, not an Ops-only name', () => {
    expect(DEFAULT_SKIN_NAME).toBe('gold-night')
    expect(BUILTIN_THEMES['gold-night']).toBe(goldNightTheme)
    expect(goldNightTheme.label).toBe('Gold Night')
    expect(goldNightTheme.name).not.toBe('aizurg-gold-night')
    expect(goldNightTheme.name).not.toBe('gold')
  })

  it('keeps every other built-in selectable and does not revive gold', () => {
    for (const name of KEPT) {
      expect(BUILTIN_THEMES[name]?.name, name).toBe(name)
    }

    expect(BUILTIN_THEMES.gold).toBeUndefined()
    expect(BUILTIN_THEMES['aizurg-gold-night']).toBeUndefined()
    expect(RETIRED_SKINS.has('gold')).toBe(true)
    expect(RETIRED_SKINS.has('gold-night')).toBe(false)
  })

  it('ships deep and hi as selectable variants on the same surfaces', () => {
    expect(BUILTIN_THEMES['gold-night-hi']).toBe(goldNightHiTheme)
    expect(goldNightTheme.colors.primary).toBe('#C9A55A')
    expect(goldNightHiTheme.colors.primary).toBe('#E8C77A')
    expect(goldNightTheme.colors.secondary).toBe(goldNightHiTheme.colors.secondary)
    expect(goldNightTheme.colors.background).toBe(goldNightHiTheme.colors.background)
  })

  it('uses one palette object for light and dark', () => {
    expect(goldNightTheme.colors).toBe(goldNightTheme.darkColors)
    expect(goldNightHiTheme.colors).toBe(goldNightHiTheme.darkColors)
  })

  it('matches the frozen theme-object hexes', () => {
    expect(goldNightTheme.colors).toEqual({
      background: '#0E0D0B',
      foreground: '#F2E8D5',
      card: '#16140F',
      cardForeground: '#F2E8D5',
      muted: '#16140F',
      mutedForeground: '#9A8F7A',
      popover: '#1F1B14',
      popoverForeground: '#F2E8D5',
      primary: '#C9A55A',
      primaryForeground: '#0E0D0B',
      secondary: '#1F1B14',
      secondaryForeground: '#F2E8D5',
      accent: '#C9A55A',
      accentForeground: '#0E0D0B',
      border: '#2F291C',
      input: '#1F1B14',
      ring: '#E8C77A',
      midground: '#E8C77A',
      midgroundForeground: '#0E0D0B',
      composerRing: '#E8C77A',
      destructive: '#B4533C',
      destructiveForeground: '#FFFFFF',
      sidebarBackground: '#0E0D0B',
      sidebarBorder: '#2F291C',
      userBubble: '#1F1B14',
      userBubbleBorder: '#2F291C'
    })
  })

  it('does not copy the plugin pairs that fail as text', () => {
    const painted = Object.values(goldNightTheme.colors).join(' ')

    expect(painted).not.toContain('#040405')
    expect(painted).not.toContain('#7C7A72')
    expect(painted).not.toContain('#C45C5C')
    expect(painted).not.toContain('#3ECF8E')
    expect(painted).not.toContain('#0B0B0D')
  })

  it('names bundled faces and does not fetch a stylesheet', () => {
    expect(goldNightTheme.typography?.fontSans?.startsWith('Geist, ')).toBe(true)
    expect(goldNightTheme.typography?.fontSans).toContain('Segoe UI')
    expect(goldNightTheme.typography?.fontMono?.startsWith('"Geist Mono", ')).toBe(true)
    expect(goldNightTheme.typography?.fontMono).toContain('JetBrains Mono')
    expect(goldNightTheme.typography?.fontUrl).toBeUndefined()
    expect(goldNightHiTheme.typography?.fontUrl).toBeUndefined()
    expect({ ...DEFAULT_TYPOGRAPHY, ...nousTheme.typography, ...goldNightTheme.typography }.fontUrl).toBeUndefined()
  })

  it('freezes the gutter, focus tokens, and O79 copy without a route skin', () => {
    expect(GOLD_NIGHT_CUSTOM_CSS).toContain('--gn-gutter: 24px')
    expect(GOLD_NIGHT_CUSTOM_CSS).toContain('--gn-focus-inner: #F2E8D5')
    expect(GOLD_NIGHT_CUSTOM_CSS).toContain('--gn-focus-outer: #E8C77A')
    expect(GOLD_NIGHT_CUSTOM_CSS).toContain('outline-offset: var(--gn-focus-offset)')
    expect(GOLD_NIGHT_CUSTOM_CSS).toContain('--dt-card: #16140F')
    expect(GOLD_NIGHT_CUSTOM_CSS).toContain('--dt-popover: #1F1B14')
    expect(GOLD_NIGHT_CUSTOM_CSS).toContain('--ui-text-secondary: #CDBB98')
    expect(GOLD_NIGHT_CUSTOM_CSS).toContain('--dt-muted-foreground: #9A8F7A')
    expect(GOLD_NIGHT_CUSTOM_CSS).toContain('--gn-destructive-copy: #D4A08C')
    expect(GOLD_NIGHT_CUSTOM_CSS).toContain('color: var(--gn-destructive-copy)')
    expect(GOLD_NIGHT_CUSTOM_CSS).not.toMatch(/\/(chat|settings|profiles|cron|webhooks)/)
    expect(GOLD_NIGHT_MOTION_COPY).toBe('States still change and stay readable')
  })
})
