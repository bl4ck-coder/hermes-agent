/** Office container (ops-panel P3-02): wires OfficeView to the P3-01 client and feed. */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { captureGatewayFileDownload } from '@/lib/media'

import { useKanbanStream } from '../feed/kanban-stream'
import { createOpsActions, type OpsActions } from '../feed/ops-actions'
import { createOpsClient, type OpsClient, parseDispatch } from '../feed/ops-client'
import { OPS_POLL_MS, useOpsFeed } from '../feed/ops-feed'

import { type AttachmentLite, boardTasks, deliveredToday } from './control-room'
import { useOpsNotifications } from './notifications'
import { OfficeView } from './office'

type Loaded<T> = T | null

export function listOrNull<T>(v: T[] | null | undefined): T[] | null {
  return Array.isArray(v) ? v : null
}

export function useOpsResource<T>(load: () => Promise<T>, deps: unknown[], pollMs = OPS_POLL_MS) {
  const [value, setValue] = useState<Loaded<T>>(null)
  const [error, setError] = useState<unknown>(null)
  const [tick, setTick] = useState(0)
  const [seenDeps, setSeenDeps] = useState<unknown[]>(deps)

  // F5 (P8): a scope change (profile, client) drops the previous scope's answer instead of showing
  // it as current until the new one lands (render-time reset, no effect lag).
  if (seenDeps.length !== deps.length || deps.some((d, i) => !Object.is(d, seenDeps[i]))) {
    setSeenDeps(deps)
    setValue(null)
    setError(null)
  }

  useEffect(() => {
    let live = true
    // F5 (P8): a load that throws synchronously (missing bridge/method) becomes this section's error.
    Promise.resolve().then(load).then(
      v => live && (setValue(v), setError(null)),
      e => live && setError(e)
    )
    const t = setTimeout(() => setTick(n => n + 1), pollMs)

    return () => {
      live = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { value, error, reload: () => setTick(n => n + 1) }
}

export function OfficeContainer({
  readOnly = false,
  client: clientProp,
  actions: actionsProp,
  onOpenProfile,
  onOpenTask,
  onOpenRoute,
  connectionLabel,
  profile = 'default'
}: {
  onOpenRoute?: (route: string) => void
  connectionLabel?: string | null
  profile?: string
  readOnly?: boolean
  client?: OpsClient
  actions?: OpsActions
  onOpenProfile?: (p: string) => void
  onOpenTask?: (taskId: string) => void
}) {
  const client = useMemo(() => clientProp ?? createOpsClient(), [clientProp])
  const actions = useMemo(() => actionsProp ?? createOpsActions(), [actionsProp])
  const feed = useOpsFeed(null, client)
  const pending = useOpsResource(() => client.pendingApprovals(), [client])
  const usage = useOpsResource(() => client.usageToday(), [client])
  const cron = useOpsResource(() => client.cronJobs(), [client])
  const board = useOpsResource(() => client.board(), [client])
  const activity = useOpsResource(() => client.resolvedApprovals(), [client])
  const blueprints = useOpsResource(() => actions.blueprints(profile), [actions, profile], 60_000)
  const projects = useOpsResource(() => actions.projects(), [actions], 30_000)
  const policy = useOpsResource(() => client.policy(profile), [client, profile], 30_000)
  const stream = useKanbanStream()
  const tasks = boardTasks(board.value)
  const nowForDelivered = Math.floor(Date.now() / 60_000) * 60
  const deliveredIds = (deliveredToday(tasks, nowForDelivered) ?? []).slice(0, 10).map(t => t.id)
  const deliveredKey = deliveredIds.join(',')
  const [attachments, setAttachments] = useState<Record<string, AttachmentLite[] | null | undefined>>({})

  // X4/X8: outputs for delivered tasks (newest 10), one request per task, refreshed when the set changes.
  useEffect(() => {
    let live = true

    for (const id of deliveredKey ? deliveredKey.split(',') : []) {
      Promise.resolve()
        .then(() => actions.attachments(id))
        .then(
          r => live && setAttachments(m => ({ ...m, [id]: Array.isArray(r) ? (r as AttachmentLite[]) : Array.isArray((r as { attachments?: unknown })?.attachments) ? (r as { attachments: AttachmentLite[] }).attachments : null })),
          () => live && setAttachments(m => ({ ...m, [id]: null }))
        )
    }

    return () => {
      live = false
    }
  }, [actions, deliveredKey])

  // A kanban push refreshes the board-derived sections and Needs-you at once (poll stays the fallback).
  useEffect(() => {
    if (stream.version) {
      board.reload()
      pending.reload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.version])

  const [nowS, setNowS] = useState(() => Date.now() / 1000)

  useEffect(() => {
    const t = setInterval(() => setNowS(Date.now() / 1000), 1000)

    return () => clearInterval(t)
  }, [])

  // Malformed or partial payloads render as unknown (null), never as an empty, healthy-looking list.
  const inFlight = Array.isArray(board.value?.columns)
    ? board.value.columns.filter(c => c.name === 'running').flatMap(c => (Array.isArray(c.tasks) ? c.tasks : []))
    : null

  const approve = useCallback(
    async (item: Parameters<OpsClient['approve']>[0]) => {
      await client.approve(item, 'once')
      pending.reload()
    },
    [client, pending]
  )

  const dispatch = useCallback(
    async (text: string) => {
      const { assignee, title, project } = parseDispatch(text)
      await client.dispatch(title, assignee, null, project)
      board.reload()
    },
    [client, board]
  )

  // R54: opt-in, silent OS notifications for new approvals and newly blocked tasks.
  useOpsNotifications(
    listOrNull(pending.value?.items)?.map(x => {
      const r = x as { id?: unknown; approval_id?: unknown }

      return String(r.id ?? r.approval_id ?? '')
    }) ?? null,
    Array.isArray(board.value?.columns)
      ? board.value.columns.filter(c => c.name === 'blocked').flatMap(c => (Array.isArray(c.tasks) ? c.tasks : [])).map(t => ({ id: t.id, title: t.title }))
      : null
  )

  const openTask = onOpenTask ?? (onOpenRoute ? (id: string) => onOpenRoute(`/kanban?task=${encodeURIComponent(id)}`) : undefined)
  const fleetView = Array.isArray(feed.fleet?.profiles) ? feed.fleet : null

  // X5: a live run opens its task (the run history lives on the task tab).
  const openRun = (runId: string) => {
    const run = fleetView?.profiles.flatMap(p => p.active_runs ?? []).find(r => String(r.id) === runId)

    if (run?.task_id) {
      openTask?.(run.task_id)
    }
  }

  const violations = Array.isArray(policy.value?.violations)
    ? policy.value.violations.map(v => ({ ...v, profile }))
    : policy.value
      ? []
      : null

  return (
    <OfficeView
      activity={listOrNull(activity.value?.items)}
      attachments={attachments}
      blueprints={listOrNull(blueprints.value?.blueprints)}
      connectionLabel={connectionLabel}
      cron={listOrNull(cron.value)}
      errors={{ pending: pending.error, board: board.error, cron: cron.error, usage: usage.error, activity: activity.error, projects: projects.error, policy: policy.error }}
      fleet={fleetView}
      fleetError={feed.error}
      inFlight={inFlight}
      nowS={nowS}
      onApprove={approve}
      onCronRun={async id => (await actions.cronTrigger(id), cron.reload())}
      onDeny={async item => (await client.approve(item, 'deny'), pending.reload())}
      onDispatch={dispatch}
      onKanban={async a => (await actions.kanban(a), pending.reload(), board.reload())}
      onNewProfile={onOpenRoute ? () => onOpenRoute('/profiles') : undefined}
      onOpenAttachment={(_t, a) => {
        if (a.stored_path) {
          void captureGatewayFileDownload()(a.stored_path, a.filename)
        }
      }}
      onOpenProfile={onOpenProfile}
      onOpenRoute={onOpenRoute}
      onOpenRun={openTask ? openRun : undefined}
      onOpenTask={openTask}
      pending={listOrNull(pending.value?.items)}
      policy={violations}
      profile={profile}
      projects={listOrNull(projects.value?.projects)}
      readOnly={readOnly}
      taskEvents={stream.mode === 'stream' || stream.events.length ? stream.events : null}
      tasks={tasks}
      usage={usage.value}
    />
  )
}
