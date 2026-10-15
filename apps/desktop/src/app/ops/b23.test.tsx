/** P8 B23: tables read as tables (quiet sortable caps, sort arrow, avatar agent cell, receding zeroes); Diagnostics as status lights. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')
const b23 = read('ops-base.css').slice(read('ops-base.css').indexOf('B23: tables'))

describe('B23', () => {
  it('non-sortable headers are localized too', () => {
    expect(read('primitives/data-table.tsx')).toContain("typeof column.header === 'string' ? T(column.header) : column.header\n")
  })

  it('sort state is visible: gold header and an arrow per direction', () => {
    expect(b23).toMatch(/th\[aria-sort='ascending'\]\) :where\(button\[data-sort-column\]\)::after \{ content: '↑'/)
    expect(b23).toMatch(/th\[aria-sort='descending'\]\) :where\(button\[data-sort-column\]\)::after \{ content: '↓'/)
  })

  it('fleet agent cell has an avatar; zero counts are marked; fleet copy is localized', () => {
    const src = read('lenses/b4-lenses.tsx')
    expect(src).toContain('<Sigil name={r.name} size={16} />')
    expect(src).toContain("data-ops-zero={r.active ? undefined : ''}")
    expect(src).toContain("T('No agent matches.')")
  })

  it('diagnostics lights: green ok, garnet for every failing capability or bad connection', () => {
    expect(b23).toMatch(/\[data-ops-probe-state='ok'\]\)::before \{ background: #6fbf73/)
    expect(b23).toMatch(/\[data-ops-diag-connection='unreachable'\]\)::before/)
  })

  it('every B23 rule is zero-specificity', () => {
    for (const line of b23.split('\n').filter(l => l.includes('{') && !l.startsWith('@') && !l.startsWith('/*'))) expect(line.trim().startsWith(':where('), line).toBe(true)
  })
})