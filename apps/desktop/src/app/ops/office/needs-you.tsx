/**
 * Needs-you queue (ops-panel P6 F1, SPEC O5/O59/O72/D3). Columns: Agent, Kind, Waiting on, Age, Why, Actions.
 * - jsonrpc approvals: one-click Approve only when the full command is shown unabridged (D3/O8).
 * - kanban_review: Approve (move to done) or Request changes (needs a comment, moves back to todo).
 * - kanban_blocked: Unblock needs a note (comment, then ready); Open goes to the task tab.
 * - cron failures (failure_streak > 0): Run now triggers the job.
 * Every action goes to the server; the row says what happened and never claims success early.
 */

import { useState } from 'react'

import type { ApprovalItem, CronJobLite } from '../feed/ops-client'

export type KanbanAction = { kind: 'approve_review' | 'request_changes' | 'unblock'; taskId: string; note?: string }

export interface NeedsYouProps {
  items: ApprovalItem[] | null
  cron?: CronJobLite[] | null
  readOnly?: boolean
  onApprove?: (item: ApprovalItem) => Promise<unknown> | void
  onKanban?: (a: KanbanAction) => Promise<unknown> | void
  onCronRun?: (jobId: string) => Promise<unknown> | void
  onOpenTask?: (taskId: string) => void
}

/** D3: one click only when the full command fits unabridged in the row. */
export const FULL_ARGS_MAX = 160

const KIND: Record<string, string> = {
  jsonrpc: 'Command approval',
  gateway_run: 'Run approval',
  kanban_review: 'Review',
  kanban_blocked: 'Blocked',
  cron_failure: 'Cron failing'
}

const age = (s: number | null | undefined) =>
  typeof s !== 'number' ? 'unknown' : s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`

type State = 'sending' | 'done' | 'failed'

export function NeedsYouQueue(p: NeedsYouProps) {
  const [busy, setBusy] = useState<Record<string, State>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  if (!p.items) {
    return <section data-ops-needs-you="">Needs you unknown</section>
  }

  const failing = (Array.isArray(p.cron) ? p.cron : []).filter(j => (j.failure_streak ?? 0) > 0)

  const run = async (key: string, fn: () => Promise<unknown> | void) => {
    setBusy(b => ({ ...b, [key]: 'sending' }))

    try {
      await fn()
      setBusy(b => ({ ...b, [key]: 'done' }))
    } catch (e) {
      setBusy(b => ({ ...b, [key]: 'failed' }))
      setErrors(x => ({ ...x, [key]: e instanceof Error ? e.message : 'refused' }))
    }
  }

  const label = (key: string, idle: string, done: string) => (busy[key] === 'done' ? done : busy[key] === 'failed' ? `Retry ${idle.toLowerCase()}` : idle)
  const total = p.items.length + failing.length

  return (
    <section aria-label="Needs you" data-ops-needs-you="">
      <h3>Needs you ({total})</h3>
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Kind</th>
            <th>Waiting on</th>
            <th>Age</th>
            <th>Why</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {p.items.map(item => {
            const key = `${item.origin}:${item.id}`
            const sending = busy[key] === 'sending' || busy[key] === 'done'
            const cmd = item.exact_request?.command ?? ''
            const fullFits = Boolean(cmd) && cmd.length <= FULL_ARGS_MAX
            const note = notes[key] ?? ''

            return (
              <tr data-ops-approval={key} data-ops-origin={item.origin} key={key} tabIndex={-1}>
                <td>{item.profile ?? 'unknown'}</td>
                <td>{KIND[item.origin] ?? item.origin}</td>
                <td data-ops-waiting-on="">{cmd || item.what_for || item.id}</td>
                <td>{age(item.age_s)}</td>
                <td>{item.why}</td>
                <td>
                  {p.readOnly ? (
                    <span data-ops-review={key}>Review</span>
                  ) : item.origin === 'jsonrpc' ? (
                    item.actions.includes('approve') && fullFits ? (
                      <button data-ops-approve={key} disabled={sending} onClick={() => void run(key, () => p.onApprove?.(item))} type="button">
                        {label(key, 'Approve', 'Approved')}
                      </button>
                    ) : (
                      <span data-ops-review={key}>Review</span>
                    )
                  ) : item.origin === 'kanban_review' ? (
                    <>
                      <button data-ops-approve={key} disabled={sending} onClick={() => void run(key, () => p.onKanban?.({ kind: 'approve_review', taskId: item.id }))} type="button">
                        {label(key, 'Approve', 'Approved')}
                      </button>
                      <input aria-label={`changes for ${item.id}`} onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))} placeholder="What to change" value={note} />
                      <button
                        disabled={sending || !note.trim()}
                        onClick={() => void run(key, () => p.onKanban?.({ kind: 'request_changes', taskId: item.id, note: note.trim() }))}
                        type="button"
                      >
                        Request changes
                      </button>
                    </>
                  ) : item.origin === 'kanban_blocked' ? (
                    <>
                      <button onClick={() => p.onOpenTask?.(item.id)} type="button">
                        Open
                      </button>
                      <input aria-label={`unblock note for ${item.id}`} onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))} placeholder="Unblock note" value={note} />
                      <button
                        data-ops-unblock={key}
                        disabled={sending || !note.trim()}
                        onClick={() => void run(key, () => p.onKanban?.({ kind: 'unblock', taskId: item.id, note: note.trim() }))}
                        type="button"
                      >
                        {label(key, 'Unblock', 'Unblocked')}
                      </button>
                    </>
                  ) : (
                    <span data-ops-review={key}>Not routable from this connection</span>
                  )}
                  {errors[key] && busy[key] === 'failed' ? <span role="alert">{errors[key]}</span> : null}
                </td>
              </tr>
            )
          })}
          {failing.map(j => {
            const key = `cron:${j.id}`

            return (
              <tr data-ops-approval={key} data-ops-origin="cron_failure" key={key}>
                <td>{j.profile ?? 'unknown'}</td>
                <td>{KIND.cron_failure}</td>
                <td>{j.name ?? j.id}</td>
                <td>unknown</td>
                <td>
                  {j.failure_streak} failure(s) in a row{j.last_status ? `, last: ${j.last_status}` : ''}
                </td>
                <td>
                  {p.readOnly ? null : (
                    <button data-ops-cron-run={j.id} disabled={busy[key] === 'sending'} onClick={() => void run(key, () => p.onCronRun?.(j.id))} type="button">
                      {label(key, 'Run now', 'Triggered')}
                    </button>
                  )}
                  {errors[key] && busy[key] === 'failed' ? <span role="alert">{errors[key]}</span> : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
