/**
 * Ops detail tabs (ops-panel P3-04): W3 agent card, W6 task tab, W7 run tab, W8 Needs-you list.
 * Read-only views over the P3-01 client. Missing or malformed data renders as "unknown"; a row that
 * cannot be found says so instead of inventing one. Lenses (W12) keep embedding existing Desktop routes.
 */

import { useMemo } from 'react'

import { createOpsActions, type OpsActions, type ProfileRow, roleFromDescription, type TaskRun } from '../feed/ops-actions'
import {
  type ApprovalItem,
  createOpsClient,
  type CronJobLite,
  type FleetProfile,
  type FleetRun,
  type KanbanBoard,
  type KanbanTask,
  type ModelNode,
  type OpsClient,
  type PolicyView
} from '../feed/ops-client'
import { useOpsFeed } from '../feed/ops-feed'
import { P, T } from '../main-i18n'
import { listOrNull, useOpsResource } from '../office/office-container'
import { Sigil } from '../primitives/sigil'

/** O78: earliest upcoming next_run_at among enabled jobs of this profile; null when none, undefined when unknown. */
export function nextCronRun(jobs: CronJobLite[] | null | undefined, name: string): { job: CronJobLite; at: number } | null | undefined {
  if (!Array.isArray(jobs)) {
    return undefined
  }

  let best: { job: CronJobLite; at: number } | null = null

  for (const j of jobs) {
    if (j.enabled === false || (j.profile && j.profile !== name)) {
      continue
    }

    const raw = j.next_run_at
    const at = typeof raw === 'number' ? raw * 1000 : typeof raw === 'string' ? Date.parse(raw) : NaN

    if (Number.isFinite(at) && (!best || at < best.at)) {
      best = { job: j, at }
    }
  }

  return best
}

const show = (v: unknown) => (v === null || v === undefined || v === '' ? 'unknown' : String(v))

export function findTask(board: KanbanBoard | null | undefined, id: string): KanbanTask | null | undefined {
  if (!board || !Array.isArray(board.columns)) {
    return undefined
  }

  for (const col of board.columns) {
    for (const t of Array.isArray(col.tasks) ? col.tasks : []) {
      if (t.id === id) {
        return t
      }
    }
  }

  return null
}

export function findRun(
  profiles: FleetProfile[] | null | undefined,
  runId: string
): { profile: string; run: FleetRun } | null | undefined {
  if (!Array.isArray(profiles)) {
    return undefined
  }

  for (const p of profiles) {
    for (const r of Array.isArray(p.active_runs) ? p.active_runs : []) {
      if (String(r.id) === runId) {
        return { profile: p.profile, run: r }
      }
    }
  }

  return null
}

export function AgentCardView({
  name,
  fleet,
  model,
  policy,
  pending,
  row,
  cron,
  role
}: {
  /** O76: first clause of the kanban profile description; undefined = not loaded, null = none. */
  role?: string | null
  name: string
  row?: ProfileRow | null
  cron?: CronJobLite[] | null
  fleet: FleetProfile | null | undefined
  model: ModelNode | null
  policy: PolicyView | null
  pending: ApprovalItem[] | null
}) {
  const violations = policy && Array.isArray(policy.violations) ? policy.violations : null

  return (
    <section aria-label={`Agent ${name}`} data-ops-agent-card={name}>
      <h2>
        <Sigil name={name} /> {row?.display_name || name}
      </h2>
      {row?.bot_title ? <p data-ops-field="title">{row.bot_title}</p> : null}
      <dl>
        <dt>{T("Presence")}</dt>
        <dd data-ops-field="presence">{fleet === undefined ? 'unknown' : fleet ? show(fleet.presence) : 'not in fleet'}</dd>
        <dt>{T("Model")}</dt>
        <dd data-ops-field="model">{model ? `${show(model.provider)} / ${show(model.model)}` : T('unknown')}</dd>
        <dt>{T("Skills")}</dt>
        <dd data-ops-field="skills">{row && typeof row.skill_count === 'number' ? row.skill_count : T('unknown')}</dd>
        <dt>{T("Next cron run")}</dt>
        <dd data-ops-field="next-cron">
          {(() => {
            const n = nextCronRun(cron, name)

            return n === undefined ? 'unknown' : n === null ? 'none scheduled' : `${new Date(n.at).toISOString()} (${n.job.name || n.job.id})`
          })()}
        </dd>
        <dt>{T("Role")}</dt>
        <dd data-ops-field="role">{role === undefined ? 'unknown' : role === null ? 'no description' : role}</dd>
        <dt>{T("Policy")}</dt>
        <dd data-ops-field="policy">
          {violations === null ? 'unknown' : violations.length === 0 ? T('inside policy') : P(violations.length, '{n} violations', '{n} violation')}
        </dd>
        <dt>{T("Active runs")}</dt>
        <dd data-ops-field="runs">{fleet && Array.isArray(fleet.active_runs) ? fleet.active_runs.length : T('unknown')}</dd>
        <dt>{T("Needs you")}</dt>
        <dd data-ops-field="pending">{pending ? pending.filter(p => p.profile === name).length : T('unknown')}</dd>
      </dl>
    </section>
  )
}

