// P25 (judge pass 19, items 6 and 8): compact Fleet rows with Details beside the primary action; Teams summary reads
// purpose then work in words with lane ids only in the expansion; Skills has one header and one count; Channels says its
// tab totals are partial while a source failed.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BoardTask } from '../office/control-room'

import { AgentsLens, type B4Client, ChannelsLens, SkillsLens } from './b4-lenses'
import { laneName } from './b4-model'

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

describe('P25 Fleet: compact rows, Details beside the primary action, present and history apart', () => {
  // failing now (pixel), running with failures earlier this week (builder), recovered with failures in 7d (scribe), never seen (quiet).
  const fleet = () =>
    base({
      profiles: vi.fn().mockResolvedValue([
        { name: 'pixel', model: 'gpt-6.1-sol', description: 'Design lead' },
        { name: 'builder', model: 'grok-4', description: 'Orchestrator. Splits work.' },
        { name: 'scribe', model: null, description: '' },
        { name: 'quiet', model: null, description: '' }
      ]),
      tasks: vi
        .fn()
        .mockResolvedValue([
          T('1', { assignee: 'pixel', status: 'todo', consecutive_failures: 3, title: 'Brand refresh' }),
          T('2', {
            assignee: 'builder',
            status: 'running',
            started_at: NOW - 600,
            last_heartbeat_at: NOW - 30,
            title: 'Ship it'
          }),
          T('3', { assignee: 'scribe', status: 'done', started_at: NOW - 3600, completed_at: NOW - 3000 })
        ]),
      workers: vi.fn().mockResolvedValue([{ profile: 'builder', task_id: '2', last_heartbeat_at: NOW - 30 }]),
      runStats: vi
        .fn()
        .mockResolvedValue({
          builder: { runs: 6, failed: 2 },
          scribe: { runs: 4, failed: 1 },
          pixel: { runs: 3, failed: 3 }
        })
    })

  it('puts the Details toggle in the same container as Open profile and opens the facts under the row', async () => {
    render(<AgentsLens client={fleet()} nowS={NOW} onOpenRoute={vi.fn()} />)
    await waitFor(() =>
      expect(document.querySelector('[data-ops-rows-group="recent"] [data-ops-fleet-row="scribe"]')).toBeTruthy()
    )
    const row = document.querySelector('[data-ops-fleet-row="builder"]') as HTMLElement
    const actions = row.querySelector('[data-ops-row-actions]') as HTMLElement
    const toggle = actions.querySelector('[data-ops-fleet-details-toggle="builder"]') as HTMLButtonElement
    expect(actions.querySelector('[data-ops-fleet-profile="builder"]')).toBeTruthy()
    expect(toggle.textContent).toBe('Details')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    // No band of its own: no native disclosure and no details body until asked for.
    expect(row.querySelector('details')).toBeNull()
    expect(row.querySelector('[data-ops-fleet-details]')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const body = row.querySelector('[data-ops-row-more-slot] [data-ops-fleet-details]') as HTMLElement
    expect(body).toBeTruthy()
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)?.contains(body)).toBe(true)
    expect(body.textContent).toContain('Orchestrator')
    expect(body.textContent).toContain('6 · 2 failed')
    fireEvent.click(toggle)
    expect(row.querySelector('[data-ops-fleet-details]')).toBeNull()
  })

  it('failing now, running and recovered-with-failures each appear once, in their own group', async () => {
    render(<AgentsLens client={fleet()} nowS={NOW} />)
    await waitFor(() =>
      expect(document.querySelector('[data-ops-rows-group="recent"] [data-ops-fleet-row="scribe"]')).toBeTruthy()
    )

    for (const name of ['pixel', 'builder', 'scribe', 'quiet']) {
      expect(document.querySelectorAll(`[data-ops-fleet-row="${name}"]`)).toHaveLength(1)
    }

    expect(document.querySelector('[data-ops-rows-group="attention"] [data-ops-fleet-row="pixel"]')).toBeTruthy()
    expect(document.querySelector('[data-ops-rows-group="running"] [data-ops-fleet-row="builder"]')).toBeTruthy()
    expect(document.querySelector('[data-ops-rows-group="recent"] [data-ops-fleet-row="scribe"]')).toBeTruthy()
    expect(document.querySelector('[data-ops-rows-group="quiet"] [data-ops-fleet-row="quiet"]')).toBeTruthy()
    // The running agent's line is about now (P26: the work it runs, by title); its earlier failures wait in Details.
    const running = document.querySelector('[data-ops-fleet-row="builder"] [data-ops-row-context]')?.textContent ?? ''
    expect(running).toBe('Working on: Ship it')
    expect(document.querySelector('[data-ops-fleet-row="scribe"] [data-ops-row-context]')?.textContent).toContain(
      '1 failed run'
    )
    expect(document.querySelector('[data-ops-fleet-row="pixel"] [data-ops-row-context]')?.textContent).toContain(
      'Brand refresh'
    )
  })
})

