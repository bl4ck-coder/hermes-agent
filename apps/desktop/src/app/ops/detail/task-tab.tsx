/**
 * Task tab (ops-panel P6 F2; SPEC O27-O30, O61, O70, O71, O74, O17, W6). Everything comes from
 * GET /api/plugins/kanban/tasks/{id}: timeline (task_events → verb + target), comments, run history
 * with a failure block, subtasks (task_links children) and attachments. Writes are kanban routes only:
 * comment, assign, add subtask, unblock (with a note) and retry (→ ready). The server validates each.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createOpsActions, type OpsActions, type TaskDetail, type TaskEvent, type TaskRun } from '../feed/ops-actions'
import { T } from '../main-i18n'

import { LinkedText } from './entity-links'

const VERB: Record<string, string> = {
  created: 'created',
  assigned: 'assigned to',
  reassigned: 'handed off to',
  claimed: 'claimed by',
  started: 'started',
  completed: 'completed',
  done: 'completed',
  blocked: 'blocked',
  unblocked: 'unblocked',
  review_requested: 'requested review',
  review_reopened: 'reopened from review',
  commented: 'commented',
  edited: 'edited',
  archived: 'archived',
  failed: 'failed',
  reclaimed: 'reclaimed',
  linked: 'spawned child',
  unlinked: 'unlinked',
  delegated: 'delegated to',
  delegate_spawned: 'delegated to'
}

/** O61/O71: verb from the event kind, target from the payload (assignee/profile/child/reason). */
export function describeEvent(e: TaskEvent): { verb: string; target: string; handoff: boolean } {
  const p = (e.payload && typeof e.payload === 'object' ? e.payload : {}) as Record<string, unknown>
  const pick = (...k: string[]) => k.map(x => p[x]).find(v => typeof v === 'string' && v) as string | undefined
  const verb = VERB[e.kind] ?? e.kind.replace(/_/g, ' ')
  const target = pick('assignee', 'to', 'profile', 'child', 'child_id', 'reason', 'status', 'summary') ?? ''

  // O71: a handoff is a reassign, a child-task link, or a delegate_task spawn.
  return { verb, target, handoff: e.kind === 'reassigned' || e.kind === 'assigned' || e.kind === 'linked' || /delegat/.test(e.kind) }
}

