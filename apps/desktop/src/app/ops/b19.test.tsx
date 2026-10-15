/** P8 B19: Needs-you action labels localize, drag disables hover lift (frame budget), trouble counts read as alarms. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { MAIN_TRANSLATIONS } from './main-i18n-table'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')

describe('B19', () => {
  it('Needs-you kinds, actions and retry copy go through T in every locale', () => {
    const src = read('office/needs-you.tsx')
    expect(src).toContain('T(KIND[item.origin] ?? item.origin)')
    expect(src).toContain("T('Retry {action}')")
    for (const l of Object.keys(MAIN_TRANSLATIONS)) for (const k of ['Approve', 'Deny', 'Unblock', 'Run now', 'Command approval', 'Retry {action}']) expect(MAIN_TRANSLATIONS[l][k], `${l}:${k}`).toBeTruthy()
  })

  it('board marks an active drag so cards drop hover lift and transitions while in flight', () => {
    expect(read('board/board.tsx')).toContain("data-ops-drag-active={dragging ? '' : undefined}")
    expect(read('ops-base.css')).toMatch(/\[data-ops-drag-active\]\) :where\(\[data-ops-card\]\) \{ box-shadow: none; transform: none; transition: none/)
  })

  it('failing and overdue counts carry an alarm marker and plural copy', () => {
    const src = read('office/office.tsx')
    expect(src).toContain("P(failing.length, '{n} failing')")
    expect(src).toContain('data-ops-alarm={Number(c.overdue) > 0')
  })
})