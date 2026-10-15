import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// B41: the hierarchy spec's floor. No product text below 12px: no sub-0.75rem / sub-12px arbitrary Tailwind sizes in TSX,
// no sub-12px font-size in the Ops stylesheet. Hierarchy comes from the scale, never from shrinking text to fit.
const SRC = join(__dirname, '..')

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)

    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules') files(p, out)
    } else if (name.endsWith('.tsx') && !name.includes('.test.')) {
      out.push(p)
    }
  }

  return out
}

describe('hierarchy spec', () => {
  it('defines the type, spacing and width tokens', () => {
    const css = readFileSync(join(__dirname, 'hierarchy.css'), 'utf8')

    for (const t of ['--type-display', '--type-page', '--type-section', '--type-body', '--type-meta', '--type-caption', '--space-6', '--width-reading', '--width-form', '--width-grid', '--row-min']) {
      expect(css).toContain(t)
    }
  })

  it('keeps every product text size at 12px or above', () => {
    const tiny = /text-\[(0\.(?:[0-6]\d*|7(?:[0-4]\d*)?)rem|(?:[0-9]|1[01])(?:\.\d+)?px)\]/
    const offenders = files(SRC).filter(f => tiny.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
    const ops = readFileSync(join(SRC, 'app', 'ops', 'ops-base.css'), 'utf8')
    expect(ops).not.toMatch(/font-size:\s*(?:[0-9]|1[01])(?:\.\d+)?px/)
    const glass = readFileSync(join(SRC, 'styles', 'glass', 'glass.css'), 'utf8')
    expect(glass).not.toMatch(/font-size:\s*(?:[0-9]|1[01])(?:\.\d+)?px/)
  })
})