describe('P25 Teams: name, stated purpose, then the work in words; lane ids in the expansion', () => {
  const work = [
    T('a', {
      tenant: 'ops-panel',
      assignee: 'builder',
      status: 'blocked',
      title: 'Ship the onboarding emails',
      project_id: 'brand'
    }),
    T('b', { tenant: 'ops-panel', assignee: 'writer', status: 'todo', title: 'Decide the pricing copy' }),
    T('c', { tenant: 'ops-panel', assignee: 'writer', status: 'ready', title: 'Migrate the CDN' }),
    T('d', { tenant: 'infra_core', assignee: 'ops', status: 'running', title: 'Rotate staging keys' })
  ]

  it('summary shows purpose and human work, no lane id and no counters; the expansion holds id, states, tasks, members, projects', async () => {
    render(
      <AgentsLens
        client={base({
          tasks: vi.fn().mockResolvedValue(work),
          teamPurposes: vi.fn().mockResolvedValue({ 'ops-panel': 'Builds the Ops panel' })
        })}
        nowS={NOW}
      />
    )
    fireEvent.click(await screen.findByText('Teams'))
    await waitFor(() =>
      expect(document.querySelector('[data-ops-team="ops-panel"] [data-ops-team-purpose-line]')).toBeTruthy()
    )
    const row = document.querySelector('[data-ops-team="ops-panel"]') as HTMLElement
    const title = row.querySelector('[data-ops-row-title]')!.textContent
    const context = row.querySelector('[data-ops-row-context]') as HTMLElement
    expect(title).toBe('Ops panel')
    expect(context.querySelector('[data-ops-team-purpose-line]')?.textContent).toBe('Builds the Ops panel')

    // Blocked work first, then the open work, in words.
    const lines = [...context.querySelectorAll('[data-ops-team-purpose-line], [data-ops-team-work]')].map(
      e => e.getAttribute('data-ops-team-work') ?? 'purpose'
    )

    expect(lines).toEqual(['purpose', 'blocked', 'open'])
    expect(context.querySelector('[data-ops-team-work="blocked"]')?.textContent).toBe(
      'Blocked Ship the onboarding emails'
    )
    expect(context.querySelector('[data-ops-team-work="open"]')?.textContent).toMatch(
      /^Open work: (Decide the pricing copy|Migrate the CDN) \+1$/
    )
    // No counters and no technical id outside the expansion.
    const body = row.querySelector('[data-ops-disclosure-body]') as HTMLElement
    expect(row.querySelector('[data-ops-row-main]')?.textContent).not.toContain('ops-panel')
    expect(row.querySelector('[data-ops-row-meta]')).toBeNull()
    expect(row.querySelector('[data-ops-row-main] [data-ops-team-open-n]')).toBeNull()
    // Expansion: lane id, states, the tasks the summary does not show (P26: each task once), members, projects.
    const detail = within(body)
    expect(body.querySelector('[data-ops-team-lane-id]')?.textContent).toBe('ops-panel')
    expect(body.querySelector('[data-ops-team-states]')?.textContent).toBe('1 blocked3 open')
    expect(body.querySelectorAll('[data-ops-team-rest] li')).toHaveLength(1)
    expect(detail.getByText('Members').tagName).toBe('DT')
    expect(body.querySelector('[data-ops-team-members]')?.textContent).toContain('writer')
    expect(body.querySelector('[data-ops-team-project="brand"]')).toBeTruthy()
    expect(row.querySelector('[data-ops-row-more-slot] details[data-ops-disclosure]')).toBeTruthy()
  })

  it('a lane without a stated purpose shows none (nothing guessed from its name or work)', async () => {
    render(<AgentsLens client={base({ tasks: vi.fn().mockResolvedValue(work) })} nowS={NOW} />)
    fireEvent.click(await screen.findByText('Teams'))
    await waitFor(() => expect(document.querySelector('[data-ops-team="infra_core"]')).toBeTruthy())
    const row = document.querySelector('[data-ops-team="infra_core"]') as HTMLElement
    expect(row.querySelector('[data-ops-row-title]')?.textContent).toBe('Infra core')
    expect(row.querySelector('[data-ops-team-purpose-line]')).toBeNull()
    expect(row.querySelector('[data-ops-row-context]')?.textContent).toBe('Working on: Rotate staging keys')
  })

  it('laneName turns ids into words and keeps plain names', () => {
    expect(laneName('ops-panel')).toBe('Ops panel')
    expect(laneName('infra__core')).toBe('Infra core')
    expect(laneName('Web')).toBe('Web')
  })
})

