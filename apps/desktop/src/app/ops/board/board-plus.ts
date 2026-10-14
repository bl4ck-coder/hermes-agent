/**
 * Board P8 b3 model (R67 saved views, R68 timeline, R69 grouping/sorting, R71 card signals, R74 favourites).
 * Pure functions plus two tiny localStorage stores. Nothing here invents data: a missing field is "unknown".
 */

import { useSyncExternalStore } from 'react'

import { DEFAULT_THRESHOLDS, type OfficeThresholds } from '../office/thresholds'

import type { BoardFilter, BoardLayout, BoardTask } from './board-model'

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Newest moment the task is known to have moved (board rows carry no updated_at). */
export function touched(t: BoardTask): number | null {
  const xs = [t.completed_at, t.last_heartbeat_at, t.current_run_started_at, t.started_at, t.created_at].map(num).filter((x): x is number => x !== null)

  return xs.length ? Math.max(...xs) : null
}

/* ------------------------------- R69 group + sort ------------------------------ */

export type GroupBy = 'none' | 'status' | 'profile' | 'project' | 'priority'
export type SortBy = 'manual' | 'priority' | 'updated'

export interface TaskGroup {
  key: string
  label: string
  tasks: BoardTask[]
}

export function sortTasks(tasks: BoardTask[], by: SortBy): BoardTask[] {
  if (by === 'manual') {
    return tasks
  }

  const xs = [...tasks]

  return by === 'priority'
    ? xs.sort((a, b) => (num(b.priority) ?? 0) - (num(a.priority) ?? 0))
    : xs.sort((a, b) => (touched(b) ?? -1) - (touched(a) ?? -1))
}

export function groupTasks(tasks: BoardTask[], by: GroupBy, sort: SortBy, statusOrder: string[] = []): TaskGroup[] {
  if (by === 'none') {
    return [{ key: 'all', label: 'All tasks', tasks: sortTasks(tasks, sort) }]
  }

  const keyOf = (t: BoardTask) =>
    by === 'status' ? t.status : by === 'profile' ? t.assignee || '' : by === 'project' ? t.project_id || '' : String(num(t.priority) ?? 0)

  const label = (k: string) =>
    by === 'profile' ? k || 'Unassigned' : by === 'project' ? k || 'No project' : by === 'priority' ? `Priority ${k}` : k

  const m = new Map<string, BoardTask[]>()

  for (const t of tasks) {
    const k = keyOf(t)
    m.set(k, [...(m.get(k) ?? []), t])
  }

  const keys = [...m.keys()]

  keys.sort((a, b) => {
    if (by === 'status') {
      return (statusOrder.indexOf(a) + 1 || 99) - (statusOrder.indexOf(b) + 1 || 99)
    }

    if (by === 'priority') {
      return Number(b) - Number(a)
    }

    // Empty bucket (unassigned / no project) last.
    return (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b)
  })

  return keys.map(k => ({ key: k || '∅', label: label(k), tasks: sortTasks(m.get(k)!, sort) }))
}

/* ------------------------------- R71 card signals ------------------------------ */

export type HeartbeatTone = 'fresh' | 'aging' | 'stale'

/** Only running work has a heartbeat colour; aging = past half the stale window. */
export function heartbeatTone(t: BoardTask, nowS: number, th: OfficeThresholds = DEFAULT_THRESHOLDS): HeartbeatTone | null {
  const hb = num(t.last_heartbeat_at)

  if (t.status !== 'running' || hb === null) {
    return null
  }

  const age = nowS - hb

  return age > th.staleHeartbeatS ? 'stale' : age > th.staleHeartbeatS / 2 ? 'aging' : 'fresh'
}

/** Tag chips = the task's skills (the only tag-like field kanban stores) + tenant. */
export function tagsOf(t: BoardTask): string[] {
  return [...(Array.isArray(t.skills) ? t.skills.filter((s): s is string => typeof s === 'string') : []), ...(t.tenant ? [`#${t.tenant}`] : [])]
}

