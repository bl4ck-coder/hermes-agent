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
import { Sigil } from '../primitives/sigil'
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
          <FleetAttention now={now} onOpen={onOpenRoute ? open : undefined} rows={rows} />
          <DataTable viewToggleId="fleet"
            caption={`Fleet (${rows.length})`}
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
              { id: 'lastActive', header: 'Last active', sortable: true, sortValue: r => r.lastActive ?? 0, cell: r => (r.lastActive ? fmtAge(now - r.lastActive) : T('never')) }
            ]}
            emptyLabel={q ? T('No agent matches.') : T('No profiles.')}
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
              <strong>{r.name}</strong> — {r.role ?? T('No role (the profile has no description).')}
            </li>
          ))}
          <li data-ops-roles-note="">{T("Roles are read-only here; edit a profile's description in Profiles.")}</li>
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
    return <p data-ops-empty="teams">{T("No tasks yet, so no lanes.")}</p>
  }

  // P7: one summary line instead of an avatar mosaic; each lane leads with what it is working on.
  const people = [...new Set(list.flatMap(x => x.members))]
  const openTotal = list.reduce((n, x) => n + x.open, 0)

  return (
    <>
    <p data-ops-teams-summary="">
      {P(list.length, '{n} lanes')} · {P(openTotal, '{n} open tasks')} · {P(people.length, '{n} members')}
    </p>
    <ul data-ops-teams="">
      {list.filter(t => t.open > 0).map(t => (
        <li data-ops-team={t.lane} data-ops-team-busy={t.open > 0 ? '' : undefined} data-ops-team-unassigned={t.lane === 'No lane' ? '' : undefined} key={t.lane}>
          <header data-ops-team-head="">
            <h3>{t.lane === 'No lane' ? T('Unassigned') : t.lane}</h3>
            <span data-ops-team-open="">{P(t.open, '{n} open')}</span>
            {t.blocked ? <span data-ops-team-blocked="">{P(t.blocked, '{n} blocked')}</span> : null}
          </header>
          {t.focus.length ? (
            <ul aria-label={T('Working on')} data-ops-team-purpose="">
              {t.focus.map(f => (
                <li data-ops-team-task={f.id} data-ops-team-task-blocked={f.blocked ? '' : undefined} key={f.id} title={f.title}>
                  {f.blocked ? <span data-ops-team-blocked-tag="">{T('Blocked')}</span> : null}
                  {f.title}
                </li>
              ))}
            </ul>
          ) : (
            <p data-ops-team-purpose="" data-ops-team-idle="">{T('No open work')}</p>
          )}
          <footer data-ops-team-foot="">
            <span aria-label={T('Members:')} data-ops-team-members="" role="list">
              {t.members.length
                ? t.members.map(m => (
                    <span data-ops-team-member={m} key={m} role="listitem" title={m}>
                      <Sigil name={m} size={20} />
                      <span data-ops-sr="">{m}</span>
                    </span>
                  ))
                : <span data-ops-team-none="">{T('No members')}</span>}
            </span>
            {t.projects.length ? (
              <span data-ops-team-projects="">
                {t.projects.map(p => (
                  <button data-ops-team-project={p} disabled={!onOpenRoute} key={p} onClick={() => onOpenRoute?.(`/kanban?project=${encodeURIComponent(p)}`)} type="button">
                    {p}
                  </button>
                ))}
              </span>
            ) : null}
          </footer>
        </li>
      ))}
    </ul>
    {/* P8: lanes with no open work take one line, not a card each. */}
    {list.some(t => t.open === 0) ? (
      <p data-ops-teams-idle="">
        <span>{T('No open work')}:</span>{' '}
        {list
          .filter(t => t.open === 0)
          .map(t => (
            <span data-ops-team={t.lane} data-ops-team-idle-lane="" key={t.lane}>
              {t.lane === 'No lane' ? T('Unassigned') : t.lane}
              <span aria-label={T('Members:')} data-ops-team-members="" role="list">
                {t.members.map(m => (
                  <span data-ops-team-member={m} key={m} role="listitem" title={m}>
                    <span data-ops-sr="">{m}</span>
                  </span>
                ))}
              </span>
            </span>
          ))}
      </p>
    ) : null}
    </>
  )
}

