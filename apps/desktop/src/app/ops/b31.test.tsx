import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = __dirname
const css = readFileSync(join(here, 'ops-base.css'), 'utf8')
const block = css.slice(css.indexOf('/* ---- B31:'))

describe('B31 polish', () => {
  it('keeps every B31 rule zero-specificity', () => {
    expect(block.length).toBeGreaterThan(40)
    const rules = block.split('\n').filter(l => /\{/.test(l) && !l.trim().startsWith('/*') && !/^@(media|container)/.test(l.trim()))
    for (const r of rules) expect(r.trim().startsWith(':where(')).toBe(true)
    expect(block).not.toMatch(/:has\(/)
  })
  it('keeps the probe word for screen readers and spans secrets', () => {
    expect(readFileSync(join(here, 'motion/diagnostics.tsx'), 'utf8')).toMatch(/data-ops-probe-ok/)
    expect(block).toMatch(/dd\[data-ops-field='secrets'\]/)
  })
})
