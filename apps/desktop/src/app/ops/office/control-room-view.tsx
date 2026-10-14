/**
 * Office control room sections (ops-panel P8 batch 2). Each section owns its own state:
 * loading (no answer yet), unavailable (the server's reason), empty (honest copy) or rows.
 * A refresh failure keeps the last rows and says so; nothing is ever shown as a healthy 0.
 */

import { type ReactNode, useState } from 'react'

import {
  type AttachmentLite,
  type BoardTask,
  fmtAge,
  fmtBytes,
  myQueue,
  newestAttachment,
  type OfficeStats,
  type ProjectProgress,
  type QueueTab,
  sigil,
  type StuckItem
} from './control-room'
import { CopyLink } from './copy-link'
import type { OfficeThresholds } from './thresholds'
import { T } from '../main-i18n'

export type SectionId = 'stats' | 'needs-you' | 'stuck' | 'queue' | 'projects' | 'in-flight' | 'delivered' | 'activity' | 'cost' | 'fleet'

const why = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : e ? 'request failed' : '')

/** X1: one stateful frame per section. `value === null` and no error = still loading. */
export function SectionFrame({
  id,
  title,
  count,
  error,
  loading,
  focused,
  children,
  actions,
  heading = true
}: {
  id: SectionId
  title: string
  count?: number | null
  error?: unknown
  loading: boolean
  focused?: boolean
  children?: ReactNode
  actions?: ReactNode
  /** false when the child renders its own heading (Needs you). */
  heading?: boolean
}) {
  const state = loading ? (error ? 'unavailable' : 'loading') : error ? 'stale' : 'ok'

  return (
    <section aria-label={title} data-ops-focused={focused ? '' : undefined} data-ops-section={id} data-ops-state={state} id={`ops-office-${id}`} tabIndex={-1}>
      {heading ? (
      <h3>
        {title}
        {typeof count === 'number' ? <span data-ops-section-count=""> ({count})</span> : null}
        {actions}
      </h3>
      ) : null}
      {state === 'loading' ? (
        <p data-ops-loading="">{T("Loading…")}</p>
      ) : state === 'unavailable' ? (
        <p data-ops-unavailable="" role="status">
          {title} unavailable: {why(error)}
        </p>
      ) : (
        <>
          {state === 'stale' ? (
            <p data-ops-warn="" role="status">
              {T("Refresh failed (")}{why(error)}{T("); showing the last answer.")}</p>
          ) : null}
          {children}
        </>
      )}
    </section>
  )
}

/* ---------------------------------- R63 stat cards ---------------------------------- */

export function StatCards({ stats, profile, onFocus }: { stats: OfficeStats; profile: string | null; onFocus: (s: SectionId) => void }) {
  const v = (x: number | null) => (x === null ? 'unknown' : String(x))

  const card = (key: string, label: string, value: number | null, sub: string | null, target: SectionId, alarm = false, hint = '') => (
    <button
      aria-label={`${label}: ${v(value)}${sub ? `, ${sub}` : ''}. Show ${target.replace('-', ' ')}`}
      data-ops-alarm={alarm && (value ?? 0) > 0 ? 'garnet' : undefined}
      data-ops-stat={key}
      key={key}
      onClick={() => onFocus(target)}
      title={hint}
      type="button"
    >
      <strong data-ops-stat-value="">{v(value)}</strong>
      <span>{label}</span>
      {sub ? <small data-ops-stat-sub="">{sub}</small> : null}
    </button>
  )

  return (
    <div aria-label={T("Office stats")} data-ops-stats="" role="group">
      {card('working', 'Working agents', stats.working, stats.stuck === null ? null : `${stats.stuck} at risk`, 'stuck', false, 'Profiles working, waiting on you or blocked (fleet presence; running tasks when the fleet is unavailable); at risk = blocked, stale heartbeat, failing runs or failing cron')}
      {card('open', 'Open tasks', stats.open, profile && stats.openMine !== null ? `${stats.openMine} for ${profile}` : null, 'queue', false, 'Every task not done or archived')}
      {card('done-week', 'Done this week', stats.doneWeek, null, 'delivered', false, 'Tasks completed since Monday 00:00 in the Ops timezone (Settings › Timezone)')}
      {card('attention', 'Needs attention', stats.attention, null, 'needs-you', true, 'Decisions waiting on you plus stuck items, each counted once')}
    </div>
  )
}

