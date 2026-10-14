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

export type KanbanAction = { kind: 'approve_review' | 'request_changes' | 'unblock' | 'comment'; taskId: string; note?: string }

export interface NeedsYouProps {
  items: ApprovalItem[] | null
  cron?: CronJobLite[] | null
  readOnly?: boolean
  onApprove?: (item: ApprovalItem) => Promise<unknown> | void
  /** O72: Deny is one click too (D3); it never needs the full args to be visible. */
  onDeny?: (item: ApprovalItem) => Promise<unknown> | void
  onKanban?: (a: KanbanAction) => Promise<unknown> | void
  onCronRun?: (jobId: string) => Promise<unknown> | void
  onOpenTask?: (taskId: string) => void
  /** X3 (P8): model-policy violations; the fix lives on the profile's Canvas Model node. */
  policy?: PolicyNeed[] | null
  onOpenProfile?: (profile: string) => void
}

export interface PolicyNeed {
  profile: string
  field: string
  provider: string
  model: string
  reason: string
}

/** D3: one click only when the full command fits unabridged in the row. */
export const FULL_ARGS_MAX = 160
/** SPEC v2.1 4c: and at most 3 lines. */
export const FULL_ARGS_LINES = 3

/** One-click Approve guard (SPEC v2.1 4c): full command visible, still a published action, id-bound request. */
export function oneClickApprove(item: ApprovalItem): boolean {
  const cmd = item.exact_request?.command ?? ''

  return Boolean(cmd) && cmd.length <= FULL_ARGS_MAX && cmd.split('\n').length <= FULL_ARGS_LINES && item.actions.includes('approve') && Boolean(item.id)
}

/** Distinct copy per server outcome; never a silent success. */
export function outcomeCopy(result: unknown, done: string): string {
  const o = (result as { outcome?: unknown } | null)?.outcome

  if (o === 'resolved_elsewhere' || o === 'already_resolved') {
    return 'Already resolved elsewhere'
  }

  if (o === 'expired') {
    return 'Expired'
  }

  if (o === 'stale_revision') {
    return 'Changed; review again'
  }

  if (o === 'duplicate') {
    return 'Already sent'
  }

  return done
}

const KIND: Record<string, string> = {
  jsonrpc: 'Command approval',
  gateway_run: 'Run approval',
  kanban_review: 'Review',
  kanban_blocked: 'Blocked',
  cron_failure: 'Cron failing',
  policy: 'Policy'
}

const age = (s: number | null | undefined) =>
  typeof s !== 'number'
    ? 'unknown'
    : s < 60
      ? `${Math.round(s)} s`
      : s < 3600
        ? `${Math.round(s / 60)} min`
        : s < 48 * 3600
          ? `${Math.round(s / 3600)} h`
          : `${Math.round(s / 86400)} d`

const MISSING_WHY = new Set(['', 'reason not recorded', 'motivo no registrado'])

type State = 'sending' | 'done' | 'failed'

