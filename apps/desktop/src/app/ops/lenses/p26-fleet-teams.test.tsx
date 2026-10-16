// P26 (judge pass 20 #4): Fleet says the work a running agent is on when a source names it (the active count is only
// the fallback); Teams says "Working on" only for running tasks, other open work is "Open work", and the expansion lists
// the tasks the summary does not show, once each, before members and projects.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BoardTask } from '../office/control-room'

import { AgentsLens, type B4Client } from './b4-lenses'
import { fleetRows } from './b4-model'

const NOW = 1_800_000_000
afterEach(() => cleanup())

const T = (id: string, o: Partial<BoardTask>): BoardTask =>
  ({ id, title: id, status: 'todo', assignee: null, created_at: NOW - 100, ...o }) as BoardTask

const base = (o: Partial<B4Client> = {}): B4Client => ({
  profiles: vi.fn().mockResolvedValue([]),
  tasks: vi.fn().mockResolvedValue([]),
  workers: vi.fn().mockResolvedValue([]),
  skills: vi.fn().mockResolvedValue([]),
  official: vi.fn().mockResolvedValue([]),
  install: vi.fn(),
  channels: vi.fn().mockResolvedValue({ catalog: [], servers: [], platforms: [], providers: [] }),
  ...o
})

const ctx = (name: string) => document.querySelector(`[data-ops-fleet-row="${name}"] [data-ops-row-context]`)?.textContent ?? null

