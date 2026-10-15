/** P8 b4: Fleet (R72), Teams (R73), O14, O76, Skills (G10 G12 G68-G72 G81 G82), Channels (G6 G7 G15 G62 G63 G83 G84), G67. */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BoardTask } from '../office/control-room'

import { AgentsLens, type B4Client, ChannelsLens, SkillsLens } from './b4-lenses'
import { appCards, appsInTags, fleetRows, roleOf, starterPacks, tagTone, teams } from './b4-model'
import { TemplatesLensView } from './lenses'

const NOW = 1_800_000_000
afterEach(() => cleanup())

const T = (id: string, o: Partial<BoardTask>): BoardTask => ({ id, title: id, status: 'todo', assignee: null, created_at: NOW - 100, ...o }) as BoardTask

const tasks: BoardTask[] = [
  T('1', { assignee: 'builder', tenant: 'web', status: 'running', started_at: NOW - 3600, last_heartbeat_at: NOW - 30, project_id: 'site' }),
  T('2', { assignee: 'builder', tenant: 'web', status: 'done', started_at: NOW - 10 * 86_400, completed_at: NOW - 9 * 86_400 }),
  T('3', { assignee: 'pixel', tenant: 'design', status: 'todo', consecutive_failures: 2, project_id: 'brand' }),
  T('4', { assignee: 'builder', tenant: 'ops', status: 'review', started_at: NOW - 86_400 })
]

const client = (o: Partial<B4Client> = {}): B4Client => ({
  profiles: vi.fn().mockResolvedValue([
    { name: 'builder', model: 'grok-4', description: 'Orchestrator. Splits work.' },
    { name: 'pixel', model: 'gpt-5', description: 'Design lead; owns the brand' },
    { name: 'quiet', model: null, description: '' }
  ]),
  tasks: vi.fn().mockResolvedValue(tasks),
  workers: vi.fn().mockResolvedValue([{ profile: 'builder', task_id: '1', last_heartbeat_at: NOW - 30 }]),
  skills: vi.fn((p: string) =>
    Promise.resolve(
      p === 'builder'
        ? [
            { name: 'web-research', category: 'research', description: 'Search the web', enabled: true, provenance: 'bundled', usage: 9 },
            { name: 'figma', category: 'design', description: 'Read Figma files', enabled: true, provenance: 'hub' }
          ]
        : p === 'pixel'
          ? [{ name: 'figma', category: 'design', description: 'Read Figma files', enabled: true }]
          : [{ name: 'figma', category: 'design', description: '', enabled: false }]
    )
  ),
  official: vi.fn().mockResolvedValue([
    { identifier: 'o/a', name: 'deck', category: 'design', description: '', installed: false },
    { identifier: 'o/b', name: 'palette', category: 'design', description: '', installed: true },
    { identifier: 'o/c', name: 'icons', category: 'design', description: '', installed: false },
    { identifier: 'o/d', name: 'lonely', category: 'misc', description: '', installed: false }
  ]),
  install: vi.fn().mockResolvedValue({ ok: true }),
  channels: vi.fn().mockResolvedValue({
    catalog: [
      { name: 'github', description: 'Repos and PRs', installed: false },
      { name: 'linear', description: 'Issues', installed: false }
    ],
    servers: [{ name: 'linear', enabled: true }, { name: 'my-local', enabled: false }],
    platforms: [
      { id: 'telegram', name: 'Telegram', description: 'Bot', configured: true, enabled: true, gateway_running: false },
      { id: 'slack', name: 'Slack', description: 'Workspace', configured: false, enabled: false, gateway_running: false }
    ],
    providers: [{ id: 'anthropic', name: 'Claude', flow: 'pkce', status: { logged_in: true } }, { id: 'openai', name: 'GPT', flow: 'device_code', status: { logged_in: false } }]
  }),
  ...o
})

