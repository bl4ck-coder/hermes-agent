import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ApprovalItem, OpsClient } from '../feed/ops-client'

import {
  AgentCardContainer,
  AgentCardView,
  findRun,
  findTask,
  NeedsYouListView,
  RunDetailView,
  TaskDetailContainer,
  TaskDetailView
} from './details'

afterEach(() => cleanup())

const board = { columns: [{ name: 'running', tasks: [{ id: 't1', title: 'Fix', status: 'running', assignee: 'sandhi' }] }] }

const fleet = {
  now: 1,
  profiles: [{ profile: 'sandhi', presence: 'working' as const, observed_at: 1, active_runs: [{ source: 'kanban', id: 42, task_id: 't1', started_at: 0 }] }]
}

const fake = (over: Partial<OpsClient> = {}) =>
  ({
    fleet: () => Promise.resolve(fleet),
    board: () => Promise.resolve(board),
    modelNode: () => Promise.resolve({ profile: 'sandhi', node: 'model', content_hash: 'h', exists: true, provider: 'xai', model: 'grok' }),
    policy: () => Promise.resolve({ source: 'builtin', error: null, enabled: true, allow: [], violations: [] }),
    pendingApprovals: () => Promise.resolve({ items: [], observed_at: {} }),
    ...over
  }) as unknown as OpsClient

describe('ops detail tabs (P3-04)', () => {
  it('finds tasks and runs, distinguishing unknown (undefined) from missing (null)', () => {
    expect(findTask(null, 't1')).toBeUndefined()
    expect(findTask({ columns: 'x' } as never, 't1')).toBeUndefined()
    expect(findTask(board, 'nope')).toBeNull()
    expect(findTask(board, 't1')?.title).toBe('Fix')
    expect(findRun(undefined, '42')).toBeUndefined()
    expect(findRun(fleet.profiles, '9')).toBeNull()
    expect(findRun(fleet.profiles, '42')?.profile).toBe('sandhi')
  })

  it('agent card renders unknown, never zero, when data is missing', () => {
    render(<AgentCardView fleet={undefined} model={null} name="x" pending={null} policy={null} />)

    for (const f of ['presence', 'model', 'policy', 'runs', 'pending']) {
      expect(document.querySelector(`[data-ops-field="${f}"]`)?.textContent).toBe('unknown')
    }
  })

  it('agent card container shows real fleet, model and policy', async () => {
    render(<AgentCardContainer client={fake()} name="sandhi" />)
    await waitFor(() => expect(document.querySelector('[data-ops-field="model"]')?.textContent).toBe('xai / grok'))
    expect(document.querySelector('[data-ops-field="policy"]')?.textContent).toBe('inside policy')
    await waitFor(() => expect(document.querySelector('[data-ops-field="presence"]')?.textContent).toBe('working'))
  })

  it('task tab shows the board row and opens the existing Kanban route', async () => {
    const routes: string[] = []
    render(<TaskDetailContainer client={fake()} id="t1" onOpenRoute={r => routes.push(r)} />)
    await waitFor(() => expect(document.querySelector('[data-ops-field="assignee"]')?.textContent).toBe('sandhi'))
    screen.getByText('Open in Kanban').click()
    expect(routes).toEqual(['/kanban?task=t1'])
  })

  it('task and run tabs say not found instead of inventing rows', () => {
    render(<TaskDetailView id="zz" task={null} />)
    expect(screen.getByText(/not on the current board/)).toBeTruthy()
    render(<RunDetailView found={null} id="9" />)
    expect(screen.getByText(/is not active/)).toBeTruthy()
  })

  it('needs-you list distinguishes unknown, empty and items of every origin', () => {
    const { rerender } = render(<NeedsYouListView items={null} />)
    expect(screen.getByText('Needs-you is unknown.')).toBeTruthy()
    rerender(<NeedsYouListView items={[]} />)
    expect(screen.getByText('Nothing needs you.')).toBeTruthy()
    const item = { origin: 'kanban_review', id: 'a', profile: 'p', what_for: 'review t1', why: '' } as unknown as ApprovalItem
    rerender(<NeedsYouListView items={[item]} />)
    expect(document.querySelector('[data-ops-origin="kanban_review"]')?.textContent).toBe('p: review t1')
  })
})
