/**
 * P4 performance proxy for "400 cards at 60 fps on Ignacio" (live fps check pending, Nacho runs it live).
 * Proxy: (1) windowing keeps mounted cards bounded regardless of board size; (2) jsdom render and
 * re-render of a 400-card board stay under a frame-budget multiple. jsdom is far slower than Chromium,
 * so the budgets are generous upper bounds that still catch an O(n) mount regression.
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BoardView, ROW_H } from './board'
import type { BoardData } from './board-model'

afterEach(() => cleanup())

const COLS = ['triage', 'todo', 'ready', 'running', 'blocked', 'review', 'done', 'scheduled']

const big = (n: number, oneColumn = false): BoardData => ({
  columns: COLS.map((name, ci) => ({
    name,
    tasks: Array.from({ length: oneColumn ? (ci === 1 ? n : 0) : n / COLS.length }, (_, i) => ({
      id: `${name}-${i}`,
      title: `Card ${name} ${i}`,
      status: name,
      assignee: 'sandhi'
    }))
  }))
})

const noop = { move: vi.fn(), undo: vi.fn(), archive: vi.fn(), bulkMove: vi.fn(), create: vi.fn() }
const VIEWPORT = 600
const PER_COLUMN_MAX = Math.ceil(VIEWPORT / ROW_H) + 8

describe('Board 400-card performance proxy (P4-03)', () => {
  it('mounts a bounded window, not all 400 cards, in one column', () => {
    render(<BoardView {...noop} board={big(400, true)} viewport={VIEWPORT} />)
    expect(document.querySelector('[data-ops-count="todo"]')?.textContent).toBe('400')
    expect(document.querySelectorAll('[data-ops-card]').length).toBeLessThanOrEqual(PER_COLUMN_MAX)
  })

  it('scrolling moves the window and keeps the mount count bounded', () => {
    render(<BoardView {...noop} board={big(400, true)} viewport={VIEWPORT} />)
    const win = document.querySelector('[data-ops-column="todo"] [data-ops-window]') as HTMLElement
    win.scrollTop = 200 * ROW_H
    fireEvent.scroll(win)
    expect(document.querySelector('[data-ops-card="todo-200"]')).toBeTruthy()
    expect(document.querySelector('[data-ops-card="todo-0"]')).toBeNull()
    expect(document.querySelectorAll('[data-ops-card]').length).toBeLessThanOrEqual(PER_COLUMN_MAX)
  })

  it('renders and re-renders 400 cards across 8 columns within the budget', () => {
    const t0 = performance.now()
    const { rerender } = render(<BoardView {...noop} board={big(400)} viewport={VIEWPORT} />)
    const first = performance.now() - t0
    expect(document.querySelectorAll('[data-ops-card]').length).toBeLessThanOrEqual(COLS.length * PER_COLUMN_MAX)
    const t1 = performance.now()
    rerender(<BoardView {...noop} board={big(400)} viewport={VIEWPORT} />)
    const second = performance.now() - t1
     
    console.info(`[ops-bench] 400 cards: first render ${first.toFixed(1)} ms, re-render ${second.toFixed(1)} ms`)
    expect(first).toBeLessThan(1500)
    expect(second).toBeLessThan(500)
  })
})
