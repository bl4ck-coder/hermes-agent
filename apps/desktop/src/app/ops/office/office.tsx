/**
 * Office W2 (ops-panel P3-02). Presentational: every figure comes from a backend response;
 * a null is rendered as "unknown", never 0. Updates never move focus.
 */

import { type RefObject, useRef, useState } from 'react'

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

import {
  type AttachmentLite,
  type BoardTask,
  deliveredToday,
  officeStats,
  projectProgress,
  stuckItems
} from './control-room'
import { DeliveredList, MyQueue, ProjectTable, SectionFrame, type SectionId, StatCards, StuckList } from './control-room-view'
import { type KanbanAction, NeedsYouQueue, type PolicyNeed } from './needs-you'
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
  /* ---- P8 batch 2: control room (R63-R66, X1-X5, X8) ---- */
  /** Every board row (all columns); null = not loaded yet / unavailable. */
  tasks?: BoardTask[] | null
  projects?: { id: string; name: string }[] | null
  /** task id → attachments for delivered tasks. */
  attachments?: Record<string, AttachmentLite[] | null | undefined>
  /** Focused profile (My queue, "n for profile"). */
  profile?: string | null
  /** X1: per-section request errors (a section with an error but no value is "unavailable"). */
  errors?: Partial<Record<'pending' | 'board' | 'cron' | 'usage' | 'activity' | 'projects' | 'policy', unknown>>
  /** X3: model-policy violations for the focused profile. */
  policy?: PolicyNeed[] | null
  onOpenRun?: (runId: string) => void
  onOpenAttachment?: (taskId: string, a: AttachmentLite) => void
  onNewProfile?: () => void
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

