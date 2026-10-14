/**
 * P8 b4: Agents (Fleet / Teams / Roles), Skills and Channels & MCP as live Ops lenses.
 * Reads go through Desktop's own API helpers; every connect / install / edit flow is Desktop's own
 * (Ops routes there), except skill installs, which use the hub install route after a confirm.
 */
import { useMemo, useState } from 'react'

import { connectionScoped, hermesApi } from '@/api/client'
import { listOAuthProviders } from '@/api/config'
import { getMcpCatalog, listMcpServers } from '@/api/mcp'
import { getMessagingPlatforms } from '@/api/messaging'
import { getOfficialSkills, getSkills, installSkillFromHub } from '@/api/skills'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

import { opsCall } from '../feed/diag'
import { type ActiveWorker, createOpsActions } from '../feed/ops-actions'
import type { BoardTask } from '../office/control-room'
import { fmtAge } from '../office/control-room'
import { useOpsResource } from '../office/office-container'
import { DataTable, type DataTableSort } from '../primitives/data-table'

import {
  APP_CATEGORIES,
  type AppCard,
  appCards,
  appGlyph,
  appRoute,
  type ChannelsInput,
  type FleetProfile,
  fleetRows,
  type OfficialLite,
  type RunStats,
  searchRows,
  type SkillLite,
  skillRows,
  type StarterPack,
  starterPacks,
  tagTone,
  teams,
  WEEK_S
} from './b4-model'

const why = (e: unknown) => (e instanceof Error ? e.message : e ? String(e) : null)

/** Max profiles whose skills are fetched for the Agents column (one request each). */
export const SKILL_PROFILE_SCAN_MAX = 12

export interface B4Client {
  profiles: () => Promise<FleetProfile[]>
  tasks: () => Promise<BoardTask[] | null>
  workers: () => Promise<ActiveWorker[]>
  /** R72 (P8 b6): task_runs per profile since `since` (epoch s); rejects on an older backend. */
  runStats?: (since: number) => Promise<RunStats>
  skills: (profile: string) => Promise<SkillLite[]>
  official: (profile: string) => Promise<OfficialLite[]>
  install: (identifier: string, profile: string) => Promise<unknown>
  channels: (profile: string) => Promise<ChannelsInput>
}

const settle = <T,>(p: Promise<T>) => p.then(v => v, () => null)

export function createB4Client(): B4Client {
  const ops = createOpsActions()

  return {
    profiles: async () => {
      const [desk, kan] = await Promise.all([ops.profiles(), settle(ops.kanbanProfiles())])
      const desc = new Map((kan?.profiles ?? []).map(p => [p.name, p.description ?? null]))

      return (desk?.profiles ?? []).map(p => ({ name: p.name, model: p.model, provider: p.provider, description: desc.get(p.name) ?? null }))
    },
    tasks: () => ops.boardTasks() as Promise<BoardTask[] | null>,
    workers: () => ops.activeWorkers().then(r => r?.workers ?? []),
    runStats: since =>
      opsCall('GET', '/api/plugins/kanban/runs/stats', () =>
        hermesApi<{ profiles?: RunStats }>({ ...connectionScoped(), path: `/api/plugins/kanban/runs/stats?since=${Math.floor(since)}` })
      ).then(r => r?.profiles ?? {}),
    skills: profile => getSkills(profile),
    official: profile => getOfficialSkills(profile).then(r => r?.skills ?? []),
    install: (identifier, profile) => installSkillFromHub(identifier, profile),
    channels: async profile => {
      const [c, s, m, p] = await Promise.all([settle(getMcpCatalog(profile)), settle(listMcpServers()), settle(getMessagingPlatforms(profile)), settle(listOAuthProviders(profile))])

      if (!c && !s && !m && !p) {
        throw new Error('no channel source answered')
      }

      return { catalog: c?.entries ?? null, servers: s?.servers ?? null, platforms: m?.platforms ?? null, providers: p?.providers ?? null }
    }
  }
}

let shared: B4Client | null = null
const useClient = (c?: B4Client) => c ?? (shared ??= createB4Client())

function State({ what, error }: { what: string; error: unknown }) {
  return <p data-ops-unavailable="">{error ? `${what} unavailable: ${why(error)}` : `${what} loading.`}</p>
}

