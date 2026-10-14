/** P8 batch 1: regressions for the P7 self-review findings (stream reconnect, task-tab Stop/Steer, lens states, canvas pan). */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { clampPan, PAN_LIMIT } from './canvas/canvas'
import { TaskTabContainer } from './detail/task-tab'
import { createKanbanStream } from './feed/kanban-stream'
import type { OpsActions, TaskDetail } from './feed/ops-actions'
import type { OpsSseBridge } from './feed/ops-feed'
import { ActivityLensView, ProjectsLensView, TemplatesLensView } from './lenses/lenses'

afterEach(() => (cleanup(), vi.useRealTimers()))

type Payload = Parameters<Parameters<OpsSseBridge['onEvent']>[0]>[0]

const detail = (runs: TaskDetail['runs']): TaskDetail => ({
  task: { id: 't1', title: 'Build', status: 'running', assignee: 'builder' },
  comments: [],
  events: [],
  attachments: [],
  links: { parents: [], children: [] },
  child_results: [],
  runs
})

const live = [{ id: 7, task_id: 't1', profile: 'builder', status: 'running', started_at: 0, ended_at: null }]

const fake = (over: Partial<OpsActions> = {}) =>
  ({
    taskDetail: vi.fn().mockResolvedValue(detail(live)),
    comment: vi.fn().mockResolvedValue({}),
    assignees: vi.fn().mockResolvedValue({ assignees: ['builder'] }),
    terminate: vi.fn().mockResolvedValue({ ok: true }),
    taskLog: vi.fn(),
    ...over
  }) as unknown as OpsActions

describe('P8 batch 1: kanban stream', () => {
  it('reconnects with backoff after the stream ends instead of polling forever', async () => {
    vi.useFakeTimers()
    let cb: ((p: Payload) => void) | null = null

    const bridge: OpsSseBridge = {
      open: vi.fn().mockResolvedValue({ subscriptionId: 's1', ended: false }),
      close: vi.fn().mockResolvedValue(undefined),
      onEvent: c => ((cb = c), () => (cb = null))
    }

    const s = createKanbanStream({ bridge, reconnectMs: [100] })
    s.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(s.getState().mode).toBe('stream')
    cb!({ subscriptionId: 's1', type: 'end', code: 'gone' } as Payload)
    expect(s.getState().mode).toBe('poll')
    await vi.advanceTimersByTimeAsync(100)
    expect(bridge.open).toHaveBeenCalledTimes(2)
    expect(s.getState().mode).toBe('stream')
    s.stop()
  })

  it('a failed open retries; stop cancels the pending retry', async () => {
    vi.useFakeTimers()

    const bridge: OpsSseBridge = {
      open: vi.fn().mockRejectedValue(new Error('down')),
      close: vi.fn(),
      onEvent: () => () => undefined
    }

    const s = createKanbanStream({ bridge, reconnectMs: [50] })
    s.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(s.getState().mode).toBe('poll')
    await vi.advanceTimersByTimeAsync(50)
    expect(bridge.open).toHaveBeenCalledTimes(2)
    s.stop()
    await vi.advanceTimersByTimeAsync(500)
    expect(bridge.open).toHaveBeenCalledTimes(2)
  })
})

describe('P8 batch 1: task tab Stop/Steer', () => {
  it('a refused Steer keeps the typed text and reports the reason', async () => {
    const a = fake({ comment: vi.fn().mockRejectedValue(new Error('worker gone')) })
    render(<TaskTabContainer actions={a} id="t1" pollMs={60_000} />)
    const input = (await screen.findByLabelText('steer')) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'use the fork' } })
    fireEvent.submit(input.closest('form')!)
    await screen.findByText('Refused: worker gone')
    expect(input.value).toBe('use the fork')
  })

  it('Stop on a run that already ended says so and reloads the task', async () => {
    const a = fake({ terminate: vi.fn().mockRejectedValue(new Error('409 run already ended')) })
    render(<TaskTabContainer actions={a} id="t1" pollMs={60_000} />)
    await waitFor(() => expect(document.querySelector('[data-ops-stop]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-ops-stop]')!)
    fireEvent.click(document.querySelector('[data-ops-stop-confirm]')!)
    await screen.findByText('Run already ended.')
    expect((a.taskDetail as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('an old failed run followed by a clean run shows no failure block', async () => {
    const a = fake({
      taskDetail: vi.fn().mockResolvedValue(
        detail([
          { id: 1, task_id: 't1', profile: 'b', status: 'failed', outcome: 'failed', error: 'boom' },
          { id: 2, task_id: 't1', profile: 'b', status: 'done', outcome: 'completed' }
        ])
      )
    })

    render(<TaskTabContainer actions={a} id="t1" pollMs={60_000} />)
    await waitFor(() => expect(document.querySelector('[data-ops-runs]')).toBeTruthy())
    expect(document.querySelector('[data-ops-run-failure]')).toBeNull()
  })

  it('a slow response for the previous task never overwrites the current one', async () => {
    let releaseOld: (d: TaskDetail) => void = () => undefined
    const old = new Promise<TaskDetail>(r => (releaseOld = r))
    const taskDetail = vi.fn((id: string) => (id === 'old' ? old : Promise.resolve({ ...detail([]), task: { id: 'new', title: 'New task', status: 'todo' } })))
    const a = fake({ taskDetail: taskDetail as never })
    const { rerender } = render(<TaskTabContainer actions={a} id="old" pollMs={60_000} />)
    rerender(<TaskTabContainer actions={a} id="new" pollMs={60_000} />)
    await screen.findByText('New task')
    releaseOld({ ...detail([]), task: { id: 'old', title: 'Old task', status: 'todo' } })
    await new Promise(r => setTimeout(r, 10))
    expect(screen.queryByText('Old task')).toBeNull()
  })
})

describe('P8 batch 1: lens empty and loading states', () => {
  it('Activity says connecting while the stream opens, and Resolved has an empty state', () => {
    render(<ActivityLensView connecting events={null} resolved={[]} />)
    expect(document.querySelector('[data-ops-loading]')?.textContent).toMatch(/Connecting/)
    fireEvent.click(screen.getByRole('tab', { name: 'Resolved' }))
    expect(document.querySelector('[data-ops-empty="resolved"]')).toBeTruthy()
  })

  it('Projects and Templates have empty states', () => {
    render(<ProjectsLensView projects={[]} tasks={[]} />)
    render(<TemplatesLensView blueprints={[]} />)
    expect(document.querySelector('[data-ops-empty="projects"]')).toBeTruthy()
    expect(document.querySelector('[data-ops-empty="templates"]')).toBeTruthy()
  })

  it('a blocked localStorage does not break favouriting', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })

    render(<ProjectsLensView projects={[{ id: 'p1', slug: 'p1', name: 'One' }]} tasks={[]} />)
    fireEvent.click(screen.getByLabelText('favourite One'))
    expect(document.querySelector('[data-ops-fav]')).toBeTruthy()
    spy.mockRestore()
  })
})

describe('P8 batch 1: canvas pan', () => {
  it('clamps pan so the graph cannot be lost', () => {
    expect(clampPan({ x: 99_999, y: -99_999 })).toEqual({ x: PAN_LIMIT, y: -PAN_LIMIT })
    expect(clampPan({ x: 10, y: -10 })).toEqual({ x: 10, y: -10 })
  })
})