function CronStrip({ cron, onOpenCron }: { cron: CronJobLite[] | null; onOpenCron?: (id: string) => void }) {
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
        <button data-ops-cron-failure={j.id} disabled={!onOpenCron} key={j.id} onClick={() => onOpenCron?.(j.id)} type="button">
          {j.name || j.id} ({j.failure_streak})
        </button>
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

function FleetTable({ fleet, nowS, onOpenProfile, onOpenRun }: { fleet: FleetResponse; nowS: number; onOpenProfile?: (p: string) => void; onOpenRun?: (id: string) => void }) {
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
            <td>
              {p.active_runs
                ? p.active_runs.length
                  ? p.active_runs.map(r => (
                      <button data-ops-open-run={String(r.id)} disabled={!onOpenRun} key={String(r.id)} onClick={() => onOpenRun?.(String(r.id))} type="button">
                        #{String(r.id)}
                      </button>
                    ))
                  : 0
                : unknown}
            </td>
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
  onOpenRoute,
  inputRef
}: {
  onDispatch?: (text: string) => Promise<unknown> | void
  readOnly?: boolean
  blueprints?: { key: string; title: string }[] | null
  onOpenRoute?: (route: string) => void
  inputRef?: RefObject<HTMLInputElement | null>
}) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (readOnly) {
    return null
  }

  return (
    <form
      aria-label="Dispatch"
      data-ops-dispatch=""
      onSubmit={async e => {
        e.preventDefault()

        if (!text.trim() || sending) {
          return
        }

        // F5 (P8): one dispatch in flight; the server's reason is shown, the text is kept on failure.
        setSending(true)

        try {
          await onDispatch?.(text)
          setText('')
          setStatus('Dispatched')
        } catch (err) {
          setStatus(`Dispatch failed: ${err instanceof Error ? err.message : 'request failed'}`)
        } finally {
          setSending(false)
        }
      }}
    >
      <input
        aria-label="Dispatch a task (@assignee title)"
        onChange={e => setText(e.target.value)}
        placeholder="@builder describe the task"
        ref={inputRef}
        value={text}
      />
      <button disabled={sending || !text.trim()} type="submit">
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

/** Local calendar date (the operator's zone), YYYY-MM-DD. F5 (P8): was the UTC date. */
export function localDay(nowS: number): string {
  const d = new Date(nowS * 1000)

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const localTime = (s?: number | null) => (typeof s === 'number' && s > 0 ? new Date(s * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'unknown')

export function OfficeView(props: OfficeViewProps) {
  const [localLayout, setLocalLayout] = useState<OfficeLayout>('orrery')
  const [focused, setFocused] = useState<SectionId | null>(null)
  const dispatchInput = useRef<HTMLInputElement | null>(null)
  const layout = props.layout ?? localLayout
  const setLayout = props.onLayout ?? setLocalLayout
  const { fleet, nowS } = props
  const errors = props.errors ?? {}
  const tasks = props.tasks === undefined ? null : props.tasks
  const profile = props.profile ?? null
  const stats = officeStats(tasks, props.cron, props.pending, profile, nowS)
  const stuck = stuckItems(tasks, props.cron, nowS)
  const delivered = deliveredToday(tasks, nowS)
  const projects = projectProgress(props.projects ?? null, tasks)
  const openCron = props.onOpenRoute ? (id: string) => props.onOpenRoute?.(`/cron?job=${encodeURIComponent(id)}`) : undefined

  // A stat card filters the Office to its section: highlight it and bring it into view (focus moves
  // only because the user clicked; live updates never move focus).
  const focus = (s: SectionId) => {
    setFocused(f => (f === s ? null : s))
    const el = document.getElementById(`ops-office-${s}`)
    el?.scrollIntoView?.({ block: 'nearest' })
    el?.focus?.({ preventScroll: true })
  }

  const boardLoading = tasks === null

  return (
    <div data-ops-filter={focused ?? undefined} data-ops-office="">
      <header data-ops-office-header="">
        <time dateTime={localDay(nowS)}>{localDay(nowS)}</time>
        <span data-ops-field="connection">{props.connectionLabel || 'unknown connection'}</span>
        {props.readOnly ? null : (
          <span data-ops-header-actions="">
            <button data-ops-new-task="" data-ops-primary="" onClick={() => dispatchInput.current?.focus()} type="button">
              New task
            </button>
            <button data-ops-new-profile="" disabled={!props.onNewProfile} onClick={() => props.onNewProfile?.()} type="button">
              New profile
            </button>
          </span>
        )}
      </header>
      <StatCards onFocus={focus} profile={profile} stats={stats} />
      <TodayStrip cron={props.cron} inFlight={props.inFlight} nowS={nowS} />
      <HealthStrip error={props.fleetError} fleet={fleet} nowS={nowS} />
      <CronStrip cron={props.cron} onOpenCron={openCron} />
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
          <FleetTable fleet={fleet} nowS={nowS} onOpenProfile={props.onOpenProfile} onOpenRun={props.onOpenRun} />
        )
      ) : null}
      <Dispatch blueprints={props.blueprints} inputRef={dispatchInput} onDispatch={props.onDispatch} onOpenRoute={props.onOpenRoute} readOnly={props.readOnly} />
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
      <SectionFrame error={errors.pending} focused={focused === 'needs-you'} heading={false} id="needs-you" loading={props.pending === null} title="Needs you">
        <NeedsYouQueue
          cron={props.cron}
          items={props.pending}
          onApprove={props.onApprove}
          onCronRun={props.onCronRun}
          onDeny={props.onDeny}
          onKanban={props.onKanban}
          onOpenProfile={props.onOpenProfile}
          onOpenTask={props.onOpenTask}
          policy={props.policy}
          readOnly={props.readOnly}
        />
      </SectionFrame>
      <SectionFrame count={stuck?.length} error={errors.board ?? errors.cron} focused={focused === 'stuck'} id="stuck" loading={stuck === null} title="Stuck">
        {stuck ? <StuckList items={stuck} onOpenCron={openCron} onOpenTask={props.onOpenTask} /> : null}
      </SectionFrame>
      {profile ? (
        <SectionFrame error={errors.board} focused={focused === 'queue'} id="queue" loading={boardLoading} title={`My queue · ${profile}`}>
          {tasks ? <MyQueue nowS={nowS} onOpenTask={props.onOpenTask} profile={profile} tasks={tasks} /> : null}
        </SectionFrame>
      ) : null}
      <SectionFrame error={errors.board} focused={focused === 'in-flight'} id="in-flight" loading={props.inFlight === null} title="In flight">
        {props.inFlight && props.inFlight.length === 0 ? (
          <p data-ops-empty="in-flight">Nothing running.</p>
        ) : (
          <ul>
            {(props.inFlight ?? []).map(t => (
              <li data-ops-in-flight-task={t.id} key={t.id}>
                <button disabled={!props.onOpenTask} onClick={() => props.onOpenTask?.(t.id)} type="button">
                  {t.title}
                </button>{' '}
                {t.assignee ? `@${t.assignee}` : ''}
              </li>
            ))}
          </ul>
        )}
      </SectionFrame>
      <SectionFrame count={delivered?.length} error={errors.board} focused={focused === 'delivered'} id="delivered" loading={delivered === null} title="Delivered today">
        {delivered ? (
          <DeliveredList attachments={props.attachments ?? {}} nowS={nowS} onOpenAttachment={props.onOpenAttachment} onOpenTask={props.onOpenTask} tasks={delivered} />
        ) : null}
      </SectionFrame>
      {props.projects !== undefined ? (
        <SectionFrame error={errors.projects ?? errors.board} focused={focused === 'projects'} id="projects" loading={projects === null} title="Project progress">
          {projects ? <ProjectTable nowS={nowS} onOpenProject={props.onOpenRoute ? id => props.onOpenRoute?.(`/kanban?project=${encodeURIComponent(id)}`) : undefined} rows={projects} /> : null}
        </SectionFrame>
      ) : null}
      <SectionFrame error={errors.usage} id="cost" loading={props.usage === null} title="Today">
        <span data-ops-tokens="input">Input tokens {num(props.usage?.input_tokens)}</span>
        <span data-ops-tokens="output">Output tokens {num(props.usage?.output_tokens)}</span>
      </SectionFrame>
      <SectionFrame error={errors.activity} id="activity" loading={props.activity === null && !props.taskEvents?.length} title="Activity">
        {props.taskEvents && props.taskEvents.length ? (
          <ul aria-label="Task events" data-ops-task-events="">
            {props.taskEvents.slice(0, 20).map(e => {
              const d = describeEvent(e)

              return (
                <li data-ops-handoff={d.handoff ? '' : undefined} data-ops-task-event={e.id} key={e.id}>
                  <button disabled={!props.onOpenTask} onClick={() => props.onOpenTask?.(e.task_id)} type="button">
                    {e.task_id}
                  </button>{' '}
                  {d.verb} {d.target} <time>{localTime(e.created_at)}</time>
                </li>
              )
            })}
          </ul>
        ) : null}
        {props.activity === null ? null : props.activity.length === 0 && !props.taskEvents?.length ? (
          <p data-ops-empty="activity">No activity yet today.</p>
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
      </SectionFrame>
    </div>
  )
}
