/**
 * Office W2 (ops-panel P3-02). Presentational: every figure comes from a backend response;
 * a null is rendered as "unknown", never 0. Updates never move focus.
 */

import { useState } from 'react'

import { describeEvent } from '../detail/task-tab'
import type { KanbanEvent } from '../feed/kanban-stream'
import type {
  ApprovalItem,
  CronJobLite,
  FleetProfile,
  FleetResponse,
  KanbanTask,
  Presence,
  UsageToday
} from '../feed/ops-client'
import { parseDispatch, shownPresence } from '../feed/ops-client'
import { ToastQueue } from '../primitives/toast-queue'

import { type KanbanAction, NeedsYouQueue } from './needs-you'
import { activityRow, focusNeedsYouRow, toastsFromPending } from './office-toasts'
import { layoutOrrery, ORRERY_CAP } from './orrery'

export type OfficeLayout = 'orrery' | 'table'

export interface OfficeViewProps {
  fleet: FleetResponse | null
  fleetError?: unknown
  nowS: number
  pending: ApprovalItem[] | null
  usage: UsageToday | null
  cron: CronJobLite[] | null
  inFlight: KanbanTask[] | null
  activity: Record<string, unknown>[] | null
  /** P7 F1 (O7): live task_events from the kanban stream, newest first; null = no stream. */
  taskEvents?: KanbanEvent[] | null
  readOnly?: boolean
  layout?: OfficeLayout
  onLayout?: (layout: OfficeLayout) => void
  onApprove?: (item: ApprovalItem) => Promise<unknown> | void
  onDeny?: (item: ApprovalItem) => Promise<unknown> | void
  onDispatch?: (text: string) => Promise<unknown> | void
  onOpenProfile?: (profile: string) => void
  onKanban?: (a: KanbanAction) => Promise<unknown> | void
  onCronRun?: (jobId: string) => Promise<unknown> | void
  onOpenTask?: (taskId: string) => void
  /** R61: header shows the date and the connection, no greeting. */
  connectionLabel?: string | null
  /** O4: cron blueprint chips under the composer; picking one opens Schedule with it. */
  blueprints?: { key: string; title: string }[] | null
  onOpenRoute?: (route: string) => void
}

const unknown = 'unknown'
const num = (v: number | null | undefined) => (typeof v === 'number' ? v.toLocaleString('en-US') : unknown)

const PRESENCE_LABEL: Record<Presence, string> = {
  working: 'Working',
  needs_you: 'Needs you',
  blocked: 'Blocked',
  idle: 'Idle',
  offline: 'Offline',
  unknown: 'Unknown',
  stale: 'Stale'
}

function HealthStrip({ fleet, error, nowS }: { fleet: FleetResponse | null; error?: unknown; nowS: number }) {
  if (!fleet) {
    return (
      <div data-ops-strip="health" role="status">
        {error ? 'Fleet unavailable' : 'Loading fleet'}
      </div>
    )
  }

  const counts = new Map<Presence, number>()

  for (const p of fleet.profiles) {
    const s = shownPresence(p, nowS)
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }

  return (
    <div data-ops-strip="health" role="status">
      <span data-ops-count="profiles">{fleet.profiles.length} profiles</span>
      {(Object.keys(PRESENCE_LABEL) as Presence[])
        .filter(k => counts.get(k))
        .map(k => (
          <span data-ops-count={k} key={k}>
            {PRESENCE_LABEL[k]} {counts.get(k)}
          </span>
        ))}
      {error ? <span data-ops-warn="">refresh failed, showing last snapshot</span> : null}
    </div>
  )
}

/** R1: cron runs in the next 24 h and overdue work (a running task whose heartbeat is stale). */
export function todayCounts(cron: CronJobLite[] | null, inFlight: KanbanTask[] | null, nowS: number) {
  const next24 = cron
    ? cron.filter(j => {
        if (j.enabled === false) {
          return false
        }

        const t = typeof j.next_run_at === 'number' ? j.next_run_at : typeof j.next_run_at === 'string' ? Date.parse(j.next_run_at) / 1000 : NaN

        return Number.isFinite(t) && t >= nowS && t - nowS <= 86_400
      }).length
    : null

  const overdue = inFlight
    ? inFlight.filter(t => {
        const hb = (t as KanbanTask & { last_heartbeat_at?: number | null }).last_heartbeat_at

        return typeof hb === 'number' && nowS - hb > 600
      }).length
    : null

  return { next24, overdue, running: inFlight ? inFlight.length : null }
}

function TodayStrip({ cron, inFlight, nowS }: { cron: CronJobLite[] | null; inFlight: KanbanTask[] | null; nowS: number }) {
  const c = todayCounts(cron, inFlight, nowS)
  const n = (v: number | null) => (v === null ? unknown : String(v))

  return (
    <div aria-label="Today strip" data-ops-strip="today">
      <span data-ops-count="cron-24h">Cron next 24 h {n(c.next24)}</span>
      <span data-ops-count="running">Running {n(c.running)}</span>
      <span data-ops-count="overdue">Overdue {n(c.overdue)}</span>
    </div>
  )
}

