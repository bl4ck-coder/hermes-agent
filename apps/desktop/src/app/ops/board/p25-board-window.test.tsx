// P25 (judge pass 19 #4): a focused card grows in flow, so the column window must use its real height.
// The fixed-pitch window used to skip a tall focused card still crossing the viewport and jump later rows.
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BoardView, ROW_H } from './board'
import { type BoardData, windowRange } from './board-model'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('P25 windowRange with one expanded row (judge pure control)', () => {
  it('a 1000px expanded first card scrolled by 600 stays in the window', () => {
    // Before P25 the fixed pitch said start 2: the visible card was unmounted.
    const w = windowRange(20, 600, 600, 100, 4, { index: 0, pitch: 1000 })
    expect(w.start).toBe(0)
    expect(w.end).toBe(7)
    expect(w.padTop).toBe(0)
    // Total height counts the real pitch: 19 rows of 100 + 1000.
    expect(w.padTop + 1000 + (w.end - 1) * 100 + w.padBottom).toBe(2900)
  })

  it('later rows are offset by the expanded row real height', () => {
    // Row 1 starts at 1000, row 2 at 1100: scrolled to 1500, rows 0..5 have ended, so the window starts at 6 - 4.
    const w = windowRange(20, 1500, 600, 100, 4, { index: 0, pitch: 1000 })
    expect(w.start).toBe(2)
    // Row 2 starts after the real 1000px of row 0 plus row 1: 1100. Row 0, scrolled out but focused, is kept before.
    expect(w.padTop + 1000 + (w.kept?.gap ?? 0)).toBe(1100)
    expect(w.kept).toEqual({ index: 0, side: 'before', gap: 100 })
    expect(w.end).toBe(16)
    expect(w.padBottom).toBe(2900 - (1000 + 15 * 100))
  })

  it('an expanded row far outside the viewport is still kept mounted, and the window stays bounded', () => {
    const w = windowRange(80, 6000, 600, 100, 4, { index: 0, pitch: 1000 })
    expect(w.start).toBe(47)
    expect(w.end).toBe(61)
    expect(w.end - w.start).toBeLessThanOrEqual(Math.ceil(600 / 100) + 8)
    // Spacer before the kept row is its own offset (0), then the row, then the gap up to the window.
    expect(w.padTop).toBe(0)
    expect(w.kept).toEqual({ index: 0, side: 'before', gap: 4700 + 900 - 1000 })
    expect(w.padTop + 1000 + (w.kept?.gap ?? 0) + (w.end - w.start) * 100 + w.padBottom).toBe(79 * 100 + 1000)
  })

  it('an expanded row below the window is kept after it', () => {
    const w = windowRange(80, 0, 600, 100, 4, { index: 70, pitch: 1000 })
    expect(w.start).toBe(0)
    expect(w.end).toBe(10)
    expect(w.kept).toEqual({ index: 70, side: 'after', gap: 7000 - 1000 })
    expect(w.padBottom).toBe(9 * 100)
  })

  it('without an expanded row the window is the fixed-pitch one', () => {
    expect(windowRange(400, 0, 600, 40, 4, null)).toEqual({ start: 0, end: 19, padTop: 0, padBottom: 381 * 40 })
    expect(windowRange(400, 4000, 600, 40, 4, { index: 999, pitch: 900 }).start).toBe(96)
  })
})

const tall = (n: number): BoardData => ({
  columns: [
    { name: 'todo', tasks: Array.from({ length: n }, (_, i) => ({ id: `todo-${i}`, title: `Card ${i}`, status: 'todo' })) },
    { name: 'ready', tasks: [] },
    { name: 'running', tasks: [] },
    { name: 'review', tasks: [] },
    { name: 'done', tasks: [] }
  ],
  tenants: [],
  assignees: []
})

const noop = { move: vi.fn(), undo: vi.fn(), archive: vi.fn(), bulkMove: vi.fn(), create: vi.fn() }
const cardEl = (id: string) => document.querySelector(`[data-ops-card="${id}"]`) as HTMLElement | null
const win = () => document.querySelector('[data-ops-column="todo"] [data-ops-window]') as HTMLElement

// jsdom has no layout: the expanded card measures 994px (+6px gap = 1000px pitch); every other card its fixed height.
const measure = () =>
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const h = this.hasAttribute('data-ops-card-expanded') ? 994 : this.hasAttribute('data-ops-card') ? ROW_H - 6 : 0

    return { x: 0, y: 0, top: 0, left: 0, right: 200, bottom: h, width: 200, height: h, toJSON: () => ({}) } as DOMRect
  })

const scrollTo = (y: number) => {
  win().scrollTop = y
  fireEvent.scroll(win())
}

describe('P25 Board focused card: focus, scroll, blur', () => {
  it('keeps the tall focused card mounted while it crosses the viewport, offsets later cards, and releases it on blur', () => {
    measure()
    render(<BoardView {...noop} board={tall(80)} viewport={600} />)
    fireEvent.focus(cardEl('todo-0')!)
    expect(cardEl('todo-0')?.hasAttribute('data-ops-card-expanded')).toBe(true)

    scrollTo(600)
    // The expanded card still covers 600..1000 of the viewport: it stays, in order, first in the window.
    expect(cardEl('todo-0')).toBeTruthy()
    const items = [...win().querySelectorAll('[data-ops-card]')].map(e => e.getAttribute('data-ops-card'))
    expect(items[0]).toBe('todo-0')
    expect(items[1]).toBe('todo-1')
    expect((win().firstElementChild as HTMLElement).style.height).toBe('0px')

    // Far below, the focused card is kept mounted at its place (focus is never lost), the window stays bounded.
    scrollTo(6000)
    expect(cardEl('todo-0')?.hasAttribute('data-ops-card-expanded')).toBe(true)
    expect(cardEl('todo-50')).toBeTruthy()
    expect(win().querySelectorAll('[data-ops-card]').length).toBeLessThanOrEqual(Math.ceil(600 / ROW_H) + 8 + 1)
    // Spacers + rows add up to the real column height: 79 rows of ROW_H + the 1000px card.
    const total = [...win().children].reduce((s, el) => s + (el.hasAttribute('data-ops-card') ? (el.hasAttribute('data-ops-card-expanded') ? 1000 : ROW_H) : parseFloat((el as HTMLElement).style.height || '0')), 0)
    expect(total).toBe(79 * ROW_H + 1000)

    // Blur: back to the fixed pitch; the card, now out of view, is released.
    fireEvent.blur(cardEl('todo-0')!, { relatedTarget: null })
    expect(cardEl('todo-0')).toBeNull()
    expect(document.querySelector('[data-ops-card-expanded]')).toBeNull()
    expect((win().firstElementChild as HTMLElement).style.height).toBe(`${56 * ROW_H}px`)
  })
})