/** P7/P8: agents that need a look lead the Fleet, each with the reason and what to open; the inventory follows. */
function FleetAttention({ rows, now, onOpen }: { rows: ReturnType<typeof fleetRows>; now: number; onOpen?: (name: string) => void }) {
  const [all, setAll] = useState(false)
  const hot = rows
    .filter(r => r.status === 'failing' || r.status === 'unknown' || (r.failed7d ?? 0) > 0)
    .sort((a, b) => Number(b.status === 'failing') - Number(a.status === 'failing') || (b.failed7d ?? 0) - (a.failed7d ?? 0))
  const running = rows.filter(r => r.status === 'running').length

  if (hot.length === 0) {
    return (
      <p data-ops-fleet-attention="clear">
        {T('Nothing needs attention.')} {P(running, '{n} running')} · {P(rows.length, '{n} agents')}
      </p>
    )
  }

  const shown = all ? hot : hot.slice(0, 3)
  const reason = (r: (typeof hot)[number]) =>
    r.failingTask
      ? `${T('Failing task')}: ${r.failingTask.title} · ${P(r.failingTask.failures, '{n} failures in a row')}`
      : r.status === 'unknown'
        ? T('No task or worker data for this agent.')
        : `${P(r.failed7d ?? 0, '{n} failed runs')} ${T('in the last 7 days')}`

  return (
    <section aria-label={T('Needs attention')} data-ops-fleet-attention="">
      <h3>
        {T('Needs attention')} <span>{hot.length}</span>
      </h3>
      <ul>
        {shown.map(r => (
          <li data-ops-fleet-attention-row={r.name} data-ops-fleet-attention-kind={r.failingTask ? 'failing' : r.status === 'unknown' ? 'unknown' : 'failed-runs'} key={r.name}>
            <button disabled={!onOpen} onClick={() => onOpen?.(r.name)} type="button">
              <Sigil name={r.name} size={32} />
              <span data-ops-fleet-attention-name="">{r.name}</span>
              <span data-ops-fleet-status={r.status}>{T(r.status)}</span>
              <span data-ops-fleet-attention-reason="">{reason(r)}</span>
              <small>
                {P(r.active, '{n} active')} · {r.lastActive ? fmtAge(now - r.lastActive) : T('never')}
              </small>
            </button>
          </li>
        ))}
      </ul>
      {hot.length > 3 ? (
        <button data-ops-fleet-attention-more="" onClick={() => setAll(v => !v)} type="button">
          {all ? T('Show fewer') : `${T('Show all')} (${hot.length})`}
        </button>
      ) : null}
    </section>
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
    <section aria-label={T("Skills")} data-ops-lens="skills">
      <header>
        <h2>{T("Skills ·")}{' '}{profile}</h2>
        <button data-ops-skill-create="" disabled={!onOpenRoute} onClick={() => onOpenRoute?.('/capabilities?tab=skills&new=1')} type="button">
          {T("Create skill")}</button>
        <button data-ops-browse-library="" disabled={!onOpenRoute} onClick={() => onOpenRoute?.('/capabilities?tab=skills&hub=1')} type="button">
          {T("Browse library")}</button>
      </header>
      {rows ? (
        /* B35b: Skills hero: how much is on, and where it clusters. */
        <div data-ops-skills-hero="">
          <strong data-ops-channels-count="">
            {rows.filter(r => r.enabled).length}
            <small>/{rows.length}</small>
          </strong>
          <div>
            <span data-ops-now-label="">{T('Skills')}</span>
            <p data-ops-channels-hero-list="">
              {types
                .map(t => [t, rows.filter(r => (r.category || 'general') === t).length] as const)
                .sort((x, y) => y[1] - x[1])
                .slice(0, 6)
                .map(([t, n]) => (
                  <button aria-pressed={type === t} data-ops-chip="" key={t} onClick={() => setType(type === t ? '' : t)} type="button">
                    {t} {n}
                  </button>
                ))}
            </p>
          </div>
        </div>
      ) : null}
      {progress ? (
        <p aria-live="polite" data-ops-install-progress={`${progress.done}/${progress.total}`} role="status">
          {T("Installing")}{' '}{progress.done} of {progress.total}…
        </p>
      ) : null}
      {note ? <p role="status">{note}</p> : null}
      <details data-ops-packs-fold="" open={!rows || rows.length === 0}>
      <summary>{T("Starter packs")}</summary>
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
            {scanCapped ? ` · ${T('Agents column covers the first {n} profiles').replace('{n}', String(SKILL_PROFILE_SCAN_MAX))}` : ''}
          </p>
        ) : null}
        {!rows ? (
          <State error={skills.error} what="Skills" />
        ) : (
          <DataTable viewToggleId="skills"
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
              { id: 'source', header: 'Source', sortable: true, sortValue: r => r.provenance ?? '', cell: r => r.provenance ?? T('unknown') },
              { id: 'usage', header: 'Uses', sortable: true, tabular: true, sortValue: r => r.usage ?? -1, cell: r => (typeof r.usage === 'number' ? String(r.usage) : '—') },
              { id: 'enabled', header: 'On', sortable: true, sortValue: r => (r.enabled ? 1 : 0), cell: r => (r.enabled ? T('on') : T('off')) }
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

function AppTile({ card, onOpenRoute }: { card: AppCard; onOpenRoute?: (r: string) => void }) {
  return (
    <li data-ops-app={card.key} data-ops-app-connected={card.connected ? '' : undefined}>
      <span data-ops-app-head="">
        <span aria-hidden data-ops-app-glyph="">
          {appGlyph(card.name)}
        </span>
        <strong>{card.name}</strong>
        {card.connected ? <span data-ops-app-state="connected">{T("✓ Connected")}</span> : null}
      </span>
      {card.warning ? <small data-ops-app-warning="">{card.warning}</small> : null}
      <p>{card.description}</p>
      <button data-ops-app-action={card.connected ? 'manage' : 'connect'} disabled={!onOpenRoute} onClick={() => onOpenRoute?.(appRoute(card))} type="button">
        {card.connected ? T('Manage') : T('Connect')}
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

  const missing = (['catalog', 'platforms', 'providers'] as const).filter(k => r.value![k] === null)
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
      {/* B35: Channels hero: how much is wired up, and what. */}
      <div data-ops-channels-hero="">
        {/* P6: a plain count, not a ring: the connected list is the content. */}
        <strong data-ops-channels-count="">
          {cards.filter(x => x.connected).length}
          <small>/{cards.length}</small>
        </strong>
        <div>
          <span data-ops-now-label="">{T('Connected apps')}</span>
          <p data-ops-channels-hero-list="">
            {cards.filter(x => x.connected).slice(0, 8).map(x => <span data-ops-chip="" key={x.key}>{x.name}</span>)}
          </p>
        </div>
      </div>
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
            <section aria-label={T('Connected apps')} data-ops-app-section="connected">
              <h3>{T('Connected apps')}</h3>
              <ul data-ops-app-grid="">
                {shown.filter(x => x.connected).map(card => (
                  <AppTile card={card} key={`c-${card.key}`} onOpenRoute={onOpenRoute} />
                ))}
              </ul>
            </section>
          ) : null}
          {cats
            .filter(x => !cat || x === cat)
            .map(x => {
              // B37: when connected apps lead in their own section, the catalog below lists only the rest.
              const xs = shown.filter(c => c.category === x && !(connectedFirst && c.connected))

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
