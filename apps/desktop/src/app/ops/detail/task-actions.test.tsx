import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createOpsActions, type OpsActions, type TaskDetail } from '../feed/ops-actions'
import type { ApprovalItem } from '../feed/ops-client'
import { NeedsYouQueue } from '../office/needs-you'

import { describeEvent, TaskTabContainer } from './task-tab'

afterEach(() => cleanup())

const running = (): TaskDetail => ({
  task: { id: 't1', title: 'Build', status: 'running', assignee: 'builder', workspace_path: 'C:/ws/t1' },
  comments: [],
  events: [],
  attachments: [],
  links: { parents: [], children: [] },
  child_results: [],
  runs: [{ id: 7, task_id: 't1', profile: 'builder', status: 'running', started_at: 0, ended_at: null }]
})

const fake = (over: Partial<OpsActions> = {}) =>
  ({
    taskDetail: vi.fn().mockResolvedValue(running()),
    comment: vi.fn().mockResolvedValue({}),
    assign: vi.fn().mockResolvedValue({}),
    assignees: vi.fn().mockResolvedValue({ assignees: ['builder', 'pixel'] }),
    terminate: vi.fn().mockResolvedValue({ ok: true }),
    taskLog: vi.fn().mockResolvedValue({ exists: true, content: 'line 1\nline 2', truncated: true, size_bytes: 9, path: 'x' }),
    createSubtask: vi.fn(),
    setStatus: vi.fn(),
    kanban: vi.fn(),
    ...over
  }) as unknown as OpsActions

describe('task actions (P7 F2: O29, O35, O17, O71, R39)', () => {
  it('Stop asks for confirmation, then terminates the live run', async () => {
    const a = fake()
    render(<TaskTabContainer actions={a} id="t1" pollMs={60_000} />)
    await waitFor(() => expect(document.querySelector('[data-ops-stop]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-ops-stop]')!)
    expect(a.terminate).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('[data-ops-stop-confirm]')!)
    await waitFor(() => expect(a.terminate).toHaveBeenCalledWith('7'))
  })

  it('Steer sends a comment through the live worker comment bridge', async () => {
    const a = fake()
    render(<TaskTabContainer actions={a} id="t1" pollMs={60_000} />)
    await waitFor(() => expect(screen.getByLabelText('steer')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('steer'), { target: { value: 'focus on tests' } })
    fireEvent.click(screen.getByText('Steer'))
    await waitFor(() => expect(a.comment).toHaveBeenCalledWith('t1', 'Steer: focus on tests'))
  })

  it('worker log tail, workspace path and the board assignee list', async () => {
    const a = fake()
    render(<TaskTabContainer actions={a} id="t1" pollMs={60_000} />)
    await waitFor(() => expect(document.querySelector('[data-ops-field="workspace"]')?.textContent).toContain('C:/ws/t1'))
    fireEvent.click(screen.getByText('Show worker log'))
    await waitFor(() => expect(document.querySelector('[data-ops-log]')?.textContent).toContain('line 2'))
    await waitFor(() => expect(screen.getByRole('option', { name: 'pixel' })).toBeTruthy())
  })

  it('no worker log says so honestly', async () => {
    const a = fake({ taskLog: vi.fn().mockResolvedValue({ exists: false, content: '', truncated: false, size_bytes: 0, path: '' }) } as never)
    render(<TaskTabContainer actions={a} id="t1" pollMs={60_000} />)
    await waitFor(() => screen.getByText('Show worker log'))
    fireEvent.click(screen.getByText('Show worker log'))
    await waitFor(() => expect(document.querySelector('[data-ops-log]')?.textContent).toMatch(/never spawned/))
  })

  it('handoffs include child links and delegate spawns', () => {
    expect(describeEvent({ id: 1, task_id: 't', kind: 'linked', payload: { parent: 'p', child: 'c9' }, created_at: 0 })).toEqual({ verb: 'spawned child', target: 'c9', handoff: true })
    expect(describeEvent({ id: 2, task_id: 't', kind: 'delegate_spawned', payload: { profile: 'x' }, created_at: 0 }).handoff).toBe(true)
    expect(describeEvent({ id: 3, task_id: 't', kind: 'commented', payload: {}, created_at: 0 }).handoff).toBe(false)
  })

  it('routes: reassign, terminate, log, assignees, run unwrap', async () => {
    const api = vi.fn().mockResolvedValue({ run: { id: 4, task_id: 't', status: 'ended' } })
    const acts = createOpsActions(api as never)
    await acts.assign('t1', 'pixel')
    expect(api.mock.calls[0][0]).toMatchObject({ method: 'POST', path: '/api/plugins/kanban/tasks/t1/reassign', body: { profile: 'pixel', reclaim_first: false } })
    await acts.terminate(7)
    expect(api.mock.calls[1][0]).toMatchObject({ method: 'POST', path: '/api/plugins/kanban/runs/7/terminate' })
    await acts.taskLog('t1', 100)
    expect(api.mock.calls[2][0].path).toBe('/api/plugins/kanban/tasks/t1/log?tail=100')
    expect((await acts.runDetail(4)).status).toBe('ended')
    await acts.kanban({ kind: 'comment', taskId: 't1', note: ' hi ' })
    expect(api.mock.calls.at(-1)?.[0]).toMatchObject({ method: 'POST', body: { body: 'hi' } })
  })
})

describe('inline Deny / Comment (P7 F2: O72)', () => {
  const item = (o: Partial<ApprovalItem>): ApprovalItem =>
    ({ origin: 'jsonrpc', id: 'a1', profile: 'p', session_id: 's', run_id: null, tenant: null, exact_request: { command: 'ls', pattern_keys: [] }, why: 'w', what_for: '', status: 'pending', expires_at: null, age_s: 1, actions: ['approve', 'deny'], ...o }) as ApprovalItem

  it('Deny is one click and labelled separately from Approve', async () => {
    const onDeny = vi.fn().mockResolvedValue({})
    render(<NeedsYouQueue items={[item({})]} onApprove={vi.fn()} onDeny={onDeny} />)
    fireEvent.click(document.querySelector('[data-ops-deny]')!)
    await waitFor(() => expect(document.querySelector('[data-ops-deny]')?.textContent).toBe('Denied'))
    expect(document.querySelector('[data-ops-approve]')?.textContent).toBe('Approve')
    expect(onDeny).toHaveBeenCalled()
  })

  it('kanban rows take an inline comment', async () => {
    const onKanban = vi.fn().mockResolvedValue({})
    render(<NeedsYouQueue items={[item({ origin: 'kanban_review', id: 't5', actions: [] })]} onKanban={onKanban} />)
    fireEvent.change(screen.getByLabelText('comment for t5'), { target: { value: 'nice' } })
    fireEvent.click(document.querySelector('[data-ops-comment]')!)
    await waitFor(() => expect(onKanban).toHaveBeenCalledWith({ kind: 'comment', taskId: 't5', note: 'nice' }))
  })
})
