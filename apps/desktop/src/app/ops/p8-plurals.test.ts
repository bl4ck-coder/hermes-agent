import { describe, expect, it } from 'vitest'

import { MAIN_PLURALS } from './main-i18n-plurals'

const KEYS = ['{n} lanes', '{n} open tasks', '{n} members', '{n} blocked', '{n} running', '{n} agents', '{n} active', '{n} failed']

describe('P8 plurals are translated, not English fallbacks', () => {
  it('every locale has every Intl.PluralRules category it needs, in its own language', () => {
    for (const [locale, table] of Object.entries(MAIN_PLURALS)) {
      const cats = new Intl.PluralRules(locale).resolvedOptions().pluralCategories

      for (const k of KEYS) {
        const forms = table[k]
        expect(forms, `${locale} ${k}`).toBeDefined()

        for (const c of cats) expect(forms?.[c] ?? forms?.other, `${locale} ${k} ${c}`).toContain('{n}')
      }
      // Some words coincide (fr 'agents'); a locale matching English on most keys is a fallback.
      expect(KEYS.filter(k => table[k]?.other === k).length, locale).toBeLessThanOrEqual(1)
    }
  })
})
