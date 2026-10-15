import { describe, expect, it } from 'vitest'

import { MAIN_PLURALS } from './main-i18n-plurals'

const KEYS = [
  '{n} lanes',
  '{n} open tasks',
  '{n} members',
  '{n} blocked',
  '{n} running',
  '{n} agents',
  '{n} active',
  '{n} failed',
  '{n} failures in a row',
  '{n} failed runs'
]

// Words that are genuinely the same as English in that language.
const SAME_AS_ENGLISH = new Set(['fr:{n} agents', 'fr:{n} active'])

describe('P8/P9 plurals are translated in every category', () => {
  it('each locale states every Intl.PluralRules category explicitly, in its own language', () => {
    for (const [locale, table] of Object.entries(MAIN_PLURALS)) {
      const cats = new Intl.PluralRules(locale).resolvedOptions().pluralCategories

      for (const k of KEYS) {
        const forms = table[k]
        expect(forms, `${locale} ${k}`).toBeDefined()

        for (const c of cats) {
          const v = forms?.[c]
          expect(v, `${locale} ${k} [${c}] must be explicit`).toBeTypeOf('string')
          expect(v, `${locale} ${k} [${c}]`).toContain('{n}')

          if (!SAME_AS_ENGLISH.has(`${locale}:${k}`)) {
            expect(v, `${locale} ${k} [${c}] is an English fallback`).not.toBe(k)
          }
        }
      }
    }
  })
})
