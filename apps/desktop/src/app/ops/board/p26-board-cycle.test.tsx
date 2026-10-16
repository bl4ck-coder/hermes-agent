// P26 (judge pass 20 #5): the virtualizer's full cycle. Expand a card, scroll it out past the overscan and back, then
// Tab out. The kept card must be the same DOM node in every branch (no remount), keep focus and expansion, and the
// rows after it must sit at the same offsets before and after; leaving the card compacts it to the fixed pitch.
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BoardView, ROW_H } from './board'
import type { BoardData } from './board-model'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
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
const EXPANDED = 1000

const measure = () =>
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const h = this.hasAttribute('data-ops-card-expanded') ? EXPANDED - 6 : this.hasAttribute('data-ops-card') ? ROW_H - 6 : 0

    return { x: 0, y: 0, top: 0, left: 0, right: 200, bottom: h, width: 200, height: h, toJSON: () => ({}) } as DOMRect
  })

const scrollTo = (y: number) => {
  win().scrollTop = y
  fireEvent.scroll(win())
}

/** Top offset of every mounted card inside the window, from the spacers and card pitches (what a layout engine would do). */
const offsets = () => {
  const out = new Map<string, number>()
  let y = 0

  for (const el of [...win().children] as HTMLElement[]) {
    const id = el.getAttribute('data-ops-card')

    if (id) {
      out.set(id, y)
      y += el.hasAttribute('data-ops-card-expanded') ? EXPANDED : ROW_H
    } else {
      y += parseFloat(el.style.height || '0')
    }
  }

  return { at: out, total: y }
}

describe('P26 Board windowed card: expand, scroll out of range, back, Tab out', () => {
  it('keeps the same focused, expanded node through the kept branch and back, with no jump in later rows', () => {
    measure()
    render(<BoardView {...noop} board={tall(80)} viewport={600} />)
    const node = cardEl('todo-2')!
    act(() => node.focus())
    expect(document.activeElement).toBe(node)
    expect(node.hasAttribute('data-ops-card-expanded')).toBe(true)
    // Expanded in place: rows after it are offset by its real pitch.
    expect(offsets().at.get('todo-3')).toBe(2 * ROW_H + EXPANDED)
    expect(offsets().total).toBe(79 * ROW_H + EXPANDED)

    // Far past the overscan: the card leaves the slice and is kept before it. Same node, still focused and expanded.
    scrollTo(5000)
    expect(cardEl('todo-2')).toBe(node)
    expect(node.isConnected).toBe(true)
    expect(document.activeElement).toBe(node)
    expect(node.hasAttribute('data-ops-card-expanded')).toBe(true)
    expect(offsets().at.get('todo-2')).toBe(2 * ROW_H)
    expect(offsets().at.get('todo-50')).toBe(49 * ROW_H + EXPANDED)
    expect(offsets().total).toBe(79 * ROW_H + EXPANDED)
    expect(win().querySelectorAll('[data-ops-card]').length).toBeLessThanOrEqual(Math.ceil(600 / ROW_H) + 8 + 1)

    // Back to the top: the card returns to the slice as the very same node, focus and expansion intact.
    scrollTo(0)
    expect(cardEl('todo-2')).toBe(node)
    expect(document.activeElement).toBe(node)
    expect(node.hasAttribute('data-ops-card-expanded')).toBe(true)
    expect(offsets().at.get('todo-3')).toBe(2 * ROW_H + EXPANDED)
    expect(offsets().at.get('todo-4')).toBe(3 * ROW_H + EXPANDED)

    // Tab out of the card (focus moves outside the column): it compacts, later rows return to the fixed pitch.
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    act(() => outside.focus())
    expect(document.activeElement).toBe(outside)
    expect(cardEl('todo-2')).toBe(node)
    expect(node.hasAttribute('data-ops-card-expanded')).toBe(false)
    expect(document.querySelector('[data-ops-card-expanded]')).toBeNull()
    expect(offsets().at.get('todo-3')).toBe(3 * ROW_H)
    expect(offsets().at.get('todo-9')).toBe(9 * ROW_H)
    expect(offsets().total).toBe(80 * ROW_H)
  })

  it('a card kept after the window (scrolled above it) is the same node when the window comes back down to it', () => {
    measure()
    render(<BoardView {...noop} board={tall(80)} viewport={600} />)
    scrollTo(6000)
    const node = cardEl('todo-62')!
    act(() => node.focus())
    expect(node.hasAttribute('data-ops-card-expanded')).toBe(true)

    scrollTo(0)
    expect(cardEl('todo-62')).toBe(node)
    expect(document.activeElement).toBe(node)
    expect(offsets().at.get('todo-62')).toBe(62 * ROW_H)
    expect(offsets().total).toBe(79 * ROW_H + EXPANDED)

    scrollTo(6000)
    expect(cardEl('todo-62')).toBe(node)
    expect(document.activeElement).toBe(node)
    expect(offsets().at.get('todo-63')).toBe(62 * ROW_H + EXPANDED)

    // Tab to the next card: focus moves with it, the old one compacts and the new one grows; both stay mounted.
    const next = cardEl('todo-63')!
    act(() => next.focus())
    expect(document.activeElement).toBe(next)
    expect(node.hasAttribute('data-ops-card-expanded')).toBe(false)
    expect(next.hasAttribute('data-ops-card-expanded')).toBe(true)
    expect(offsets().at.get('todo-63')).toBe(63 * ROW_H)
    expect(offsets().at.get('todo-64')).toBe(63 * ROW_H + EXPANDED)
  })
})
