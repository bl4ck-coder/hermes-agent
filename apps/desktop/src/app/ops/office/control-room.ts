/**
 * Office control room derivations (ops-panel P8 batch 2: R63-R65, X2, X8). Pure functions over the
 * kanban board rows, cron jobs and pending approvals. Every figure is computed from backend rows;
 * a missing source yields null ("unknown"), never 0.
 */

import type { ApprovalItem, CronJobLite, KanbanTask } from '../feed/ops-client'

/** Board rows carry more than the Ops client type names (plugin_api._task_dict). */
export type BoardTask = KanbanTask & {
  priority?: number | null
  created_at?: number | null
  started_at?: number | null
  completed_at?: number | null
  last_heartbeat_at?: number | null
  consecutive_failures?: number | null
  last_failure_error?: string | null
  block_kind?: string | null
  project_id?: string | null
  latest_summary?: string | null
  progress?: { done: number; total: number } | null
}

export const STALE_HEARTBEAT_S = 600
export const REVIEW_OVERDUE_S = 86_400
export const DAY_S = 86_400
export const WEEK_S = 7 * DAY_S

const OPEN = new Set(['triage', 'todo', 'scheduled', 'ready', 'running', 'blocked', 'review'])

export const isOpen = (t: BoardTask) => OPEN.has(t.status)
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Newest moment we know the task moved. */
export function touchedAt(t: BoardTask): number | null {
  const xs = [n(t.completed_at), n(t.last_heartbeat_at), n(t.current_run_started_at), n(t.started_at), n(t.created_at)].filter((x): x is number => x !== null)

  return xs.length ? Math.max(...xs) : null
}

/* ---------------------------------- Stuck (X2) ---------------------------------- */

export type StuckReason = 'blocked' | 'stale_heartbeat' | 'failing' | 'cron_failing'

export interface StuckItem {
  key: string
  kind: 'task' | 'cron'
  id: string
  title: string
  profile: string | null
  reason: StuckReason
  /** Human reason, with the server's own words when it gave any. */
  detail: string
  /** Seconds since the moment that made it stuck; null = unknown. */
  ageS: number | null
  /** Higher first: failing > stale > blocked > cron. */
  severity: number
}

export function stuckItems(tasks: BoardTask[] | null, cron: CronJobLite[] | null, nowS: number): StuckItem[] | null {
  if (!tasks && !cron) {
    return null
  }

  const out: StuckItem[] = []

  for (const t of tasks ?? []) {
    const hb = n(t.last_heartbeat_at)
    const fails = n(t.consecutive_failures) ?? 0
    const base = { kind: 'task' as const, id: t.id, title: t.title, profile: t.assignee ?? null }

    if (fails > 0 && t.status !== 'done') {
      out.push({ ...base, key: `task:${t.id}`, reason: 'failing', detail: `${fails} failed run(s)${t.last_failure_error ? `: ${t.last_failure_error}` : ''}`, ageS: ageOf(touchedAt(t), nowS), severity: 3 })
    } else if (t.status === 'running' && hb !== null && nowS - hb > STALE_HEARTBEAT_S) {
      out.push({ ...base, key: `task:${t.id}`, reason: 'stale_heartbeat', detail: `no heartbeat for ${fmtAge(nowS - hb)}`, ageS: nowS - hb, severity: 2 })
    } else if (t.status === 'blocked') {
      out.push({ ...base, key: `task:${t.id}`, reason: 'blocked', detail: t.block_kind ? `blocked (${t.block_kind})` : 'blocked', ageS: ageOf(touchedAt(t), nowS), severity: 1 })
    }
  }

  for (const j of cron ?? []) {
    const s = n(j.failure_streak) ?? 0

    if (s > 0) {
      out.push({
        key: `cron:${j.id}`,
        kind: 'cron',
        id: j.id,
        title: j.name || j.id,
        profile: j.profile ?? null,
        reason: 'cron_failing',
        detail: `${s} failure(s) in a row${j.last_status ? `, last: ${j.last_status}` : ''}`,
        ageS: null,
        severity: 0
      })
    }
  }

  return out.sort((a, b) => b.severity - a.severity || (b.ageS ?? -1) - (a.ageS ?? -1))
}

const ageOf = (t: number | null, nowS: number) => (t === null ? null : Math.max(0, nowS - t))

export function fmtAge(s: number | null | undefined): string {
  if (typeof s !== 'number') {
    return 'unknown'
  }

  return s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : s < DAY_S ? `${Math.round(s / 3600)} h` : `${Math.round(s / DAY_S)} d`
}

/* -------------------------------- Stat cards (R63) ------------------------------- */

export interface OfficeStats {
  working: number | null
  stuck: number | null
  open: number | null
  openMine: number | null
  doneWeek: number | null
  attention: number | null
}

export function officeStats(
  tasks: BoardTask[] | null,
  cron: CronJobLite[] | null,
  pending: ApprovalItem[] | null,
  profile: string | null,
  nowS: number
): OfficeStats {
  const stuck = stuckItems(tasks, cron, nowS)

  return {
    working: tasks ? tasks.filter(t => t.status === 'running').length : null,
    stuck: stuck ? stuck.length : null,
    open: tasks ? tasks.filter(isOpen).length : null,
    openMine: tasks && profile ? tasks.filter(t => isOpen(t) && t.assignee === profile).length : null,
    doneWeek: tasks ? tasks.filter(t => t.status === 'done' && (n(t.completed_at) ?? -Infinity) >= nowS - WEEK_S).length : null,
    // Needs attention = every decision waiting on a human + every stuck item, without double counting
    // kanban review/blocked rows that appear in both lists.
    attention:
      pending && stuck
        ? new Set([
            ...pending.map(p => (p.origin === 'kanban_blocked' || p.origin === 'kanban_review' ? `task:${p.id}` : `${p.origin}:${p.id}`)),
            ...stuck.map(s => s.key)
          ]).size
        : null
  }
}

