/** P8 B15: lens/diagnostics/settings strings, nav fallback, empty-state way out, compact compose. */
import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { ComposePanel } from './canvas/compose-view'
import { MAIN_TRANSLATIONS } from './main-i18n-table'
import { setOpsMainLocale } from './main-i18n'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')

afterEach(() => setOpsMainLocale('en'))

describe('B15', () => {
  it('new strings exist in every locale', () => {
    for (const l of ['es', 'fr', 'de', 'ru', 'ja', 'zh', 'zh-hant', 'ar']) {
      for (const k of ['Manage', 'Connect', 'Connected', 'Show all apps', 'Run capability probe', 'Messaging', 'Tools (MCP)', 'Models', 'Install {n}']) {
        expect(MAIN_TRANSLATIONS[l][k], `${l}:${k}`).toBeTruthy()
      }
      expect(MAIN_TRANSLATIONS[l]['Install {n}']).toContain('{n}')
    }
  })

  it('nav labels without a locale copy fall back to the main table', () => {
    expect(read('locales.ts')).toContain("copy.nav[key as keyof OpsCopy['nav']] : T(fallback)")
  })

  it('the Channels empty state offers a way out', () => {
    const l = read('lenses/b4-lenses.tsx')
    expect(l).toContain('data-ops-empty-reset')
    expect(l).toContain("(setFilter('all'), setQ(''), setCat(null))")
  })

  it('compose starts as one line and grows with content', () => {
    render(<ComposePanel edges={[]} profile="p" />)
    const ta = screen.getByLabelText('Describe a change to this agent') as HTMLTextAreaElement
    expect(ta.rows).toBe(1)
    fireEvent.change(ta, { target: { value: 'a\nb' } })
    expect(ta.rows).toBe(3)
  })
})