function Search({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input aria-label={label} onChange={e => onChange(e.target.value)} placeholder={placeholder} type="search" value={value} />
}

/* ------------------------------ Agents lens -------------------------------- */

type AgentsTab = 'fleet' | 'teams' | 'roles'

export function AgentsLens({ client: c, nowS, onOpenRoute }: { client?: B4Client; nowS?: number; onOpenRoute?: (r: string) => void }) {
  const client = useClient(c)
  const profiles = useOpsResource(() => client.profiles(), [client])
  const tasks = useOpsResource(() => client.tasks(), [client])
  const workers = useOpsResource(() => client.workers(), [client], 10_000)

  const stats = useOpsResource(
    () => (client.runStats ? client.runStats(Math.floor(Date.now() / 1000) - WEEK_S) : Promise.reject(new Error('no run stats'))),
    [client],
    60_000
  )

  const [tab, setTab] = useState<AgentsTab>('fleet')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<DataTableSort | null>({ columnId: 'lastActive', direction: 'desc' })
  const now = nowS ?? Math.floor(Date.now() / 1000)

  const rows = useMemo(
    () => (profiles.value ? fleetRows(profiles.value, tasks.value ?? null, workers.value ?? null, now, stats.value ?? null) : null),
    [profiles.value, tasks.value, workers.value, now, stats.value]
  )

  const open = (name: string) => onOpenRoute?.(`/profiles?profile=${encodeURIComponent(name)}`)

  return (
    <section aria-label="Agents" data-ops-lens="agents">
      <header>
        <h2>Agents</h2>
        <div role="tablist">
          {(['fleet', 'teams', 'roles'] as const).map(t => (
            <button aria-selected={tab === t} data-ops-agents-tab={t} key={t} onClick={() => setTab(t)} role="tab" type="button">
              {t === 'fleet' ? 'Fleet' : t === 'teams' ? 'Teams' : 'Roles'}
            </button>
          ))}
        </div>
        {/* O14: a new agent is a new profile, created in Desktop's profile flow (clone-from lives there). */}
        <button data-ops-new-agent="" disabled={!onOpenRoute} onClick={() => onOpenRoute?.('/profiles?new=1')} type="button">
          New agent
        </button>
      </header>
      {!rows ? (
        <State error={profiles.error} what="Agents" />
      ) : tab === 'fleet' ? (
        <>
          <Search label="search agents" onChange={setQ} placeholder="Search by name, model, lane, role" value={q} />
          {tasks.error ? <p data-ops-partial="">Task counts unavailable: {why(tasks.error)}</p> : null}
          <DataTable
            caption={`Fleet (${rows.length})`}
            columns={[
              {
                id: 'name',
                header: 'Agent',
                sortable: true,
                sortValue: r => r.name,
                cell: r => (
                  <button data-ops-fleet-open={r.name} disabled={!onOpenRoute} onClick={() => open(r.name)} type="button">
                    <span>{r.name}</span>
                    {r.role ? <small data-ops-role="">{r.role}</small> : null}
                  </button>
                )
              },
              { id: 'model', header: 'Model', sortable: true, sortValue: r => r.model, cell: r => r.model ?? 'unknown' },
              { id: 'lane', header: 'Lane', sortable: true, sortValue: r => r.lane, cell: r => r.lane ?? '—' },
              { id: 'active', header: 'Active tasks', sortable: true, tabular: true, sortValue: r => r.active, cell: r => String(r.active) },
              {
                id: 'runs7d',
                header: 'Runs 7d',
                sortable: true,
                tabular: true,
                sortValue: r => r.runs7d,
                cell: r => (
                  <span data-ops-runs-source={r.runsSource} title={r.runsSource === 'runs' ? 'Worker runs started in the last 7 days' : 'Task starts (this Hermes has no run stats)'}>
                    {r.runs7d}
                    {r.failed7d ? <small data-ops-runs-failed=""> · {r.failed7d} failed</small> : null}
                  </span>
                )
              },
              { id: 'lastActive', header: 'Last active', sortable: true, sortValue: r => r.lastActive ?? 0, cell: r => (r.lastActive ? fmtAge(now - r.lastActive) : 'never') },
              { id: 'status', header: 'Status', sortable: true, sortValue: r => r.status, cell: r => <span data-ops-fleet-status={r.status}>{r.status}</span> }
            ]}
            emptyLabel={q ? 'No agent matches.' : 'No profiles.'}
            getRowId={r => r.name}
            onSortChange={setSort}
            rows={searchRows(rows, q, r => [r.name, r.model, r.lane, r.role])}
            sort={sort}
          />
        </>
      ) : tab === 'teams' ? (
        <TeamsView onOpenRoute={onOpenRoute} tasks={tasks.value ?? null} tasksError={tasks.error} />
      ) : (
        <ul data-ops-roles="">
          {rows.map(r => (
            <li data-ops-role-row={r.name} key={r.name}>
              <strong>{r.name}</strong> — {r.role ?? 'No role (the profile has no description).'}
            </li>
          ))}
          <li data-ops-roles-note="">Roles are read-only here; edit a profile's description in Profiles.</li>
        </ul>
      )}
    </section>
  )
}

function TeamsView({ tasks, tasksError, onOpenRoute }: { tasks: BoardTask[] | null; tasksError: unknown; onOpenRoute?: (r: string) => void }) {
  if (!tasks) {
    return <State error={tasksError} what="Teams" />
  }

  const list = teams(tasks)

  if (list.length === 0) {
    return <p data-ops-empty="teams">No tasks yet, so no lanes.</p>
  }

  return (
    <ul data-ops-teams="">
      {list.map(t => (
        <li data-ops-team={t.lane} key={t.lane}>
          <h3>{t.lane}</h3>
          <span data-ops-team-open="">{t.open} open</span>
          <p>
            Projects:{' '}
            {t.projects.length
              ? t.projects.map(p => (
                  <button data-ops-team-project={p} disabled={!onOpenRoute} key={p} onClick={() => onOpenRoute?.(`/kanban?project=${encodeURIComponent(p)}`)} type="button">
                    {p}
                  </button>
                ))
              : 'none'}
          </p>
          <p data-ops-team-members="">Members: {t.members.join(', ') || 'none'}</p>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------- Skills lens -------------------------------- */

function AgentLinks({ agents, onOpen }: { agents: string[]; onOpen?: (p: string) => void }) {
  const [more, setMore] = useState(false)
  const head = agents.slice(0, 3)
  const rest = agents.slice(3)

  return (
    <span data-ops-skill-agents="">
      {head.map(a => (
        <button disabled={!onOpen} key={a} onClick={() => onOpen?.(a)} type="button">
          {a}
        </button>
      ))}
      {rest.length ? (
        <button aria-expanded={more} data-ops-agents-more="" onClick={() => setMore(m => !m)} type="button">
          +{rest.length}
        </button>
      ) : null}
      {more ? (
        <span data-ops-agents-popover="" role="dialog">
          {rest.map(a => (
            <button disabled={!onOpen} key={a} onClick={() => onOpen?.(a)} type="button">
              {a}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  )
}

export function SkillsLens({ client: c, profile, onOpenRoute }: { client?: B4Client; profile: string; onOpenRoute?: (r: string) => void }) {
  const client = useClient(c)
  const profiles = useOpsResource(() => client.profiles(), [client], 60_000)

  const names = useMemo(() => {
    const all = (profiles.value ?? []).map(p => p.name)

    return [profile, ...all.filter(n => n !== profile)].slice(0, SKILL_PROFILE_SCAN_MAX)
  }, [profiles.value, profile])

  const key = names.join('\0')

  const skills = useOpsResource(
    async () => Object.fromEntries(await Promise.all(names.map(async n => [n, n === profile ? await client.skills(n) : await settle(client.skills(n))] as const))),
    [client, key],
    60_000
  )

  const official = useOpsResource(() => client.official(profile), [client, profile], 120_000)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<DataTableSort | null>({ columnId: 'name', direction: 'asc' })
  const [confirm, setConfirm] = useState<StarterPack | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [onFilter, setOnFilter] = useState<'all' | 'on' | 'off'>('all')
  const [type, setType] = useState('')
  const rows = skills.value ? skillRows(skills.value as Record<string, SkillLite[] | null>, profile) : null
  const types = rows ? [...new Set(rows.map(r => r.category || 'general'))].sort() : []

  const shown = rows
    ? searchRows(rows, q, r => [r.name, r.category, r.description]).filter(r => (onFilter === 'all' || (onFilter === 'on') === Boolean(r.enabled)) && (!type || (r.category || 'general') === type))
    : []

  const filtered = Boolean(q || type || onFilter !== 'all')
  const scanCapped = (profiles.value?.length ?? 0) > SKILL_PROFILE_SCAN_MAX
  const packs = official.value ? starterPacks(official.value) : null
  const openSkill = (n: string) => onOpenRoute?.(`/capabilities?tab=skills&skill=${encodeURIComponent(n)}`)
  const openAgent = (p: string) => onOpenRoute?.(`/profiles?profile=${encodeURIComponent(p)}`)

  const addAll = async (pack: StarterPack) => {
    setBusy(true)
    const failed: string[] = []

    setProgress({ done: 0, total: pack.missing.length })

    for (const [i, s] of pack.missing.entries()) {
      try {
        await client.install(s.identifier, profile)
        setProgress({ done: i + 1, total: pack.missing.length })
      } catch (e) {
        failed.push(`${s.name} (${why(e)})`)
      }
    }

    setBusy(false)
    setProgress(null)
    setConfirm(null)
    setNote(failed.length ? `Installed ${pack.missing.length - failed.length} of ${pack.missing.length}; failed: ${failed.join(', ')}` : `Installing ${pack.missing.length} skills into ${profile}.`)
    official.reload()
    skills.reload()
  }

  return (
    <section aria-label="Skills" data-ops-lens="skills">
      <header>
        <h2>Skills · {profile}</h2>
        <button data-ops-skill-create="" disabled={!onOpenRoute} onClick={() => onOpenRoute?.('/capabilities?tab=skills&new=1')} type="button">
          Create skill
        </button>
        <button data-ops-browse-library="" disabled={!onOpenRoute} onClick={() => onOpenRoute?.('/capabilities?tab=skills&hub=1')} type="button">
          Browse library
        </button>
      </header>
      {progress ? (
        <p aria-live="polite" data-ops-install-progress={`${progress.done}/${progress.total}`} role="status">
          Installing {progress.done} of {progress.total}…
        </p>
      ) : null}
      {note ? <p role="status">{note}</p> : null}
      <section aria-label="Starter packs" data-ops-packs="">
        <h3>Starter packs</h3>
        {!packs ? (
          <State error={official.error} what="Starter packs" />
        ) : packs.length === 0 ? (
          <p data-ops-empty="packs">The hub offers no category with two or more skills.</p>
        ) : (
          <ul>
            {packs.map(p => (
              <li data-ops-pack={p.id} key={p.id}>
                <strong>{p.title}</strong> <span data-ops-pack-meta="">{p.skills.length} skills{p.missing.length < p.skills.length ? ` · ${p.skills.length - p.missing.length} installed` : ''}</span>
                <button data-ops-add-all={p.id} disabled={busy || p.missing.length === 0} onClick={() => setConfirm(p)} type="button">
                  {p.missing.length === 0 ? 'All added' : 'Add all'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Individual skills" data-ops-skills="">
        <h3>
          Individual skills <span data-ops-skill-count="">{rows ? shown.length : '…'}</span>
        </h3>
        <div aria-label="Skill filters" data-ops-skill-filters="" role="group">
          <Search label="search skills" onChange={setQ} placeholder="Search by name, type, etc." value={q} />
          <select aria-label="skill state" data-ops-skill-state={onFilter} onChange={e => setOnFilter(e.target.value as 'all' | 'on' | 'off')} value={onFilter}>
            <option value="all">All states</option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
          <select aria-label="skill type" data-ops-skill-type={type} onChange={e => setType(e.target.value)} value={type}>
            <option value="">All types</option>
            {types.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {filtered ? (
            <button data-ops-skill-clear="" onClick={() => (setQ(''), setType(''), setOnFilter('all'))} type="button">
              Clear filters
            </button>
          ) : null}
        </div>
        {rows ? (
          <p data-ops-skill-shown="">
            Showing {shown.length} of {rows.length}
            {scanCapped ? ` · Agents column covers the first ${SKILL_PROFILE_SCAN_MAX} profiles` : ''}
          </p>
        ) : null}
        {!rows ? (
          <State error={skills.error} what="Skills" />
        ) : (
          <DataTable
            caption="Skills"
            columns={[
              {
                id: 'name',
                header: 'Name',
                sortable: true,
                sortValue: r => r.name,
                cell: r => (
                  <button data-ops-skill-open={r.name} disabled={!onOpenRoute} onClick={() => openSkill(r.name)} type="button">
                    {r.name}
                  </button>
                )
              },
              { id: 'type', header: 'Type', sortable: true, sortValue: r => r.category, cell: r => <span data-ops-skill-tag={tagTone(r.category || 'general')}>{r.category || 'general'}</span> },
              { id: 'description', header: 'Description', description: r => r.description },
              { id: 'agents', header: 'Agents', sortable: true, tabular: true, sortValue: r => r.agents.length, cell: r => <AgentLinks agents={r.agents} onOpen={onOpenRoute ? openAgent : undefined} /> },
              { id: 'source', header: 'Source', sortable: true, sortValue: r => r.provenance ?? '', cell: r => r.provenance ?? 'unknown' },
              { id: 'usage', header: 'Uses', sortable: true, tabular: true, sortValue: r => r.usage ?? -1, cell: r => (typeof r.usage === 'number' ? String(r.usage) : '—') },
              { id: 'enabled', header: 'On', sortable: true, sortValue: r => (r.enabled ? 1 : 0), cell: r => (r.enabled ? 'on' : 'off') }
            ]}
            emptyLabel={filtered ? 'No skill matches these filters.' : 'This profile has no skills yet. Use Create skill or Browse library.'}
            getRowId={r => r.name}
            onSortChange={setSort}
            rows={shown}
            sort={sort}
          />
        )}
      </section>
      <ConfirmDialog
        confirmLabel={busy ? 'Installing…' : `Install ${confirm?.missing.length ?? 0}`}
        description={confirm ? `Into ${profile}: ${confirm.missing.map(s => s.name).join(', ')}` : ''}
        onClose={() => {
          if (!busy) {
            setConfirm(null)
          }
        }}
        onConfirm={() => {
          if (confirm) {
            void addAll(confirm)
          }
        }}
        open={!!confirm}
        title={confirm ? `Add all of ${confirm.title}?` : ''}
      />
    </section>
  )
}

/* ------------------------------ Channels lens ------------------------------- */

type Filter = 'all' | 'connected'

function AppTile({ card, onOpenRoute }: { card: AppCard; onOpenRoute?: (r: string) => void }) {
  return (
    <li data-ops-app={card.key} data-ops-app-connected={card.connected ? '' : undefined}>
      <span aria-hidden data-ops-app-glyph="">
        {appGlyph(card.name)}
      </span>
      <strong>{card.name}</strong>
      <p>{card.description}</p>
      {card.warning ? <small data-ops-app-warning="">{card.warning}</small> : null}
      {card.connected ? <span data-ops-app-state="connected">✓ Connected</span> : null}
      <button data-ops-app-action={card.connected ? 'manage' : 'connect'} disabled={!onOpenRoute} onClick={() => onOpenRoute?.(appRoute(card))} type="button">
        {card.connected ? 'Manage' : 'Connect'}
      </button>
    </li>
  )
}

/** G62: quick-connect popover; search + kind filter over every catalog, grouped by category. */
export function QuickConnect({ cards, onOpenRoute, onClose }: { cards: AppCard[]; onOpenRoute?: (r: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | AppCard['kind']>('all')
  const hits = searchRows(cards, q, c => [c.name, c.description, c.category]).filter(c => kind === 'all' || c.kind === kind)

  return (
    <div aria-label="Connect an app" data-ops-quick-connect="" onKeyDown={e => e.key === 'Escape' && onClose()} role="dialog">
      <Search label="search apps" onChange={setQ} placeholder="Search apps" value={q} />
      <select aria-label="app kind" onChange={e => setKind(e.target.value as typeof kind)} value={kind}>
        <option value="all">All kinds</option>
        {(Object.keys(APP_CATEGORIES) as AppCard['kind'][]).map(k => (
          <option key={k} value={k}>
            {APP_CATEGORIES[k]}
          </option>
        ))}
      </select>
      {Object.values(APP_CATEGORIES).map(cat => {
        const xs = hits.filter(c => c.category === cat)

        return xs.length ? (
          <section aria-label={cat} data-ops-qc-group={cat} key={cat}>
            <h4>{cat}</h4>
            {xs.map(c => (
              <button data-ops-qc-item={c.key} disabled={!onOpenRoute} key={c.key} onClick={() => (onOpenRoute?.(appRoute(c)), onClose())} type="button">
                {c.name} {c.connected ? '✓' : ''}
              </button>
            ))}
          </section>
        ) : null
      })}
      {hits.length === 0 ? <p>No app matches.</p> : null}
    </div>
  )
}

export function ChannelsLens({ client: c, profile, onOpenRoute }: { client?: B4Client; profile: string; onOpenRoute?: (r: string) => void }) {
  const client = useClient(c)
  const r = useOpsResource(() => client.channels(profile), [client, profile], 60_000)
  const [filter, setFilter] = useState<Filter>('all')
  const [cat, setCat] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [quick, setQuick] = useState(false)
  const cards = useMemo(() => (r.value ? appCards(r.value) : null), [r.value])

  if (!cards || !r.value) {
    return <State error={r.error} what="Channels & MCP" />
  }

  const missing = (['catalog', 'platforms', 'providers'] as const).filter(k => r.value![k] === null)
  const base = filter === 'connected' ? cards.filter(x => x.connected) : cards
  const shown = searchRows(base, q, x => [x.name, x.description]).filter(x => !cat || x.category === cat)
  const cats = Object.values(APP_CATEGORIES)

  return (
    <section aria-label="Channels & MCP" data-ops-lens="channels">
      <header>
        <h2>Channels &amp; MCP</h2>
        <div role="tablist">
          {(['all', 'connected'] as const).map(f => (
            <button aria-selected={filter === f} data-ops-app-filter={f} key={f} onClick={() => setFilter(f)} role="tab" type="button">
              {f === 'all' ? `All ${cards.length}` : `Connected ${cards.filter(x => x.connected).length}`}
            </button>
          ))}
        </div>
        <Search label="search integrations" onChange={setQ} placeholder="Search" value={q} />
        <button aria-expanded={quick} aria-label="quick connect" data-ops-quick-open="" onClick={() => setQuick(v => !v)} type="button">
          +
        </button>
      </header>
      {missing.length ? <p data-ops-partial="">Not answering: {missing.join(', ')}.</p> : null}
      {quick ? <QuickConnect cards={cards} onClose={() => setQuick(false)} onOpenRoute={onOpenRoute} /> : null}
      <div data-ops-channels-body="">
        <nav aria-label="Categories" data-ops-app-rail="">
          <button aria-pressed={cat === null} data-ops-app-cat="all" onClick={() => setCat(null)} type="button">
            All
          </button>
          {cats.map(x => (
            <button aria-pressed={cat === x} data-ops-app-cat={x} key={x} onClick={() => setCat(x)} type="button">
              {x} <span>{base.filter(c => c.category === x).length}</span>
            </button>
          ))}
          {/* G15: the rail's footer is the library entry. */}
          <button data-ops-connect-more="" onClick={() => setQuick(true)} type="button">
            Connect more apps
          </button>
        </nav>
        <div>
          {cats
            .filter(x => !cat || x === cat)
            .map(x => {
              const xs = shown.filter(c => c.category === x)

              return xs.length ? (
                <section aria-label={x} data-ops-app-section={x} key={x}>
                  <h3>{x}</h3>
                  <ul data-ops-app-grid="">
                    {xs.map(card => (
                      <AppTile card={card} key={card.key} onOpenRoute={onOpenRoute} />
                    ))}
                  </ul>
                </section>
              ) : null
            })}
          {shown.length === 0 ? <p data-ops-empty="apps">{filter === 'connected' ? 'Nothing connected yet.' : 'No app matches.'}</p> : null}
        </div>
      </div>
    </section>
  )
}
