import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BoardContainer } from '../board/board-container'
import { OfficeView } from '../office/office'

import { createKanbanStream, KANBAN_STREAM_PATH, parseKanbanFrame } from './kanban-stream'
import type { OpsSseBridge } from './ops-feed'

afterEach(() => cleanup())

type Payload = Parameters<Parameters<OpsSseBridge['onEvent']>[0]>[0]

function fakeBridge(ended = false) {
  let cb: ((p: Payload) => void) | null = null

  const bridge: OpsSseBridge = {
    open: vi.fn().mockResolvedValue({ subscriptionId: 's1', ended }),
    close: vi.fn().mockResolvedValue(undefined),
    onEvent: c => ((cb = c), () => (cb = null))
  }

  return { bridge, emit: (p: Payload) => cb?.(p) }
}

const frame = (id: number, kind = 'status_changed', task = 't1') => ({
  subscriptionId: 's1',
  type: 'event' as const,
  event: 'kanban',
  data: JSON.stringify({ id, task_id: task, kind, payload: { status: 'ready' }, created_at: 60 })
})

describe('kanban push stream (P7 F1)', () => {
  it('parses task_events rows and rejects malformed frames', () => {
    expect(parseKanbanFrame('{"id":1,"task_id":"t","kind":"x","created_at":1}')?.kind).toBe('x')
    expect(parseKanbanFrame('{"id":"1"}')).toBeNull()
    expect(parseKanbanFrame('nope')).toBeNull()
  })

  it('opens the allowlisted kanban path, dedupes by id, ignores foreign subscriptions, falls back on end', async () => {
    const { bridge, emit } = fakeBridge()
    const s = createKanbanStream({ bridge })
    s.start()
    await waitFor(() => expect(s.getState().mode).toBe('stream'))
    expect(bridge.open).toHaveBeenCalledWith({ path: KANBAN_STREAM_PATH })
    emit(frame(1))
    emit(frame(1))
    emit({ ...frame(2), subscriptionId: 'other' })
    expect(s.getState().events.map(e => e.id)).toEqual([1])
    expect(s.getState().version).toBe(1)
    emit({ subscriptionId: 's1', type: 'end', code: 'gone' })
    expect(s.getState().mode).toBe('poll')
    s.stop()
  })

  it('no bridge means poll mode', () => {
    const s = createKanbanStream({ bridge: null })
    s.start()
    expect(s.getState().mode).toBe('poll')
  })

  it('board reloads on a pushed event (not on the fleet) and shows Live', async () => {
    const { bridge, emit } = fakeBridge()
    const board = vi.fn().mockResolvedValue({ columns: [{ name: 'todo', tasks: [] }] })
    const client = { board, move: vi.fn(), bulk: vi.fn(), create: vi.fn() } as never
    render(<BoardContainer bridge={bridge} client={client} pollMs={60_000} />)
    await waitFor(() => expect(document.querySelector('[data-ops-push="stream"]')?.textContent).toBe('Live'))
    const before = board.mock.calls.length
    act(() => emit(frame(5)))
    await waitFor(() => expect(board.mock.calls.length).toBeGreaterThan(before))
  })

  it('Office activity lists task events with verbs and opens the task', () => {
    const open = vi.fn()
    render(
      <OfficeView
        activity={[]}
        cron={null}
        fleet={null}
        inFlight={null}
        nowS={0}
        onOpenTask={open}
        pending={null}
        taskEvents={[{ id: 3, task_id: 't9', kind: 'reassigned', payload: { assignee: 'pixel' }, created_at: 0 }]}
        usage={null}
      />
    )
    const row = document.querySelector('[data-ops-task-event="3"]')
    expect(row?.textContent).toContain('handed off to pixel')
    expect(row?.hasAttribute('data-ops-handoff')).toBe(true)
    ;(row?.querySelector('button') as HTMLButtonElement).click()
    expect(open).toHaveBeenCalledWith('t9')
  })
})
