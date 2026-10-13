import { readFileSync } from 'node:fs'

import { contrastRatio } from '@hermes/shared/color'
import { describe, expect, it } from 'vitest'

import { GOLD_NIGHT_ACCENT_VARIANTS, selectGoldNightAccent } from './accent-override'
import {
  goldNightHiTheme,
  goldNightTheme,
  GOLD_NIGHT_GARNET,
  GOLD_NIGHT_INK,
  GOLD_NIGHT_SURFACES,
  GOLD_NIGHT_TEXT
} from './presets'

const SURFACES = [GOLD_NIGHT_SURFACES.base, GOLD_NIGHT_SURFACES.panel, GOLD_NIGHT_SURFACES.raised]

function minOnSurfaces(ink: string): number {
  const ratios = SURFACES.map(surface => contrastRatio(ink, surface))

  expect(ratios.every(ratio => ratio != null)).toBe(true)

  return Math.min(...(ratios as number[]))
}

describe('gold-night contrast', () => {
  it('clears 4.5:1 for every text tier on every reading surface', () => {
    for (const [tier, hex] of Object.entries(GOLD_NIGHT_TEXT)) {
      expect(minOnSurfaces(hex), tier).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('pairs ink with the approved fills and refuses ivory on them', () => {
    expect(contrastRatio(GOLD_NIGHT_INK, '#C9A55A')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(GOLD_NIGHT_INK, '#E8C77A')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#FFFFFF', GOLD_NIGHT_GARNET)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#F2E8D5', '#C9A55A')!).toBeLessThan(4.5)
    expect(contrastRatio('#F2E8D5', '#E8C77A')!).toBeLessThan(4.5)
    expect(contrastRatio(GOLD_NIGHT_INK, GOLD_NIGHT_GARNET)!).toBeLessThan(4.5)
  })

  it('keeps the theme object on those measured pairs', () => {
    expect(contrastRatio(goldNightTheme.colors.foreground, goldNightTheme.colors.background)!).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(goldNightTheme.colors.primaryForeground, goldNightTheme.colors.primary)!).toBeGreaterThanOrEqual(
      4.5
    )
    expect(
      contrastRatio(goldNightHiTheme.colors.primaryForeground, goldNightHiTheme.colors.primary)!
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(goldNightTheme.colors.destructiveForeground, goldNightTheme.colors.destructive)!
    ).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(goldNightTheme.colors.ring, goldNightTheme.colors.popover)!).toBeGreaterThanOrEqual(3)
  })

  it('offers exactly the two approved accent variants', () => {
    expect(GOLD_NIGHT_ACCENT_VARIANTS.map(variant => variant.hex)).toEqual(['#C9A55A', '#E8C77A'])
    expect(GOLD_NIGHT_ACCENT_VARIANTS.map(variant => variant.themeName)).toEqual(['gold-night', 'gold-night-hi'])
    expect(selectGoldNightAccent).toEqual(expect.any(Function))
  })

  it('keeps the existing lucide pin and does not add a font fetch', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      dependencies: Record<string, string>
    }

    expect(pkg.dependencies['lucide-react']).toBe('0.577.0')
    expect(goldNightTheme.typography?.fontUrl).toBeUndefined()
    expect(JSON.stringify(goldNightTheme)).not.toContain('fonts.googleapis.com')
    expect(JSON.stringify(goldNightHiTheme)).not.toContain('fonts.googleapis.com')
  })
})