describe('model', () => {
  it('O76 role = first clause; fleet rows; teams per lane', () => {
    expect(roleOf('Orchestrator. Splits work.')).toBe('Orchestrator')
    expect(roleOf('Design lead; owns')).toBe('Design lead')
    expect(roleOf('')).toBeNull()
    const [b, p, q] = fleetRows([{ name: 'builder' }, { name: 'pixel' }, { name: 'quiet' }], tasks, [{ profile: 'builder', task_id: '1', last_heartbeat_at: 0 }], NOW)
    expect(b).toMatchObject({ lane: 'web', active: 2, runs7d: 2, status: 'running', lastActive: NOW - 30 })
    expect(p).toMatchObject({ lane: 'design', active: 1, status: 'failing' })
    expect(q).toMatchObject({ lane: null, active: 0, lastActive: null, status: 'idle' })
    expect(fleetRows([{ name: 'x' }], null, null, NOW)[0].status).toBe('unknown')
    expect(teams(tasks).map(t => [t.lane, t.open, t.members.join()])).toEqual([
      ['design', 1, 'pixel'],
      ['ops', 1, 'builder'],
      ['web', 1, 'builder']
    ])
  })

  it('G10 packs = categories with >= 2 skills; G68 stable tones; G83 connected; G67 tag icons', () => {
    const packs = starterPacks([
      { identifier: 'a', name: 'a', category: 'design', description: '', installed: false },
      { identifier: 'b', name: 'b', category: 'design', description: '', installed: true },
      { identifier: 'c', name: 'c', category: 'misc', description: '', installed: false }
    ])

    expect(packs.map(p => [p.title, p.missing.length])).toEqual([['Design kit', 1]])
    expect(tagTone('Design')).toBe(tagTone('design'))
    const cards = appCards({ catalog: [{ name: 'github', description: '' }], servers: [{ name: 'github', enabled: false }], platforms: null, providers: null })
    expect(cards[0]).toMatchObject({ connected: true, warning: 'disabled' })
    expect(appsInTags(['GitHub', 'nope', 'github'], cards).map(a => a.id)).toEqual(['github'])
  })
})

describe('R72 Fleet / R73 Teams / O14', () => {
  it('fleet columns, role subtitle, search, sort, status; teams; roles read-only; New agent routes to profiles', async () => {
    const open = vi.fn()
    render(<AgentsLens client={client()} nowS={NOW} onOpenRoute={open} />)
    await waitFor(() => expect(document.querySelector('[data-ops-fleet-open="builder"]')).toBeTruthy())
    await waitFor(() => expect(document.querySelector('[data-ops-fleet-status="running"]')).toBeTruthy())
    // P14: the list is the default; role and status read in the row, columns live in the Table view.
    expect(document.querySelector('[data-ops-fleet-open="builder"] [data-ops-role]')?.textContent).toBe('Orchestrator')
    fireEvent.click(document.querySelector('[data-ops-fleet-view="table"]')!)
    const heads = [...document.querySelectorAll('th')].map(th => th.textContent)

    for (const h of ['Agent', 'Model', 'Lane', 'Active tasks', 'Runs 7d', 'Last active', 'Status']) {
      expect(heads.some(x => x?.includes(h))).toBe(true)
    }

    expect(document.querySelector('[data-ops-fleet-open="builder"] [data-ops-role]')?.textContent).toBe('Orchestrator')
    expect(document.querySelector('[data-ops-fleet-status="failing"]')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('search agents'), { target: { value: 'design' } })
    expect(document.querySelector('[data-ops-fleet-open="builder"]')).toBeNull()
    expect(document.querySelector('[data-ops-fleet-open="pixel"]')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('search agents'), { target: { value: '' } })
    fireEvent.click(document.querySelector('[data-ops-fleet-open="pixel"]')!)
    expect(open).toHaveBeenLastCalledWith('/profiles?profile=pixel')
    fireEvent.click(document.querySelector('[data-ops-new-agent]')!)
    expect(open).toHaveBeenLastCalledWith('/profiles?new=1')
    fireEvent.click(document.querySelector('[data-ops-agents-tab="teams"]')!)
    const web = document.querySelector('[data-ops-team="web"]') as HTMLElement
    expect(web.querySelector('[data-ops-team-members]')?.textContent).toContain('builder')
    fireEvent.click(document.querySelector('[data-ops-team-project="brand"]')!)
    expect(open).toHaveBeenLastCalledWith('/kanban?project=brand')
    fireEvent.click(document.querySelector('[data-ops-agents-tab="roles"]')!)
    expect(document.querySelector('[data-ops-role-row="quiet"]')?.textContent).toMatch(/No role/)
    expect(document.querySelector('[data-ops-roles] input, [data-ops-roles] textarea')).toBeNull()
  })

  it('a refused profiles read shows the reason; refused tasks keep the fleet with a partial note', async () => {
    render(<AgentsLens client={client({ profiles: vi.fn().mockRejectedValue(new Error('503: down')) })} nowS={NOW} />)
    await screen.findByText('Agents unavailable: 503: down')
    cleanup()
    render(<AgentsLens client={client({ tasks: vi.fn().mockRejectedValue(new Error('board gone')) })} nowS={NOW} />)
    await screen.findByText('Task counts unavailable: board gone')
    expect(document.querySelector('[data-ops-fleet-open="builder"]')).toBeTruthy()
  })
})

