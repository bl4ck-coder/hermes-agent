/** P8 B21: Channels/Teams/Skills breathe: grids, visual status (connected, busy lane, pack progress), Canvas leftovers localized. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { MAIN_PLURALS } from './main-i18n-plurals'
import { MAIN_TRANSLATIONS } from './main-i18n-table'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')
const b21 = read('ops-base.css').slice(read('ops-base.css').indexOf('B21: Channels'))

describe('B21', () => {
  it('teams render as cards with member sigils, plural open counts and empty copy', () => {
    const src = read('lenses/b4-lenses.tsx')
    expect(src).toContain("P(t.open, '{n} open')")
    expect(src).toContain('<Sigil name={m} size={20} />')
    expect(src).toContain("T('No members')")
    for (const l of Object.keys(MAIN_PLURALS)) expect(MAIN_PLURALS[l]['{n} open']?.other).toContain('{n}')
  })

  it('starter packs show an install progress bar with an accessible label', () => {
    const src = read('lenses/b4-lenses.tsx')
    expect(src).toContain('data-ops-pack-bar=""')
    expect(src).toContain("T('{n} of {total} installed')")
    expect(b21).toMatch(/\[data-ops-pack-bar\]\)::after \{[^}]*width: var\(--ops-pct/)
  })

  it('connected apps lead their group; actions are pinned to the card foot', () => {
    expect(b21).toMatch(/\[data-ops-app\]\[data-ops-app-connected\]\) \{[^}]*order: -1/)
    expect(b21).toMatch(/li > \[data-ops-app-action\]\) \{ align-self: flex-start; margin-top: auto/)
  })

  it('canvas leftovers are keys in every locale', () => {
    for (const l of Object.keys(MAIN_TRANSLATIONS)) for (const k of ['Hide run panel', 'inherits main model', '{name} (no description)']) expect(MAIN_TRANSLATIONS[l][k], `${l}:${k}`).toBeTruthy()
  })

  it('every B21 rule is zero-specificity', () => {
    for (const line of b21.split('\n').filter(l => l.includes('{') && !l.startsWith('@') && !l.startsWith('/*'))) expect(line.trim().startsWith(':where('), line).toBe(true)
  })
})