export function NeedsYouQueue(p: NeedsYouProps) {
  const [busy, setBusy] = useState<Record<string, State>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, unknown>>({})

  if (!p.items) {
    return <section data-ops-needs-you="">Needs you unknown</section>
  }

  const failing = (Array.isArray(p.cron) ? p.cron : []).filter(j => (j.failure_streak ?? 0) > 0)

  const run = async (key: string, fn: () => Promise<unknown> | void) => {
    setBusy(b => ({ ...b, [key]: 'sending' }))

    try {
      const r = await fn()
      setResults(x => ({ ...x, [key]: r }))
      setBusy(b => ({ ...b, [key]: 'done' }))
    } catch (e) {
      setBusy(b => ({ ...b, [key]: 'failed' }))
      setErrors(x => ({ ...x, [key]: e instanceof Error ? e.message : 'refused' }))
    }
  }

  const label = (key: string, idle: string, done: string) => (busy[key] === 'done' ? outcomeCopy(results[key], done) : busy[key] === 'failed' ? `Retry ${idle.toLowerCase()}` : idle)
  const policy = Array.isArray(p.policy) ? p.policy : []
  const total = p.items.length + failing.length + policy.length

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
            const fullFits = oneClickApprove(item)
            const note = notes[key] ?? ''

            return (
              <tr data-ops-approval={key} data-ops-origin={item.origin} key={key} tabIndex={-1}>
                <td>{item.profile ?? 'unknown'}</td>
                <td>{KIND[item.origin] ?? item.origin}</td>
                <td data-ops-waiting-on="">{cmd || item.what_for || item.id}</td>
                <td data-ops-age="">{age(item.age_s)}</td>
                <td data-ops-why="">
                  {MISSING_WHY.has((item.why ?? '').trim()) ? (
                    <span aria-label="reason not recorded" data-ops-why-missing="" title="reason not recorded">
                      —
                    </span>
                  ) : (
                    item.why
                  )}
                </td>
                <td>
                  {p.readOnly ? (
                    <span data-ops-review={key}>Review</span>
                  ) : item.origin === 'jsonrpc' ? (
                    <>
                      {fullFits ? (
                        <button data-ops-approve={key} data-ops-write="" disabled={sending} onClick={() => void run(key, () => p.onApprove?.(item))} type="button">
                          {label(key, 'Approve', 'Approved')}
                        </button>
                      ) : (
                        <span data-ops-review={key}>Review</span>
                      )}
                      {p.onDeny && item.actions.includes('deny') ? (
                        <button data-ops-deny={key} data-ops-write="" disabled={sending || busy[`d:${key}`] === 'sending' || busy[`d:${key}`] === 'done'} onClick={() => void run(`d:${key}`, () => p.onDeny?.(item))} type="button">
                          {label(`d:${key}`, 'Deny', 'Denied')}
                        </button>
                      ) : null}
                    </>
                  ) : item.origin === 'kanban_review' ? (
                    <>
                      <button data-ops-approve={key} data-ops-write="" disabled={sending} onClick={() => void run(key, () => p.onKanban?.({ kind: 'approve_review', taskId: item.id }))} type="button">
                        {label(key, 'Approve', 'Approved')}
                      </button>
                      <input aria-label={`changes for ${item.id}`} onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))} placeholder="What to change" value={note} />
                      <button data-ops-write=""
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
                      <button data-ops-unblock={key}
                        data-ops-write=""
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
                  {!p.readOnly && (item.origin === 'kanban_review' || item.origin === 'kanban_blocked') ? (
                    <>
                      <input
                        aria-label={`comment for ${item.id}`}
                        onChange={e => setNotes(n => ({ ...n, [`c:${key}`]: e.target.value }))}
                        placeholder="Comment"
                        value={notes[`c:${key}`] ?? ''}
                      />
                      <button data-ops-comment={key}
                        data-ops-write=""
                        disabled={!(notes[`c:${key}`] ?? '').trim()}
                        onClick={() =>
                          void run(`c:${key}`, () => p.onKanban?.({ kind: 'comment', taskId: item.id, note: (notes[`c:${key}`] ?? '').trim() })).then(() =>
                            setNotes(n => ({ ...n, [`c:${key}`]: '' }))
                          )
                        }
                        type="button"
                      >
                        Comment
                      </button>
                    </>
                  ) : null}
                  {errors[key] && busy[key] === 'failed' ? <span role="alert">{errors[key]}</span> : null}
                  {errors[`d:${key}`] && busy[`d:${key}`] === 'failed' ? <span role="alert">{errors[`d:${key}`]}</span> : null}
                  {errors[`c:${key}`] && busy[`c:${key}`] === 'failed' ? <span role="alert">{errors[`c:${key}`]}</span> : null}
                </td>
              </tr>
            )
          })}
          {policy.map(v => {
            const key = `policy:${v.profile}:${v.field}`

            return (
              <tr data-ops-approval={key} data-ops-origin="policy" key={key}>
                <td>{v.profile}</td>
                <td>{KIND.policy}</td>
                <td>
                  {v.field}: {v.provider}/{v.model}
                </td>
                <td>unknown</td>
                <td>{v.reason}</td>
                <td>
                  <button data-ops-policy-fix={v.profile} disabled={!p.onOpenProfile} onClick={() => p.onOpenProfile?.(v.profile)} type="button">
                    Fix on Canvas
                  </button>
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
                    <button data-ops-cron-run={j.id} data-ops-write="" disabled={busy[key] === 'sending'} onClick={() => void run(key, () => p.onCronRun?.(j.id))} type="button">
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
      {total === 0 ? <p data-ops-empty="needs-you">Nothing needs you right now.</p> : null}
    </section>
  )
}
