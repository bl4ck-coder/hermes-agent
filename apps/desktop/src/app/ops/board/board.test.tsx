import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BoardView, type BoardViewProps } from './board'
import { BoardContainer } from './board-container'
import type { BoardClient, BoardData } from './board-model'

afterEach(() => cleanup())

const mk = (n: number, status = 'todo') =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, title: `Task ${i}`, status, assignee: i % 2 ? 'sandhi' : 'builder', tenant: 'ops', created_at: 86400 }))

const board = (n = 3): BoardData => ({
  columns: [
    { name: 'todo', tasks: mk(n) },
    { name: 'ready', tasks: [] },
    { name: 'running', tasks: [] },
    { name: 'review', tasks: [{ id: 'r1', title: 'Review me', status: 'review' }] },
    { name: 'done', tasks: [] }
  ],
  tenants: ['ops'],
  assignees: ['builder', 'sandhi']
})

const noop = { move: vi.fn(), undo: vi.fn(), archive: vi.fn(), bulkMove: vi.fn(), create: vi.fn() }
const view = (p: Partial<BoardViewProps> = {}) => render(<BoardView {...noop} board={board()} {...p} />)

const fakeClient = (over: Partial<BoardClient> = {}) =>
  ({
    board: vi.fn().mockResolvedValue(board()),
    move: vi.fn().mockResolvedValue({}),
    bulk: vi.fn().mockResolvedValue({ results: [] }),
    archive: vi.fn(),
    assign: vi.fn(),
    create: vi.fn().mockResolvedValue({}),
    ...over
  }) as unknown as BoardClient

const feedClient = { fleet: () => Promise.resolve({ profiles: [], now: 0 }) }

describe('Board view (P4-02)', () => {
  it('counts equal the backend rows and filters by profile, tenant and text', () => {
    view()
    expect(document.querySelector('[data-ops-count="todo"]')?.textContent).toBe('3')
    fireEvent.change(screen.getByLabelText('profile'), { target: { value: 'sandhi' } })
    expect(document.querySelector('[data-ops-count="todo"]')?.textContent).toBe('1')
    fireEvent.change(screen.getByLabelText('filter'), { target: { value: 'zzz' } })
    expect(document.querySelector('[data-ops-count="todo"]')?.textContent).toBe('0')
  })

  it('switches every layout and the Review lens', () => {
    view()

    for (const l of ['list', 'table', 'calendar', 'timeline']) {
      fireEvent.click(document.querySelector(`[data-ops-layout="${l}"]`)!)
      expect(document.querySelector(`[data-ops-board="${l}"]`)).toBeTruthy()
    }

    expect(document.querySelectorAll('[data-ops-timeline-item]').length).toBe(4)
    fireEvent.click(document.querySelector('[data-ops-layout="review"]')!)
    expect([...document.querySelectorAll('[data-ops-column]')].map(e => e.getAttribute('data-ops-column'))).toEqual(['review'])
  })

  it('keyboard Alt+Arrow moves skipping running, menu moves, bulk bar, + Add and drawer', () => {
    const move = vi.fn()
    const bulkMove = vi.fn()
    const create = vi.fn()
    view({ move, bulkMove, create })
    fireEvent.keyDown(document.querySelector('[data-ops-card="t0"]')!, { key: 'ArrowRight', altKey: true })
    expect(move).toHaveBeenLastCalledWith('t0', 'ready')
    fireEvent.change(screen.getByLabelText('move t1'), { target: { value: 'done' } })
    expect(move).toHaveBeenLastCalledWith('t1', 'done')
    expect(screen.getByLabelText('move t1').textContent).not.toContain('running')
    fireEvent.click(screen.getByLabelText('select t0'))
    fireEvent.click(screen.getByText('Move selected'))
    expect(bulkMove).toHaveBeenCalledWith(['t0'], 'ready')
    fireEvent.click(document.querySelector('[data-ops-add="todo"]')!)
    fireEvent.change(screen.getByLabelText('new task in todo'), { target: { value: 'New one' } })
    fireEvent.submit(screen.getByLabelText('new task in todo').closest('form')!)
    expect(create).toHaveBeenCalledWith('New one', 'todo')
    fireEvent.click(document.querySelector('[data-ops-open-task="t2"]')!)
    fireEvent.click(screen.getByText('Full page'))
    expect(document.querySelector('[data-ops-drawer="full"]')).toBeTruthy()
  })

  it('pins float to the top and read-only hides every write control', () => {
    view()
    fireEvent.click(document.querySelector('[data-ops-pin="t2"]')!)
    expect(document.querySelector('[data-ops-column="todo"] [data-ops-card]')?.getAttribute('data-ops-card')).toBe('t2')
    cleanup()
    view({ readOnly: true })
    expect(document.querySelector('[data-ops-menu]')).toBeNull()
    expect(document.querySelector('[data-ops-add]')).toBeNull()
  })

  it('unknown board renders unknown, not an empty board', () => {
    render(<BoardView {...noop} board={null} />)
    expect(screen.getByText('Board is loading (unknown).')).toBeTruthy()
  })
})

describe('Board container (P4-02)', () => {
  it('server refusal snaps the card back and shows the reason; success offers Undo', async () => {
    const client = fakeClient({ move: vi.fn().mockRejectedValueOnce(new Error('blocked by parent(s) not done')).mockResolvedValue({}) })
    render(<BoardContainer client={client} feedClient={feedClient} />)
    await waitFor(() => expect(document.querySelector('[data-ops-count="todo"]')?.textContent).toBe('3'))
    await act(async () => {
      fireEvent.change(screen.getByLabelText('move t0'), { target: { value: 'ready' } })
    })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('blocked by parent'))
    expect(document.querySelector('[data-ops-count="todo"]')?.textContent).toBe('3')
    await act(async () => {
      fireEvent.change(screen.getByLabelText('move t0'), { target: { value: 'ready' } })
    })
    await waitFor(() => expect(document.querySelector('[data-ops-undo]')).toBeTruthy())
    expect(client.move).toHaveBeenLastCalledWith('t0', 'ready')
  })

  it('bulk partial failures are reported per id', async () => {
    const client = fakeClient({ bulk: vi.fn().mockResolvedValue({ results: [{ id: 't0', ok: false, error: 'not found' }] }) })
    render(<BoardContainer client={client} feedClient={feedClient} />)
    await waitFor(() => expect(screen.getByLabelText('select t0')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('select t0'))
    await act(async () => {
      fireEvent.click(screen.getByText('Archive selected'))
    })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('t0 (not found)'))
    expect(client.bulk).toHaveBeenCalledWith(['t0'], { archive: true })
  })

  it('polls as the fallback and treats a malformed board as unavailable', async () => {
    const client = fakeClient({ board: vi.fn().mockResolvedValue({ columns: 'x' }) })
    render(<BoardContainer client={client} feedClient={feedClient} pollMs={20} />)
    await waitFor(() => expect(screen.getByText(/malformed board/)).toBeTruthy())
    await waitFor(() => expect((client.board as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(2))
  })
})
