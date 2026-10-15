/** P8 B22: Office below the Orbit, Board card hierarchy, tab fade (opacity only), all motion-guarded. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')
const b22 = read('ops-base.css').slice(read('ops-base.css').indexOf('B22: Office below'))

describe('B22', () => {
  it('tab switch fades with opacity only (no transform: fixed drawers keep their containing block) and respects reduced motion', () => {
    const kf = b22.match(/@keyframes ops-tab-in \{([^\n]*)\}/)![1]
    expect(kf).not.toMatch(/transform|translate|scale/)
    expect(b22).toMatch(/\[data-ops-motion='reduced'\] \[data-ops-panel\]:not\(\[hidden\]\) > \[data-ops-panel-body\]\) \{ animation: none/)
  })

  it('needs-you rows carry an avatar and a kind pill; troubled kinds are garnet', () => {
    const src = read('office/needs-you.tsx')
    expect(src).toContain('<span data-ops-kind={item.origin}>')
    expect(src).toContain('<Sigil name={item.profile} size={20} />') // P14: the row lead slot
    expect(b22).toMatch(/\[data-ops-kind='kanban_blocked'\]/)
  })

  it('board card title leads and column state tints the edge without changing size', () => {
    expect(b22).toMatch(/\[data-ops-open-task\]\) \{ color: var\(--ops-fg\); font-size: 13px; font-weight: 600/)
    const tint = b22.match(/\[data-ops-column='blocked'\] \[data-ops-card\]\) \{([^}]*)\}/)![1]
    expect(tint).toContain('inset')
    expect(tint).not.toMatch(/border-width|height|padding|margin/)
  })

  it('every B22 rule is zero-specificity', () => {
    for (const line of b22.split('\n').filter(l => l.includes('{') && !l.startsWith('@') && !l.startsWith('/*'))) expect(line.trim().startsWith(':where('), line).toBe(true)
  })
})