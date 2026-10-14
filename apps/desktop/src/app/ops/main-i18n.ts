/**
 * B12: Ops main-content i18n. Components wrap visible English in T('...'); OpsShell sets the locale
 * from the Desktop i18n context on every render, so a locale switch re-renders through it.
 * Strings not in the table (profile ids, job names, server text) pass through unchanged.
 */
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
