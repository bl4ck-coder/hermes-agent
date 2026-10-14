/** P8 B26: Office frame budget: no unscoped :has() (it re-matches on every Office DOM update). */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(__dirname, 'ops-base.css'), 'utf8')

describe('B26', () => {
  it('no subject-less :has() and no :has() on the board toolbar', () => {
    expect(css).not.toMatch(/:where\(:has\(/)
    expect(css).not.toMatch(/\[role='toolbar'\]:has/)
    expect(css).toMatch(/:where\(\[data-ops-board-toolbar\]\) \{ flex-wrap: nowrap/)
  })

  it('the board toolbar carries its attribute', () => {
    expect(readFileSync(join(__dirname, 'board/board.tsx'), 'utf8')).toContain('<div data-ops-board-toolbar="" role="toolbar">')
  })
})