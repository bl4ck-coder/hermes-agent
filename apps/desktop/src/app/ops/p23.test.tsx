// P23 (judge pass 17): Fleet separates recent failures (history) from attention (now); Office shows a missing reason
// before the controls, not inside More actions.
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BoardTask } from './office/control-room'

import { AgentsLens, type B4Client } from './lenses/b4-lenses'
import { NeedsYouQueue } from './office/needs-you'

const NOW = 1_800_000_000
afterEach(() => cleanup())

const T = (id: string, o: Partial<BoardTask>): BoardTask => ({ id, title: id, status: 'todo', assignee: null, created_at: NOW - 100, ...o }) as BoardTask

const client = (): B4Client => ({
  profiles: vi.fn().mockResolvedValue([
    { name: 'pixel', model: 'gpt-6.1-sol', description: '' },
    { name: 'scribe', model: null, description: '' }
  ]),
  tasks: vi.fn().mockResolvedValue([T('1', { assignee: 'pixel', status: 'todo', consecutive_failures: 2 }), T('2', { assignee: 'scribe', status: 'done', started_at: NOW - 3600, completed_at: NOW - 3000 })]),
  workers: vi.fn().mockResolvedValue([]),
  runStats: vi.fn().mockResolvedValue({ scribe: { runs: 4, failed: 2, last_started_at: NOW - 3600 } }),
  skills: vi.fn().mockResolvedValue([]),
  official: vi.fn().mockResolvedValue([]),
  install: vi.fn(),
  channels: vi.fn().mockResolvedValue({ catalog: [], servers: [], platforms: [], providers: [] })
})

describe('P23c Fleet attention vs history', () => {
  it('keeps a failing agent in attention and a recently failed idle one in its own group', async () => {
    render(<AgentsLens client={client()} nowS={NOW} />)
    await waitFor(() => expect(document.querySelector('[data-ops-fleet-row="scribe"]')).toBeTruthy())
    await waitFor(() => expect(document.querySelector('[data-ops-rows-group="recent"] [data-ops-fleet-row="scribe"]')).toBeTruthy())
    expect(document.querySelector('[data-ops-rows-group="attention"] [data-ops-fleet-row="pixel"]')).toBeTruthy()
    expect(document.querySelector('[data-ops-rows-group="attention"] [data-ops-fleet-row="scribe"]')).toBeNull()
    // Unknown infrastructure takes no detail rows: scribe has no model.
    const details = document.querySelector('[data-ops-fleet-row="scribe"] [data-ops-fleet-details]')!
    expect(details.textContent).not.toContain('Model')
    expect(details.textContent).toContain('Runs 7d')
  })
})

describe('P23b Office reason before controls', () => {
  it('says the reason is missing in the row context, not inside More actions', () => {
    render(<NeedsYouQueue items={[{ id: 't_1', origin: 'kanban_review', actions: ['approve'], what_for: 'Ship the thing', why: '', profile: 'builder', age_s: 120 } as never]} onKanban={vi.fn()} />)
    const row = document.querySelector('[data-ops-approval="kanban_review:t_1"]')!
    expect(row.querySelector('[data-ops-row-context] [data-ops-why-missing]')).toBeTruthy()
    expect(row.querySelector('[data-ops-disclosure-body] [data-ops-why-missing]')).toBeNull()
  })
})
