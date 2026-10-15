/** P8 B18: typography scale, rhythm, Office strip density, card/row feedback (transform-only, pitch-safe). */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(__dirname, 'ops-base.css'), 'utf8')
const b18 = css.slice(css.indexOf('B18 design layer'))

describe('B18', () => {
  it('has a real type scale: greeting 20, lens 16, section label 11 caps', () => {
    expect(b18).toMatch(/\[data-ops-greeting\] h2\) \{ font-size: 20px/)
    expect(b18).toMatch(/header > h2\) \{ font-size: 16px/)
    expect(b18).toMatch(/fieldset > legend\) \{[^}]*font-size: 11px[^}]*text-transform: uppercase/)
  })

  it('card hover moves by transform only and never touches height or margin (ROW_H pitch)', () => {
    const card = b18.match(/:where\(\[data-ops-card\]:hover\) \{([^}]*)\}/)![1]
    expect(card).toContain('translateY(-1px)')
    expect(card).not.toMatch(/height|margin|padding/)
    expect(b18).toMatch(/\[data-ops-motion='reduced'\] \[data-ops-card\]:hover\) \{ transform: none/)
  })

  it('every B18 rule is zero-specificity', () => {
    for (const line of b18.split('\n').filter(l => l.includes('{') && !l.startsWith('@') && !l.startsWith('/*'))) expect(line.trim().startsWith(':where('), line).toBe(true)
  })
})