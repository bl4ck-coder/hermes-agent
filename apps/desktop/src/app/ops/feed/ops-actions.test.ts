import { describe, expect, it, vi } from 'vitest'

import { createOpsActions, envPresenceList } from './ops-actions'

describe('ops actions (P6)', () => {
  it('kanban actions comment first, then a server-validated transition', async () => {
    const api = vi.fn().mockResolvedValue({})
    const a = createOpsActions(api)
    await a.kanban({ kind: 'unblock', taskId: 't1', note: 'creds' })
    expect(api.mock.calls[0][0]).toMatchObject({ method: 'POST', path: '/api/plugins/kanban/tasks/t1/comments', body: { body: 'Unblocked from Ops: creds' } })
    expect(api.mock.calls[1][0]).toMatchObject({ method: 'PATCH', body: { status: 'ready' } })
    await a.kanban({ kind: 'approve_review', taskId: 't2' })
    expect(api.mock.calls[2][0]).toMatchObject({ path: '/api/plugins/kanban/tasks/t2', body: { status: 'done' } })
    await expect(a.kanban({ kind: 'request_changes', taskId: 't3', note: ' ' })).rejects.toThrow('note')
  })

  it('cron trigger, subtask and archived board hit existing routes', async () => {
    const api = vi.fn().mockResolvedValue({ latest_event_id: 7 })
    const a = createOpsActions(api)
    await a.cronTrigger('j 1')
    await a.createSubtask('p1', 'child', 'sandhi')
    await a.archivedBoard()
    expect(await a.latestEventId()).toBe(7)
    expect(api.mock.calls[0][0].path).toBe('/api/cron/jobs/j%201/trigger')
    expect(api.mock.calls[1][0].body).toEqual({ title: 'child', assignee: 'sandhi', parents: ['p1'] })
    expect(api.mock.calls[2][0].path).toContain('include_archived=true')
  })

  it('a missing bridge rejects instead of throwing', async () => {
    const a = createOpsActions(() => {
      throw new Error('no bridge')
    })

    await expect(a.taskDetail('x')).rejects.toThrow('no bridge')
  })

  it('env presence exposes names and set/unset only', () => {
    expect(envPresenceList(null)).toBeNull()
    const out = envPresenceList({ B_KEY: { is_set: true, redacted_value: 'sk-…' } as never, A_KEY: { is_set: false } })
    expect(out).toEqual([{ name: 'A_KEY', set: false }, { name: 'B_KEY', set: true }])
    expect(JSON.stringify(out)).not.toContain('sk-')
  })
})
