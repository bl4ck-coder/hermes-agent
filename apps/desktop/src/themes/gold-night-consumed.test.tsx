import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { contrastRatio } from '@hermes/shared/color'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ThemeProvider, useTheme } from './context'
import {
  GOLD_NIGHT_CONSUMED_VARS,
  GOLD_NIGHT_DESTRUCTIVE_COPY,
  GOLD_NIGHT_GARNET,
  GOLD_NIGHT_INK,
  GOLD_NIGHT_PANEL,
  GOLD_NIGHT_RAISED,
  goldNightTheme
} from './presets'

const SRC = dirname(fileURLToPath(import.meta.url))
const STYLES = readFileSync(join(SRC, '../styles.css'), 'utf8')

function cssVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name).trim()
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')

  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function mixHex(fg: string, bg: string, amount: number): string {
  const a = hexToRgb(fg)
  const b = hexToRgb(bg)
  const rgb = a.map((channel, i) => Math.round(amount * channel + (1 - amount) * b[i]))
  return `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

function ThemeProbe({ onReady }: { onReady: (ctx: ReturnType<typeof useTheme>) => void }) {
  onReady(useTheme())

  return null
}

describe('gold-night consumed CSS', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    document.getElementById('styles-css-loaded')?.remove()
  })

  it('loads styles.css color-mix defaults and overrides them only on the gold-night path', () => {
    expect(STYLES).toContain('color-mix(in srgb, var(--theme-card-seed) var(--theme-mix-card), var(--theme-neutral-card))')
    expect(STYLES).toContain('--dt-popover: color-mix(in srgb, var(--ui-bg-elevated) 96%, transparent)')
    expect(STYLES).toContain('--ui-text-secondary: color-mix(in srgb, var(--ui-base) 74%, transparent)')
    expect(STYLES).toContain('--ui-text-tertiary: color-mix(in srgb, var(--ui-base) 54%, transparent)')
    expect(STYLES).not.toContain('fonts.googleapis.com')
    expect(STYLES).toContain("font-family: 'Geist'")
    expect(STYLES).toContain("url('./fonts/Geist-Regular.woff2')")
    expect(STYLES).toContain("url('./fonts/Geist-Medium.woff2')")
    expect(STYLES).toContain("url('./fonts/GeistMono-Regular.woff2')")

    const style = document.createElement('style')
    style.id = 'styles-css-loaded'
    style.textContent = STYLES
    document.head.appendChild(style)

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    )

    expect(cssVar('--dt-card')).toBe(GOLD_NIGHT_PANEL)
    expect(cssVar('--dt-popover')).toBe(GOLD_NIGHT_RAISED)
    expect(cssVar('--dt-background')).toBe(GOLD_NIGHT_INK)
    expect(cssVar('--ui-text-secondary')).toBe('#CDBB98')
    expect(cssVar('--ui-text-tertiary')).toBe('#9A8F7A')
    expect(cssVar('--dt-muted-foreground')).toBe('#9A8F7A')
    expect(cssVar('--ui-text-primary')).toBe('#F2E8D5')
    expect(cssVar('--gn-destructive-copy')).toBe(GOLD_NIGHT_DESTRUCTIVE_COPY)
    expect(cssVar('--dt-destructive')).toBe(GOLD_NIGHT_GARNET)
    expect(cssVar('--theme-mix-card')).toBe('100%')
    expect(cssVar('--dt-card')).not.toContain('color-mix')
    expect(cssVar('--dt-popover')).not.toContain('color-mix')
    expect(cssVar('--ui-text-secondary')).not.toContain('color-mix')
  })

  it('paints error copy at ≥4.5:1 on the tinted composite, and keeps the garnet fill', () => {
    render(
      <ThemeProvider>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-gn-destructive-copy" data-testid="error-copy">
          Desktop IPC bridge is unavailable.
        </div>
      </ThemeProvider>
    )

    const probe = document.querySelector('[data-testid="error-copy"]') as HTMLElement
    const declared = getComputedStyle(probe).color.replace(/\s/g, '')
    // jsdom keeps var() as the specified value; Chromium resolves it. The token
    // the rule points at is the measured copy, and the fill token stays garnet.
    expect(declared).toContain('--gn-destructive-copy')
    expect(cssVar('--gn-destructive-copy')).toBe(GOLD_NIGHT_DESTRUCTIVE_COPY)
    expect(document.getElementById('hermes-gold-night-tokens')?.textContent).toContain(
      'html[data-hermes-theme^="gold-night"] .text-gn-destructive-copy'
    )
    expect(probe.className).toContain('bg-destructive/10')
    expect(probe.className).toContain('text-gn-destructive-copy')
    expect(probe.className).not.toMatch(/\btext-destructive\b/)

    const backgrounds = [
      GOLD_NIGHT_INK,
      GOLD_NIGHT_PANEL,
      GOLD_NIGHT_RAISED,
      mixHex(GOLD_NIGHT_GARNET, GOLD_NIGHT_INK, 0.1),
      mixHex(GOLD_NIGHT_GARNET, GOLD_NIGHT_PANEL, 0.1),
      mixHex(GOLD_NIGHT_GARNET, GOLD_NIGHT_RAISED, 0.1),
      mixHex(GOLD_NIGHT_GARNET, GOLD_NIGHT_PANEL, 0.3),
      '#2A1E1A'
    ]

    for (const background of backgrounds) {
      expect(contrastRatio(GOLD_NIGHT_DESTRUCTIVE_COPY, background), background).toBeGreaterThanOrEqual(4.5)
    }

    expect(contrastRatio('#FFFFFF', GOLD_NIGHT_GARNET)).toBeGreaterThanOrEqual(4.5)
    expect(goldNightTheme.colors.destructive).toBe(GOLD_NIGHT_GARNET)
    expect(goldNightTheme.colors.destructiveForeground).toBe('#FFFFFF')
    expect(contrastRatio(GOLD_NIGHT_GARNET, GOLD_NIGHT_RAISED)!).toBeLessThan(4.5)
  })

  it('keeps deep and hi accents and drops the solids when switching to nous', () => {
    let ctx: ReturnType<typeof useTheme>
    render(
      <ThemeProvider>
        <ThemeProbe onReady={value => (ctx = value)} />
      </ThemeProvider>
    )

    expect(cssVar('--theme-primary')).toBe('#C9A55A')
    expect(cssVar('--dt-card')).toBe(GOLD_NIGHT_PANEL)

    act(() => ctx!.setTheme('gold-night-hi'))

    expect(document.documentElement.dataset.hermesTheme).toBe('gold-night-hi')
    expect(cssVar('--theme-primary')).toBe('#E8C77A')
    expect(cssVar('--dt-card')).toBe(GOLD_NIGHT_PANEL)
    expect(cssVar('--dt-popover')).toBe(GOLD_NIGHT_RAISED)
    expect(cssVar('--ui-text-secondary')).toBe('#CDBB98')
    expect(document.getElementById('hermes-gold-night-tokens')).not.toBeNull()

    act(() => ctx!.setTheme('nous'))

    expect(document.documentElement.dataset.hermesTheme).toBe('nous')
    expect(document.getElementById('hermes-gold-night-tokens')).toBeNull()

    for (const key of Object.keys(GOLD_NIGHT_CONSUMED_VARS)) {
      expect(cssVar(key), key).toBe('')
    }

    expect(cssVar('--theme-primary')).not.toBe('#C9A55A')
    expect(cssVar('--theme-primary')).not.toBe('#E8C77A')
    expect(cssVar('--theme-mix-card')).not.toBe('100%')
  })
})
