/**
 * Office W2 (ops-panel P3-02). Presentational: every figure comes from a backend response;
 * a null is rendered as "unknown", never 0. Updates never move focus.
 */

import { Tip } from '@/components/ui/tooltip'
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
import { opsMainLocale, T, P } from '../main-i18n'
import { EASE, effectiveReduced, loadMotion, MOTION, systemPrefersReduced } from '../motion/motion'
import { opsTimezone } from '../motion/tz'
import { Sigil } from '../primitives/sigil'
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
import { CopyLink } from './copy-link'
import { type KanbanAction, NeedsYouQueue, type PolicyNeed } from './needs-you'
import { activityRow, focusNeedsYouRow, toastsFromPending } from './office-toasts'
import { layoutOrrery, ORRERY_CAP, spreadOrbs } from './orrery'
import { DEFAULT_THRESHOLDS, type OfficeThresholds, useOfficeThresholds } from './thresholds'

export type OfficeLayout = 'orrery' | 'table'

export interface OfficeViewProps {
  fleet: FleetResponse | null
  /** SPEC v2.1 4a: Ops timezone; default = Settings › Timezone (else host). */
  timezone?: string
  fleetError?: unknown
  nowS: number
  pending: ApprovalItem[] | null
  usage: UsageToday | null
  /** X10: per-profile tokens today; null entry = that profile did not answer. */
  usageByProfile?: Record<string, UsageToday | null> | null
  cron: CronJobLite[] | null
  inFlight: KanbanTask[] | null
  activity: Record<string, unknown>[] | null
  /** P7 F1 (O7): live task_events from the kanban stream, newest first; null = no stream. */
  taskEvents?: KanbanEvent[] | null
  /** X7/X11: override the resolved motion (tests, host). */
  reducedMotion?: boolean
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
  /** Stuck / Overdue thresholds; default = Ops settings (useOfficeThresholds). */
  thresholds?: OfficeThresholds
}

const unknown = 'unknown'
const num = (v: number | null | undefined) => (typeof v === 'number' ? v.toLocaleString('en-US') : unknown)

/** B11: why a profile reads unknown; approvals for other profiles live in their own process. */
const UNKNOWN_WHY = 'Not observable from here: their approvals live in another process.'

const PRESENCE_LABEL: Record<Presence, string> = {
  working: 'Working',
  needs_you: 'Needs you',
  blocked: 'Blocked',
  idle: 'Idle',
  offline: 'Offline',
  unknown: 'Unknown',
  stale: 'Stale'
}

/** B12 (Gr8r): a calm greeting with today's date in the Ops time zone. */
export function greetingFor(hour: number): string {
  return hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 19 ? 'Good afternoon' : 'Good evening'
}

function Greeting() {
  const tz = opsTimezone()
  const now = new Date()
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(now))
  const date = new Intl.DateTimeFormat(opsMainLocale(), { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz }).format(now)

  return (
    <header data-ops-greeting="">
      <h2>{T(greetingFor(hour))}</h2>
      <p>
        {date} · {T("Here's what's happening across your agents.")}
      </p>
    </header>
  )
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
      <span data-ops-count="profiles">{fleet.profiles.length} {T("profiles")}</span>
      {(Object.keys(PRESENCE_LABEL) as Presence[])
        .filter(k => counts.get(k))
        .map(k => (
          <span data-ops-count={k} key={k} title={k === 'unknown' ? UNKNOWN_WHY : undefined}>
            {T(PRESENCE_LABEL[k])} {counts.get(k)}
          </span>
        ))}
      {error ? <span data-ops-warn="">{T("refresh failed, showing last snapshot")}</span> : null}
    </div>
  )
}

/** R1: cron runs in the next 24 h and overdue work (a running task whose heartbeat is stale). */
export function todayCounts(cron: CronJobLite[] | null, inFlight: KanbanTask[] | null, nowS: number, th: OfficeThresholds = DEFAULT_THRESHOLDS) {
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

        return typeof hb === 'number' && nowS - hb > th.staleHeartbeatS
      }).length
    : null

  return { next24, overdue, running: inFlight ? inFlight.length : null }
}

function TodayStrip({ cron, inFlight, nowS, th }: { cron: CronJobLite[] | null; inFlight: KanbanTask[] | null; nowS: number; th: OfficeThresholds }) {
  const c = todayCounts(cron, inFlight, nowS, th)
  const n = (v: number | null) => (v === null ? unknown : String(v))

  return (
    <div aria-label={T("Today strip")} data-ops-strip="today">
      <span data-ops-count="cron-24h">{T("Cron next 24 h")}{' '}{n(c.next24)}</span>
      <span data-ops-count="running">{T("Running")}{' '}{n(c.running)}</span>
      <span data-ops-alarm={Number(c.overdue) > 0 ? '' : undefined} data-ops-count="overdue">{T("Overdue")}{' '}{n(c.overdue)}</span>
    </div>
  )
}

