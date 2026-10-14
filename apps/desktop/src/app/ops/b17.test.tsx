/** P8 B17: last connection/notification English, plus the design layer (press, chips, stats, orbit stage). */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { setOpsMainLocale } from './main-i18n'
import { connCopy } from './motion/diagnostics'

const css = readFileSync(join(__dirname, 'ops-base.css'), 'utf8')

afterEach(() => setOpsMainLocale('en'))

describe('B17', () => {
  it('every connection state line localizes and keeps its values', () => {
    setOpsMainLocale('es')
    expect(connCopy('Hermes is unreachable: ECONNREFUSED. Showing the last data, labelled stale.')).toBe('Hermes no responde: ECONNREFUSED. Se muestran los últimos datos, marcados como desactualizados.')
    expect(connCopy('Hermes 0.30.0 is outside this Ops window (0.20.0 to below 0.30.0). Ops is read-only until Desktop or Hermes is updated.')).toContain('0.30.0')
    expect(connCopy('Hermes 0.21.5 lacks a1, a5. Ops is read-only for those features.')).toBe('A Hermes 0.21.5 le falta a1, a5. Ops queda en solo lectura para esas funciones.')
    expect(connCopy('Hermes 0.22.0 is newer than tested (0.21.5); unknown fields are ignored.')).toMatch(/^Hermes 0\.22\.0 es más nuevo.*0\.21\.5/)
    setOpsMainLocale('en')
    expect(connCopy('Hermes 0.21.5 lacks a1. Ops is read-only for those features.')).toBe('Hermes 0.21.5 lacks a1. Ops is read-only for those features.')
  })

  it('notifications route through T and plural P', () => {
    const src = readFileSync(join(__dirname, 'office/notifications.ts'), 'utf8')
    expect(src).toContain("T('Task blocked')")
    expect(src).toContain("P(fresh.length, '{n} approvals are waiting.')")
  })

  it('design layer: press state, reduced-motion guard, orbit rings, quiet chips', () => {
    expect(css).toMatch(/button:active:not\(:disabled\)\) \{ box-shadow: inset/)
    expect(css).toMatch(/:where\(\[data-ops-orrery\]\)::before/)
    expect(css).toMatch(/\[data-ops-motion='reduced'\] \[data-ops-orrery-centre\]\)::before \{ animation: none/)
    expect(css).toMatch(/:where\(\[data-ops-chips\]\) :where\(button\) \{ background: transparent/)
  })
})