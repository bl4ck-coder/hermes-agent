/**
 * Dev-only accent override.
 *
 * Live-authoring knob for `retintTheme`: while this holds a hex, the theme
 * context paints the active skin re-seeded from it. `null` means "off" — the
 * theme paints exactly as authored, which is the only state a production build
 * can ever be in (the picker that sets this is installed under
 * `import.meta.env.DEV`).
 *
 * Deliberately NOT persisted. It's a scratch control for finding a color you
 * like, and the outcome is meant to be written into `presets.ts` as a real
 * palette — not carried around as user state that would silently override a
 * theme the user picked later.
 */

import { atom } from 'nanostores'

import { normalizeHex } from './color'

export const $accentOverride = atom<null | string>(null)

export function setAccentOverride(color: null | string): void {
  $accentOverride.set(color === null ? null : (normalizeHex(color) ?? $accentOverride.get()))
}

/**
 * Selectable Gold Night accent fills. `deep` is the authored `gold-night`
 * preset. `hi` is the authored `gold-night-hi` preset. Neither id is written
 * to storage from here — `deep` and `null` clear the scratch atom so
 * production paint stays the authored hexes.
 */
export const GOLD_NIGHT_ACCENT_VARIANTS = [
  { id: 'deep', label: 'Deep', hex: '#C9A55A', themeName: 'gold-night' },
  { id: 'hi', label: 'Hi', hex: '#E8C77A', themeName: 'gold-night-hi' }
] as const

export type GoldNightAccentId = (typeof GOLD_NIGHT_ACCENT_VARIANTS)[number]['id']

export function goldNightAccentVariant(id: GoldNightAccentId) {
  return GOLD_NIGHT_ACCENT_VARIANTS.find(variant => variant.id === id)!
}

/** Scratch selection only. Does not persist and does not rewrite a saved skin. */
export function selectGoldNightAccent(id: GoldNightAccentId | null): void {
  if (id === null || id === 'deep') {
    setAccentOverride(null)

    return
  }

  setAccentOverride(goldNightAccentVariant(id).hex)
}
