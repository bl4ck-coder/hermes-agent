/** P8 B14: plural rules, layout pills, residual lens strings, fleet status chips. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { inspectorFields, localizeInspector } from './inspector-i18n'
import { layoutLabel, P, setOpsMainLocale, T } from './main-i18n'
import { MAIN_PLURALS } from './main-i18n-plurals'

afterEach(() => setOpsMainLocale('en'))

describe('B14 plurals', () => {
  it('English uses one/other from the caller', () => {
    expect(P(1, '{n} cards', '{n} card')).toBe('1 card')
    expect(P(3, '{n} cards', '{n} card')).toBe('3 cards')
  })

  it('Russian picks one / few / many', () => {
    setOpsMainLocale('ru')
    expect(P(1, '{n} cards')).toBe('1 карточка')
    expect(P(3, '{n} cards')).toBe('3 карточки')
    expect(P(5, '{n} cards')).toBe('5 карточек')
    expect(P(21, '{n} cards')).toBe('21 карточка')
  })

  it('Arabic has zero / two; Japanese has a single form; numbers are locale formatted', () => {
    setOpsMainLocale('ar')
    expect(P(0, '{n} comments')).toBe('لا تعليقات')
    expect(P(2, '{n} comments')).toBe('تعليقان')
    setOpsMainLocale('ja')
    expect(P(1, '{n} skills')).toBe('1 スキル')
    setOpsMainLocale('de')
    expect(P(1200, '{n} cards')).toBe('1.200 Karten')
  })

  it('every plural key covers all 8 locales with an other (or full) form', () => {
    for (const l of ['es', 'fr', 'de', 'ru', 'ja', 'zh', 'zh-hant', 'ar']) {
      for (const k of Object.keys(MAIN_PLURALS.es)) {
        expect(MAIN_PLURALS[l][k]?.other, `${l}:${k}`).toBeTruthy()
      }
    }
  })
})

describe('B14 labels', () => {
  it('layout pills and inspector column ids translate', () => {
    setOpsMainLocale('es')
    expect(layoutLabel('calendar')).toBe('calendario')
    expect(localizeInspector('ready', inspectorFields('es'))).toBe('lista')
    expect(localizeInspector('3 cards', inspectorFields('es'))).toBe('3 tarjetas')
    expect(T('Add all')).toBe('Agregar todo')
  })

  it('lens strings are wrapped and fleet status chips are coloured', () => {
    const l = readFileSync(join(__dirname, 'lenses/b4-lenses.tsx'), 'utf8')
    expect(l).toContain("T('Add all')")
    expect(l).toContain("P(p.skills.length, '{n} skills', '{n} skill')")
    expect(readFileSync(join(__dirname, 'ops-base.css'), 'utf8')).toContain("[data-ops-fleet-status='failing']")
  })
})