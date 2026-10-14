import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OpsActions, TaskDetail } from '../feed/ops-actions'

import { describeEvent, TaskTabContainer, TaskTabView } from './task-tab'

afterEach(() => cleanup())

const detail = (): TaskDetail => ({
  task: { id: 't1', title: 'Fix build', status: 'blocked', assignee: 'builder', current_step_key: 'test', branch_name: 'ops/x' },
  comments: [{ author: 'sandhi', body: 'look at CI', created_at: 1 }],
  events: [
    { id: 1, task_id: 't1', kind: 'created', payload: null, created_at: 0 },
    { id: 2, task_id: 't1', kind: 'reassigned', payload: { assignee: 'builder' }, created_at: 60 }
  ],
  attachments: [{ id: 'a1', filename: 'log.txt' }],
  links: { parents: [], children: ['c1'] },
  child_results: [{ id: 'c1', title: 'Child', status: 'todo' }],
  runs: [{ id: 9, task_id: 't1', profile: 'builder', status: 'ended', outcome: 'failed', error: 'exit 1', started_at: 0, ended_at: 12 }]
})

const fake = (over: Partial<OpsActions> = {}) =>
  ({
    taskDetail: vi.fn().mockResolvedValue(detail()),
    comment: vi.fn().mockResolvedValue({}),
    assign: vi.fn().mockResolvedValue({}),
    createSubtask: vi.fn().mockResolvedValue({}),
    setStatus: vi.fn().mockResolvedValue({}),
    kanban: vi.fn().mockResolvedValue({}),
    ...over
  }) as unknown as OpsActions

describe('task tab (P6 F2)', () => {
  it('maps events to verb + target and flags handoffs', () => {
    expect(describeEvent({ id: 1, task_id: 't', kind: 'reassigned', payload: { assignee: 'pixel' }, created_at: 0 })).toEqual({ verb: 'handed off to', target: 'pixel', handoff: true })
    expect(describeEvent({ id: 2, task_id: 't', kind: 'weird_kind', payload: 'x', created_at: 0 }).verb).toBe('weird kind')
  })

  it('renders timeline, runs, failure block, subtasks, attachments and comments; expand/collapse all', () => {
    render(<TaskTabView detail={detail()} onAction={vi.fn()} />)
    expect(document.querySelectorAll('[data-ops-event]').length).toBe(2)
    expect(document.querySelector('[data-ops-handoff]')).toBeTruthy()
    expect(document.querySelector('[data-ops-run-row="9"]')?.textContent).toContain('12 s')
    expect(document.querySelector('[data-ops-run-failure]')?.textContent).toContain('exit 1')
    expect(document.querySelector('[data-ops-subtask="c1"]')).toBeTruthy()
    expect(screen.getByText('log.txt')).toBeTruthy()
    fireEvent.click(screen.getByText('Expand all'))
    expect(document.querySelectorAll('[data-ops-event-payload]').length).toBe(2)
    fireEvent.click(screen.getByText('Collapse all'))
    expect(document.querySelectorAll('[data-ops-event-payload]').length).toBe(0)
  })

  it('writes go through the kanban routes and reload; refusals are shown', async () => {
    const a = fake({ setStatus: vi.fn().mockRejectedValue(new Error('409: parent not done')) })
    render(<TaskTabContainer actions={a} assignees={['builder', 'pixel']} id="t1" />)
    await waitFor(() => expect(screen.getByText('Fix build')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('comment'), { target: { value: 'hi' } })
    await act(async () => fireEvent.submit(screen.getByLabelText('comment').closest('form')!))
    expect(a.comment).toHaveBeenCalledWith('t1', 'hi')
    await act(async () => fireEvent.change(screen.getByLabelText('assignee'), { target: { value: 'pixel' } }))
    expect(a.assign).toHaveBeenCalledWith('t1', 'pixel')
    fireEvent.change(screen.getByLabelText('new subtask'), { target: { value: 'sub' } })
    await act(async () => fireEvent.submit(screen.getByLabelText('new subtask').closest('form')!))
    expect(a.createSubtask).toHaveBeenCalledWith('t1', 'sub')
    await act(async () => fireEvent.click(screen.getByText('Retry → ready')))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('parent not done'))
    fireEvent.change(screen.getByLabelText('unblock note'), { target: { value: 'fixed' } })
    await act(async () => fireEvent.click(screen.getByText('Unblock')))
    expect(a.kanban).toHaveBeenCalledWith({ kind: 'unblock', taskId: 't1', note: 'fixed' })
  })

  it('unknown and malformed stay unknown', async () => {
    render(<TaskTabContainer actions={fake({ taskDetail: vi.fn().mockResolvedValue({}) })} id="t1" />)
    await waitFor(() => expect(screen.getByText(/malformed task/)).toBeTruthy())
  })
})