/* -------------------------------------- X2 stuck ------------------------------------- */

const REASON: Record<StuckItem['reason'], string> = {
  failing: 'Failing',
  stale_heartbeat: 'Stale heartbeat',
  blocked: 'Blocked',
  cron_failing: 'Cron failing'
}

export function StuckList({ items, onOpenTask, onOpenCron }: { items: StuckItem[]; onOpenTask?: (id: string) => void; onOpenCron?: (id: string) => void }) {
  if (!items.length) {
    return <p data-ops-empty="stuck">{T("Nothing is stuck.")}</p>
  }

  return (
    <ul data-ops-stuck="">
      {items.map(s => (
        <li data-ops-stuck-item={s.key} data-ops-stuck-reason={s.reason} key={s.key}>
          <button disabled={s.kind === 'task' ? !onOpenTask : !onOpenCron} onClick={() => (s.kind === 'task' ? onOpenTask?.(s.id) : onOpenCron?.(s.id))} type="button">
            {s.title}
          </button>{' '}
          <span data-ops-field="reason">{REASON[s.reason]}</span> <span data-ops-field="detail">{s.detail}</span>{' '}
          <span data-ops-field="age">{s.ageS === null ? 'age unknown' : `for ${fmtAge(s.ageS)}`}</span>
          {s.profile ? <span data-ops-field="profile"> @{s.profile}</span> : null}
        {s.kind === 'task' ? <CopyLink id={s.id} kind="task" /> : <CopyLink id={s.id} kind="cron" />}
</li>
      ))}
    </ul>
  )
}

/* ------------------------------------ R64 my queue ----------------------------------- */

