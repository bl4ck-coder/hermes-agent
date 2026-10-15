/**
 * Needs-you queue (ops-panel P6 F1, SPEC O5/O59/O72/D3). P14: a list of decisions (title, context, meta, one primary action, More actions).
 * - jsonrpc approvals: one-click Approve only when the full command is shown unabridged (D3/O8).
 * - kanban_review: Approve (move to done) or Request changes (needs a comment, moves back to todo).
 * - kanban_blocked: Unblock needs a note (comment, then ready); Open goes to the task tab.
 * - cron failures (failure_streak > 0): Run now triggers the job.
 * Every action goes to the server; the row says what happened and never claims success early.
 */

import { type ReactNode, useState } from 'react'

import type { ApprovalItem, CronJobLite } from '../feed/ops-client'
import { T } from '../main-i18n'
import { Disclosure, EntityList, EntityRow } from '../primitives/entity-row'
import { Sigil } from '../primitives/sigil'

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
    ? T('unknown')
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
    return <section data-ops-needs-you="">{T("Needs you unknown")}</section>
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

  const label = (key: string, idle: string, done: string) => (busy[key] === 'done' ? T(outcomeCopy(results[key], done)) : busy[key] === 'failed' ? T('Retry {action}').replace('{action}', T(idle).toLowerCase()) : T(idle))
  const policy = Array.isArray(p.policy) ? p.policy : []
  const total = p.items.length + failing.length + policy.length

  const alerts = (key: string) => (
    <>
      {errors[key] && busy[key] === 'failed' ? <span role="alert">{errors[key]}</span> : null}
      {errors[`d:${key}`] && busy[`d:${key}`] === 'failed' ? <span role="alert">{errors[`d:${key}`]}</span> : null}
      {errors[`c:${key}`] && busy[`c:${key}`] === 'failed' ? <span role="alert">{errors[`c:${key}`]}</span> : null}
    </>
  )

  // P14: oldest first where age is known; unknown age last. Stable by key otherwise.
  const byAge = (x: ApprovalItem, y: ApprovalItem) => (typeof y.age_s === 'number' ? y.age_s : -1) - (typeof x.age_s === 'number' ? x.age_s : -1)
  const decisions = p.items.filter(i => i.origin !== 'kanban_blocked').sort(byAge)
  const blocked = p.items.filter(i => i.origin === 'kanban_blocked').sort(byAge)

  const comment = (item: ApprovalItem, key: string) =>
    !p.readOnly && (item.origin === 'kanban_review' || item.origin === 'kanban_blocked') ? (
      <span data-ops-row-more="comment">
        <input aria-label={`comment for ${item.id}`} onChange={e => setNotes(n => ({ ...n, [`c:${key}`]: e.target.value }))} placeholder={T("Comment")} value={notes[`c:${key}`] ?? ''} />
        <button data-ops-comment={key}
          data-ops-write=""
          disabled={!(notes[`c:${key}`] ?? '').trim()}
          onClick={() => void run(`c:${key}`, () => p.onKanban?.({ kind: 'comment', taskId: item.id, note: (notes[`c:${key}`] ?? '').trim() })).then(() => setNotes(n => ({ ...n, [`c:${key}`]: '' })))}
          type="button"
        >
          {T("Comment")}</button>
      </span>
    ) : null

  const row = (item: ApprovalItem) => {
    const key = `${item.origin}:${item.id}`
    const sending = busy[key] === 'sending' || busy[key] === 'done'
    const cmd = item.exact_request?.command ?? ''
    const fullFits = oneClickApprove(item)
    const note = notes[key] ?? ''
    const why = MISSING_WHY.has((item.why ?? '').trim()) ? null : item.why
    // The recognisable work leads; a command is shown whole, in mono, before Approve.
    const title = item.origin === 'jsonrpc' || item.origin === 'gateway_run' ? item.what_for || T(KIND[item.origin] ?? item.origin) : item.what_for || cmd || item.id

    let primary: ReactNode = null
    let more: ReactNode = null

    if (p.readOnly) {
      primary = <span data-ops-review={key}>{T("Review")}</span>
    } else if (item.origin === 'jsonrpc') {
      primary = fullFits ? (
        <button data-ops-approve={key} data-ops-primary="" data-ops-write="" disabled={sending} onClick={() => void run(key, () => p.onApprove?.(item))} type="button">
          {label(key, 'Approve', 'Approved')}
        </button>
      ) : (
        <span data-ops-review={key}>{T("Review")}</span>
      )
      more =
        p.onDeny && item.actions.includes('deny') ? (
          <button data-ops-deny={key} data-ops-write="" disabled={sending || busy[`d:${key}`] === 'sending' || busy[`d:${key}`] === 'done'} onClick={() => void run(`d:${key}`, () => p.onDeny?.(item))} type="button">
            {label(`d:${key}`, 'Deny', 'Denied')}
          </button>
        ) : null
    } else if (item.origin === 'kanban_review') {
      primary = (
        <button data-ops-approve={key} data-ops-primary="" data-ops-write="" disabled={sending} onClick={() => void run(key, () => p.onKanban?.({ kind: 'approve_review', taskId: item.id }))} type="button">
          {label(key, 'Approve', 'Approved')}
        </button>
      )
      more = (
        <Disclosure label={T("More actions")}>
          <input aria-label={`changes for ${item.id}`} onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))} placeholder={T("What to change")} value={note} />
          <button data-ops-write="" disabled={sending || !note.trim()} onClick={() => void run(key, () => p.onKanban?.({ kind: 'request_changes', taskId: item.id, note: note.trim() }))} type="button">
            {T("Request changes")}</button>
          {p.onOpenTask ? <button onClick={() => p.onOpenTask?.(item.id)} type="button">{T("Open task")}</button> : null}
          {comment(item, key)}
          {why ? null : <small data-ops-why-missing="">{T("reason not recorded")}</small>}
        </Disclosure>
      )
    } else if (item.origin === 'kanban_blocked') {
      primary = (
        <button data-ops-primary="" onClick={() => p.onOpenTask?.(item.id)} type="button">
          {T("Open task")}</button>
      )
      more = (
        <Disclosure label={T("More actions")}>
          <input aria-label={`unblock note for ${item.id}`} onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))} placeholder={T("Unblock note")} value={note} />
          <button data-ops-unblock={key} data-ops-write="" disabled={sending || !note.trim()} onClick={() => void run(key, () => p.onKanban?.({ kind: 'unblock', taskId: item.id, note: note.trim() }))} type="button">
            {label(key, 'Unblock', 'Unblocked')}
          </button>
          {comment(item, key)}
          {why ? null : <small data-ops-why-missing="">{T("reason not recorded")}</small>}
        </Disclosure>
      )
    } else {
      primary = <span data-ops-review={key}>{T("Not routable from this connection")}</span>
    }

    return (
      <EntityRow
        attrs={{ 'data-ops-approval': key, 'data-ops-origin': item.origin }}
        context={
          <>
            {why ? <span data-ops-why="">{why}</span> : null}
            {cmd && (item.origin === 'jsonrpc' || item.origin === 'gateway_run') ? <pre data-ops-row-command="" data-ops-waiting-on="">{cmd}</pre> : null}
          </>
        }
        focusable
        key={key}
        lead={item.profile ? <Sigil name={item.profile} size={20} /> : null}
        meta={
          <>
            <span data-ops-kind={item.origin}>{T(KIND[item.origin] ?? item.origin)}</span>
            <span data-ops-agent="">{item.profile ?? T('unknown')}</span>
            <span data-ops-age="">{age(item.age_s)}</span>
          </>
        }
        more={
          <>
            {more}
            {alerts(key)}
          </>
        }
        primary={primary}
        title={cmd && (item.origin === 'jsonrpc' || item.origin === 'gateway_run') ? title : <span data-ops-waiting-on="">{title}</span>}
        tone={item.origin === 'kanban_blocked' ? 'warn' : undefined}
      />
    )
  }

  return (
    <section aria-label={T("Needs you")} data-ops-needs-you="">
      <h3>{T("Needs you (")}{total})</h3>
      {/* P14 (judge consult): decisions, not a table. Grouped by what is asked of you; oldest first. */}
      {decisions.length ? (
        <div data-ops-rows-group="decisions">
          <h4>{T("Pending decisions")}</h4>
          <EntityList label={T("Pending decisions")}>{decisions.map(row)}</EntityList>
        </div>
      ) : null}
      {blocked.length ? (
        <div data-ops-rows-group="blocked">
          <h4>{T("Blocked work")}</h4>
          <EntityList label={T("Blocked work")}>{blocked.map(row)}</EntityList>
        </div>
      ) : null}
      {policy.length || failing.length ? (
        <div data-ops-rows-group="problems">
          <h4>{T("Configuration or run problems")}</h4>
          <EntityList label={T("Configuration or run problems")}>
            {policy.map(v => {
              const key = `policy:${v.profile}:${v.field}`

              return (
                <EntityRow
                  attrs={{ 'data-ops-approval': key, 'data-ops-origin': 'policy' }}
                  context={v.reason}
                  key={key}
                  meta={
                    <>
                      <span data-ops-kind="policy">{T(KIND.policy)}</span>
                      <span data-ops-agent="">{v.profile}</span>
                    </>
                  }
                  primary={
                    <button data-ops-policy-fix={v.profile} data-ops-primary="" disabled={!p.onOpenProfile} onClick={() => p.onOpenProfile?.(v.profile)} type="button">
                      {T("Fix on Canvas")}</button>
                  }
                  title={`${v.field}: ${v.provider}/${v.model}`}
                  tone="bad"
                />
              )
            })}
            {failing.map(j => {
              const key = `cron:${j.id}`

              return (
                <EntityRow
                  attrs={{ 'data-ops-approval': key, 'data-ops-origin': 'cron_failure' }}
                  context={`${j.failure_streak} ${T("failure(s) in a row")}${j.last_status ? `, last: ${j.last_status}` : ''}`}
                  key={key}
                  meta={
                    <>
                      <span data-ops-kind="cron_failure">{T(KIND.cron_failure)}</span>
                      <span data-ops-agent="">{j.profile ?? T('unknown')}</span>
                    </>
                  }
                  more={alerts(key)}
                  primary={
                    p.readOnly ? null : (
                      <button data-ops-cron-run={j.id} data-ops-primary="" data-ops-write="" disabled={busy[key] === 'sending'} onClick={() => void run(key, () => p.onCronRun?.(j.id))} type="button">
                        {label(key, 'Run now', 'Triggered')}
                      </button>
                    )
                  }
                  title={j.name ?? j.id}
                  tone="bad"
                />
              )
            })}
          </EntityList>
        </div>
      ) : null}
      {total === 0 ? <p data-ops-empty="needs-you">{T("Nothing needs you right now.")}</p> : null}
    </section>
  )
}
