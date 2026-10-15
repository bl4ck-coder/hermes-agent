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
import { P, T } from '../main-i18n'
import type { BoardTask } from '../office/control-room'
import { fmtAge } from '../office/control-room'
import { useOpsResource } from '../office/office-container'
import { DataTable, type DataTableSort } from '../primitives/data-table'
import { Disclosure, EntityList, EntityRow } from '../primitives/entity-row'
import { Sigil } from '../primitives/sigil'

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
  // P14: the Fleet reads as one grouped list of agents; the sortable table stays one click away.
  const [fleetView, setFleetView] = useState<'list' | 'table'>('list')
  const [sort, setSort] = useState<DataTableSort | null>({ columnId: 'lastActive', direction: 'desc' })
  const now = nowS ?? Math.floor(Date.now() / 1000)

  const rows = useMemo(
    () => (profiles.value ? fleetRows(profiles.value, tasks.value ?? null, workers.value ?? null, now, stats.value ?? null) : null),
    [profiles.value, tasks.value, workers.value, now, stats.value]
  )

  const open = (name: string) => onOpenRoute?.(`/profiles?profile=${encodeURIComponent(name)}`)

  return (
    <section aria-label={T("Agents")} data-ops-lens="agents">
      <header>
        <h2>{T("Agents")}</h2>
        <div role="tablist">
          {(['fleet', 'teams', 'roles'] as const).map(t => (
            <button aria-selected={tab === t} data-ops-agents-tab={t} key={t} onClick={() => setTab(t)} role="tab" type="button">
              {t === 'fleet' ? T('Fleet') : t === 'teams' ? T('Teams') : T('Roles')}
            </button>
          ))}
        </div>
        {/* O14: a new agent is a new profile, created in Desktop's profile flow (clone-from lives there). */}
        <button data-ops-new-agent="" disabled={!onOpenRoute} onClick={() => onOpenRoute?.('/profiles?new=1')} type="button">
          {T("New agent")}</button>
      </header>
      {!rows ? (
        <State error={profiles.error} what="Agents" />
      ) : tab === 'fleet' ? (
        <>
          <Search label={T("search agents")} onChange={setQ} placeholder={T("Search by name, model, lane, role")} value={q} />
          {tasks.error ? <p data-ops-partial="">{T("Task counts unavailable:")}{' '}{why(tasks.error)}</p> : null}
          <div aria-label={T('Fleet view')} data-ops-fleet-views="" role="group">
            {(['list', 'table'] as const).map(v => (
              <button aria-pressed={fleetView === v} data-ops-fleet-view={v} key={v} onClick={() => setFleetView(v)} type="button">
                {v === 'list' ? T('List') : T('Table')}
              </button>
            ))}
          </div>
          {fleetView === 'list' ? (
            <FleetRows now={now} onOpen={onOpenRoute ? open : undefined} rows={searchRows(rows, q, r => [r.name, r.model, r.lane, r.role])} />
          ) : (
          <DataTable caption={`Fleet (${rows.length})`}
            columns={[
              {
                id: 'name',
                header: 'Agent',
                sortable: true,
                sortValue: r => r.name,
                cardTitle: r => (
                  <button data-ops-fleet-open={r.name} data-ops-roster-agent="" disabled={!onOpenRoute} onClick={() => open(r.name)} type="button">
                    <span data-ops-roster-avatar={r.status}>
                      <Sigil name={r.name} size={36} />
                    </span>
                    <span data-ops-roster-name="">
                      <span>{r.name}</span>
                      {r.role ? <small data-ops-role="">{r.role}</small> : null}
                    </span>
                  </button>
                ),
                cell: r => (
                  <button data-ops-fleet-open={r.name} disabled={!onOpenRoute} onClick={() => open(r.name)} type="button">
                    <Sigil name={r.name} size={16} />
                    <span>{r.name}</span>
                    {r.role ? <small data-ops-role="">{r.role}</small> : null}
                  </button>
                )
              },
              // P6: attention leads the card, right after the name.
              { id: 'status', header: 'Status', sortable: true, sortValue: r => r.status, cell: r => <span data-ops-fleet-status={r.status}>{T(r.status)}</span> },
              { id: 'model', header: 'Model', sortable: true, sortValue: r => r.model, cell: r => r.model ?? T('unknown') },
              { id: 'lane', header: 'Lane', sortable: true, sortValue: r => r.lane, cell: r => r.lane ?? '—' },
              { id: 'active', header: 'Active tasks', sortable: true, tabular: true, sortValue: r => r.active, cell: r => <span data-ops-zero={r.active ? undefined : ''}>{String(r.active)}</span> },
              {
                id: 'runs7d',
                header: 'Runs 7d',
                sortable: true,
                tabular: true,
                sortValue: r => r.runs7d,
                cell: r => (
                  <span data-ops-runs-source={r.runsSource} title={r.runsSource === 'runs' ? T('Worker runs started in the last 7 days') : T('Task starts (this Hermes has no run stats)')}>
                    <span data-ops-zero={r.runs7d ? undefined : ''}>{r.runs7d}</span>
                    {r.failed7d ? <small data-ops-runs-failed=""> · {r.failed7d} {T("failed")}</small> : null}
                  </span>
                )
              },
              { id: 'lastActive', header: 'Last active', sortable: true, sortValue: r => r.lastActive ?? 0, cell: r => (r.lastActive ? fmtAge(now - r.lastActive) : T('unknown')) }
            ]}
            emptyLabel={q ? T('No agent matches.') : T('No profiles.')}
            getRowId={r => r.name}
            onSortChange={setSort}
            rows={searchRows(rows, q, r => [r.name, r.model, r.lane, r.role])}
            sort={sort}
            viewToggleId="fleet"
          />
          )}
        </>
      ) : tab === 'teams' ? (
        <TeamsView onOpenRoute={onOpenRoute} tasks={tasks.value ?? null} tasksError={tasks.error} />
      ) : (
        <ul data-ops-roles="">
          {rows.map(r => (
            <li data-ops-role-row={r.name} key={r.name}>
              <strong>{r.name}</strong> — {r.role ?? T('No role (the profile has no description).')}
            </li>
          ))}
          <li data-ops-roles-note="">{T("Roles are read-only here; edit a profile's description in Profiles.")}</li>
        </ul>
      )}
    </section>
  )
}