function CronStrip({ cron, onOpenCron }: { cron: CronJobLite[] | null; onOpenCron?: (id: string) => void }) {
  if (!cron) {
    return <div data-ops-strip="cron">{T("Cron")}{' '}{unknown}</div>
  }

  const failing = cron.filter(j => (j.failure_streak ?? 0) > 0)
  const enabled = cron.filter(j => j.enabled !== false)

  return (
    <div data-ops-strip="cron">
      <span data-ops-count="cron-enabled">{enabled.length} {T("cron jobs")}</span>
      <span data-ops-alarm={failing.length ? '' : undefined} data-ops-count="cron-failing">{P(failing.length, '{n} failing')}</span>
      {failing.slice(0, 3).map(j => (
        <button data-ops-cron-failure={j.id} disabled={!onOpenCron} key={j.id} onClick={() => onOpenCron?.(j.id)} type="button">
          {j.name || j.id} ({j.failure_streak})
        </button>
      ))}
    </div>
  )
}

/** X7 (P8 b6): a handoff (assigned/reassigned with both ends known) younger than this draws an orrery arc. */
export const HANDOFF_ARC_WINDOW_S = 10

export function handoffArcs(events: KanbanEvent[] | null | undefined, nowS: number): { id: number; from: string; to: string }[] {
  const out: { id: number; from: string; to: string }[] = []

  for (const e of events ?? []) {
    const p = (e.payload ?? {}) as { from?: unknown; assignee?: unknown }

    if ((e.kind === 'assigned' || e.kind === 'reassigned') && typeof p.from === 'string' && p.from && typeof p.assignee === 'string' && p.assignee && p.from !== p.assignee && nowS - e.created_at <= HANDOFF_ARC_WINDOW_S) {
      out.push({ id: e.id, from: p.from, to: p.assignee })
    }
  }

  return out
}

