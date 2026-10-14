/**
 * Ops detail tabs (ops-panel P3-04): W3 agent card, W6 task tab, W7 run tab, W8 Needs-you list.
 * Read-only views over the P3-01 client. Missing or malformed data renders as "unknown"; a row that
 * cannot be found says so instead of inventing one. Lenses (W12) keep embedding existing Desktop routes.
 */

import { useMemo } from 'react'

import {
  type ApprovalItem,
  createOpsClient,
  type FleetProfile,
  type FleetRun,
  type KanbanBoard,
  type KanbanTask,
  type ModelNode,
  type OpsClient,
  type PolicyView
} from '../feed/ops-client'
import { useOpsFeed } from '../feed/ops-feed'
import { listOrNull, useOpsResource } from '../office/office-container'

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
  pending
}: {
  name: string
  fleet: FleetProfile | null | undefined
  model: ModelNode | null
  policy: PolicyView | null
  pending: ApprovalItem[] | null
}) {
  const violations = policy && Array.isArray(policy.violations) ? policy.violations : null

  return (
    <section aria-label={`Agent ${name}`} data-ops-agent-card={name}>
      <h2>{name}</h2>
      <dl>
        <dt>Presence</dt>
        <dd data-ops-field="presence">{fleet === undefined ? 'unknown' : fleet ? show(fleet.presence) : 'not in fleet'}</dd>
        <dt>Model</dt>
        <dd data-ops-field="model">{model ? `${show(model.provider)} / ${show(model.model)}` : 'unknown'}</dd>
        <dt>Policy</dt>
        <dd data-ops-field="policy">
          {violations === null ? 'unknown' : violations.length === 0 ? 'inside policy' : `${violations.length} violation(s)`}
        </dd>
        <dt>Active runs</dt>
        <dd data-ops-field="runs">{fleet && Array.isArray(fleet.active_runs) ? fleet.active_runs.length : 'unknown'}</dd>
        <dt>Needs you</dt>
        <dd data-ops-field="pending">{pending ? pending.filter(p => p.profile === name).length : 'unknown'}</dd>
      </dl>
    </section>
  )
}

export function TaskDetailView({ id, task, onOpenRoute }: { id: string; task: KanbanTask | null | undefined; onOpenRoute?: (r: string) => void }) {
  const route = `/kanban?task=${encodeURIComponent(id)}`

  return (
    <section aria-label={`Task ${id}`} data-ops-task={id}>
      {task === undefined ? (
        <p data-ops-unavailable="">Task data unknown (board not loaded).</p>
      ) : task === null ? (
        <p data-ops-unavailable="">Task {id} is not on the current board.</p>
      ) : (
        <dl>
          <dt>Title</dt>
          <dd>{task.title}</dd>
          <dt>Status</dt>
          <dd data-ops-field="status">{show(task.status)}</dd>
          <dt>Assignee</dt>
          <dd data-ops-field="assignee">{show(task.assignee)}</dd>
          <dt>Tenant</dt>
          <dd>{show(task.tenant)}</dd>
        </dl>
      )}
      <button data-ops-open-route={route} onClick={() => onOpenRoute?.(route)} type="button">
        Open in Kanban
      </button>
    </section>
  )
}

export function RunDetailView({ id, found }: { id: string; found: { profile: string; run: FleetRun } | null | undefined }) {
  return (
    <section aria-label={`Run ${id}`} data-ops-run={id}>
      {found === undefined ? (
        <p data-ops-unavailable="">Run data unknown (fleet not loaded).</p>
      ) : found === null ? (
        <p data-ops-unavailable="">Run {id} is not active. History and live replay are not available yet.</p>
      ) : (
        <dl>
          <dt>Profile</dt>
          <dd data-ops-field="profile">{found.profile}</dd>
          <dt>Source</dt>
          <dd>{show(found.run.source)}</dd>
          <dt>Task</dt>
          <dd>{show(found.run.task_id)}</dd>
          <dt>Started</dt>
          <dd>{found.run.started_at ? new Date(found.run.started_at * 1000).toISOString() : 'unknown'}</dd>
        </dl>
      )}
    </section>
  )
}

export function NeedsYouListView({ items }: { items: ApprovalItem[] | null }) {
  if (items === null) {
    return <p data-ops-unavailable="">Needs-you is unknown.</p>
  }

  if (items.length === 0) {
    return <p data-ops-needs-you-empty="">Nothing needs you.</p>
  }

  return (
    <ul aria-label="Needs you" data-ops-needs-you-list="">
      {items.map(i => (
        <li data-ops-origin={i.origin} key={`${i.origin}:${i.id}`}>
          {show(i.profile)}: {i.what_for || i.why || i.id}
        </li>
      ))}
    </ul>
  )
}

const useClient = (c?: OpsClient) => useMemo(() => c ?? createOpsClient(), [c])

export function AgentCardContainer({ name, client: c }: { name: string; client?: OpsClient }) {
  const client = useClient(c)
  const feed = useOpsFeed(null, client)
  const model = useOpsResource(() => client.modelNode(name), [client, name])
  const policy = useOpsResource(() => client.policy(name), [client, name])
  const pending = useOpsResource(() => client.pendingApprovals(), [client])
  const profiles = Array.isArray(feed.fleet?.profiles) ? feed.fleet.profiles : null

  return (
    <AgentCardView
      fleet={profiles ? (profiles.find(p => p.profile === name) ?? null) : undefined}
      model={model.value}
      name={name}
      pending={listOrNull(pending.value?.items)}
      policy={policy.value}
    />
  )
}

export function TaskDetailContainer({ id, client: c, onOpenRoute }: { id: string; client?: OpsClient; onOpenRoute?: (r: string) => void }) {
  const client = useClient(c)
  const board = useOpsResource(() => client.board(), [client])

  return <TaskDetailView id={id} onOpenRoute={onOpenRoute} task={findTask(board.value, id)} />
}

export function RunDetailContainer({ id, client: c }: { id: string; client?: OpsClient }) {
  const client = useClient(c)
  const feed = useOpsFeed(null, client)

  return <RunDetailView found={findRun(feed.fleet?.profiles, id)} id={id} />
}