export function TaskDetailView({ id, task, onOpenRoute }: { id: string; task: KanbanTask | null | undefined; onOpenRoute?: (r: string) => void }) {
  const route = `/kanban?task=${encodeURIComponent(id)}`

  return (
    <section aria-label={`Task ${id}`} data-ops-task={id}>
      {task === undefined ? (
        <p data-ops-unavailable="">{T("Task data unknown (board not loaded).")}</p>
      ) : task === null ? (
        <p data-ops-unavailable="">{T("Task")}{' '}{id} {T("is not on the current board.")}</p>
      ) : (
        <dl>
          <dt>{T("Title")}</dt>
          <dd>{task.title}</dd>
          <dt>{T("Status")}</dt>
          <dd data-ops-field="status">{show(task.status)}</dd>
          <dt>{T("Assignee")}</dt>
          <dd data-ops-field="assignee">{show(task.assignee)}</dd>
          <dt>{T("Tenant")}</dt>
          <dd>{show(task.tenant)}</dd>
        </dl>
      )}
      <button data-ops-open-route={route} onClick={() => onOpenRoute?.(route)} type="button">
        {T("Open in Kanban")}</button>
    </section>
  )
}

const secs = (a?: number | null, b?: number | null) => (typeof a === 'number' && typeof b === 'number' ? `${Math.max(0, b - a).toFixed(0)} s` : T('unknown'))

export function RunHistoryView({ id, run, error, onOpenRoute }: { id: string; run: TaskRun | null | undefined; error?: string | null; onOpenRoute?: (r: string) => void }) {
  if (error) {
    return <p data-ops-unavailable="">{T("Run")}{' '}{id} {T("history unavailable:")}{' '}{error}</p>
  }

  if (run === undefined) {
    return <p data-ops-loading="">{T("Loading run history…")}</p>
  }

  if (!run) {
    return <p data-ops-unavailable="">{T("Run")}{' '}{id} {T("not found.")}</p>
  }

  return (
    <dl data-ops-run-history={id}>
      <dt>{T("Profile")}</dt>
      <dd data-ops-field="profile">{show(run.profile)}</dd>
      <dt>{T("Status")}</dt>
      <dd data-ops-field="status">{show(run.status)}</dd>
      <dt>{T("Outcome")}</dt>
      <dd data-ops-field="outcome">{show(run.outcome)}</dd>
      <dt>{T("Step")}</dt>
      <dd>{show(run.step_key)}</dd>
      <dt>{T("Started")}</dt>
      <dd>{typeof run.started_at === 'number' ? new Date(run.started_at * 1000).toISOString() : T('unknown')}</dd>
      <dt>{T("Duration")}</dt>
      <dd data-ops-field="duration">{secs(run.started_at, run.ended_at)}</dd>
      {run.summary ? (
        <>
          <dt>{T("Summary")}</dt>
          <dd>{run.summary}</dd>
        </>
      ) : null}
      {run.error ? (
        <>
          <dt>{T("Error")}</dt>
          <dd role="alert">{run.error}</dd>
        </>
      ) : null}
      <dt>{T("Task")}</dt>
      <dd>
        <button data-ops-open-route={`/kanban?task=${encodeURIComponent(run.task_id)}`} disabled={!onOpenRoute} onClick={() => onOpenRoute?.(`/kanban?task=${encodeURIComponent(run.task_id)}`)} type="button">
          {run.task_id}
        </button>
      </dd>
    </dl>
  )
}