describe('Skills lens', () => {
  it('G71 count pill, G81 search, G68 tags, G69 agents +N, G12 open/create, G72 browse', async () => {
    const open = vi.fn()

    const many = client({
      profiles: vi.fn().mockResolvedValue(['builder', 'a1', 'a2', 'a3', 'a4'].map(name => ({ name }))),
      skills: vi.fn().mockResolvedValue([{ name: 'figma', category: 'design', description: 'Read Figma files', enabled: true }])
    })

    render(<SkillsLens client={many} onOpenRoute={open} profile="builder" />)
    await waitFor(() => expect(document.querySelector('[data-ops-skill-open="figma"]')).toBeTruthy())
    expect(document.querySelector('[data-ops-skill-count]')?.textContent).toBe('1')
    expect(document.querySelector('[data-ops-skill-tag]')?.getAttribute('data-ops-skill-tag')).toBe(tagTone('design'))
    const agents = document.querySelector('[data-ops-skill-agents]') as HTMLElement
    // P15: every profile with the skill enabled is reachable from the row's disclosure (no +N popover).
    expect(within(agents).getAllByRole('button').map(b => b.textContent).sort()).toEqual(['a1', 'a2', 'a3', 'a4', 'builder'])
    fireEvent.click(within(agents).getByText('builder'))
    expect(open).toHaveBeenLastCalledWith('/profiles?profile=builder')
    fireEvent.change(screen.getByLabelText('search skills'), { target: { value: 'nothing' } })
    expect(document.querySelector('[data-ops-skill-count]')?.textContent).toBe('0')
    fireEvent.change(screen.getByLabelText('search skills'), { target: { value: 'figma files' } })
    fireEvent.change(screen.getByLabelText('search skills'), { target: { value: 'DESIGN' } })
    expect(document.querySelector('[data-ops-skill-count]')?.textContent).toBe('1')
    fireEvent.click(document.querySelector('[data-ops-skill-open="figma"]')!)
    expect(open).toHaveBeenLastCalledWith('/capabilities?tab=skills&skill=figma')
    fireEvent.click(document.querySelector('[data-ops-skill-create]')!)
    expect(open).toHaveBeenLastCalledWith('/capabilities?tab=skills&new=1')
    fireEvent.click(document.querySelector('[data-ops-browse-library]')!)
    expect(open).toHaveBeenLastCalledWith('/capabilities?tab=skills&hub=1')
  })

  it('G82 Add all: confirm lists every missing skill, installs into the focused profile, reports failures', async () => {
    const install = vi.fn().mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error('409: exists'))
    const c = client({ install })
    render(<SkillsLens client={c} profile="pixel" />)
    await waitFor(() => expect(document.querySelector('[data-ops-pack="design"]')).toBeTruthy())
    expect(document.querySelector('[data-ops-pack="misc"]')).toBeNull()
    expect(document.querySelector('[data-ops-pack-meta]')?.textContent).toBe('3 skills · 1 installed')
    fireEvent.click(document.querySelector('[data-ops-add-all="design"]')!)
    expect(install).not.toHaveBeenCalled()
    await screen.findByText('Into pixel: deck, icons')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Install 2' })))
    await waitFor(() => expect(install).toHaveBeenCalledTimes(2))
    expect(install).toHaveBeenCalledWith('o/a', 'pixel')
    expect(install).toHaveBeenCalledWith('o/c', 'pixel')
    await screen.findByText('Installed 1 of 2; failed: icons (409: exists)')
  })

  it('a refused skills read for another profile does not break the focused one', async () => {
    const skills = vi.fn((p: string) => (p === 'pixel' ? Promise.reject(new Error('no')) : Promise.resolve([{ name: 's', category: '', description: '', enabled: true }])))
    render(<SkillsLens client={client({ skills })} profile="builder" />)
    await waitFor(() => expect(document.querySelector('[data-ops-skill-open="s"]')).toBeTruthy())
    expect(document.querySelector('[data-ops-skill-tag]')?.textContent).toBe('general')
  })
})