function Orrery({
  fleet,
  nowS,
  onOpenProfile,
  onLayout,
  events,
  reduced
}: {
  fleet: FleetResponse
  nowS: number
  /** X7: recent task events (handoff arcs). */
  events?: KanbanEvent[] | null
  /** X7/X11: resolved reduced motion; arcs, drift and halos are off. */
  reduced?: boolean
  onOpenProfile?: (p: string) => void
  onLayout?: (l: OfficeLayout) => void
}) {
  const laid = layoutOrrery(fleet.profiles, p => shownPresence(p, nowS))
  const { overflow } = laid
  // B11: labels never overlap (ellipse + relaxation); the centre stays put.
  const [centre, ...orbs] = spreadOrbs([laid.centre, ...laid.orbs])
  // X11: drift and halos only while a run is live (A1 active_runs), never under reduced motion.
  const live = new Set(fleet.profiles.filter(p => (p.active_runs?.length ?? 0) > 0).map(p => p.profile))
  const moving = !reduced && live.size > 0
  const at = new Map([centre, ...orbs].map(o => [o.profile, o]))
  const arcs = reduced ? [] : handoffArcs(events, nowS).filter(a => at.has(a.from) && at.has(a.to))

  const orb = (o: { profile: string; presence: Presence; ring: number; x: number; y: number }) => (
    <Tip label={o.presence === 'unknown' ? `${o.profile}: ${UNKNOWN_WHY}` : undefined} key={o.profile}><button
      aria-label={`${o.profile}: ${T(PRESENCE_LABEL[o.presence])}`}
      data-ops-halo={moving && live.has(o.profile) ? '' : undefined}
      data-ops-orb={o.profile}
      data-ops-presence={o.presence}
      data-ops-ring={o.ring}
      data-ops-thinking={live.has(o.profile) && !reduced ? '' : undefined}
      onClick={() => onOpenProfile?.(o.profile)}
      style={{ position: 'absolute', left: `calc(50% + ${o.x}px)`, top: `calc(50% + ${o.y}px)`, transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap' }}
      type="button"
    >
      <Sigil name={o.profile} size={o.ring === 0 ? 26 : 16} />
      <span data-ops-orb-label="">{o.profile}</span>
    </button></Tip>
  )

  return (
    <div aria-label={T("Orrery")} data-ops-drift={moving ? '' : undefined} data-ops-orrery="" data-ops-reduced={reduced ? '' : undefined} role="group" style={{ position: 'relative', minHeight: 240 }}>
      {arcs.length ? (
        <svg aria-hidden data-ops-handoff-arcs="" style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} viewBox="-200 -120 400 240">
          {arcs.map(a => {
            const p = at.get(a.from)!
            const q = at.get(a.to)!
            const mx = (p.x + q.x) / 2
            const my = (p.y + q.y) / 2 - Math.max(24, Math.hypot(q.x - p.x, q.y - p.y) / 3)

            return (
              <path
                d={`M ${p.x} ${p.y} Q ${mx} ${my} ${q.x} ${q.y}`}
                data-ops-handoff-arc={`${a.from}->${a.to}`}
                data-ops-ms={MOTION.view}
                fill="none"
                key={a.id}
                stroke="var(--ops-gold, #c9a227)"
                style={{ animation: `ops-arc ${MOTION.view}ms ${EASE} both` }}
              />
            )
          })}
        </svg>
      ) : null}
      <div data-ops-orrery-centre={centre.profile}>{orb(centre)}</div>
      {orbs.map(orb)}
      {overflow.length ? (
        <button data-ops-orrery-overflow={overflow.length} onClick={() => onLayout?.('table')} type="button">
          +{overflow.length} {T("more (cap")}{' '}{ORRERY_CAP})
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
          <th scope="col">{T("Profile")}</th>
          <th scope="col">{T("Presence")}</th>
          <th scope="col">{T("Observed")}</th>
          <th scope="col">{T("Runs")}</th>
          <th scope="col">
            <span className="sr-only">{T("Link")}</span>
          </th>
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
            <td>{T(PRESENCE_LABEL[shownPresence(p, nowS)])}</td>
            <td>{typeof p.observed_at === 'number' ? `${Math.max(0, Math.round(nowS - p.observed_at))} s ago` : unknown}</td>
            <td>
              {p.active_runs
                ? p.active_runs.length
                  ? p.active_runs.map(r => (
                      <span key={String(r.id)}>
                        <button data-ops-open-run={String(r.id)} disabled={!onOpenRun} onClick={() => onOpenRun?.(String(r.id))} type="button">
                          #{String(r.id)}
                        </button>
                        <CopyLink id={String(r.id)} kind="run" label={`run ${String(r.id)}`} />
                      </span>
                    ))
                  : 0
                : unknown}
            </td>
          <td data-ops-copy-cell=""><CopyLink id={p.profile} kind="profile" /></td>
</tr>
        ))}
      </tbody>
    </table>
  )
}

