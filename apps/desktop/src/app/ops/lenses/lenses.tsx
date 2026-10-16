/**
 * Live lenses (ops-panel P7 F3): Runs (O82/R50), Projects (O12/R4/R62), Templates (O16/R34/G4/G61)
 * and Activity (R26/O20/R36). Read-only views over existing routes; writes stay in their owners
 * (cron blueprint instantiate lives in Desktop's /cron, Stop lives on the task tab).
 * Unknown stays "unknown"; a refused read shows the server reason.
 */

import { useMemo, useState } from 'react'

import { describeEvent } from '../detail/task-tab'
import { useKanbanStream } from '../feed/kanban-stream'
import { type ActiveWorker, createOpsActions, type OpsActions } from '../feed/ops-actions'
import type { KanbanTask } from '../feed/ops-client'
import { T } from '../main-i18n'
import { listOrNull, useOpsResource } from '../office/office-container'
import { activityRow } from '../office/office-toasts'

import { createB4Client } from './b4-lenses'
import { type AppCard, appCards, appGlyph, appsInTags } from './b4-model'

const why = (e: unknown) => (e instanceof Error ? e.message : e ? String(e) : null)
/** P8: local time for the operator (was UTC ISO). */
const iso = (s?: number | null) => (typeof s === 'number' && s > 0 ? new Date(s * 1000).toLocaleString() : T('unknown'))

function Unavailable({ what, error }: { what: string; error: unknown }) {
  return <p data-ops-unavailable="">{error ? `${what} unavailable: ${why(error)}` : `${what} loading (unknown).`}</p>
}

/* ---------------------------------- Runs ---------------------------------- */