/* --------------------------------- My queue (R64) -------------------------------- */

export type QueueTab = 'upcoming' | 'overdue' | 'completed'

export interface QueueRow {
  task: BoardTask
  /** Why it is overdue (only on the overdue tab). */
  why?: string
}

export function myQueue(tasks: BoardTask[] | null, profile: string | null, nowS: number): Record<QueueTab, QueueRow[]> | null {
  if (!tasks || !profile) {
    return null
  }

  const mine = tasks.filter(t => t.assignee === profile)
  const upcoming: QueueRow[] = []
  const overdue: QueueRow[] = []
  const completed: QueueRow[] = []

  for (const t of mine) {
    const hb = n(t.last_heartbeat_at)
    const since = touchedAt(t)

    if (t.status === 'done') {
      if ((n(t.completed_at) ?? -Infinity) >= nowS - WEEK_S) {
        completed.push({ task: t })
      }
    } else if (t.status === 'running' && hb !== null && nowS - hb > STALE_HEARTBEAT_S) {
      overdue.push({ task: t, why: `heartbeat ${fmtAge(nowS - hb)} old` })
    } else if (t.status === 'review' && since !== null && nowS - since > REVIEW_OVERDUE_S) {
      overdue.push({ task: t, why: `in review for ${fmtAge(nowS - since)}` })
    } else if (isOpen(t)) {
      upcoming.push({ task: t })
    }
  }

  // Upcoming: what will run next first (priority, then oldest); completed: newest first.
  upcoming.sort((a, b) => (n(b.task.priority) ?? 0) - (n(a.task.priority) ?? 0) || (n(a.task.created_at) ?? 0) - (n(b.task.created_at) ?? 0))
  completed.sort((a, b) => (n(b.task.completed_at) ?? 0) - (n(a.task.completed_at) ?? 0))

  return { upcoming, overdue, completed }
}

/* ----------------------------- Project progress (R65) ---------------------------- */

export interface ProjectProgress {
  id: string
  name: string
  total: number
  done: number
  pct: number
  /** Derived status: blocked if any task is blocked, active if anything runs, done at 100 %, else planned. */
  status: 'blocked' | 'active' | 'done' | 'planned' | 'empty'
  team: string[]
  updatedAt: number | null
}

export function projectProgress(projects: { id: string; name: string }[] | null, tasks: BoardTask[] | null): ProjectProgress[] | null {
  if (!projects || !tasks) {
    return null
  }

  return projects
    .map(p => {
      const mine = tasks.filter(t => t.project_id === p.id)
      const done = mine.filter(t => t.status === 'done').length
      const team = [...new Set(mine.map(t => t.assignee).filter((a): a is string => Boolean(a)))].sort()
      const times = mine.map(touchedAt).filter((x): x is number => x !== null)

      const status: ProjectProgress['status'] = !mine.length
        ? 'empty'
        : mine.some(t => t.status === 'blocked')
          ? 'blocked'
          : done === mine.length
            ? 'done'
            : mine.some(t => t.status === 'running' || t.status === 'review')
              ? 'active'
              : 'planned'

      return { id: p.id, name: p.name, total: mine.length, done, pct: mine.length ? Math.round((done / mine.length) * 100) : 0, status, team, updatedAt: times.length ? Math.max(...times) : null }
    })
    .sort((a, b) => (b.updatedAt ?? -1) - (a.updatedAt ?? -1))
}

/** Two-letter sigil for a profile name (team avatars). */
export const sigil = (name: string) =>
  (name.split(/[-_\s]+/).filter(Boolean).length > 1 ? name.split(/[-_\s]+/).filter(Boolean).slice(0, 2).map(w => w[0]) : [name.slice(0, 2)]).join('').toUpperCase()

/* ------------------------------ Delivered today (X8) ----------------------------- */

export function deliveredToday(tasks: BoardTask[] | null, nowS: number): BoardTask[] | null {
  if (!tasks) {
    return null
  }

  return tasks
    .filter(t => t.status === 'done' && (n(t.completed_at) ?? -Infinity) >= nowS - DAY_S)
    .sort((a, b) => (n(b.completed_at) ?? 0) - (n(a.completed_at) ?? 0))
}

export interface AttachmentLite {
  stored_path?: string | null
  id: string
  filename: string
  size?: number | null
  created_at?: number | null
  content_type?: string | null
}

export const newestAttachment = (xs: AttachmentLite[] | null | undefined) =>
  Array.isArray(xs) && xs.length ? [...xs].sort((a, b) => (n(b.created_at) ?? 0) - (n(a.created_at) ?? 0))[0] : null

export function fmtBytes(b: number | null | undefined): string {
  if (typeof b !== 'number') {
    return 'size unknown'
  }

  return b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`
}

/** Flatten a board payload; malformed → null. */
export function boardTasks(board: { columns?: { name: string; tasks?: unknown[] }[] } | null | undefined): BoardTask[] | null {
  return Array.isArray(board?.columns) ? (board.columns.flatMap(c => (Array.isArray(c.tasks) ? c.tasks : [])) as BoardTask[]) : null
}
