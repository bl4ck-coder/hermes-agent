/** P8 B29: skills agent chips with avatars, quiet first-column names, thresholds as a labelled control row. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')
const b29 = read('ops-base.css').slice(read('ops-base.css').indexOf('B29: Skills table'))

describe('B29', () => {
  it('skill agent links render as pill chips (no sigil: its initials would join the accessible name)', () => {
    expect(read('lenses/b4-lenses.tsx')).not.toContain('<Sigil name={a} size={12} />')
    expect(b29).toMatch(/\[data-ops-skill-agents\]\) :where\(button\) \{[^}]*border-radius: 999px/)
  })

  it('thresholds stack label over input, inputs use tabular numerals', () => {
    expect(b29).toMatch(/\[data-ops-thresholds\] > label\) \{[^}]*flex-direction: column/)
    expect(b29).toMatch(/label > input\) \{[^}]*tabular-nums/)
  })

  it('every B29 rule is zero-specificity', () => {
    for (const line of b29.split('\n').filter(l => l.includes('{') && !l.startsWith('@') && !l.startsWith('/*'))) expect(line.trim().startsWith(':where('), line).toBe(true)
  })
})