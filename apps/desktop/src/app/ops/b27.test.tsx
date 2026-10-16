/** P8 B27: board toolbar is actually a flex row; canvas detail expands in place; settings label/control grid. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(__dirname, 'ops-base.css'), 'utf8')
const b27 = css.slice(css.indexOf('B27: Board toolbar'))

describe('B27', () => {
  it('board toolbar declares display:flex (B26 nowrap was inert on block flow)', () => {
    expect(b27).toMatch(/:where\(\[data-ops-board-toolbar\]\) \{ align-items: center; display: flex/)
  })

  it('canvas detail is in flow, never absolutely positioned over neighbours', () => {
    expect(b27).toMatch(/\[data-ops-node-detail\]\) \{[^}]*position: static/)
  })

  it('settings groups are a two-column grid; a dd without its own dt sits in the control column', () => {
    expect(b27).toMatch(/\[data-ops-settings-group\] > dl\) \{[^}]*display: grid/)
    expect(b27).toMatch(/dl > dd \+ dd\) \{ grid-column: 2/)
  })

  it('every B27 rule is zero-specificity', () => {
    for (const line of b27.split('\n').filter(l => l.includes('{') && !l.startsWith('@') && !l.startsWith('/*'))) expect(line.trim().startsWith(':where('), line).toBe(true)
  })
})