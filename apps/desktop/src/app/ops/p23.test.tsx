// P23 (judge pass 17): Fleet separates recent failures (history) from attention (now); Office shows a missing reason
// before the controls, not inside More actions.
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgentsLens, type B4Client } from './lenses/b4-lenses'
import type { BoardTask } from './office/control-room'
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
    // Unknown infrastructure takes no detail rows: scribe has no model. P25: Details is a toggle beside Open profile.
    fireEvent.click(document.querySelector('[data-ops-fleet-details-toggle="scribe"]')!)
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

describe('P24 Office one intent per line, refusal in place', () => {
  it('keeps the typed note and shows the refusal beside Request changes; Approve stays available', async () => {
    const onKanban = vi.fn().mockRejectedValue(new Error('409: task moved'))
    render(<NeedsYouQueue items={[{ id: 't_2', origin: 'kanban_review', actions: ['approve'], what_for: 'Ship it', why: 'Needs a second look', profile: 'builder', age_s: 60 } as never]} onKanban={onKanban} onOpenTask={vi.fn()} />)
    const row = document.querySelector('[data-ops-approval="kanban_review:t_2"]')!
    const input = row.querySelector('[data-ops-intent="request-changes"] input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Split the commit' } })
    fireEvent.click(row.querySelector('[data-ops-request-changes]')!)
    await waitFor(() => expect(row.querySelector('[data-ops-intent="request-changes"] [role="alert"]')?.textContent).toContain('409'))
    expect(input.value).toBe('Split the commit')
    expect((row.querySelector('[data-ops-approve]') as HTMLButtonElement).disabled).toBe(false)
    // Comment is its own folded intent; Open task is a quiet link on the links line.
    expect(row.querySelector('[data-ops-intent="links"] [data-ops-disclosure="comment"]')).toBeTruthy()
    expect(row.querySelector('[data-ops-intent="links"] [data-ops-row-link]')?.textContent).toBe('Open task')
  })
})
