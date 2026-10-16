/** P8 B25: Office frame budget (no repaint-heavy shadows on drifting orbs), Canvas run status pill, single-line board toolbar. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { MAIN_TRANSLATIONS } from './main-i18n-table'

const css = readFileSync(join(__dirname, 'ops-base.css'), 'utf8')
const b25 = css.slice(css.indexOf('B25: Office frame budget'))

describe('B25', () => {
  it('drifting orbs drop their shadow and are hinted for compositing', () => {
    expect(b25).toMatch(/\[data-ops-orrery\]\[data-ops-drift\] \[data-ops-orb\]\) \{ box-shadow: none; will-change: translate/)
  })

  it('run status is a localized pill whose light follows the state and stops under reduced motion', () => {
    expect(readFileSync(join(__dirname, 'canvas/canvas.tsx'), 'utf8')).toContain('{T(run.status)}')
    for (const l of Object.keys(MAIN_TRANSLATIONS)) for (const k of ['idle', 'running', 'streaming', 'error']) expect(MAIN_TRANSLATIONS[l][k], `${l}:${k}`).toBeTruthy()
    expect(b25).toMatch(/\[data-ops-motion='reduced'\] \[data-ops-run-status\]\)::before \{ animation: none/)
  })

  it('every B25 rule is zero-specificity', () => {
    for (const line of b25.split('\n').filter(l => l.includes('{') && !l.startsWith('@') && !l.startsWith('/*'))) expect(line.trim().startsWith(':where('), line).toBe(true)
  })
})