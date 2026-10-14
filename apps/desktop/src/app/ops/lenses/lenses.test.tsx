import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OpsActions } from '../feed/ops-actions'
import { opsLivePanel } from '../live-panels'

import { ActivityLensView, projectOverview, ProjectsLensView, RunsLens, RunsLensView, TemplatesLens, TemplatesLensView } from './lenses'

beforeEach(() => localStorage.clear())
afterEach(() => cleanup())

const tasks = [
  { id: 'a', title: 'A', status: 'done', assignee: 'x', project_id: 'p1' },
  { id: 'b', title: 'B', status: 'todo', assignee: null, project_id: 'p1' },
  { id: 'c', title: 'C', status: 'todo', assignee: 'y', project_id: 'p2' }
] as never

describe('live lenses (P7 F3)', () => {
  it('Runs lens lists live workers with elapsed and stale heartbeat, opens task and run', () => {
    const openTask = vi.fn()
    const openRun = vi.fn()
    render(
      <RunsLensView
        nowS={1000}
        onOpenRun={openRun}
        onOpenTask={openTask}
        workers={[{ run_id: 7, task_id: 't1', task_title: 'Build', task_status: 'running', task_assignee: 'b', profile: 'b', worker_pid: 1, started_at: 900, last_heartbeat_at: 700 }]}
      />
    )
    const row = document.querySelector('[data-ops-run-row="7"]')!
    expect(row.textContent).toContain('100 s')
    expect(row.querySelector('[data-ops-stale]')).toBeTruthy()
    fireEvent.click(screen.getByText('Build'))
    fireEvent.click(screen.getByText('#7'))
    expect(openTask).toHaveBeenCalledWith('t1')
    expect(openRun).toHaveBeenCalledWith('7')
  })

  it('Runs lens: unknown vs empty vs refused', async () => {
    render(<RunsLensView nowS={0} workers={null} />)
    expect(screen.getByText(/Runs loading \(unknown\)/)).toBeTruthy()
    cleanup()
    render(<RunsLensView nowS={0} workers={[]} />)
    expect(screen.getByText('No worker is running.')).toBeTruthy()
    cleanup()
    const actions = { activeWorkers: vi.fn().mockRejectedValue(new Error('404: no plugin')) } as unknown as OpsActions
    render(<RunsLens actions={actions} />)
    await waitFor(() => expect(screen.getByText(/Runs unavailable: 404: no plugin/)).toBeTruthy())
  })

  it('project overview counts per status/profile and throughput; favourites persist and sort first', () => {
    expect(projectOverview(tasks, 'p1')).toEqual({ total: 2, byStatus: { done: 1, todo: 1 }, byProfile: { x: 1, unassigned: 1 }, done: 1 })
    const open = vi.fn()
    render(<ProjectsLensView onOpenBoard={open} projects={[{ id: 'p1', slug: 'a', name: 'Alpha' }, { id: 'p2', slug: 'z', name: 'Zed' }]} tasks={tasks} />)
    fireEvent.click(screen.getByLabelText('favourite Zed'))
    expect(document.querySelector('[data-ops-project]')?.getAttribute('data-ops-project')).toBe('p2')
    expect(JSON.parse(localStorage.getItem('hermes.ops.projectFavs')!)).toEqual(['p2'])
    fireEvent.click(screen.getByText('Alpha'))
    expect(document.querySelector('[data-ops-field="total"]')?.textContent).toBe('2 tasks')
    fireEvent.click(screen.getByText('Open Board filtered to this project'))
    expect(open).toHaveBeenCalledWith('p1')
  })

  it('Templates lens shows cron blueprints and states the workflow-template cut', async () => {
    const routes: string[] = []
    render(<TemplatesLensView blueprints={[{ key: 'daily', title: 'Daily digest', description: 'd', category: 'reports' }]} onOpenRoute={r => routes.push(r)} />)
    expect(document.querySelector('[data-ops-cut="workflow-templates"]')).toBeTruthy()
    fireEvent.click(screen.getByText('Use in Schedule'))
    expect(routes).toEqual(['/cron?blueprint=daily'])
    cleanup()
    const actions = { blueprints: vi.fn().mockResolvedValue({ blueprints: [] }) } as unknown as OpsActions
    render(<TemplatesLens actions={actions} profile="builder" />)
    await waitFor(() => expect(actions.blueprints).toHaveBeenCalledWith('builder'))
  })

  it('Activity lens: task events and a Resolved tab (last 50, who/when/how)', () => {
    render(
      <ActivityLensView
        events={[{ id: 1, task_id: 't1', kind: 'blocked', payload: { reason: 'tests' }, created_at: 0 }]}
        resolved={Array.from({ length: 60 }, (_, i) => ({ choice: 'once', profile: `p${i}`, resolved_at: i }))}
      />
    )
    expect(document.querySelector('[data-ops-task-event="1"]')?.textContent).toContain('blocked tests')
    fireEvent.click(screen.getByRole('tab', { name: 'Resolved' }))
    expect(document.querySelectorAll('[data-ops-resolved-row]').length).toBe(50)
  })

  it('Activity lens without the stream says so', () => {
    render(<ActivityLensView events={null} resolved={[]} />)
    expect(screen.getByText(/need the kanban stream/)).toBeTruthy()
  })

  it('live panels map the four lenses when the bridge exists', () => {
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = { api: vi.fn().mockReturnValue(new Promise(() => {})) }

    try {
      for (const id of ['lens:runs', 'lens:projects', 'lens:templates', 'lens:activity']) {
        const node = opsLivePanel({ id, kind: 'lens', label: id, route: '', pinned: false, closable: true }, 'default', () => {})
        expect(node).toBeTruthy()
      }
    } finally {
      delete (window as unknown as { hermesDesktop?: unknown }).hermesDesktop
    }
  })
})
