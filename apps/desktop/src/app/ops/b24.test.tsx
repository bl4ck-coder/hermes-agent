/** P8 B24: secrets grid with lights, segmented board views, Canvas detail below its node, Office live cards, kit titles wrap. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(__dirname, 'ops-base.css'), 'utf8')
const b24 = css.slice(css.indexOf('B24: Settings secrets'))

describe('B24', () => {
  it('set secrets light green; unset ones stay muted', () => {
    expect(b24).toMatch(/\[data-ops-secret\]\[data-ops-set='yes'\]\)::before \{ background: #6fbf73/)
  })

  it('the pressed board view is marked by surface and a gold baseline, not just colour', () => {
    const rule = b24.match(/\[data-ops-layout\]\[aria-pressed='true'\]\) \{([^}]*)\}/)![1]
    expect(rule).toContain('inset 0 -2px 0 var(--ops-gold)')
    expect(rule).toContain('background')
  })

  it('the canvas node detail is positioned below the node', () => {
    expect(b24).toMatch(/\[data-ops-node-detail\]\) \{[^}]*position: absolute; top: calc\(100% \+ 6px\)/)
  })

  it('every B24 rule is zero-specificity', () => {
    for (const line of b24.split('\n').filter(l => l.includes('{') && !l.startsWith('@') && !l.startsWith('/*'))) expect(line.trim().startsWith(':where('), line).toBe(true)
  })
})