export function RunDetailView({ id, found }: { id: string; found: { profile: string; run: FleetRun } | null | undefined }) {
  return (
    <section aria-label={`Run ${id}`} data-ops-run={id}>
      {found === undefined ? (
        <p data-ops-unavailable="">{T("Run data unknown (fleet not loaded).")}</p>
      ) : found === null ? (
        <p data-ops-unavailable="">{T("Run")}{' '}{id} {T("is not active. Live replay is not available; history below.")}</p>
      ) : (
        <dl>
          <dt>{T("Profile")}</dt>
          <dd data-ops-field="profile">{found.profile}</dd>
          <dt>{T("Source")}</dt>
          <dd>{show(found.run.source)}</dd>
          <dt>{T("Task")}</dt>
          <dd>{show(found.run.task_id)}</dd>
          <dt>{T("Started")}</dt>
          <dd>{found.run.started_at ? new Date(found.run.started_at * 1000).toISOString() : T('unknown')}</dd>
        </dl>
      )}
    </section>
  )
}

export function NeedsYouListView({ items }: { items: ApprovalItem[] | null }) {
  if (items === null) {
    return <p data-ops-unavailable="">{T("Needs-you is unknown.")}</p>
  }

  if (items.length === 0) {
    return <p data-ops-needs-you-empty="">{T("Nothing needs you.")}</p>
  }

  return (
    <ul aria-label={T("Needs you")} data-ops-needs-you-list="">
      {items.map(i => (
        <li data-ops-origin={i.origin} key={`${i.origin}:${i.id}`}>
          {show(i.profile)}: {i.what_for || i.why || i.id}
        </li>
      ))}
    </ul>
  )
}

const useClient = (c?: OpsClient) => useMemo(() => c ?? createOpsClient(), [c])

export function AgentCardContainer({ name, client: c, actions: a }: { name: string; client?: OpsClient; actions?: OpsActions }) {
  const client = useClient(c)
  const actions = useMemo(() => a ?? createOpsActions(), [a])
  const rows = useOpsResource(() => actions.profiles(), [actions], 30_000)
  const cron = useOpsResource(() => Promise.resolve().then(() => client.cronJobs(name)), [client, name], 30_000)
  const list = listOrNull(rows.value?.profiles)
  const roster = useOpsResource(() => Promise.resolve().then(() => actions.kanbanProfiles()), [actions], 30_000)
  const kp = listOrNull(roster.value?.profiles)
  const feed = useOpsFeed(null, client)
  const model = useOpsResource(() => client.modelNode(name), [client, name])
  const policy = useOpsResource(() => client.policy(name), [client, name])
  const pending = useOpsResource(() => client.pendingApprovals(), [client])
  const profiles = Array.isArray(feed.fleet?.profiles) ? feed.fleet.profiles : null

  return (
    <AgentCardView
      cron={listOrNull(cron.value)}
      fleet={profiles ? (profiles.find(p => p.profile === name) ?? null) : undefined}
      model={model.value}
      name={name}
      pending={listOrNull(pending.value?.items)}
      policy={policy.value}
      role={kp ? roleFromDescription(kp.find(r => r.name === name)?.description) : undefined}
      row={list ? (list.find(r => r.name === name) ?? null) : undefined}
    />
  )
}

export function TaskDetailContainer({ id, client: c, onOpenRoute }: { id: string; client?: OpsClient; onOpenRoute?: (r: string) => void }) {
  const client = useClient(c)
  const board = useOpsResource(() => client.board(), [client])

  return <TaskDetailView id={id} onOpenRoute={onOpenRoute} task={findTask(board.value, id)} />
}

export function RunDetailContainer({ id, client: c, actions: a, onOpenRoute }: { id: string; client?: OpsClient; actions?: OpsActions; onOpenRoute?: (r: string) => void }) {
  const client = useClient(c)
  const actions = useMemo(() => a ?? createOpsActions(), [a])
  const feed = useOpsFeed(null, client)
  const hist = useOpsResource(() => actions.runDetail(id), [actions, id])

  return (
    <>
      <RunDetailView found={findRun(feed.fleet?.profiles, id)} id={id} />
      <section aria-label={`Run ${id} history`}>
        <RunHistoryView error={hist.error && !hist.value ? (hist.error instanceof Error ? hist.error.message : String(hist.error)) : null} id={id} onOpenRoute={onOpenRoute} run={hist.value === null ? undefined : hist.value} />
      </section>
    </>
  )
}
