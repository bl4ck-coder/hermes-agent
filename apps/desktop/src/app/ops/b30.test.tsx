import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = __dirname
const css = readFileSync(join(here, 'ops-base.css'), 'utf8')
const block = css.slice(css.indexOf('/* ---- B30:'))

describe('B30 polish', () => {
  it('keeps every B30 rule zero-specificity', () => {
    expect(block.length).toBeGreaterThan(40)
    const rules = block.split('\n').filter(l => /\{/.test(l) && !l.trim().startsWith('/*') && !/^@(media|container)/.test(l.trim()))
    for (const r of rules) expect(r.trim().startsWith(':where(')).toBe(true)
    expect(block).not.toMatch(/:has\(/)
  })
  it('drives the drop highlight through the DOM, not React state', () => {
    const src = readFileSync(join(here, 'board/board.tsx'), 'utf8')
    expect(src).not.toMatch(/setDropCol/)
    expect(src).toMatch(/markDrop\(e\.currentTarget\)/)
    expect(css).toMatch(/\[data-ops-drop='over'\]/)
  })
  it('styles skill names by attribute and tags table cells with their column', () => {
    expect(block).toMatch(/\[data-ops-skill-open\]/)
    expect(readFileSync(join(here, 'primitives/data-table.tsx'), 'utf8')).toMatch(/data-col=\{column\.id\}/)
  })
})