export function RunsLensView({
  workers,
  error,
  nowS,
  onOpenTask,
  onOpenRun
}: {
  workers: ActiveWorker[] | null
  error?: unknown
  nowS: number
  onOpenTask?: (id: string) => void
  onOpenRun?: (id: string) => void
}) {
  if (!workers) {
    return <Unavailable error={error} what="Runs" />
  }

  return (
    <section aria-label={T("Runs")} data-ops-lens="runs">
      <h2>{T("Runs (")}{workers.length} {T("live)")}</h2>
      {workers.length === 0 ? (
        <p>{T("No worker is running.")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{T("Run")}</th>
              <th scope="col">{T("Task")}</th>
              <th scope="col">{T("Profile")}</th>
              <th scope="col">{T("Elapsed")}</th>
              <th scope="col">{T("Heartbeat")}</th>
            </tr>
          </thead>
          <tbody>
            {workers.map(w => (
              <tr data-ops-run-row={w.run_id} key={w.run_id}>
                <td>
                  <button disabled={!onOpenRun} onClick={() => onOpenRun?.(String(w.run_id))} type="button">
                    #{w.run_id}
                  </button>
                </td>
                <td>
                  <button disabled={!onOpenTask} onClick={() => onOpenTask?.(w.task_id)} type="button">
                    {w.task_title || w.task_id}
                  </button>
                </td>
                <td>{w.profile ?? T('unknown')}</td>
                <td>{typeof w.started_at === 'number' ? `${Math.max(0, Math.round(nowS - w.started_at))} s` : T('unknown')}</td>
                <td data-ops-stale={typeof w.last_heartbeat_at === 'number' && nowS - w.last_heartbeat_at > 120 ? '' : undefined}>
                  {typeof w.last_heartbeat_at === 'number' ? `${Math.max(0, Math.round(nowS - w.last_heartbeat_at))} s ${T('ago')}` : T('unknown')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

/* -------------------------------- Projects -------------------------------- */

export interface ProjectRow {
  id: string
  slug: string
  name: string
  primary_path?: string
}

export function projectOverview(tasks: KanbanTask[], projectId: string | null) {
  const mine = projectId === null ? tasks : tasks.filter(t => (t as KanbanTask & { project_id?: string | null }).project_id === projectId)
  const byStatus: Record<string, number> = {}
  const byProfile: Record<string, number> = {}

  for (const t of mine) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1
    byProfile[t.assignee || 'unassigned'] = (byProfile[t.assignee || 'unassigned'] ?? 0) + 1
  }

  return { total: mine.length, byStatus, byProfile, done: byStatus.done ?? 0 }
}

const FAV = 'hermes.ops.projectFavs'

function loadFavs(): string[] {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(FAV) ?? '[]')

    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

export function ProjectsLensView({
  projects,
  tasks,
  error,
  onOpenBoard
}: {
  projects: ProjectRow[] | null
  tasks: KanbanTask[] | null
  error?: unknown
  onOpenBoard?: (projectId: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [favs, setFavs] = useState<string[]>(loadFavs)

  if (!projects) {
    return <Unavailable error={error} what="Projects" />
  }

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id]

    try {
      globalThis.localStorage?.setItem(FAV, JSON.stringify(next))
    } catch {
      // P8: storage full or blocked; the favourite still applies for this session.
    }

    setFavs(next)
  }

  const sorted = [...projects].sort((a, b) => Number(favs.includes(b.id)) - Number(favs.includes(a.id)) || a.name.localeCompare(b.name))
  const ov = open && tasks ? projectOverview(tasks, open) : null

  return (
    <section aria-label={T("Projects")} data-ops-lens="projects">
      <h2>{T("Projects (")}{projects.length})</h2>
      {projects.length === 0 ? <p data-ops-empty="projects">{T("No projects yet. Create one from the Board.")}</p> : null}
      <ul>
        {sorted.map(p => (
          <li data-ops-fav={favs.includes(p.id) ? '' : undefined} data-ops-project={p.id} key={p.id}>
            <button aria-label={`favourite ${p.name}`} aria-pressed={favs.includes(p.id)} onClick={() => toggleFav(p.id)} type="button">
              {favs.includes(p.id) ? '★' : '☆'}
            </button>
            <button onClick={() => setOpen(o => (o === p.id ? null : p.id))} type="button">
              {p.name}
            </button>
            {p.primary_path ? <code>{p.primary_path}</code> : null}
          </li>
        ))}
      </ul>
      {open ? (
        <div aria-label={T("Project overview")} data-ops-project-overview={open}>
          {ov ? (
            <>
              <p data-ops-field="total">{ov.total} {T("tasks")}</p>
              <p data-ops-field="throughput">{ov.done} {T("done")}</p>
              <ul>
                {Object.entries(ov.byStatus).map(([k, v]) => (
                  <li data-ops-count={k} key={k}>
                    {k}: {v}
                  </li>
                ))}
              </ul>
              <ul>
                {Object.entries(ov.byProfile).map(([k, v]) => (
                  <li data-ops-profile-count={k} key={k}>
                    {k}: {v}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>{T("Board unknown.")}</p>
          )}
          <button disabled={!onOpenBoard} onClick={() => onOpenBoard?.(open)} type="button">
            {T("Open Board filtered to this project")}</button>
        </div>
      ) : null}
    </section>
  )
}

/* -------------------------------- Templates ------------------------------- */

export interface BlueprintRow {
  key: string
  title: string
  description: string
  category: string
  tags?: string[]
  source?: string
}

export function TemplatesLensView({
  blueprints,
  error,
  onOpenRoute,
  apps
}: {
  blueprints: BlueprintRow[] | null
  error?: unknown
  onOpenRoute?: (r: string) => void
  /** G67 (P8 b4): known apps; a blueprint tag naming one shows its icon. */
  apps?: Pick<AppCard, 'id' | 'name' | 'kind'>[] | null
}) {
  if (!blueprints) {
    return <Unavailable error={error} what="Templates" />
  }

  return (
    <section aria-label={T("Templates")} data-ops-lens="templates">
      <h2>{T("Cron blueprints (")}{blueprints.length})</h2>
      {blueprints.length === 0 ? <p data-ops-empty="templates">{T("No cron blueprints are installed for this profile.")}</p> : null}
      <p data-ops-cut="workflow-templates">{T("Kanban workflow templates: not offered (every board uses the default workflow; per-board templates are not in the backend).")}</p>
      <ul>
        {blueprints.map(b => (
          <li data-ops-blueprint={b.key} key={b.key}>
            <strong>{b.title}</strong> <span data-ops-tag="">{b.category}</span>
            {appsInTags(b.tags, apps ?? []).map(a => (
              <span aria-label={a.name} data-ops-bp-app={a.id} key={a.id} title={a.name}>
                {appGlyph(a.name)}
              </span>
            ))}
            {b.source === 'plugin' ? <span> {T("(plugin)")}</span> : null}
            <p>{b.description}</p>
            <button disabled={!onOpenRoute} onClick={() => onOpenRoute?.(`/cron?blueprint=${encodeURIComponent(b.key)}`)} type="button">
              {T("Use in Schedule")}</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* -------------------------------- Activity -------------------------------- */

export function ActivityLensView({
  events,
  connecting,
  resolved,
  error,
  onOpenTask
}: {
  events: ReturnType<typeof useKanbanStream>['events'] | null
  /** P8: while the stream is connecting, say so instead of "polling only". */
  connecting?: boolean
  resolved: Record<string, unknown>[] | null
  error?: unknown
  onOpenTask?: (id: string) => void
}) {
  const [tab, setTab] = useState<'events' | 'resolved'>('events')

  return (
    <section aria-label={T("Activity")} data-ops-lens="activity">
      <div role="tablist">
        <button aria-selected={tab === 'events'} onClick={() => setTab('events')} role="tab" type="button">
          {T("Task events")}</button>
        <button aria-selected={tab === 'resolved'} onClick={() => setTab('resolved')} role="tab" type="button">
          {T("Resolved")}</button>
      </div>
      {tab === 'events' ? (
        events === null && connecting ? (
          <p data-ops-loading="">{T("Connecting to live task events…")}</p>
        ) : events === null ? (
          <p data-ops-unavailable="">{T("Live task events need the kanban stream (polling only).")}</p>
        ) : events.length === 0 ? (
          <p>{T("No task events since this lens opened.")}</p>
        ) : (
          <ol>
            {events.map(e => {
              const d = describeEvent(e)

              return (
                <li data-ops-task-event={e.id} key={e.id}>
                  <button disabled={!onOpenTask} onClick={() => onOpenTask?.(e.task_id)} type="button">
                    {e.task_id}
                  </button>{' '}
                  {d.verb} {d.target} <time>{iso(e.created_at)}</time>
                </li>
              )
            })}
          </ol>
        )
      ) : resolved === null ? (
        <Unavailable error={error} what="Resolved" />
      ) : resolved.length === 0 ? (
        <p data-ops-empty="resolved">{T("Nothing resolved yet.")}</p>
      ) : (
        <ol aria-label={T("Resolved")} data-ops-resolved="">
          {resolved.slice(0, 50).map((a, i) => {
            const r = activityRow(a)

            return (
              <li data-ops-resolved-row="" key={i}>
                <span data-ops-field="who">{r.who}</span> {r.what} <time>{r.when}</time>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/* ------------------------------- Containers ------------------------------- */

const useActions = (a?: OpsActions) => useMemo(() => a ?? createOpsActions(), [a])

export function RunsLens({ actions: a, onOpenTask, onOpenRun }: { actions?: OpsActions; onOpenTask?: (id: string) => void; onOpenRun?: (id: string) => void }) {
  const actions = useActions(a)
  const r = useOpsResource(() => actions.activeWorkers(), [actions])

  return <RunsLensView error={r.error} nowS={Date.now() / 1000} onOpenRun={onOpenRun} onOpenTask={onOpenTask} workers={listOrNull(r.value?.workers)} />
}

export function ProjectsLens({ actions: a, onOpenBoard }: { actions?: OpsActions; onOpenBoard?: (id: string) => void }) {
  const actions = useActions(a)
  const p = useOpsResource(() => actions.projects(), [actions], 30_000)
  const b = useOpsResource(() => actions.boardTasks(), [actions])

  return <ProjectsLensView error={p.error} onOpenBoard={onOpenBoard} projects={listOrNull(p.value?.projects)} tasks={b.value ?? null} />
}

export function TemplatesLens({ profile, actions: a, onOpenRoute }: { profile: string; actions?: OpsActions; onOpenRoute?: (r: string) => void }) {
  const actions = useActions(a)
  const r = useOpsResource(() => actions.blueprints(profile), [actions, profile], 60_000)
  const apps = useOpsResource(() => (a ? Promise.resolve(null) : createB4Client().channels(profile).then(appCards)), [a, profile], 300_000)

  return <TemplatesLensView apps={apps.value} blueprints={listOrNull(r.value?.blueprints)} error={r.error} onOpenRoute={onOpenRoute} />
}

export function ActivityLens({ actions: a, onOpenTask }: { actions?: OpsActions; onOpenTask?: (id: string) => void }) {
  const actions = useActions(a)
  const stream = useKanbanStream()
  const r = useOpsResource(() => actions.resolved(50), [actions])

  return (
    <ActivityLensView
      connecting={stream.mode === 'connecting'}
      error={r.error}
      events={stream.mode === 'stream' || stream.events.length ? stream.events : null}
      onOpenTask={onOpenTask}
      resolved={listOrNull(r.value?.items)}
    />
  )
}