describe('P26 Fleet: a running agent reads as the work it is running', () => {
  // pixel failing now; builder running 'Ship it' with failures earlier this week; scribe recovered (failures in 7d, idle);
  // runner has a live worker on a task the board does not carry (no title anywhere) and one open task;
  // keeper has a running task on the board (no worker row) with a title.
  const fleet = () =>
    base({
      profiles: vi.fn().mockResolvedValue([
        { name: 'pixel', description: 'Design lead' },
        { name: 'builder', description: 'Orchestrator. Splits work.' },
        { name: 'scribe' },
        { name: 'runner' },
        { name: 'keeper' }
      ]),
      tasks: vi.fn().mockResolvedValue([
        T('1', { assignee: 'pixel', status: 'todo', consecutive_failures: 3, title: 'Brand refresh' }),
        T('2', { assignee: 'builder', status: 'running', started_at: NOW - 600, last_heartbeat_at: NOW - 30, title: 'Ship it' }),
        T('2b', { assignee: 'builder', status: 'ready', title: 'Queued follow-up' }),
        T('3', { assignee: 'scribe', status: 'done', started_at: NOW - 3600, completed_at: NOW - 3000 }),
        T('4', { assignee: 'runner', status: 'ready', title: 'Not running yet' }),
        T('5', { assignee: 'keeper', status: 'running', started_at: NOW - 60, title: 'Rotate keys' })
      ]),
      workers: vi.fn().mockResolvedValue([
        { profile: 'builder', task_id: '2', last_heartbeat_at: NOW - 30 },
        { profile: 'runner', task_id: 'gone', last_heartbeat_at: NOW - 10 },
        { profile: 'keeper', task_id: '5', last_heartbeat_at: NOW - 5 }
      ]),
      runStats: vi.fn().mockResolvedValue({ builder: { runs: 6, failed: 2 }, scribe: { runs: 4, failed: 1 }, pixel: { runs: 3, failed: 3 } })
    })

  it('shows the running task title when the board names it, never a queued one', async () => {
    render(<AgentsLens client={fleet()} nowS={NOW} />)
    await waitFor(() => expect(document.querySelector('[data-ops-rows-group="recent"] [data-ops-fleet-row="scribe"]')).toBeTruthy())
    expect(ctx('builder')).toBe('Working on: Ship it')
    expect(ctx('keeper')).toBe('Working on: Rotate keys')
    expect(ctx('builder')).not.toContain('Queued follow-up')
  })

  it('falls back to the active count when no source names the running work (nothing invented)', async () => {
    render(<AgentsLens client={fleet()} nowS={NOW} />)
    await waitFor(() => expect(document.querySelector('[data-ops-rows-group="running"] [data-ops-fleet-row="runner"]')).toBeTruthy())
    expect(ctx('runner')).toBe('1 active')
    expect(ctx('runner')).not.toContain('Not running yet')
    expect(ctx('runner')).not.toContain('gone')
  })

  it('model: runningTask comes from the worker task first, then a running board task; untitled work gives none', () => {
    const rows = fleetRows(
      [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      [T('w', { assignee: 'a', status: 'running', title: 'From worker' }), T('r', { assignee: 'b', status: 'running', title: '' }), T('q', { assignee: 'c', status: 'ready', title: 'Queued' })],
      [{ profile: 'a', task_id: 'w', last_heartbeat_at: NOW }, { profile: 'c', task_id: 'missing', last_heartbeat_at: NOW }],
      NOW
    )

    expect(rows.map(r => r.runningTask ?? null)).toEqual([{ id: 'w', title: 'From worker' }, null, null])
  })

  it('failing, running with 7d history and recovered stay in disjoint groups; Details keeps access to the profile', async () => {
    const onOpenRoute = vi.fn()
    render(<AgentsLens client={fleet()} nowS={NOW} onOpenRoute={onOpenRoute} />)
    await waitFor(() => expect(document.querySelector('[data-ops-rows-group="recent"] [data-ops-fleet-row="scribe"]')).toBeTruthy())

    for (const name of ['pixel', 'builder', 'scribe', 'runner', 'keeper']) {
      expect(document.querySelectorAll(`[data-ops-fleet-row="${name}"]`)).toHaveLength(1)
    }

    expect(document.querySelector('[data-ops-rows-group="attention"] [data-ops-fleet-row="pixel"]')).toBeTruthy()
    expect(document.querySelector('[data-ops-rows-group="running"] [data-ops-fleet-row="builder"]')).toBeTruthy()
    expect(document.querySelector('[data-ops-rows-group="recent"] [data-ops-fleet-row="scribe"]')).toBeTruthy()
    // The running agent's past failures are history: not in its line, available in Details.
    expect(ctx('builder')).not.toContain('failed')
    const row = document.querySelector('[data-ops-fleet-row="builder"]') as HTMLElement
    fireEvent.click(row.querySelector('[data-ops-fleet-details-toggle="builder"]')!)
    expect(row.querySelector('[data-ops-fleet-details]')?.textContent).toContain('6 · 2 failed')
    fireEvent.click(row.querySelector('[data-ops-fleet-profile="builder"]')!)
    expect(onOpenRoute).toHaveBeenCalledWith('/profiles?profile=builder')
  })
})

describe('P26 Teams: honest state words and each task once', () => {
  const work = [
    T('a', { tenant: 'ops-panel', assignee: 'builder', status: 'blocked', title: 'Ship the onboarding emails', project_id: 'brand' }),
    T('a2', { tenant: 'ops-panel', assignee: 'builder', status: 'blocked', title: 'Second blocker', created_at: NOW - 500 }),
    T('b', { tenant: 'ops-panel', assignee: 'writer', status: 'triage', title: 'Decide the pricing copy' }),
    T('c', { tenant: 'ops-panel', assignee: 'writer', status: 'ready', title: 'Migrate the CDN', created_at: NOW - 200 }),
    T('d', { tenant: 'infra', assignee: 'ops', status: 'running', title: 'Rotate staging keys' }),
    T('e', { tenant: 'infra', assignee: 'ops', status: 'todo', title: 'Patch the bastion', created_at: NOW - 50 }),
    T('f', { tenant: 'web', assignee: 'pixel', status: 'scheduled', title: 'Weekly audit' })
  ]

  const teamsOf = async () => {
    render(<AgentsLens client={base({ tasks: vi.fn().mockResolvedValue(work) })} nowS={NOW} />)
    fireEvent.click(await screen.findByText('Teams'))
    await waitFor(() => expect(document.querySelector('[data-ops-team="ops-panel"]')).toBeTruthy())
  }

  const row = (lane: string) => document.querySelector(`[data-ops-team="${lane}"]`) as HTMLElement
  const context = (lane: string) => row(lane).querySelector('[data-ops-row-context]') as HTMLElement

  it('triage, ready, todo and scheduled never read as "Working on"; blocked stays Blocked', async () => {
    await teamsOf()
    expect(context('ops-panel').textContent).not.toContain('Working on')
    expect(context('ops-panel').querySelector('[data-ops-team-work="blocked"]')?.textContent).toBe('Blocked Ship the onboarding emails +1')
    expect(context('ops-panel').querySelector('[data-ops-team-work="open"]')?.textContent).toBe('Open work: Decide the pricing copy +1')
    // Scheduled work is open work, not idle and not in progress.
    expect(row('web').querySelector('[data-ops-row-context]')?.textContent).toBe('Open work: Weekly audit')
  })

  it('a running task is "Working on"; the lane\'s other open work is "Open work"', async () => {
    await teamsOf()
    expect(context('infra').querySelector('[data-ops-team-work="running"]')?.textContent).toBe('Working on: Rotate staging keys')
    expect(context('infra').querySelector('[data-ops-team-work="open"]')?.textContent).toBe('Open work: Patch the bastion')
  })

  it('the expansion lists only the tasks the summary does not show, with their state, then members and projects', async () => {
    await teamsOf()
    const r = row('ops-panel')

    for (const id of ['a', 'a2', 'b', 'c']) {
      expect(r.querySelectorAll(`[data-ops-team-task="${id}"]`)).toHaveLength(1)
    }

    const rest = [...r.querySelectorAll('[data-ops-team-rest] li')].map(li => li.textContent)
    expect(rest).toEqual(['Blocked Second blocker', 'Ready Migrate the CDN'])
    expect(r.querySelector('[data-ops-team-members]')?.textContent).toContain('writer')
    expect(r.querySelector('[data-ops-team-project="brand"]')).toBeTruthy()
    // A lane whose summary already shows every task has no repeated list at all.
    expect(row('infra').querySelector('[data-ops-team-rest]')).toBeNull()
    expect(row('infra').querySelectorAll('[data-ops-team-task="d"]')).toHaveLength(1)
    expect(row('infra').querySelector('[data-ops-team-members]')?.textContent).toContain('ops')
  })
})