describe('P25 Skills: one main header, one count', () => {
  const skills = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      name: `s${i}`,
      category: i % 2 ? 'design' : 'research',
      description: `does ${i}`,
      enabled: true
    }))

  it('renders a single heading and a total in the toolbar; filtering turns the same count into Showing N of M', async () => {
    render(
      <SkillsLens
        client={base({
          profiles: vi.fn().mockResolvedValue([{ name: 'default' }]),
          skills: vi.fn().mockResolvedValue(skills(5))
        })}
        profile="default"
      />
    )
    await waitFor(() => expect(document.querySelector('[data-ops-skill-open="s0"]')).toBeTruthy())
    const lens = document.querySelector('[data-ops-lens="skills"]') as HTMLElement
    // The lens title is the only heading above the list (no "Individual skills", no "Enabled in this profile" when all are enabled).
    expect([...lens.querySelectorAll('h1, h2, h3, h4')].map(h => h.textContent)).toEqual(['Skills · default'])
    const counts = lens.querySelectorAll('[data-ops-skill-count], [data-ops-skill-shown]')
    expect(counts).toHaveLength(1)
    expect(counts[0].closest('[data-ops-skill-filters]')).toBeTruthy()
    expect(counts[0].textContent).toBe('5 skills')
    fireEvent.change(screen.getByLabelText('skill type'), { target: { value: 'design' } })
    expect(lens.querySelector('[data-ops-skill-count]')?.textContent).toBe('Showing 2 of 5')
    // The list region is not a nested framed section.
    expect(lens.querySelector('section[data-ops-skills]')).toBeNull()
  })

  it('keeps the enabled/disabled group headings only when both groups exist', async () => {
    const mixed = [...skills(2), { name: 'off', category: 'x', description: 'idle', enabled: false }]
    render(
      <SkillsLens
        client={base({
          profiles: vi.fn().mockResolvedValue([{ name: 'default' }]),
          skills: vi.fn().mockResolvedValue(mixed)
        })}
        profile="default"
      />
    )
    await waitFor(() => expect(document.querySelector('[data-ops-skill-open="off"]')).toBeTruthy())
    expect([...document.querySelectorAll('[data-ops-rows-group] > h4')].map(h => h.textContent)).toEqual([
      'Enabled in this profile',
      'Disabled in this profile'
    ])
  })
})

describe('P25 Channels: tab totals say they are partial while a source failed', () => {
  const full = {
    catalog: [{ name: 'github', description: 'Repos', installed: false }],
    servers: [{ name: 'linear', enabled: true }],
    platforms: [
      { id: 'telegram', name: 'Telegram', description: 'Bot', configured: true, enabled: true, gateway_running: true }
    ],
    providers: [{ id: 'anthropic', name: 'Claude', flow: 'pkce', status: { logged_in: true } }]
  }

  it('marks All/Connected as a lower bound described by the failure notice', async () => {
    render(
      <ChannelsLens client={base({ channels: vi.fn().mockResolvedValue({ ...full, platforms: null }) })} profile="p" />
    )
    await screen.findByText(/Couldn't load messaging platforms/)
    const all = document.querySelector('[data-ops-app-filter="all"]') as HTMLElement
    const connected = document.querySelector('[data-ops-app-filter="connected"]') as HTMLElement
    expect(all.textContent).toBe('All 3+')
    expect(connected.textContent).toBe('Connected 2+')
    const notice = document.querySelector('[data-ops-partial]') as HTMLElement
    expect(all.getAttribute('aria-describedby')).toBe(notice.id)
    expect(connected.getAttribute('aria-describedby')).toBe(notice.id)
    expect(all.hasAttribute('data-ops-count-partial')).toBe(true)
  })

  it('complete reads stay plain counts with no description', async () => {
    render(<ChannelsLens client={base({ channels: vi.fn().mockResolvedValue(full) })} profile="p" />)
    await screen.findByText('Telegram')
    const all = document.querySelector('[data-ops-app-filter="all"]') as HTMLElement
    expect(all.textContent).toBe('All 4')
    expect(all.getAttribute('aria-describedby')).toBeNull()
    expect(all.hasAttribute('data-ops-count-partial')).toBe(false)
  })
})