function CronStrip({ cron }: { cron: CronJobLite[] | null }) {
  if (!cron) {
    return <div data-ops-strip="cron">Cron {unknown}</div>
  }

  const failing = cron.filter(j => (j.failure_streak ?? 0) > 0)
  const enabled = cron.filter(j => j.enabled !== false)

  return (
    <div data-ops-strip="cron">
      <span data-ops-count="cron-enabled">{enabled.length} cron jobs</span>
      <span data-ops-count="cron-failing">{failing.length} failing</span>
      {failing.slice(0, 3).map(j => (
        <span data-ops-cron-failure={j.id} key={j.id}>
          {j.name || j.id} ({j.failure_streak})
        </span>
      ))}
    </div>
  )
}

function Orrery({
  fleet,
  nowS,
  onOpenProfile,
  onLayout
}: {
  fleet: FleetResponse
  nowS: number
  onOpenProfile?: (p: string) => void
  onLayout?: (l: OfficeLayout) => void
}) {
  const { centre, orbs, overflow } = layoutOrrery(fleet.profiles, p => shownPresence(p, nowS))

  const orb = (o: { profile: string; presence: Presence; ring: number; x: number; y: number }) => (
    <button
      aria-label={`${o.profile}: ${PRESENCE_LABEL[o.presence]}`}
      data-ops-orb={o.profile}
      data-ops-presence={o.presence}
      data-ops-ring={o.ring}
      key={o.profile}
      onClick={() => onOpenProfile?.(o.profile)}
      style={{ position: 'absolute', left: `calc(50% + ${o.x}px)`, top: `calc(50% + ${o.y}px)` }}
      type="button"
    >
      {o.profile}
    </button>
  )

  return (
    <div aria-label="Orrery" data-ops-orrery="" role="group" style={{ position: 'relative', minHeight: 240 }}>
      <div data-ops-orrery-centre={centre.profile}>{orb(centre)}</div>
      {orbs.map(orb)}
      {overflow.length ? (
        <button data-ops-orrery-overflow={overflow.length} onClick={() => onLayout?.('table')} type="button">
          +{overflow.length} more (cap {ORRERY_CAP})
        </button>
      ) : null}
    </div>
  )
}

