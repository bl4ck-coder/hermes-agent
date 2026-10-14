/**
 * Task tab (ops-panel P6 F2; SPEC O27-O30, O61, O70, O71, O74, O17, W6). Everything comes from
 * GET /api/plugins/kanban/tasks/{id}: timeline (task_events → verb + target), comments, run history
 * with a failure block, subtasks (task_links children) and attachments. Writes are kanban routes only:
 * comment, assign, add subtask, unblock (with a note) and retry (→ ready). The server validates each.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { createOpsActions, type OpsActions, type TaskDetail, type TaskEvent, type TaskRun } from '../feed/ops-actions'

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
  linked: 'linked'
}

/** O61/O71: verb from the event kind, target from the payload (assignee/profile/child/reason). */
export function describeEvent(e: TaskEvent): { verb: string; target: string; handoff: boolean } {
  const p = (e.payload && typeof e.payload === 'object' ? e.payload : {}) as Record<string, unknown>
  const pick = (...k: string[]) => k.map(x => p[x]).find(v => typeof v === 'string' && v) as string | undefined
  const verb = VERB[e.kind] ?? e.kind.replace(/_/g, ' ')
  const target = pick('assignee', 'to', 'profile', 'child_id', 'reason', 'status', 'summary') ?? ''

  return { verb, target, handoff: e.kind === 'reassigned' || e.kind === 'assigned' || e.kind === 'linked' }
}

const hhmm = (s?: number | null) => (typeof s === 'number' ? new Date(s * 1000).toISOString().slice(11, 16) : '--:--')
const dur = (r: TaskRun) => (typeof r.started_at === 'number' && typeof r.ended_at === 'number' ? `${r.ended_at - r.started_at} s` : 'unknown')

export function TaskTabView({
  detail,
  error,
  assignees,
  readOnly,
  onAction,
  onOpenTask,
  onOpenRoute
}: {
  detail: TaskDetail | null
  error?: string | null
  assignees?: string[]
  readOnly?: boolean
  onAction: (a: { kind: 'comment' | 'assign' | 'subtask' | 'unblock' | 'retry'; value?: string }) => Promise<unknown>
  onOpenTask?: (id: string) => void
  onOpenRoute?: (r: string) => void
}) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [comment, setComment] = useState('')
  const [sub, setSub] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  if (!detail) {
    return <p data-ops-unavailable="">{error ? `Task unavailable: ${error}` : 'Task is loading (unknown).'}</p>
  }

  const t = detail.task
  const runs = Array.isArray(detail.runs) ? detail.runs : []
  const events = Array.isArray(detail.events) ? detail.events : []
  const failed = runs.find(r => r.outcome === 'failed' || r.status === 'failed' || r.error)

  const act = async (a: Parameters<typeof onAction>[0], done: string) => {
    try {
      await onAction(a)
      setMsg(done)
    } catch (e) {
      setMsg(`Refused: ${e instanceof Error ? e.message : 'request failed'}`)
    }
  }

  return (
    <section aria-label={`Task ${t.id}`} data-ops-task-tab={t.id}>
      <header>
        <h2>{t.title}</h2>
        <span data-ops-field="status">{t.status}</span>
        {t.current_step_key ? <span data-ops-field="step">step {t.current_step_key}</span> : null}
        {t.branch_name ? <span data-ops-field="branch">{t.branch_name}</span> : null}
        <label>
          Assignee
          <select aria-label="assignee" disabled={readOnly} onChange={e => void act({ kind: 'assign', value: e.target.value }, 'Reassigned')} value={t.assignee ?? ''}>
            <option value="">unassigned</option>
            {[...new Set([...(assignees ?? []), ...(t.assignee ? [t.assignee] : [])])].map(a => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <button onClick={() => onOpenRoute?.(`/kanban?task=${encodeURIComponent(t.id)}`)} type="button">
          Open in Board
        </button>
      </header>
      {msg ? <p role="status">{msg}</p> : null}

      {failed ? (
        <div data-ops-run-failure="" role="alert">
          <strong>Run {failed.id} failed</strong> {failed.error ?? failed.outcome ?? ''}
          {!readOnly ? (
            <>
              <input aria-label="unblock note" onChange={e => setNote(e.target.value)} placeholder="Unblock note" value={note} />
              <button disabled={!note.trim()} onClick={() => void act({ kind: 'unblock', value: note.trim() }, 'Unblocked')} type="button">
                Unblock
              </button>
              <button onClick={() => void act({ kind: 'retry' }, 'Moved to ready')} type="button">
                Retry → ready
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <section aria-label="Subtasks" data-ops-subtasks="">
        <h3>Subtasks ({detail.child_results?.length ?? 0})</h3>
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
          <form onSubmit={e => (e.preventDefault(), sub.trim() && void act({ kind: 'subtask', value: sub.trim() }, 'Subtask created').then(() => setSub('')))}>
            <input aria-label="new subtask" onChange={e => setSub(e.target.value)} placeholder="Add subtask" value={sub} />
          </form>
        ) : null}
      </section>

      <section aria-label="Timeline" data-ops-timeline="">
        <h3>Timeline</h3>
        <button onClick={() => setOpen(new Set(events.map(e => e.id)))} type="button">
          Expand all
        </button>
        <button onClick={() => setOpen(new Set())} type="button">
          Collapse all
        </button>
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

      <section aria-label="Runs" data-ops-runs="">
        <h3>Runs ({runs.length})</h3>
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

      <section aria-label="Attachments" data-ops-attachments="">
        <h3>Attachments ({detail.attachments?.length ?? 0})</h3>
        <ul>
          {(detail.attachments ?? []).map(a => (
            <li key={a.id}>{a.filename}</li>
          ))}
        </ul>
      </section>

      <section aria-label="Comments" data-ops-comments="">
        <h3>Comments ({detail.comments?.length ?? 0})</h3>
        <ul>
          {(detail.comments ?? []).map((c, i) => (
            <li key={c.id ?? i}>
              <strong>{c.author ?? 'unknown'}</strong> {c.body}
            </li>
          ))}
        </ul>
        {!readOnly ? (
          <form onSubmit={e => (e.preventDefault(), comment.trim() && void act({ kind: 'comment', value: comment.trim() }, 'Comment added').then(() => setComment('')))}>
            <input aria-label="comment" onChange={e => setComment(e.target.value)} placeholder="Comment" value={comment} />
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

  const load = useCallback(async () => {
    try {
      const d = await actions.taskDetail(id)
      setDetail(d && d.task ? d : null)
      setError(d && d.task ? null : 'malformed task')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed')
    }
  }, [actions, id])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), pollMs)

    return () => clearInterval(t)
  }, [load, pollMs])

  const onAction = async (x: { kind: string; value?: string }) => {
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
    }

    await load()
  }

  return <TaskTabView assignees={assignees} detail={detail} error={error} onAction={onAction} onOpenRoute={onOpenRoute} onOpenTask={onOpenTask} />
}
