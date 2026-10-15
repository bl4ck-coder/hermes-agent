import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BoardView, type BoardViewProps, pushBadge, ROW_H } from './board'
import type { BoardData } from './board-model'

afterEach(() => cleanup())

const LONG = 'Migrate the nightly export job to the new storage bucket and verify every downstream report still renders the totals'

const board = (): BoardData => ({
  columns: [
    { name: 'todo', tasks: [{ id: 't_long', title: LONG, status: 'todo', assignee: 'sandhi' }, { id: 't_b', title: 'Short', status: 'todo' }] },
    { name: 'ready', tasks: [] },
    { name: 'running', tasks: [] },
    { name: 'review', tasks: [] },
    { name: 'done', tasks: [] }
  ],
  tenants: [],
  assignees: ['sandhi']
})

const noop = { move: vi.fn(), undo: vi.fn(), archive: vi.fn(), bulkMove: vi.fn(), create: vi.fn() }
const view = (p: Partial<BoardViewProps> = {}) => render(<BoardView {...noop} board={board()} {...p} />)
const badge = () => document.querySelector('[data-ops-push]')

describe('P24a Board push badge (judge pass 18)', () => {
  it('only a live stream may say Connected when the refresh failed', () => {
    expect(pushBadge('stream', 'HTTP 502')).toEqual({ state: 'stale', text: 'Connected, board not updated' })
    expect(pushBadge('connecting', 'HTTP 502')).toEqual({ state: 'stale', text: 'Connecting, board not updated' })
    expect(pushBadge('poll', 'HTTP 502')).toEqual({ state: 'stale', text: 'Polling, board not updated' })
    expect(pushBadge(undefined, 'HTTP 502')).toBeNull()
    expect(pushBadge('stream', null)).toEqual({ state: 'stream', text: 'Live' })
    expect(pushBadge('connecting', null)).toEqual({ state: 'connecting', text: 'Connecting' })
  })

  it('error while connecting never renders Connected', () => {
    view({ error: 'HTTP 502', pushMode: 'connecting' })
    expect(badge()?.textContent).toBe('Connecting, board not updated')
    expect(badge()?.textContent).not.toMatch(/^Connected/)
    expect(badge()?.getAttribute('data-ops-push')).toBe('stale')
    expect(badge()?.getAttribute('data-ops-push-transport')).toBe('connecting')
  })

  it('error while streaming says Connected, board not updated; unknown transport makes no claim', () => {
    view({ error: 'HTTP 502', pushMode: 'stream' })
    expect(badge()?.textContent).toBe('Connected, board not updated')
    cleanup()
    view({ error: 'HTTP 502' })
    expect(badge()).toBeNull()
    // The stale notice still says the board was not refreshed.
    expect(document.querySelector('[data-ops-board-stale]')?.textContent).toContain('HTTP 502')
  })
})

describe('P24a Board card: full title on focus, metadata back on blur', () => {
  const card = () => document.querySelector('[data-ops-card="t_long"]') as HTMLElement
  const title = () => card().querySelector('[data-ops-open-task]') as HTMLButtonElement

  it('the title button carries the whole title (accessible name and hover title), not a cut copy', () => {
    view()
    expect(title().textContent).toBe(LONG)
    expect(title().getAttribute('title')).toBe(LONG)
  })

  it('focus expands the card in flow and keeps meta; blur restores the windowed card', () => {
    view()
    expect(card().hasAttribute('data-ops-card-expanded')).toBe(false)
    expect(card().style.height).toBe(`${ROW_H - 6}px`)

    fireEvent.focus(title())
    expect(card().hasAttribute('data-ops-card-expanded')).toBe(true)
    expect(card().style.height).toBe('')
    expect(card().style.minHeight).toBe(`${ROW_H - 6}px`)
    // Assignee and quick actions are both in the DOM: the strip no longer replaces the metadata.
    expect(card().querySelector('[data-ops-assignee]')?.textContent).toContain('sandhi')
    expect(card().querySelector('[data-ops-quick]')).toBeTruthy()

    // Moving focus inside the card (to a quick action) keeps it expanded.
    const pin = card().querySelector('[data-ops-pin]') as HTMLButtonElement
    fireEvent.blur(title(), { relatedTarget: pin })
    expect(card().hasAttribute('data-ops-card-expanded')).toBe(true)

    // Leaving the card restores it.
    const other = document.querySelector('[data-ops-card="t_b"]') as HTMLElement
    fireEvent.blur(pin, { relatedTarget: other })
    expect(card().hasAttribute('data-ops-card-expanded')).toBe(false)
    expect(card().style.height).toBe(`${ROW_H - 6}px`)
  })

  it('stylesheet: expanded card unclamps the title, shows meta, puts actions on their own row; hover no longer hides meta on focus', () => {
    const css = readFileSync(join(__dirname, '../ops-base.css'), 'utf8')
    expect(css).toContain(":where([data-ops-card][data-ops-card-expanded]) { grid-template-areas: 'chk title title' 'chk who sig' 'chk quick quick'")
    expect(css).toMatch(/\[data-ops-card-expanded\]\) :where\(\[data-ops-open-task\]\) \{ display: block; -webkit-line-clamp: none/)
    expect(css).toMatch(/\[data-ops-card-expanded\]\) > :where\(\[data-ops-assignee\], \[data-ops-card-signals\]\) \{ visibility: visible/)
    expect(css).toMatch(/\[data-ops-card-expanded\]\) > :where\(\[data-ops-quick\]\) \{ grid-area: quick; position: static/)
    expect(css).not.toContain(':where([data-ops-card]:hover, [data-ops-card]:focus-within) > :where([data-ops-assignee], [data-ops-card-signals]) { visibility: hidden; }')
  })
})
