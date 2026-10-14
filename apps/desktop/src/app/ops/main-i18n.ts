/**
 * B12: Ops main-content i18n. Components wrap visible English in T('...'); OpsShell sets the locale
 * from the Desktop i18n context on every render, so a locale switch re-renders through it.
 * Strings not in the table (profile ids, job names, server text) pass through unchanged.
 */
import { LAYOUT_LABELS, MAIN_PLURALS } from './main-i18n-plurals'
import { MAIN_TRANSLATIONS } from './main-i18n-table'

let locale = 'en'

export function setOpsMainLocale(next: string | null | undefined): void {
  locale = next || 'en'
}

export function opsMainLocale(): string {
  return locale
}

export function T(s: string): string {
  const row = MAIN_TRANSLATIONS[locale]

  return (row && row[s]) || s
}

const rules = new Map<string, Intl.PluralRules>()

/**
 * B14: a count with proper plural rules. `other` is the English key ('{n} cards'); `one` the English
 * singular. Locales pick their CLDR category (ru one/few/many, ar zero..many, ja/zh other).
 */
export function P(n: number, other: string, one?: string): string {
  const forms = MAIN_PLURALS[locale]?.[other]
  const fmt = (s: string) => s.replace('{n}', new Intl.NumberFormat(locale === 'en' ? 'en' : locale).format(n))

  if (!forms) {
    return fmt(n === 1 && one ? one : other)
  }

  let r = rules.get(locale)

  if (!r) {
    r = new Intl.PluralRules(locale)
    rules.set(locale, r)
  }

  const cat = n === 0 && forms.zero ? 'zero' : r.select(n)

  return fmt(forms[cat] ?? forms.other ?? other)
}

/** B14: board layout pill label. */
export function layoutLabel(id: string): string {
  return LAYOUT_LABELS[locale]?.[id] ?? T(id)
}
