/** P8 B12: fusion builds + main-content i18n. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { opsMainLocale, setOpsMainLocale, T } from './main-i18n'
import { MAIN_TRANSLATIONS } from './main-i18n-table'
import { greetingFor } from './office/office'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')
const LOCALES = ['es', 'fr', 'de', 'ru', 'ja', 'zh', 'zh-hant', 'ar']

afterEach(() => setOpsMainLocale('en'))

describe('B12 main-content i18n', () => {
  it('English is the identity and unknown strings pass through', () => {
    setOpsMainLocale('en')
    expect(T('Board')).toBe('Board')
    setOpsMainLocale('es')
    expect(T('profile-id-xyz')).toBe('profile-id-xyz')
  })

  it('switches per locale', () => {
    setOpsMainLocale('es')
    expect(opsMainLocale()).toBe('es')
    expect(T('Good morning')).toBe('Buenos días')
    setOpsMainLocale('ja')
    expect(T('Zoom in')).toBe('拡大')
    setOpsMainLocale(null)
    expect(opsMainLocale()).toBe('en')
  })

  it('every locale table has the same complete, non-empty key set', () => {
    const keys = Object.keys(MAIN_TRANSLATIONS.es).sort()
    expect(keys.length).toBeGreaterThan(400)

    for (const l of LOCALES) {
      const row = MAIN_TRANSLATIONS[l]
      expect(row, l).toBeTruthy()
      expect(Object.keys(row).sort(), l).toEqual(keys)

      for (const k of keys) {expect(row[k].trim().length, `${l}:${k}`).toBeGreaterThan(0)}
    }
  })
})

describe('B12 fusion builds', () => {
  it('greets by hour', () => {
    expect(greetingFor(8)).toBe('Good morning')
    expect(greetingFor(14)).toBe('Good afternoon')
    expect(greetingFor(21)).toBe('Good evening')
  })

  it('orbs and board cards carry a Sigil; cards a mono id', () => {
    expect(read('office/office.tsx')).toContain('<Sigil name={o.profile}')
    const board = read('board/board.tsx')
    expect(board).toContain('data-ops-card-id')
    expect(board).toContain('<Sigil')
  })

  it('stylesheet has column glyphs, dotted canvas and a reduced-motion off switch', () => {
    const css = read('ops-base.css')
    expect(css).toContain("[data-ops-column='blocked'] > h3)::before")
    expect(css).toContain('@keyframes ops-think')
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ :where\(\[data-ops-orb\]\[data-ops-thinking\]\) \{ animation: none/)
  })
})