export function MyQueue({ tasks, profile, nowS, th, onOpenTask }: { tasks: BoardTask[]; profile: string; nowS: number; th?: OfficeThresholds; onOpenTask?: (id: string) => void }) {
  const q = myQueue(tasks, profile, nowS, th)!
  // Open where the work is: overdue first when there is any.
  const [tab, setTab] = useState<QueueTab>(() => (q.overdue.length ? 'overdue' : 'upcoming'))
  const rows = q[tab]
  const LABEL: Record<QueueTab, string> = { upcoming: 'Upcoming', overdue: 'Overdue', completed: 'Completed' }

  return (
    <div data-ops-queue={profile}>
      <div aria-label={T("Queue")} role="tablist">
        {(['upcoming', 'overdue', 'completed'] as const).map(t => (
          <button aria-selected={tab === t} data-ops-queue-tab={t} key={t} onClick={() => setTab(t)} role="tab" type="button">
            {LABEL[t]} <span data-ops-queue-count={t}>{q[t].length}</span>
          </button>
        ))}
      </div>
      {q.upcoming.length + q.overdue.length === 0 && tab !== 'completed' ? (
        <p data-ops-empty="queue">{T("You're all caught up.")}</p>
      ) : rows.length === 0 ? (
        <p data-ops-empty={`queue-${tab}`}>{T("Nothing")}{' '}{LABEL[tab].toLowerCase()}.</p>
      ) : (
        <ul role="tabpanel">
          {rows.map(r => (
            <li data-ops-queue-row={r.task.id} key={r.task.id}>
              <button disabled={!onOpenTask} onClick={() => onOpenTask?.(r.task.id)} type="button">
                {r.task.title}
              </button>{' '}
              <span data-ops-field="status">{r.task.status}</span>
              {r.why ? <span data-ops-field="why"> {r.why}</span> : null}
            <CopyLink id={r.task.id} kind="task" label={r.task.title} />
</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* -------------------------------- R65 project progress ------------------------------- */

export function ProjectTable({ rows, nowS, onOpenProject }: { rows: ProjectProgress[]; nowS: number; onOpenProject?: (id: string) => void }) {
  if (!rows.length) {
    return <p data-ops-empty="projects">{T("No projects yet. Group tasks into a project from the Board.")}</p>
  }

  return (
    <table data-ops-project-table="">
      <thead>
        <tr>
          <th scope="col">{T("Project")}</th>
          <th scope="col">{T("Status")}</th>
          <th scope="col">{T("Progress")}</th>
          <th scope="col">{T("Team")}</th>
          <th scope="col">{T("Updated")}</th>
          <th scope="col">
            <span className="sr-only">{T("Link")}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(p => (
          <tr data-ops-project-row={p.id} key={p.id}>
            <td>
              <button disabled={!onOpenProject} onClick={() => onOpenProject?.(p.id)} type="button">
                {p.name}
              </button>
            </td>
            <td data-ops-project-status={p.status}>{p.status}</td>
            <td>
              <span data-ops-field="progress">
                {p.done}/{p.total} ({p.pct}%)
              </span>
              <meter aria-label={`${p.name} progress`} max={100} min={0} value={p.pct} />
            </td>
            <td>
              {p.team.length
                ? p.team.slice(0, 4).map(m => (
                    <abbr data-ops-sigil={m} key={m} title={m}>
                      {sigil(m)}
                    </abbr>
                  ))
                : 'no one assigned'}
              {p.team.length > 4 ? <span> +{p.team.length - 4}</span> : null}
            </td>
            <td>{p.updatedAt === null ? 'unknown' : `${fmtAge(nowS - p.updatedAt)} ago`}</td>
          <td data-ops-copy-cell=""><CopyLink id={p.id} kind="project" label={p.name ?? p.id} /></td>
</tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---------------------------------- X4 / X8 delivered -------------------------------- */

export function DeliveredList({
  tasks,
  attachments,
  nowS,
  onOpenTask,
  onOpenAttachment
}: {
  tasks: BoardTask[]
  /** task id → attachments; undefined = still loading for that task, null = unavailable. */
  attachments: Record<string, AttachmentLite[] | null | undefined>
  nowS: number
  onOpenTask?: (id: string) => void
  onOpenAttachment?: (taskId: string, a: AttachmentLite) => void
}) {
  if (!tasks.length) {
    return <p data-ops-empty="delivered">{T("Nothing delivered in the last 24 h.")}</p>
  }

  return (
    <ol data-ops-delivered="">
      {tasks.map(t => {
        const files = attachments[t.id]
        const top = newestAttachment(files)

        return (
          <li data-ops-delivered-task={t.id} key={t.id}>
            <button disabled={!onOpenTask} onClick={() => onOpenTask?.(t.id)} type="button">
              {t.title}
            </button>{' '}
            {t.assignee ? <span>@{t.assignee}</span> : null}{' '}
            <time>{typeof t.completed_at === 'number' ? `${fmtAge(nowS - t.completed_at)} ago` : 'unknown'}</time>
            {t.latest_summary ? <p data-ops-field="summary">{t.latest_summary}</p> : null}
            {top ? (
              <button data-ops-open-output={top.id} disabled={!onOpenAttachment} onClick={() => onOpenAttachment?.(t.id, top)} type="button">
                {T("Open")}{' '}{top.filename} ({fmtBytes(top.size)}){files && files.length > 1 ? ` +${files.length - 1} more` : ''}
              </button>
            ) : files === undefined ? (
              <span data-ops-loading="">{T("outputs loading")}</span>
            ) : files === null ? (
              <span data-ops-unavailable="">{T("outputs unavailable")}</span>
            ) : (
              <span data-ops-field="no-output">{T("no files attached")}</span>
            )}
          <CopyLink id={t.id} kind="task" label={t.title} />
</li>
        )
      })}
    </ol>
  )
}
