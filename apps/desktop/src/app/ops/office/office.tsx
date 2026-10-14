/**
 * Office W2 (ops-panel P3-02). Presentational: every figure comes from a backend response;
 * a null is rendered as "unknown", never 0. Updates never move focus.
 */

import { useState } from 'react'

import type {
  ApprovalItem,
  CronJobLite,
  FleetProfile,
  FleetResponse,
  KanbanTask,
  Presence,
  UsageToday
} from '../feed/ops-client'
import { shownPresence } from '../feed/ops-client'

import { type KanbanAction, NeedsYouQueue } from './needs-you'
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
  readOnly?: boolean
  layout?: OfficeLayout
  onLayout?: (layout: OfficeLayout) => void
  onApprove?: (item: ApprovalItem) => Promise<unknown> | void
  onDispatch?: (text: string) => Promise<unknown> | void
  onOpenProfile?: (profile: string) => void
  onKanban?: (a: KanbanAction) => Promise<unknown> | void
  onCronRun?: (jobId: string) => Promise<unknown> | void
  onOpenTask?: (taskId: string) => void
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

function Dispatch({ onDispatch, readOnly }: { onDispatch?: (text: string) => Promise<unknown> | void; readOnly?: boolean }) {
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
      <button type="submit">Dispatch</button>
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
      <Dispatch onDispatch={props.onDispatch} readOnly={props.readOnly} />
      <NeedsYouQueue
        cron={props.cron}
        items={props.pending}
        onApprove={props.onApprove}
        onCronRun={props.onCronRun}
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
        {props.activity === null ? (
          <span>{unknown}</span>
        ) : (
          <ul>
            {props.activity.slice(0, 20).map((a, i) => (
              <li key={i}>{String(a.outcome ?? a.choice ?? 'resolved')} {String(a.profile ?? '')}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