/** P8: local wall-clock (the operator's zone), not UTC. */
const hhmm = (s?: number | null) => {
  if (typeof s !== 'number') {
    return '--:--'
  }

  const d = new Date(s * 1000)

  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const dur = (r: TaskRun) => (typeof r.started_at === 'number' && typeof r.ended_at === 'number' ? `${r.ended_at - r.started_at} s` : 'unknown')

/** X9: a worker run can report a diff in its metadata (``diff`` or ``diffstat``); newest run wins. */
export function latestDiff(runs: { metadata?: unknown; started_at?: number | null }[]): string | null {
  for (const r of [...runs].sort((x, y) => (y.started_at ?? 0) - (x.started_at ?? 0))) {
    let m = r.metadata

    if (typeof m === 'string') {
      try {
        m = JSON.parse(m)
      } catch {
        m = null
      }
    }

    const d = (m as { diff?: unknown; diffstat?: unknown } | null)?.diff ?? (m as { diffstat?: unknown } | null)?.diffstat

    if (typeof d === 'string' && d.trim()) {
      return d
    }
  }

  return null
}

export function TaskTabView({
  detail,
  error,
  assignees,
  readOnly,
  onAction,
  onOpenTask,
  onOpenRoute,
  loadLog
}: {
  detail: TaskDetail | null
  error?: string | null
  assignees?: string[]
  readOnly?: boolean
  onAction: (a: { kind: 'comment' | 'assign' | 'subtask' | 'unblock' | 'retry' | 'stop' | 'steer'; value?: string }) => Promise<unknown>
  loadLog?: () => Promise<{ exists: boolean; content: string; truncated: boolean }>
  onOpenTask?: (id: string) => void
  onOpenRoute?: (r: string) => void
}) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [comment, setComment] = useState('')
  const [sub, setSub] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState<number | null>(null)
  const [steer, setSteer] = useState('')
  const [log, setLog] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!detail) {
    return <p data-ops-unavailable="">{error ? `Task unavailable: ${error}` : 'Task is loading (unknown).'}</p>
  }

  const t = detail.task
  const runs = Array.isArray(detail.runs) ? detail.runs : []
  const events = Array.isArray(detail.events) ? detail.events : []
  const live = runs.find(r => r.status === 'running' && (r.ended_at === null || r.ended_at === undefined))
  // P8: only the newest run's failure is actionable; an old failure followed by a clean run is history.
  const newest = runs.reduce<TaskRun | undefined>((m, r) => (!m || r.id > m.id ? r : m), undefined)
  const failed = newest && (newest.outcome === 'failed' || newest.status === 'failed' || newest.error) ? newest : undefined

  /** Resolves true on success. P8: inputs are only cleared on success; one action in flight at a time. */
  const act = async (a: Parameters<typeof onAction>[0], done: string): Promise<boolean> => {
    if (busy) {
      return false
    }

    setBusy(true)

    try {
      await onAction(a)
      setMsg(done)

      return true
    } catch (e) {
      const m = e instanceof Error ? e.message : 'request failed'
      setMsg(a.kind === 'stop' && /409|already|ended/i.test(m) ? 'Run already ended.' : `Refused: ${m}`)

      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label={`Task ${t.id}`} data-ops-task-tab={t.id}>
      <header>
        <h2>{t.title}</h2>
        <span data-ops-field="status">{t.status}</span>
        {t.current_step_key ? <span data-ops-field="step">{T("step")}{' '}{t.current_step_key}</span> : null}
        {t.branch_name ? <span data-ops-field="branch">{t.branch_name}</span> : null}
        <button onClick={() => onOpenRoute?.(`/kanban?task=${encodeURIComponent(t.id)}`)} type="button">
          {T("Open in Board")}</button>
      </header>
      {/* X9 (P8 b6): evidence first (timeline, runs, log, diff, outputs), then every action. */}
      <div data-ops-evidence="">
      <section aria-label={T("Timeline")} data-ops-timeline="">
        <h3>{T("Timeline")}</h3>
        <button onClick={() => setOpen(new Set(events.map(e => e.id)))} type="button">
          {T("Expand all")}</button>
        <button onClick={() => setOpen(new Set())} type="button">
          {T("Collapse all")}</button>
        <ol>
          {events.map(e => {
            const d = describeEvent(e)

            return (
              <li data-ops-event={e.kind} data-ops-handoff={d.handoff ? '' : undefined} key={e.id}>
                <code>{hhmm(e.created_at)}</code> {d.verb} <code>{d.target}</code>
                <button aria-expanded={open.has(e.id)} onClick={() => setOpen(s => (s.has(e.id) ? new Set([...s].filter(x => x !== e.id)) : new Set([...s, e.id])))} type="button">
                  {open.has(e.id) ? 'Hide' : 'Details'}
                </button>
                {open.has(e.id) ? <pre data-ops-event-payload="">{JSON.stringify(e.payload, null, 2)}</pre> : null}
              </li>
            )
          })}
        </ol>
      </section>

      <section aria-label={T("Runs")} data-ops-runs="">
        <h3>{T("Runs (")}{runs.length})</h3>
        <table>
          <tbody>
            {runs.map(r => (
              <tr data-ops-run-row={r.id} key={r.id}>
                <td>#{r.id}</td>
                <td>{r.profile ?? 'unknown'}</td>
                <td>{r.status}</td>
                <td>{r.outcome ?? ''}</td>
                <td>{dur(r)}</td>
                <td>{r.summary ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {loadLog ? (
        <section aria-label={T("Worker log")} data-ops-worker-log="">
          <h3>{T("Worker log")}</h3>
          <button
            onClick={() =>
              void loadLog().then(
                l => setLog(l.exists ? `${l.truncated ? '…(tail)\n' : ''}${l.content}` : 'No worker log: this task never spawned a worker.'),
                e => setLog(`Log unavailable: ${e instanceof Error ? e.message : 'request failed'}`)
              )
            }
            type="button"
          >
            {log === null ? 'Show worker log' : 'Refresh log'}
          </button>
          {log !== null ? <pre data-ops-log="">{log}</pre> : null}
        </section>
      ) : null}

      <section aria-label={T("Diff")} data-ops-diff="">
        <h3>{T("Diff")}</h3>
        {(() => {
          const d = latestDiff(runs)

          return d ? <pre data-ops-diff-body="">{d}</pre> : <p data-ops-empty="diff">{T("No diff reported by the latest run.")}</p>
        })()}
      </section>

      <section aria-label={T("Attachments")} data-ops-attachments="">
        <h3>{T("Outputs (")}{detail.attachments?.length ?? 0})</h3>
        <ul>
          {(detail.attachments ?? []).map(a => (
            <li key={a.id}>{a.filename}</li>
          ))}
        </ul>
      </section>

      </div>
      <div aria-label={T("Task actions")} data-ops-task-actions="">
        <label>
          {T("Assignee")}<select aria-label={T("assignee")} disabled={readOnly} onChange={e => void act({ kind: 'assign', value: e.target.value }, 'Reassigned')} value={t.assignee ?? ''}>
            <option value="">{T("unassigned")}</option>
            {[...new Set([...(assignees ?? []), ...(t.assignee ? [t.assignee] : [])])].map(a => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>
      {msg ? <p role="status">{msg}</p> : null}
      {t.workspace_path ? (
        <p data-ops-field="workspace">
          {T("Workspace")}{' '}<code>{t.workspace_path}</code>
        </p>
      ) : null}

      {live && !readOnly ? (
        <div aria-label={T("Live run controls")} data-ops-live-run={live.id}>
          {confirmStop === live.id ? (
            <>
              <span>{T("Stop run")}{' '}{live.id}{T("? The worker is terminated.")}</span>
              <button data-ops-stop-confirm="" data-ops-write="" disabled={busy} onClick={() => (setConfirmStop(null), void act({ kind: 'stop', value: String(live.id) }, 'Stopped'))} type="button">
                {T("Confirm stop")}</button>
              <button onClick={() => setConfirmStop(null)} type="button">
                {T("Cancel")}</button>
            </>
          ) : (
            <button data-ops-stop="" data-ops-write="" onClick={() => setConfirmStop(live.id)} type="button">
              {T("Stop")}</button>
          )}
          <form onSubmit={e => (e.preventDefault(), steer.trim() && void act({ kind: 'steer', value: steer.trim() }, 'Steer sent').then(ok => ok && setSteer('')))}>
            <input aria-label={T("steer")} onChange={e => setSteer(e.target.value)} placeholder={T("Steer the running worker")} value={steer} />
            <button data-ops-write="" disabled={busy || !steer.trim()} type="submit">
              {T("Steer")}</button>
          </form>
        </div>
      ) : null}

      {failed ? (
        <div data-ops-run-failure="" role="alert">
          <strong>{T("Run")}{' '}{failed.id} {T("failed")}</strong> {failed.error ?? failed.outcome ?? ''}
          {!readOnly ? (
            <>
              <input aria-label={T("unblock note")} onChange={e => setNote(e.target.value)} placeholder={T("Unblock note")} value={note} />
              <button data-ops-write="" disabled={busy || !note.trim()} onClick={() => void act({ kind: 'unblock', value: note.trim() }, 'Unblocked').then(ok => ok && setNote(''))} type="button">
                {T("Unblock")}</button>
              <button data-ops-write="" onClick={() => void act({ kind: 'retry' }, 'Moved to ready')} type="button">
                {T("Retry → ready")}</button>
            </>
          ) : null}
        </div>
      ) : null}

      <section aria-label={T("Subtasks")} data-ops-subtasks="">
        <h3>{T("Subtasks (")}{detail.child_results?.length ?? 0})</h3>
        <ul>
          {(detail.child_results ?? []).map(c => (
            <li data-ops-subtask={c.id} key={c.id}>
              <button onClick={() => onOpenTask?.(c.id)} type="button">
                {c.title}
              </button>{' '}
              {c.status}
            </li>
          ))}
        </ul>
        {!readOnly ? (
          <form onSubmit={e => (e.preventDefault(), sub.trim() && void act({ kind: 'subtask', value: sub.trim() }, 'Subtask created').then(ok => ok && setSub('')))}>
            <input aria-label={T("new subtask")} onChange={e => setSub(e.target.value)} placeholder={T("Add subtask")} value={sub} />
          </form>
        ) : null}
      </section>

      <section aria-label={T("Comments")} data-ops-comments="">
        <h3>{T("Comments (")}{detail.comments?.length ?? 0})</h3>
        <ul>
          {(detail.comments ?? []).map((c, i) => (
            <li key={c.id ?? i}>
              <strong>{c.author ?? 'unknown'}</strong> <LinkedText onOpenTask={onOpenTask} text={c.body ?? ''} />
            </li>
          ))}
        </ul>
        {!readOnly ? (
          <form onSubmit={e => (e.preventDefault(), comment.trim() && void act({ kind: 'comment', value: comment.trim() }, 'Comment added').then(ok => ok && setComment('')))}>
            <input aria-label={T("comment")} onChange={e => setComment(e.target.value)} placeholder={T("Comment")} value={comment} />
          </form>
        ) : null}
      </section>
    </section>
  )
}

export function TaskTabContainer({
  id,
  actions: a,
  assignees,
  onOpenTask,
  onOpenRoute,
  pollMs = 5000
}: {
  id: string
  actions?: OpsActions
  assignees?: string[]
  onOpenTask?: (id: string) => void
  onOpenRoute?: (r: string) => void
  pollMs?: number
}) {
  const actions = useMemo(() => a ?? createOpsActions(), [a])
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [names, setNames] = useState<string[] | undefined>(assignees)

  useEffect(() => {
    if (assignees) {
      return
    }

    Promise.resolve()
      .then(() => actions.assignees())
      .then(
      r => setNames(Array.isArray(r?.assignees) ? r.assignees.map(String) : undefined),
      () => setNames(undefined)
    )
  }, [actions, assignees])

  // P8: a response for a previous id (or an older poll) never overwrites the current one.
  const seq = useRef(0)

  const load = useCallback(async () => {
    const mine = ++seq.current

    try {
      const d = await actions.taskDetail(id)

      if (mine !== seq.current) {
        return
      }

      setDetail(d && d.task ? d : null)
      setError(d && d.task ? null : 'malformed task')
    } catch (e) {
      if (mine === seq.current) {
        setError(e instanceof Error ? e.message : 'request failed')
      }
    }
  }, [actions, id])

  useEffect(() => {
    setDetail(null)
    setError(null)
  }, [id])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), pollMs)

    return () => clearInterval(t)
  }, [load, pollMs])

  const onAction = async (x: { kind: string; value?: string }) => {
    // P8: reload even on refusal (e.g. Stop on a run that just ended) so the controls match the server.
    try {
      await run(x)
    } finally {
      await load()
    }
  }

  const run = async (x: { kind: string; value?: string }) => {
    if (x.kind === 'comment') {
      await actions.comment(id, x.value ?? '')
    } else if (x.kind === 'assign') {
      await actions.assign(id, x.value || null)
    } else if (x.kind === 'subtask') {
      await actions.createSubtask(id, x.value ?? '')
    } else if (x.kind === 'unblock') {
      await actions.kanban({ kind: 'unblock', taskId: id, note: x.value })
    } else if (x.kind === 'retry') {
      await actions.setStatus(id, 'ready')
    } else if (x.kind === 'stop') {
      await actions.terminate(x.value ?? '')
    } else if (x.kind === 'steer') {
      // The live worker comment bridge delivers new comments to a running worker.
      await actions.comment(id, `Steer: ${x.value ?? ''}`)
    }
  }

  return (
    <TaskTabView assignees={names} detail={detail} error={error} key={id} loadLog={() => actions.taskLog(id)} onAction={onAction} onOpenRoute={onOpenRoute} onOpenTask={onOpenTask} />
  )
}