const statusWord = (s: string) => ({ blocked: 'Blocked', running: 'Running', ready: 'Ready', todo: 'To do', triage: 'Triage', review: 'Review', scheduled: 'Scheduled' } as Record<string, string>)[s] ?? s

function TeamsView({ tasks, tasksError, onOpenRoute }: { tasks: BoardTask[] | null; tasksError: unknown; onOpenRoute?: (r: string) => void }) {
  if (!tasks) {
    return <State error={tasksError} what="Teams" />
  }

  const list = teams(tasks)

  if (list.length === 0) {
    return <p data-ops-empty="teams">{T("No tasks yet, so no lanes.")}</p>
  }

  // P7: one summary line instead of an avatar mosaic; each lane leads with what it is working on.
  const people = [...new Set(list.flatMap(x => x.members))]
  const openTotal = list.reduce((n, x) => n + x.open, 0)

  const label = (lane: string) => (lane === 'No lane' ? T('Unassigned') : lane)

  // P14 (judge consult): one EntityRow per lane: name → current work with its state → open/blocked and members → projects and the rest in a disclosure.
  const row = (t: (typeof list)[number]) => {
    const [head] = t.focus
    const rest = t.work.filter(w => w.id !== head?.id)

    return (
      <EntityRow
        attrs={{ 'data-ops-team': t.lane, 'data-ops-team-busy': t.open > 0 ? '' : undefined, 'data-ops-team-unassigned': t.lane === 'No lane' ? '' : undefined }}
        context={
          head ? (
            <span data-ops-team-current="">
              <span data-ops-team-now="">{T('Working on')}:</span>{' '}
              {head.blocked ? <span data-ops-team-blocked-tag="">{T('Blocked')}</span> : null}
              <span data-ops-team-task={head.id} data-ops-team-task-blocked={head.blocked ? '' : undefined}>{head.title}</span>
            </span>
          ) : (
            <span data-ops-team-idle="">{T('No open work')}</span>
          )
        }
        key={t.lane}
        meta={
          <>
            <span data-ops-team-open-n="">{P(t.open, '{n} open')}</span>
            {t.blocked ? <span data-ops-team-blocked="">{P(t.blocked, '{n} blocked')}</span> : null}
            <span>{P(t.members.length, '{n} members')}</span>
          </>
        }
        more={
          <Disclosure label={T('Work and members')}>
            <div data-ops-team-detail="">
              {rest.length ? (
                <ul aria-label={T('Working on')} data-ops-team-rest="">
                  {rest.map(f => (
                    <li data-ops-team-task={f.id} data-ops-team-task-blocked={f.status === 'blocked' ? '' : undefined} key={f.id}>
                      <span data-ops-team-task-status={f.status}>{T(statusWord(f.status))}</span> {f.title}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p aria-label={T('Members:')} data-ops-team-members="">
                {t.members.length ? t.members.map(m => <span data-ops-team-member={m} key={m}><Sigil name={m} size={20} /> {m}</span>) : <span data-ops-team-none="">{T('No members')}</span>}
              </p>
              {t.projects.length ? (
                <p data-ops-team-projects="">
                  {t.projects.map(pr => (
                    <button data-ops-team-project={pr} disabled={!onOpenRoute} key={pr} onClick={() => onOpenRoute?.(`/kanban?project=${encodeURIComponent(pr)}`)} type="button">
                      {pr}
                    </button>
                  ))}
                </p>
              ) : null}
            </div>
          </Disclosure>
        }
        title={label(t.lane)}
        tone={t.blocked ? 'warn' : undefined}
      />
    )
  }

  const lanes = list.filter(t => t.lane !== 'No lane')
  const blockedLanes = lanes.filter(t => t.open > 0 && t.blocked > 0)
  const openLanes = lanes.filter(t => t.open > 0 && !t.blocked)
  const idle = list.filter(t => t.open === 0)
  const unassigned = list.find(t => t.lane === 'No lane' && t.open > 0)

  const group = (id: string, title: string, xs: typeof list) =>
    xs.length ? (
      <div data-ops-rows-group={id} key={id}>
        <h4>
          {title} <span data-ops-rows-count="">{xs.length}</span>
        </h4>
        <EntityList label={title}>{xs.map(row)}</EntityList>
      </div>
    ) : null

  return (
    <div data-ops-teams="">
      <p data-ops-teams-summary="">
        {P(list.length, '{n} lanes')} {'\u00b7'} {P(openTotal, '{n} open tasks')} {'\u00b7'} {P(people.length, '{n} members')}
      </p>
      {group('blocked', T('With blocked work'), blockedLanes)}
      {group('open', T('With open work'), openLanes)}
      {unassigned ? group('unassigned', T('Work not assigned to a lane'), [unassigned]) : null}
      {idle.length ? (
        <details data-ops-rows-group="idle" data-ops-teams-idle="">
          <summary>
            {T('No open work')} <span data-ops-rows-count="">{idle.length}</span>
          </summary>
          <EntityList label={T('No open work')}>{idle.map(row)}</EntityList>
        </details>
      ) : null}
    </div>
  )
}

/** P14 (judge consult): one list, each agent once. Attention first, then running, then no run observed.
 * name → work/problem → status and last activity → open profile; infrastructure in Details. */
function FleetRows({ rows, now, onOpen }: { rows: ReturnType<typeof fleetRows>; now: number; onOpen?: (name: string) => void }) {
  const hot = (r: (typeof rows)[number]) => r.status === 'failing' || r.status === 'unknown' || (r.failed7d ?? 0) > 0

  const attention = rows
    .filter(hot)
    .sort((a, b) => Number(b.status === 'failing') - Number(a.status === 'failing') || Number(a.status === 'unknown') - Number(b.status === 'unknown') || (b.failed7d ?? 0) - (a.failed7d ?? 0))

  const running = rows.filter(r => !hot(r) && r.status === 'running')
  // P15 (judge): inactive now is not the same as never observed.
  const idleNow = rows.filter(r => !hot(r) && r.status !== 'running' && (r.lastActive || (r.runs7d ?? 0) > 0))
  const quiet = rows.filter(r => !hot(r) && r.status !== 'running' && !(r.lastActive || (r.runs7d ?? 0) > 0))

  const context = (r: (typeof rows)[number]) =>
    r.failingTask
      ? `${T('Failing task')}: ${r.failingTask.title} \u00b7 ${P(r.failingTask.failures, '{n} failures in a row')}`
      : r.status === 'unknown'
        ? T('No task or worker data for this agent.')
        : (r.failed7d ?? 0) > 0
          ? `${P(r.failed7d ?? 0, '{n} failed runs')} ${T('in the last 7 days')}`
          : r.active
            ? P(r.active, '{n} active')
            : null

  const row = (r: (typeof rows)[number]) => (
    <EntityRow
      attrs={{ 'data-ops-fleet-row': r.name, 'data-ops-fleet-attention-row': hot(r) ? r.name : undefined }}
      context={context(r)}
      key={r.name}
      lead={<Sigil name={r.name} size={32} />}
      meta={
        <>
          <span data-ops-fleet-status={r.status}>{T(r.status)}</span>
          <span>{r.lastActive ? fmtAge(now - r.lastActive) : T('unknown')}</span>
        </>
      }
      more={
        <Disclosure label={T('Details')}>
          <dl data-ops-fleet-details="">
            <dt>{T('Model')}</dt>
            <dd>{r.model ?? T('unknown')}</dd>
            <dt>{T('Lane')}</dt>
            <dd>{r.lane ?? '\u2014'}</dd>
            <dt>{T('Active tasks')}</dt>
            <dd>{String(r.active)}</dd>
            <dt>{T('Runs 7d')}</dt>
            <dd data-ops-runs-source={r.runsSource}>
              {r.runs7d}
              {r.failed7d ? ` \u00b7 ${r.failed7d} ${T('failed')}` : ''}
            </dd>
          </dl>
        </Disclosure>
      }
      primary={
        <button data-ops-fleet-profile={r.name} data-ops-primary="" disabled={!onOpen} onClick={() => onOpen?.(r.name)} type="button">
          {T('Open profile')}</button>
      }
      title={
        <button data-ops-fleet-open={r.name} data-ops-row-link="" disabled={!onOpen} onClick={() => onOpen?.(r.name)} type="button">
          <span>{r.name}</span>
          {r.role ? <small data-ops-role="">{r.role}</small> : null}
        </button>
      }
      tone={r.status === 'failing' ? 'bad' : r.status === 'unknown' ? 'warn' : undefined}
    />
  )

  const group = (id: string, title: string, xs: typeof rows) =>
    xs.length ? (
      <div data-ops-rows-group={id} key={id}>
        <h4>
          {title} <span data-ops-rows-count="">{xs.length}</span>
        </h4>
        <EntityList label={title}>{xs.map(row)}</EntityList>
      </div>
    ) : null

  return (
    <div data-ops-fleet-rows="">
      {attention.length === 0 ? <p data-ops-fleet-attention="clear">{T('Nothing needs attention.')}</p> : null}
      {group('attention', T('Needs attention'), attention)}
      {group('running', T('Running'), running)}
      {group('idle', T('No active run'), idleNow)}
      {group('quiet', T('No run observed'), quiet)}
    </div>
  )
}

function AgentLinks({ agents, onOpen }: { agents: string[]; onOpen?: (p: string) => void }) {
  const [more, setMore] = useState(false)
  const head = agents.slice(0, 3)
  const rest = agents.slice(3)

  return (
    <span data-ops-skill-agents="">
      {head.map(a => (
        <button data-ops-skill-agent={a} disabled={!onOpen} key={a} onClick={() => onOpen?.(a)} type="button">
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

/** P15 (judge consult): Skills as one list: enabled, then disabled. Name → what it does → category and state → Open skill; usage and profiles under a disclosure. */
function SkillRows({ rows, onOpenSkill, onOpenAgent, scanCapped }: { rows: ReturnType<typeof skillRows>; onOpenSkill?: (n: string) => void; onOpenAgent?: (p: string) => void; scanCapped: boolean }) {
  const row = (r: (typeof rows)[number]) => (
    <EntityRow
      attrs={{ 'data-ops-skill': r.name, 'data-ops-skill-enabled': r.enabled ? '' : undefined }}
      context={r.description ? <span data-ops-skill-desc="">{r.description}</span> : <span data-ops-skill-nodesc="">{T('No description')}</span>}
      key={r.name}
      lead={<span aria-hidden data-ops-skill-glyph="">{'\u2726'}</span>}
      meta={
        <>
          <span data-ops-skill-tag={tagTone(r.category || 'general')}>{r.category || 'general'}</span>
          <span>{r.enabled ? T('Enabled') : T('Disabled')}</span>
        </>
      }
      more={
        <Disclosure label={T('Details and profiles')}>
          <div data-ops-skill-detail="">
            {(r as { provenance?: string }).provenance ? <p data-ops-skill-provenance="">{T('Source')}: {(r as { provenance?: string }).provenance}</p> : null}
            <p>{typeof r.usage === 'number' ? P(r.usage, 'Used {n} times') : T('Usage not available')}</p>
            <p>{T('Profiles with this skill enabled')}</p>
            {r.agents.length ? (
              <p data-ops-skill-agents="">
                {r.agents.map(a => (
                  <button data-ops-skill-agent={a} disabled={!onOpenAgent} key={a} onClick={() => onOpenAgent?.(a)} type="button">
                    {a}
                  </button>
                ))}
              </p>
            ) : (
              <p>{T('None observed')}</p>
            )}
            {scanCapped ? <p>{T('Among the first {n} profiles checked').replace('{n}', String(SKILL_PROFILE_SCAN_MAX))}</p> : null}
          </div>
        </Disclosure>
      }
      primary={
        <button data-ops-skill-open={r.name} disabled={!onOpenSkill} onClick={() => onOpenSkill?.(r.name)} type="button">
          {T('Open skill')}
        </button>
      }
      title={r.name}
    />
  )

  // P16b: stable alphabetical order inside each group.
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name))
  const on = sorted.filter(r => r.enabled)
  const off = sorted.filter(r => !r.enabled)

  const group = (id: string, title: string, xs: typeof rows) =>
    xs.length ? (
      <div data-ops-rows-group={id} key={id}>
        <h4>
          {title}
        </h4>
        <EntityList label={title}>{xs.map(row)}</EntityList>
      </div>
    ) : null

  return (
    <>
      {group('on', T('Enabled in this profile'), on)}
      {group('off', T('Disabled in this profile'), off)}
    </>
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
  const [skillView, setSkillView] = useState<'list' | 'table'>('list')
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
    <section aria-label={T("Skills")} data-ops-lens="skills">
      <header>
        <h2>{T("Skills ·")}{' '}{profile}</h2>
        <button data-ops-skill-create="" disabled={!onOpenRoute} onClick={() => onOpenRoute?.('/capabilities?tab=skills&new=1')} type="button">
          {T("Create skill")}</button>
        <button data-ops-browse-library="" disabled={!onOpenRoute} onClick={() => onOpenRoute?.('/capabilities?tab=skills&hub=1')} type="button">
          {T("Browse library")}</button>
      </header>
      {/* P10: no hero band; one filter/count zone sits with the list (judge pass 10). */}
      {progress ? (
        <p aria-live="polite" data-ops-install-progress={`${progress.done}/${progress.total}`} role="status">
          {T("Installing")}{' '}{progress.done} of {progress.total}…
        </p>
      ) : null}
      {note ? <p role="status">{note}</p> : null}
      <section aria-label={T("Individual skills")} data-ops-skills="">
        <h3>
          {T("Individual skills")}{' '}<span data-ops-skill-count="">{rows ? shown.length : '…'}</span>
        </h3>
        <div aria-label={T("Skill filters")} data-ops-skill-filters="" role="group">
          <Search label={T("search skills")} onChange={setQ} placeholder={T("Search by name, type, etc.")} value={q} />
          <select aria-label={T("skill state")} data-ops-skill-state={onFilter} onChange={e => setOnFilter(e.target.value as 'all' | 'on' | 'off')} value={onFilter}>
            <option value="all">{T("All states")}</option>
            <option value="on">{T("On")}</option>
            <option value="off">{T("Off")}</option>
          </select>
          <select aria-label={T("skill type")} data-ops-skill-type={type} onChange={e => setType(e.target.value)} value={type}>
            <option value="">{T("All types")}</option>
            {types.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {filtered ? (
            <button data-ops-skill-clear="" onClick={() => (setQ(''), setType(''), setOnFilter('all'))} type="button">
              {T("Clear filters")}</button>
          ) : null}
        </div>
        {rows ? (
          <p data-ops-skill-shown="">
            {T('Showing')}{' '}{shown.length} {T('of')} {rows.length}
            {scanCapped && skillView === 'table' ? ` · ${T('Agents column covers the first {n} profiles').replace('{n}', String(SKILL_PROFILE_SCAN_MAX))}` : ''}
          </p>
        ) : null}
        {rows ? (
          <div aria-label={T('Skills view')} data-ops-fleet-views="" data-ops-skill-views="" role="group">
            {(['list', 'table'] as const).map(v => (
              <button aria-pressed={skillView === v} data-ops-skill-view={v} key={v} onClick={() => setSkillView(v)} type="button">
                {v === 'list' ? T('List') : T('Table')}
              </button>
            ))}
          </div>
        ) : null}
        {!rows ? (
          <State error={skills.error} what="Skills" />
        ) : skillView === 'list' ? (
          shown.length === 0 ? (
            <p data-ops-empty="skills">{T(filtered ? 'No skill matches these filters.' : 'This profile has no skills yet. Use Create skill or Browse library.')}</p>
          ) : (
            <SkillRows onOpenAgent={onOpenRoute ? openAgent : undefined} onOpenSkill={onOpenRoute ? openSkill : undefined} rows={shown} scanCapped={scanCapped} />
          )
        ) : (
          <DataTable caption="Skills"
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
              { id: 'description', header: 'Description', description: r => r.description },
              { id: 'type', header: 'Type', sortable: true, sortValue: r => r.category, cell: r => <span data-ops-skill-tag={tagTone(r.category || 'general')}>{r.category || 'general'}</span> },
              { id: 'agents', header: 'Agents', sortable: true, tabular: true, sortValue: r => r.agents.length, cell: r => <AgentLinks agents={r.agents} onOpen={onOpenRoute ? openAgent : undefined} /> },
              { id: 'usage', header: 'Uses', sortable: true, tabular: true, sortValue: r => r.usage ?? -1, cell: r => (typeof r.usage === 'number' ? String(r.usage) : '—') },
              { id: 'enabled', header: 'On', sortable: true, sortValue: r => (r.enabled ? 1 : 0), cell: r => (r.enabled ? T('on') : T('off')) }
            ]}
            emptyLabel={filtered ? 'No skill matches these filters.' : 'This profile has no skills yet. Use Create skill or Browse library.'}
            getRowId={r => r.name}
            onSortChange={setSort}
            rows={shown}
            sort={sort}
            viewToggleId="skills"
          />
        )}
      </section>
      <details data-ops-packs-fold="" open={!!rows && rows.length === 0}>
      <summary>{T("Add by category")}</summary>
      <section aria-label={T("Starter packs")} data-ops-packs="">
        {!packs ? (
          <State error={official.error} what="Starter packs" />
        ) : packs.length === 0 ? (
          <p data-ops-empty="packs">{T("The hub offers no category with two or more skills.")}</p>
        ) : (
          <ul>
            {packs.map(p => (
              <li data-ops-pack={p.id} data-ops-pack-complete={p.missing.length === 0 ? '' : undefined} key={p.id}>
                <strong>{p.title}</strong> <span data-ops-pack-meta="">{P(p.skills.length, '{n} skills', '{n} skill')}{p.missing.length < p.skills.length ? ` · ${P(p.skills.length - p.missing.length, '{n} installed')}` : ''}</span>
                <span aria-label={T('{n} of {total} installed').replace('{n}', String(p.skills.length - p.missing.length)).replace('{total}', String(p.skills.length))} data-ops-pack-bar="" role="img" style={{ ['--ops-pct' as string]: `${Math.round(((p.skills.length - p.missing.length) / Math.max(1, p.skills.length)) * 100)}%` }} />
                <button data-ops-add-all={p.id} data-ops-write="" disabled={busy || p.missing.length === 0} onClick={() => setConfirm(p)} type="button">
                  {p.missing.length === 0 ? T('All added') : T('Add all')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      </details>
      <ConfirmDialog
        confirmLabel={busy ? T('Installing…') : T('Install {n}').replace('{n}', String(confirm?.missing.length ?? 0))}
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
        title={confirm ? T('Add all of {title}?').replace('{title}', confirm.title) : ''}
      />
    </section>
  )
}

/* ------------------------------ Channels lens ------------------------------- */

type Filter = 'all' | 'connected'

/** P15 (judge consult): what "connected" means depends on the source; say that, not a health claim. */
const appState = (card: AppCard) => (card.kind === 'model' ? T('Signed in') : T('Configured'))

/** P15: one EntityRow per app: glyph → name → warning (or what it does) → category and state → Manage / Connect. */
function AppRow({ card, onOpenRoute }: { card: AppCard; onOpenRoute?: (r: string) => void }) {
  return (
    <EntityRow
      attrs={{ 'data-ops-app': card.key, 'data-ops-app-connected': card.connected ? '' : undefined }}
      context={
        card.warning ? (
          <span data-ops-app-warning="">{card.warning}</span>
        ) : card.description ? (
          <span data-ops-app-desc="">{card.description}</span>
        ) : undefined
      }
      lead={
        <span aria-hidden data-ops-app-glyph="">
          {appGlyph(card.name)}
        </span>
      }
      meta={
        <>
          <span>{T(card.category)}</span>
          {card.connected ? <span data-ops-app-state={card.kind}>{appState(card)}</span> : null}
        </>
      }
      more={
        card.warning && card.description ? (
          <Disclosure label={T('Details')}>
            <span data-ops-app-desc="">{card.description}</span>
          </Disclosure>
        ) : undefined
      }
      primary={
        <button data-ops-app-action={card.connected ? 'manage' : 'connect'} disabled={!onOpenRoute} onClick={() => onOpenRoute?.(appRoute(card))} type="button">
          {card.connected ? T('Manage') : T('Connect')}
        </button>
      }
      title={card.name}
      tone={card.warning ? 'warn' : undefined}
    />
  )
}

/** G62: quick-connect popover; search + kind filter over every catalog, grouped by category. */
export function QuickConnect({ cards, onOpenRoute, onClose }: { cards: AppCard[]; onOpenRoute?: (r: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | AppCard['kind']>('all')
  const hits = searchRows(cards, q, c => [c.name, c.description, c.category]).filter(c => kind === 'all' || c.kind === kind)

  return (
    <div aria-label={T("Connect an app")} data-ops-quick-connect="" onKeyDown={e => e.key === 'Escape' && onClose()} role="dialog">
      <Search label={T("search apps")} onChange={setQ} placeholder={T("Search apps")} value={q} />
      <select aria-label={T("app kind")} onChange={e => setKind(e.target.value as typeof kind)} value={kind}>
        <option value="all">{T("All kinds")}</option>
        {(Object.keys(APP_CATEGORIES) as AppCard['kind'][]).map(k => (
          <option key={k} value={k}>
            {T(APP_CATEGORIES[k])}
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
      {hits.length === 0 ? <p>{T("No app matches.")}</p> : null}
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

  const missing = (['catalog', 'servers', 'platforms', 'providers'] as const).filter(k => r.value![k] === null)
  const base = filter === 'connected' ? cards.filter(x => x.connected) : cards
  const shown = searchRows(base, q, x => [x.name, x.description]).filter(x => !cat || x.category === cat)
  const connectedFirst = filter === 'all' && !cat && !q && shown.some(x => x.connected)
  const cats = Object.values(APP_CATEGORIES)

  return (
    <section aria-label={T("Channels & MCP")} data-ops-lens="channels">
      <header>
        <h2>{T("Channels & MCP")}</h2>
        <div role="tablist">
          {(['all', 'connected'] as const).map(f => (
            <button aria-selected={filter === f} data-ops-app-filter={f} key={f} onClick={() => setFilter(f)} role="tab" type="button">
              {f === 'all' ? `${T('All')} ${cards.length}` : `${T('Connected')} ${cards.filter(x => x.connected).length}`}
            </button>
          ))}
        </div>
        <Search label={T("search integrations")} onChange={setQ} placeholder={T("Search")} value={q} />
        <button aria-expanded={quick} aria-label={T("quick connect")} data-ops-quick-open="" onClick={() => setQuick(v => !v)} type="button">
          +
        </button>
      </header>
      {missing.length ? <p data-ops-partial="">{T("Not answering:")}{' '}{missing.join(', ')}.</p> : null}
      {quick ? <QuickConnect cards={cards} onClose={() => setQuick(false)} onOpenRoute={onOpenRoute} /> : null}
      <div data-ops-channels-body="">
        <nav aria-label={T("Categories")} data-ops-app-rail="">
          <button aria-pressed={cat === null} data-ops-app-cat="all" onClick={() => setCat(null)} type="button">
            {T("All")}</button>
          {cats.map(x => (
            <button aria-pressed={cat === x} data-ops-app-cat={x} key={x} onClick={() => setCat(x)} type="button">
              {x} <span>{base.filter(c => c.category === x).length}</span>
            </button>
          ))}
          {/* G15: the rail's footer is the library entry. */}
          <button data-ops-connect-more="" onClick={() => setQuick(true)} type="button">
            {T("Connect more apps")}</button>
        </nav>
        <div>
          {connectedFirst ? (
            <>
              {/* P15: configured apps with a warning lead; the warning reads with the row closed. */}
              {shown.some(x => x.connected && x.warning) ? (
                <section aria-label={T('Configured with warnings')} data-ops-app-section="warn">
                  <h3>
                    {T('Configured with warnings')} <span data-ops-rows-count="">{shown.filter(x => x.connected && x.warning).length}</span>
                  </h3>
                  <EntityList label={T('Configured with warnings')}>
                    {shown.filter(x => x.connected && x.warning).map(card => (
                      <AppRow card={card} key={`w-${card.key}`} onOpenRoute={onOpenRoute} />
                    ))}
                  </EntityList>
                </section>
              ) : null}
              {shown.some(x => x.connected && !x.warning) ? (
                <section aria-label={T('Other configured')} data-ops-app-section="connected">
                  <h3>
                    {T('Other configured')} <span data-ops-rows-count="">{shown.filter(x => x.connected && !x.warning).length}</span>
                  </h3>
                  <EntityList label={T('Other configured')}>
                    {shown.filter(x => x.connected && !x.warning).map(card => (
                      <AppRow card={card} key={`c-${card.key}`} onOpenRoute={onOpenRoute} />
                    ))}
                  </EntityList>
                </section>
              ) : null}
            </>
          ) : null}
          <div data-ops-app-catalog={connectedFirst ? '' : undefined}>
            {connectedFirst && shown.some(x => !x.connected) ? <h3 data-ops-app-catalog-title="">{T('Add connections')}</h3> : null}
            {cats
              .filter(x => !cat || x === cat)
              .map(x => {
                // B37: when configured apps lead in their own sections, the catalog lists only the rest.
                const xs = shown.filter(c => c.category === x && !(connectedFirst && c.connected))

                return xs.length ? (
                  <section aria-label={x} data-ops-app-section={x} key={x}>
                    <h4>{T(x)}</h4>
                    <EntityList label={x}>
                      {xs.map(card => (
                        <AppRow card={card} key={card.key} onOpenRoute={onOpenRoute} />
                      ))}
                    </EntityList>
                  </section>
                ) : null
              })}
          </div>
          {shown.length === 0 ? (
        <p data-ops-empty="apps">
          {filter === 'connected' ? T('Nothing connected yet.') : T('No app matches.')}{' '}
          <button data-ops-empty-reset="" onClick={() => (setFilter('all'), setQ(''))} type="button">
            {T('Show all apps')}
          </button>
        </p>
      ) : null}
        </div>
      </div>
    </section>
  )
}
