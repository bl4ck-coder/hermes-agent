/** P8 B16: diagnostics localized at render (report stays English), drag live-region announcements. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { MAIN_TRANSLATIONS } from './main-i18n-table'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')

describe('B16', () => {
  it('capability labels and connection lines translate in every locale, keeping placeholders', () => {
    for (const l of ['es', 'fr', 'de', 'ru', 'ja', 'zh', 'zh-hant', 'ar']) {
      for (const k of ['Fleet feed', 'Kanban board', 'Pending approvals', 'Usage today', 'Node editor', 'available']) expect(MAIN_TRANSLATIONS[l][k], `${l}:${k}`).toBeTruthy()
      expect(MAIN_TRANSLATIONS[l]['Connected to Hermes {v}.']).toContain('{v}')
      expect(MAIN_TRANSLATIONS[l]['Moved to {col}.']).toContain('{col}')
      expect(MAIN_TRANSLATIONS[l]['Dragging {id}. Drop it on a column, or press Escape to cancel.']).toContain('{id}')
    }
  })

  it('diagnostics localizes at render only; the copied report builder stays English', () => {
    expect(read('motion/diagnostics.tsx')).toContain('connCopy(conn.copy)')
    expect(read('feed/diag.ts')).not.toContain('main-i18n')
  })

  it('board drag announces start, move and same-column drops in a polite live region', () => {
    const b = read('board/board.tsx')
    expect(b).toContain('aria-live="polite" data-ops-sr=""')
    expect(b).toContain("T('Same column: nothing moved.')")
    expect(read('ops-base.css')).toContain(':where([data-ops-sr])')
  })
})