export function progressOf(t: BoardTask): { done: number; total: number } | null {
  const p = t.progress

  return p && typeof p.total === 'number' && p.total > 0 ? { done: Math.max(0, Math.min(p.total, Number(p.done) || 0)), total: p.total } : null
}

/* ------------------------------ R68 timeline layout ----------------------------- */

export type TimeScale = 'weeks' | 'months'
export const PX_PER_DAY: Record<TimeScale, number> = { weeks: 28, months: 6 }
export const LANE_H = 28
const DAY = 86_400

export interface TimelineBar {
  task: BoardTask
  lane: string
  row: number
  x: number
  w: number
  y: number
  /** No start time known: drawn as a marker at "now", flagged. */
  estimated: boolean
}

export interface TimelineModel {
  start: number
  end: number
  width: number
  height: number
  todayX: number
  lanes: { key: string; label: string; y: number; rows: number }[]
  bars: TimelineBar[]
  curves: { from: string; to: string; d: string }[]
}

export function timelineModel(tasks: BoardTask[], links: [string, string][], nowS: number, scale: TimeScale, groupBy: 'project' | 'profile'): TimelineModel {
  const startOf = (t: BoardTask) => num(t.current_run_started_at) ?? num(t.started_at) ?? num(t.created_at)
  const endOf = (t: BoardTask) => num(t.completed_at) ?? nowS
  const starts = tasks.map(startOf).filter((x): x is number => x !== null)
  const start = Math.floor(((starts.length ? Math.min(...starts) : nowS) - DAY) / DAY) * DAY
  const end = Math.max(nowS + 2 * DAY, ...tasks.map(endOf))
  const px = PX_PER_DAY[scale] / DAY
  const xOf = (s: number) => Math.round((s - start) * px)
  const laneKey = (t: BoardTask) => (groupBy === 'project' ? t.project_id || '' : t.assignee || '')
  const keys = [...new Set(tasks.map(laneKey))].sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b))
  const lanes: TimelineModel['lanes'] = []
  const bars: TimelineBar[] = []
  let y = 0

  for (const k of keys) {
    const mine = tasks.filter(t => laneKey(t) === k).sort((a, b) => (startOf(a) ?? nowS) - (startOf(b) ?? nowS))
    // Pack bars into rows so overlapping work stacks instead of hiding.
    const rowEnds: number[] = []

    for (const t of mine) {
      const s = startOf(t)
      const x = xOf(s ?? nowS)
      const w = Math.max(6, xOf(endOf(t)) - x)
      let row = rowEnds.findIndex(e => e <= x)

      if (row < 0) {
        row = rowEnds.length
        rowEnds.push(0)
      }

      rowEnds[row] = x + w + 4
      bars.push({ task: t, lane: k, row, x, w, y: y + row * LANE_H, estimated: s === null })
    }

    const rows = Math.max(1, rowEnds.length)
    lanes.push({ key: k || '∅', label: groupBy === 'project' ? k || 'No project' : k || 'Unassigned', y, rows })
    y += rows * LANE_H + 8
  }

  const at = new Map(bars.map(b => [b.task.id, b]))

  const curves = links
    .filter(([p, c]) => at.has(p) && at.has(c))
    .map(([p, c]) => {
      const a = at.get(p)!
      const b = at.get(c)!
      const x1 = a.x + a.w
      const y1 = a.y + LANE_H / 2
      const x2 = b.x
      const y2 = b.y + LANE_H / 2
      const dx = Math.max(24, Math.abs(x2 - x1) / 2)

      return { from: p, to: c, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}` }
    })

  return { start, end, width: xOf(end) + 40, height: Math.max(LANE_H, y), todayX: xOf(nowS), lanes, bars, curves }
}

/* ------------------------------- tiny stores ------------------------------- */

function store<T>(key: string, parse: (v: unknown) => T) {
  const listeners = new Set<() => void>()
  let cache: T | null = null

  const get = (): T => {
    if (cache === null) {
      try {
        cache = parse(JSON.parse(globalThis.localStorage?.getItem(key) ?? 'null'))
      } catch {
        cache = parse(null)
      }
    }

    return cache
  }

  const set = (v: T) => {
    cache = v

    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(v))
    } catch {
      // storage blocked: keep for this session
    }

    listeners.forEach(l => l())
  }

  const reset = () => ((cache = null), listeners.forEach(l => l()))
  const use = () => useSyncExternalStore(l => (listeners.add(l), () => listeners.delete(l)), get, get)

  return { get, set, reset, use }
}

/* -------------------------------- R67 saved views ------------------------------- */

export interface SavedView {
  id: string
  name: string
  filter: BoardFilter
  layout: BoardLayout
  groupBy?: GroupBy
  sortBy?: SortBy
}

type ViewMap = Record<string, SavedView[]>

export const viewsStore = store<ViewMap>('hermes.ops.boardViews', v => (v && typeof v === 'object' && !Array.isArray(v) ? (v as ViewMap) : {}))

/** Views belong to a (connection, project) scope; '*' = no project filter. */
export const viewScope = (connection: string | null | undefined, project: string | null | undefined) => `${connection || 'local'}\u0000${project || '*'}`

export function listViews(scope: string): SavedView[] {
  const v = viewsStore.get()[scope]

  return Array.isArray(v) ? v : []
}

export function saveView(scope: string, view: Omit<SavedView, 'id'>): SavedView {
  const all = viewsStore.get()
  const list = listViews(scope)
  const same = list.find(v => v.name.toLowerCase() === view.name.toLowerCase())
  // Same name replaces (so "Save" on an open view updates it); ids stay stable.
  const saved: SavedView = { ...view, filter: { ...view.filter }, id: same?.id ?? `v${Date.now().toString(36)}${list.length}` }
  viewsStore.set({ ...all, [scope]: same ? list.map(v => (v.id === same.id ? saved : v)) : [...list, saved] })

  return saved
}

export function removeView(scope: string, id: string) {
  const all = viewsStore.get()
  viewsStore.set({ ...all, [scope]: listViews(scope).filter(v => v.id !== id) })
}

/* -------------------------------- R74 favourites -------------------------------- */

export type FavKind = 'task' | 'profile' | 'project' | 'run'

export interface Favourite {
  kind: FavKind
  id: string
  label: string
  at: number
}

const LEGACY_PROJECT_FAVS = 'hermes.ops.projectFavs'

export const favStore = store<Favourite[]>('hermes.ops.favourites', v => {
  const list = Array.isArray(v) ? (v as Favourite[]).filter(f => f && typeof f.id === 'string' && ['task', 'profile', 'project', 'run'].includes(f.kind)) : []

  // Fold the P7 Projects-lens stars in once, so nothing starred earlier disappears.
  try {
    const legacy = JSON.parse(globalThis.localStorage?.getItem(LEGACY_PROJECT_FAVS) ?? '[]')

    if (Array.isArray(legacy)) {
      for (const id of legacy.map(String)) {
        if (!list.some(f => f.kind === 'project' && f.id === id)) {
          list.push({ kind: 'project', id, label: id, at: 0 })
        }
      }
    }
  } catch {
    // ignore
  }

  return list
})

export const isFav = (kind: FavKind, id: string, list = favStore.get()) => list.some(f => f.kind === kind && f.id === id)

export function toggleFav(kind: FavKind, id: string, label: string) {
  const list = favStore.get()
  favStore.set(isFav(kind, id, list) ? list.filter(f => !(f.kind === kind && f.id === id)) : [...list, { kind, id, label, at: Date.now() }])
}

/* ----------------------------------- R20 links ---------------------------------- */

/** The Ops route identity for a task; Desktop's /kanban route opens it. */
export const taskLink = (id: string) => `/kanban?task=${encodeURIComponent(id)}`

export async function copyText(text: string): Promise<boolean> {
  try {
    await globalThis.navigator?.clipboard?.writeText(text)

    return Boolean(globalThis.navigator?.clipboard)
  } catch {
    return false
  }
}