describe('Channels lens', () => {
  it('G63 category rail + sections, G7 per-card state, G83 All/Connected, search, G84 Models', async () => {
    const open = vi.fn()
    render(<ChannelsLens client={client()} onOpenRoute={open} profile="builder" />)
    await waitFor(() => expect(document.querySelector('[data-ops-app="mcp:github"]')).toBeTruthy())
    expect([...document.querySelectorAll('[data-ops-app-section]')].map(s => s.getAttribute('data-ops-app-section'))).toEqual(['warn', 'connected', 'Messaging', 'Tools (MCP)', 'Models']) // P15: configured apps lead, the ones with a warning first
    expect(document.querySelector('[data-ops-app-filter="connected"]')?.textContent).toBe('Connected 4')
    const tg = document.querySelector('[data-ops-app="messaging:telegram"]') as HTMLElement
    expect(tg.querySelector('[data-ops-app-state]')?.textContent).toBe('Configured') // P15: messaging says configured, not a health claim
    expect(tg.querySelector('[data-ops-app-warning]')?.textContent).toBe('gateway stopped')
    fireEvent.click(tg.querySelector('[data-ops-app-action="manage"]')!)
    expect(open).toHaveBeenLastCalledWith('/messaging?platform=telegram')
    fireEvent.click(document.querySelector('[data-ops-app="mcp:github"] [data-ops-app-action="connect"]')!)
    expect(open).toHaveBeenLastCalledWith('/capabilities?tab=connectors&server=github')
    fireEvent.click(document.querySelector('[data-ops-app="model:openai"] [data-ops-app-action="connect"]')!)
    expect(open).toHaveBeenLastCalledWith('/settings?section=providers&provider=openai')
    expect(document.querySelector('[data-ops-app="mcp:my-local"] [data-ops-app-warning]')?.textContent).toBe('disabled')
    fireEvent.click(document.querySelector('[data-ops-app-filter="connected"]')!)
    expect(document.querySelector('[data-ops-app="messaging:slack"]')).toBeNull()
    expect(document.querySelector('[data-ops-app="model:anthropic"]')).toBeTruthy()
    fireEvent.click(document.querySelector('[data-ops-app-cat="Models"]')!)
    expect(document.querySelectorAll('[data-ops-app]')).toHaveLength(1)
    fireEvent.click(document.querySelector('[data-ops-app-cat="all"]')!)
    fireEvent.click(document.querySelector('[data-ops-app-filter="all"]')!)
    fireEvent.change(screen.getByLabelText('search integrations'), { target: { value: 'repos' } })
    expect([...document.querySelectorAll('[data-ops-app]')].map(e => e.getAttribute('data-ops-app'))).toEqual(['mcp:github'])
  })

  it('G62/G15 quick connect: "+" or Connect more apps opens it; search + kind filter; Esc closes', async () => {
    const open = vi.fn()
    render(<ChannelsLens client={client()} onOpenRoute={open} profile="builder" />)
    await waitFor(() => expect(document.querySelector('[data-ops-connect-more]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-ops-connect-more]')!)
    const qc = screen.getByRole('dialog', { name: 'Connect an app' })
    expect([...qc.querySelectorAll('[data-ops-qc-group]')].map(g => g.getAttribute('data-ops-qc-group'))).toEqual(['Messaging', 'Tools (MCP)', 'Models'])
    fireEvent.change(within(qc).getByLabelText('app kind'), { target: { value: 'model' } })
    expect(qc.querySelectorAll('[data-ops-qc-item]')).toHaveLength(2)
    fireEvent.change(within(qc).getByLabelText('search apps'), { target: { value: 'claude' } })
    fireEvent.click(qc.querySelector('[data-ops-qc-item="model:anthropic"]')!)
    expect(open).toHaveBeenLastCalledWith('/settings?section=providers&provider=anthropic')
    expect(screen.queryByRole('dialog', { name: 'Connect an app' })).toBeNull()
    fireEvent.click(screen.getByLabelText('quick connect'))
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Connect an app' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Connect an app' })).toBeNull()
  })

  it('a source that does not answer is named, the rest still render; all down = reason', async () => {
    render(<ChannelsLens client={client({ channels: vi.fn().mockResolvedValue({ catalog: null, servers: null, platforms: [], providers: [] }) })} profile="p" />)
    await screen.findByText(/Couldn't load the MCP catalog, your MCP servers/) // P22b: plain-language source failure
    cleanup()
    render(<ChannelsLens client={client({ channels: vi.fn().mockRejectedValue(new Error('no channel source answered')) })} profile="p" />)
    await screen.findByText('Channels & MCP unavailable: no channel source answered')
  })
})

describe('G67 blueprint app icons', () => {
  it('tags naming a known app render its icon; unknown tags do not', () => {
    render(
      <TemplatesLensView
        apps={[{ id: 'github', name: 'github', kind: 'mcp' }, { id: 'telegram', name: 'Telegram', kind: 'messaging' }]}
        blueprints={[{ key: 'k', title: 'Daily PR digest', description: '', category: 'dev', tags: ['github', 'telegram', 'daily'] }]}
      />
    )
    expect([...document.querySelectorAll('[data-ops-bp-app]')].map(e => e.getAttribute('data-ops-bp-app'))).toEqual(['github', 'telegram'])
    expect(screen.getByLabelText('Telegram').textContent).toBe('TE')
  })
})