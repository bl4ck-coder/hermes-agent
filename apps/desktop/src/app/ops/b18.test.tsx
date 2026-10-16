/** P8 B18: typography scale, rhythm, Office strip density, card/row feedback (transform-only, pitch-safe). */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(__dirname, 'ops-base.css'), 'utf8')
const b18 = css.slice(css.indexOf('B18 design layer'))

describe('B18', () => {
  // B41: the B18 scale is superseded by the hierarchy spec tokens (styles/hierarchy.css): lens = page, section = section, greeting demoted.
  it('has a real type scale on the hierarchy tokens: lens = page title, section headings = section, greeting demoted', () => {
    expect(b18).toMatch(/header > h2\) \{ font-size: var\(--type-page/)
    expect(b18).toMatch(/fieldset > legend\) \{[^}]*font-size: var\(--type-section[^}]*text-transform: none/)
    expect(b18).toMatch(/\[data-ops-greeting\] h2\) \{ font-size: var\(--type-section/)
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