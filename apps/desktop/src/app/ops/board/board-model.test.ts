import { describe, expect, it, vi } from 'vitest'

import {
  type BoardData,
  counts,
  createBoardClient,
  filterBoard,
  groupByDay,
  isBoard,
  keyboardTarget,
  moveLocal,
  serverMove,
  statusOf,
  timelineOrder,
  windowRange
} from './board-model'

const b: BoardData = {
  columns: [
    { name: 'triage', tasks: [] },
    { name: 'todo', tasks: [{ id: 't1', title: 'Alpha', status: 'todo', assignee: 'sandhi', tenant: 'ops', created_at: 86400 }] },
    { name: 'ready', tasks: [{ id: 't2', title: 'Beta', status: 'ready', assignee: 'builder', tenant: 'x', project_id: 'p' }] },
    { name: 'running', tasks: [{ id: 't3', title: 'Gamma', status: 'running', current_run_started_at: 5 }] },
    { name: 'review', tasks: [] },
    { name: 'done', tasks: [] }
  ]
}

describe('board model (P4-01)', () => {
  it('validates shape and filters by tenant, profile, project, mine and text with backend-equal counts', () => {
    expect(isBoard({ columns: 'x' })).toBe(false)
    expect(isBoard(b)).toBe(true)
    expect(counts(filterBoard(b, {}))).toEqual({ triage: 0, todo: 1, ready: 1, running: 1, review: 0, done: 0 })
    expect(counts(filterBoard(b, { tenant: 'ops' })).todo).toBe(1)
    expect(counts(filterBoard(b, { tenant: 'ops' })).ready).toBe(0)
    expect(counts(filterBoard(b, { mine: 'builder' })).ready).toBe(1)
    expect(counts(filterBoard(b, { project: 'p' })).todo).toBe(0)
    expect(counts(filterBoard(b, { text: 'gam' })).running).toBe(1)
    expect(counts(filterBoard(b, { profile: 'sandhi' })).todo).toBe(1)
  })

  it('moves locally and never into unknown columns', () => {
    const m = moveLocal(b, 't1', 'ready')
    expect(statusOf(m, 't1')).toBe('ready')
    expect(m.columns[2].tasks[0].status).toBe('ready')
    expect(moveLocal(b, 't1', 'nope')).toBe(b)
    expect(moveLocal(b, 'zz', 'ready')).toBe(b)
  })

  it('keyboard move skips running and stops at the edges', () => {
    expect(keyboardTarget(b, 't2', 1)).toBe('review')
    expect(keyboardTarget(b, 't1', -1)).toBe('triage')
    expect(keyboardTarget({ columns: [{ name: 'done', tasks: [{ id: 'd', title: 'd', status: 'done' }] }] }, 'd', 1)).toBeNull()
  })

  it('server refusal snaps back with the server reason; success returns an undo record', async () => {
    const seen: string[] = []
    const refused = await serverMove(b, 't1', 'done', () => Promise.reject(new Error('unsatisfied parent dependencies')), x => seen.push(statusOf(x, 't1')!))
    expect(seen).toEqual(['done'])
    expect(refused.ok).toBe(false)
    expect(refused.board).toBe(b)
    expect(refused.reason).toMatch(/unsatisfied parent/)
    const ok = await serverMove(b, 't1', 'ready', () => Promise.resolve({}))
    expect(ok.undo).toEqual({ id: 't1', from: 'todo', to: 'ready' })
    const run = await serverMove(b, 't1', 'running', vi.fn())
    expect(run.ok).toBe(false)
  })

  it('groups calendar days, orders the timeline and windows rows', () => {
    const days = groupByDay([...b.columns[1].tasks, ...b.columns[3].tasks])
    expect(days.map(([d]) => d)).toEqual(['1970-01-02', 'unknown'])
    expect(timelineOrder(b.columns.flatMap(c => c.tasks)).map(t => t.id)).toEqual(['t3', 't1', 't2'])
    expect(windowRange(400, 0, 600, 40)).toEqual({ start: 0, end: 19, padTop: 0, padBottom: 381 * 40 })
    expect(windowRange(400, 4000, 600, 40).start).toBe(96)
  })

  it('client sends PATCH status, bulk and archive to the kanban plugin', async () => {
    const api = vi.fn().mockResolvedValue({})
    const c = createBoardClient(api)
    await c.move('t1', 'ready')
    await c.bulk(['a', 'b'], { archive: true })
    await c.archive('t9')
    expect(api.mock.calls[0][0]).toMatchObject({ method: 'PATCH', path: '/api/plugins/kanban/tasks/t1', body: { status: 'ready' } })
    expect(api.mock.calls[1][0]).toMatchObject({ method: 'POST', path: '/api/plugins/kanban/tasks/bulk', body: { ids: ['a', 'b'], archive: true } })
    expect(api.mock.calls[2][0].body).toEqual({ status: 'archived' })
  })
})
