import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OpsActions } from '../feed/ops-actions'
import type { OpsClient } from '../feed/ops-client'

import { AgentCardContainer, AgentCardView, nextCronRun, RunDetailContainer, RunHistoryView } from './details'

afterEach(() => cleanup())

const client = () =>
  ({
    fleet: vi.fn().mockResolvedValue({ profiles: [] }),
    modelNode: vi.fn().mockResolvedValue({ provider: 'p', model: 'm' }),
    policy: vi.fn().mockResolvedValue({ source: 'default', violations: [] }),
    pendingApprovals: vi.fn().mockResolvedValue({ items: [] }),
    cronJobs: vi.fn().mockResolvedValue([{ id: 'j1', name: 'nightly', next_run_at: '2026-10-14T03:00:00Z', profile: 'builder' }])
  }) as unknown as OpsClient

describe('agent card + run history (P6 F4)', () => {
  it('nextCronRun picks the earliest enabled job and separates unknown from none', () => {
    expect(nextCronRun(null, 'x')).toBeUndefined()
    expect(nextCronRun([], 'x')).toBeNull()

    const n = nextCronRun(
      [
        { id: 'a', next_run_at: 2000 },
        { id: 'b', next_run_at: 1000 },
        { id: 'c', next_run_at: 500, enabled: false },
        { id: 'd', next_run_at: 100, profile: 'other' }
      ],
      'x'
    )

    expect(n?.job.id).toBe('b')
  })

  it('card shows sigil, skills, next cron and an honest role gap', async () => {
    const actions = { profiles: vi.fn().mockResolvedValue({ profiles: [{ name: 'builder', model: 'm', provider: 'p', skill_count: 7, display_name: 'Builder' }] }) } as unknown as OpsActions
    render(<AgentCardContainer actions={actions} client={client()} name="builder" />)
    await waitFor(() => expect(document.querySelector('[data-ops-field="skills"]')?.textContent).toBe('7'))
    await waitFor(() => expect(document.querySelector('[data-ops-field="next-cron"]')?.textContent).toContain('nightly'))
    expect(document.querySelector('.ops-sigil')).toBeTruthy()
    expect(screen.getByText('Builder')).toBeTruthy()
    expect(document.querySelector('[data-ops-field="role"]')?.textContent).toMatch(/Not available/)
  })

  it('unknown stays unknown on the card', () => {
    render(<AgentCardView fleet={undefined} model={null} name="x" pending={null} policy={null} />)
    expect(document.querySelector('[data-ops-field="skills"]')?.textContent).toBe('unknown')
    expect(document.querySelector('[data-ops-field="next-cron"]')?.textContent).toBe('unknown')
  })

  it('run tab loads history for finished runs', async () => {
    const actions = {
      runDetail: vi.fn().mockResolvedValue({ id: 9, task_id: 't1', profile: 'builder', status: 'ended', outcome: 'failed', error: 'exit 1', started_at: 0, ended_at: 30 })
    } as unknown as OpsActions

    const routes: string[] = []
    render(<RunDetailContainer actions={actions} client={client()} id="9" onOpenRoute={r => routes.push(r)} />)
    await waitFor(() => expect(document.querySelector('[data-ops-field="outcome"]')?.textContent).toBe('failed'))
    expect(document.querySelector('[data-ops-field="duration"]')?.textContent).toBe('30 s')
    screen.getByText('t1').click()
    expect(routes).toEqual(['/kanban?task=t1'])
  })

  it('run history shows the refusal reason on error', () => {
    render(<RunHistoryView error="404: not found" id="9" run={undefined} />)
    expect(screen.getByText(/404: not found/)).toBeTruthy()
  })
})