export function routingLine(text: string): string {
  if (!text.trim()) {
    return T('Type a task. Start with @profile to assign it, add #project to file it; otherwise it goes to triage.')
  }

  const { assignee, project } = parseDispatch(text)
  const where = project ? ` · project ${project}` : ''

  return assignee ? `Assigned to ${assignee}${where}` : `Unassigned → triage${where}`
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
      aria-label={T("Dispatch")}
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
          setStatus(T('Dispatched'))
        } catch (err) {
          setStatus(T('Dispatch failed: {why}').replace('{why}', err instanceof Error ? err.message : T('request failed')))
        } finally {
          setSending(false)
        }
      }}
    >
      <input
        aria-label={T("Dispatch a task (@assignee title)")}
        onChange={e => setText(e.target.value)}
        placeholder={T("@builder describe the task")}
        ref={inputRef}
        value={text}
      />
      <button data-ops-write="" disabled={sending || !text.trim()} type="submit">
        {T("Dispatch")}</button>
      <kbd>{T("Enter")}</kbd>
      <span data-ops-routing="">{routingLine(text)}</span>
      {blueprints && blueprints.length ? (
        <div aria-label={T("Blueprints")} data-ops-chips="">
          {blueprints.slice(0, 4).map(b => (
            <button data-ops-chip={b.key} disabled={!onOpenRoute} key={b.key} onClick={() => onOpenRoute?.(`/cron?blueprint=${encodeURIComponent(b.key)}`)} type="button">
              {T(b.title)}
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

/** B34: the Office hero. What is running right now, by whom, one click from the task; quiet when nothing is. */
function NowRunning({
  fleet,
  inFlight,
  onOpenProfile,
  onOpenTask
}: {
  fleet: OfficeViewProps['fleet']
  inFlight: OfficeViewProps['inFlight']
  onOpenProfile?: OfficeViewProps['onOpenProfile']
  onOpenTask?: OfficeViewProps['onOpenTask']
}) {
  const working = (fleet?.profiles ?? []).filter(p => String(p.presence) === 'working').map(p => p.profile)
  const running = (inFlight ?? []).slice(0, 3)

  if (inFlight === null && !fleet) {
    return null
  }

  return (
    <section aria-label={T('Now running')} data-ops-now-running={running.length || working.length ? 'live' : inFlight === null ? 'unknown' : 'quiet'}>
      <span aria-hidden data-ops-now-pulse="" />
      <div data-ops-now-body="">
        <span data-ops-now-label="">{T('Now running')}</span>
        {running.length === 0 && working.length === 0 ? (
          <p data-ops-now-quiet="">{inFlight === null ? T('Unknown: task feed not loaded.') : T('Nothing running.')}</p>
        ) : (
          <ul>
            {running.map(t => (
              <li key={t.id}>
                <button disabled={!onOpenTask} onClick={() => onOpenTask?.(t.id)} type="button">
                  {t.title}
                </button>
                {t.assignee ? (
                  <button data-ops-now-agent="" disabled={!onOpenProfile} onClick={() => onOpenProfile?.(t.assignee as string)} type="button">
                    @{t.assignee}
                  </button>
                ) : null}
              </li>
            ))}
            {running.length === 0
              ? working.slice(0, 3).map(name => (
                  <li key={name}>
                    <button data-ops-now-agent="" disabled={!onOpenProfile} onClick={() => onOpenProfile?.(name)} type="button">
                      @{name}
                    </button>
                  </li>
                ))
              : null}
          </ul>
        )}
      </div>
    </section>
  )
}

export function OfficeView(props: OfficeViewProps) {
  const reducedMotion = props.reducedMotion ?? effectiveReduced(loadMotion(), systemPrefersReduced())
  const [localLayout, setLocalLayout] = useState<OfficeLayout>('orrery')
  const [focused, setFocused] = useState<SectionId | null>(null)
  const dispatchInput = useRef<HTMLInputElement | null>(null)
  const layout = props.layout ?? localLayout
  const setLayout = props.onLayout ?? setLocalLayout
  const { fleet, nowS } = props
  const errors = props.errors ?? {}
  const tasks = props.tasks === undefined ? null : props.tasks
  const profile = props.profile ?? null
  const stored = useOfficeThresholds()
  const th = props.thresholds ?? stored

  const stats = officeStats(tasks, props.cron, props.pending, profile, nowS, th, {
    tz: props.timezone ?? opsTimezone(),
    presence: fleet ? fleet.profiles.map(p => ({ profile: p.profile, presence: String(p.presence) })) : null
  })

  const stuck = stuckItems(tasks, props.cron, nowS, th)
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
              {T("New task")}</button>
            <button data-ops-new-profile="" disabled={!props.onNewProfile} onClick={() => props.onNewProfile?.()} type="button">
              {T("New profile")}</button>
          </span>
        )}
      </header>
      <Greeting />
      {/* P6: decisions first; KPIs and strips follow what needs the user. */}
      <span data-ops-needs-you-anchor="" />
      <SectionFrame error={errors.pending} focused={focused === 'needs-you'} heading={false} id="needs-you" loading={props.pending === null} title={T("Needs you")}>
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
      <NowRunning fleet={fleet} inFlight={props.inFlight} onOpenProfile={props.onOpenProfile} onOpenTask={props.onOpenTask} />
      <StatCards onFocus={focus} profile={profile} stats={stats} />
      <TodayStrip cron={props.cron} inFlight={props.inFlight} nowS={nowS} th={th} />
      <HealthStrip error={props.fleetError} fleet={fleet} nowS={nowS} />
      <CronStrip cron={props.cron} onOpenCron={openCron} />
      <div aria-label={T("Fleet layout")} role="tablist">
        {(['orrery', 'table'] as const).map(l => (
          <button aria-selected={layout === l} data-ops-layout={l} key={l} onClick={() => setLayout(l)} role="tab" type="button">
            {l === 'orrery' ? T('Orrery') : T('Table')}
          </button>
        ))}
      </div>
      {fleet ? (
        layout === 'orrery' ? (
          <Orrery events={props.taskEvents} fleet={fleet} nowS={nowS} onLayout={setLayout} onOpenProfile={props.onOpenProfile} reduced={reducedMotion} />
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
      <SectionFrame count={stuck?.length} error={errors.board ?? errors.cron} focused={focused === 'stuck'} id="stuck" loading={stuck === null} title={T("Stuck")}>
        {stuck ? <StuckList items={stuck} onOpenCron={openCron} onOpenTask={props.onOpenTask} /> : null}
      </SectionFrame>
      {profile ? (
        <SectionFrame error={errors.board} focused={focused === 'queue'} id="queue" loading={boardLoading} title={`My queue · ${profile}`}>
          {tasks ? <MyQueue nowS={nowS} onOpenTask={props.onOpenTask} profile={profile} tasks={tasks} th={th} /> : null}
        </SectionFrame>
      ) : null}
      <SectionFrame error={errors.board} focused={focused === 'in-flight'} id="in-flight" loading={props.inFlight === null} title={T("In flight")}>
        {props.inFlight && props.inFlight.length === 0 ? (
          <p data-ops-empty="in-flight">{T("Nothing running.")}</p>
        ) : (
          <ul>
            {(props.inFlight ?? []).map(t => (
              <li data-ops-in-flight-task={t.id} key={t.id}>
                <button disabled={!props.onOpenTask} onClick={() => props.onOpenTask?.(t.id)} type="button">
                  {t.title}
                </button>{' '}
                {t.assignee ? `@${t.assignee}` : ''}
              <CopyLink id={t.id} kind="task" label={t.title} />
</li>
            ))}
          </ul>
        )}
      </SectionFrame>
      <SectionFrame count={delivered?.length} error={errors.board} focused={focused === 'delivered'} id="delivered" loading={delivered === null} title={T("Delivered today")}>
        {delivered ? (
          <DeliveredList attachments={props.attachments ?? {}} nowS={nowS} onOpenAttachment={props.onOpenAttachment} onOpenTask={props.onOpenTask} tasks={delivered} />
        ) : null}
      </SectionFrame>
      {props.projects !== undefined ? (
        <SectionFrame error={errors.projects ?? errors.board} focused={focused === 'projects'} id="projects" loading={projects === null} title={T("Project progress")}>
          {projects ? <ProjectTable nowS={nowS} onOpenProject={props.onOpenRoute ? id => props.onOpenRoute?.(`/kanban?project=${encodeURIComponent(id)}`) : undefined} rows={projects} /> : null}
        </SectionFrame>
      ) : null}
      <SectionFrame error={errors.usage} id="cost" loading={props.usage === null} title={T("Today")}>
        <span data-ops-tokens="input">{T("Input tokens")}{' '}{num(props.usage?.input_tokens)}</span>
        <span data-ops-tokens="output">{T("Output tokens")}{' '}{num(props.usage?.output_tokens)}</span>
        {props.usageByProfile && Object.keys(props.usageByProfile).length ? (
          <table aria-label={T("Tokens today per profile")} data-ops-usage-profiles="">
            <thead>
              <tr>
                <th scope="col">{T("Profile")}</th>
                <th scope="col">{T("Input")}</th>
                <th scope="col">{T("Output")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(props.usageByProfile)
                .sort(([, a], [, b]) => (b?.input_tokens ?? -1) + (b?.output_tokens ?? 0) - ((a?.input_tokens ?? -1) + (a?.output_tokens ?? 0)))
                .map(([name, u]) => (
                  <tr data-ops-usage-profile={name} key={name}>
                    <th scope="row">{name}</th>
                    <td>{typeof u?.input_tokens === 'number' ? u.input_tokens.toLocaleString('en-US') : '—'}</td>
                    <td>{typeof u?.output_tokens === 'number' ? u.output_tokens.toLocaleString('en-US') : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : null}
        {/* X10: provenance always shown; no money figure (no price is configured in Hermes). */}
        <small data-ops-usage-provenance="">{T('source:')} {props.usage?.provenance ?? '/api/ops/usage/today'} {T("· no $ (no price configured)")}</small>
      </SectionFrame>
      <SectionFrame error={errors.activity} id="activity" loading={props.activity === null && !props.taskEvents?.length} title={T("Activity")}>
        {props.taskEvents && props.taskEvents.length ? (
          <ul aria-label={T("Task events")} data-ops-task-events="">
            {props.taskEvents.slice(0, 20).map(e => {
              const d = describeEvent(e)

              return (
                <li data-ops-handoff={d.handoff ? '' : undefined} data-ops-task-event={e.id} key={e.id}>
                  <button disabled={!props.onOpenTask} onClick={() => props.onOpenTask?.(e.task_id)} type="button">
                    {e.task_id}
                  </button>{' '}
                  {d.verb} {d.target} <time>{localTime(e.created_at)}</time>
                <CopyLink id={e.task_id} kind="task" />
</li>
              )
            })}
          </ul>
        ) : null}
        {props.activity === null ? null : props.activity.length === 0 && !props.taskEvents?.length ? (
          <p data-ops-empty="activity">{T("No activity yet today.")}</p>
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