function FleetTable({ fleet, nowS, onOpenProfile }: { fleet: FleetResponse; nowS: number; onOpenProfile?: (p: string) => void }) {
  return (
    <table data-ops-fleet-table="">
      <thead>
        <tr>
          <th scope="col">Profile</th>
          <th scope="col">Presence</th>
          <th scope="col">Observed</th>
          <th scope="col">Runs</th>
        </tr>
      </thead>
      <tbody>
        {fleet.profiles.map((p: FleetProfile) => (
          <tr data-ops-fleet-row={p.profile} key={p.profile}>
            <td>
              <button onClick={() => onOpenProfile?.(p.profile)} type="button">
                {p.profile}
              </button>
            </td>
            <td>{PRESENCE_LABEL[shownPresence(p, nowS)]}</td>
            <td>{typeof p.observed_at === 'number' ? `${Math.max(0, Math.round(nowS - p.observed_at))} s ago` : unknown}</td>
            <td>{p.active_runs ? p.active_runs.length : unknown}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function routingLine(text: string): string {
  if (!text.trim()) {
    return 'Type a task. Start with @profile to assign it; otherwise it goes to triage.'
  }

  const { assignee } = parseDispatch(text)

  return assignee ? `Assigned to ${assignee}` : 'Unassigned → triage'
}

function Dispatch({
  onDispatch,
  readOnly,
  blueprints,
  onOpenRoute
}: {
  onDispatch?: (text: string) => Promise<unknown> | void
  readOnly?: boolean
  blueprints?: { key: string; title: string }[] | null
  onOpenRoute?: (route: string) => void
}) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  if (readOnly) {
    return null
  }

  return (
    <form
      aria-label="Dispatch"
      data-ops-dispatch=""
      onSubmit={async e => {
        e.preventDefault()

        if (!text.trim()) {
          return
        }

        try {
          await onDispatch?.(text)
          setText('')
          setStatus('Dispatched')
        } catch {
          setStatus('Dispatch failed')
        }
      }}
    >
      <input
        aria-label="Dispatch a task (@assignee title)"
        onChange={e => setText(e.target.value)}
        placeholder="@builder describe the task"
        value={text}
      />
      <button disabled={!text.trim()} type="submit">
        Dispatch
      </button>
      <kbd>Enter</kbd>
      <span data-ops-routing="">{routingLine(text)}</span>
      {blueprints && blueprints.length ? (
        <div aria-label="Blueprints" data-ops-chips="">
          {blueprints.slice(0, 4).map(b => (
            <button data-ops-chip={b.key} disabled={!onOpenRoute} key={b.key} onClick={() => onOpenRoute?.(`/cron?blueprint=${encodeURIComponent(b.key)}`)} type="button">
              {b.title}
            </button>
          ))}
        </div>
      ) : null}
      {status ? <span role="status">{status}</span> : null}
    </form>
  )
}

export function OfficeView(props: OfficeViewProps) {
  const [localLayout, setLocalLayout] = useState<OfficeLayout>('orrery')
  const layout = props.layout ?? localLayout
  const setLayout = props.onLayout ?? setLocalLayout
  const { fleet, nowS } = props

  return (
    <div data-ops-office="">
      <header data-ops-office-header="">
        <time dateTime={new Date(nowS * 1000).toISOString().slice(0, 10)}>{new Date(nowS * 1000).toISOString().slice(0, 10)}</time>
        <span data-ops-field="connection">{props.connectionLabel || 'unknown connection'}</span>
      </header>
      <TodayStrip cron={props.cron} inFlight={props.inFlight} nowS={nowS} />
      <HealthStrip error={props.fleetError} fleet={fleet} nowS={nowS} />
      <CronStrip cron={props.cron} />
      <div aria-label="Fleet layout" role="tablist">
        {(['orrery', 'table'] as const).map(l => (
          <button aria-selected={layout === l} data-ops-layout={l} key={l} onClick={() => setLayout(l)} role="tab" type="button">
            {l === 'orrery' ? 'Orrery' : 'Table'}
          </button>
        ))}
      </div>
      {fleet ? (
        layout === 'orrery' ? (
          <Orrery fleet={fleet} nowS={nowS} onLayout={setLayout} onOpenProfile={props.onOpenProfile} />
        ) : (
          <FleetTable fleet={fleet} nowS={nowS} onOpenProfile={props.onOpenProfile} />
        )
      ) : null}
      <Dispatch blueprints={props.blueprints} onDispatch={props.onDispatch} onOpenRoute={props.onOpenRoute} readOnly={props.readOnly} />
      {props.readOnly ? null : (
        <ToastQueue
          items={toastsFromPending(props.pending, nowS * 1000, {
            onApprove: props.onApprove,
            onOpenTask: props.onOpenTask,
            onReview: focusNeedsYouRow
          })}
          now={nowS * 1000}
          onNeedsYou={() => document.querySelector('[data-ops-needs-you-anchor]')?.scrollIntoView?.({ block: 'nearest' })}
        />
      )}
      <span data-ops-needs-you-anchor="" />
      <NeedsYouQueue
        cron={props.cron}
        items={props.pending}
        onApprove={props.onApprove}
        onCronRun={props.onCronRun}
        onDeny={props.onDeny}
        onKanban={props.onKanban}
        onOpenTask={props.onOpenTask}
        readOnly={props.readOnly}
      />
      <section aria-label="Today" data-ops-today="">
        <h3>Today</h3>
        <span data-ops-tokens="input">Input tokens {num(props.usage?.input_tokens)}</span>
        <span data-ops-tokens="output">Output tokens {num(props.usage?.output_tokens)}</span>
      </section>
      <section aria-label="In flight" data-ops-in-flight="">
        <h3>In flight</h3>
        {props.inFlight === null ? (
          <span>{unknown}</span>
        ) : props.inFlight.length === 0 ? (
          <span>Nothing running</span>
        ) : (
          <ul>
            {props.inFlight.map(t => (
              <li data-ops-in-flight-task={t.id} key={t.id}>
                {t.title} {t.assignee ? `@${t.assignee}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Activity" data-ops-activity="">
        <h3>Activity</h3>
        {props.taskEvents && props.taskEvents.length ? (
          <ul aria-label="Task events" data-ops-task-events="">
            {props.taskEvents.slice(0, 20).map(e => {
              const d = describeEvent(e)

              return (
                <li data-ops-handoff={d.handoff ? '' : undefined} data-ops-task-event={e.id} key={e.id}>
                  <button disabled={!props.onOpenTask} onClick={() => props.onOpenTask?.(e.task_id)} type="button">
                    {e.task_id}
                  </button>{' '}
                  {d.verb} {d.target} <time>{e.created_at ? new Date(e.created_at * 1000).toISOString() : 'unknown'}</time>
                </li>
              )
            })}
          </ul>
        ) : null}
        {props.activity === null ? (
          <span>{unknown}</span>
        ) : (
          <ul>
            {props.activity.slice(0, 20).map((a, i) => {
              const r = activityRow(a)

              return (
                <li data-ops-activity-row="" key={i}>
                  <span data-ops-field="who">{r.who}</span> {r.what} <time>{r.when}</time>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
