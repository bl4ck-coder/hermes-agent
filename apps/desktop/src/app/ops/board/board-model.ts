/**
 * Board model (ops-panel P4-01): pure filtering, counting, optimistic moves with server snap-back,
 * keyboard move targets, undo, layout grouping and windowing. The server owns every transition:
 * a move is optimistic only until PATCH answers; a refusal snaps the card back with the server reason.
 */

import { connectionScoped, hermesApi } from '@/api/client'

import type { OpsApi } from '../feed/ops-client'

export interface BoardTask {
  id: string
  title: string
  status: string
  assignee?: string | null
  tenant?: string | null
  project_id?: string | null
  priority?: number | null
  created_at?: number | null
  started_at?: number | null
  completed_at?: number | null
  current_run_started_at?: number | null
  /* P8 b3: fields the board route already sends (plugin_api._task_dict + rollups). */
  body?: string | null
  last_heartbeat_at?: number | null
  consecutive_failures?: number | null
  skills?: string[] | null
  comment_count?: number | null
  progress?: { done: number; total: number } | null
  link_counts?: { parents: number; children: number } | null
}

export interface BoardData {
  columns: { name: string; tasks: BoardTask[] }[]
  tenants?: string[]
  assignees?: string[]
  latest_event_id?: number
  now?: number
}

/** Columns a person may drag into. `running` is claim-only on the server (never offered). */
export const MOVABLE = ['triage', 'todo', 'ready', 'blocked', 'scheduled', 'review', 'done'] as const

export type BoardLayout = 'board' | 'list' | 'table' | 'calendar' | 'timeline' | 'files' | 'favorites' | 'review'

export interface BoardFilter {
  tenant?: string | null
  profile?: string | null
  project?: string | null
  mine?: string | null
  text?: string
}

export function isBoard(v: unknown): v is BoardData {
  return Boolean(v) && Array.isArray((v as BoardData).columns)
}

export function allTasks(b: BoardData): BoardTask[] {
  return b.columns.flatMap(c => (Array.isArray(c.tasks) ? c.tasks : []))
}

export function matches(t: BoardTask, f: BoardFilter): boolean {
  if (f.tenant && t.tenant !== f.tenant) {
    return false
  }

  if (f.profile && t.assignee !== f.profile) {
    return false
  }

  if (f.mine && t.assignee !== f.mine) {
    return false
  }

  if (f.project && t.project_id !== f.project) {
    return false
  }

  const text = (f.text ?? '').trim().toLowerCase()

  return !text || t.title.toLowerCase().includes(text) || t.id.toLowerCase().includes(text)
}

/** Same column order as the backend; counts are exactly the filtered backend rows (no invented totals). */
export function filterBoard(b: BoardData, f: BoardFilter): BoardData {
  return { ...b, columns: b.columns.map(c => ({ name: c.name, tasks: (c.tasks ?? []).filter(t => matches(t, f)) })) }
}

export function counts(b: BoardData): Record<string, number> {
  return Object.fromEntries(b.columns.map(c => [c.name, c.tasks.length]))
}

export function statusOf(b: BoardData, id: string): string | null {
  for (const c of b.columns) {
    if (c.tasks.some(t => t.id === id)) {
      return c.name
    }
  }

  return null
}

/** Moves a card locally (optimistic). Unknown task or column: board unchanged. */
export function moveLocal(b: BoardData, id: string, to: string): BoardData {
  const from = statusOf(b, id)

  if (!from || from === to || !b.columns.some(c => c.name === to)) {
    return b
  }

  const task = b.columns.find(c => c.name === from)!.tasks.find(t => t.id === id)!

  return {
    ...b,
    columns: b.columns.map(c =>
      c.name === from
        ? { ...c, tasks: c.tasks.filter(t => t.id !== id) }
        : c.name === to
          ? { ...c, tasks: [{ ...task, status: to }, ...c.tasks] }
          : c
    )
  }
}

/** Keyboard move: next/previous movable column, skipping `running`. */
export function keyboardTarget(b: BoardData, id: string, dir: 1 | -1): string | null {
  const from = statusOf(b, id)
  const order = b.columns.map(c => c.name).filter(n => (MOVABLE as readonly string[]).includes(n))
  const i = from ? order.indexOf(from) : -1
  const next = order[(i < 0 ? (dir > 0 ? -1 : order.length) : i) + dir]

  return next ?? null
}

export interface MoveRecord {
  id: string
  from: string
  to: string
}

export interface MoveOutcome {
  board: BoardData
  ok: boolean
  reason?: string
  undo?: MoveRecord
}

export function errorReason(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : ''

  return m || 'the server refused this transition'
}

/**
 * Optimistic move with snap-back: `onLocal` sees the moved board immediately; when the server refuses,
 * the result is the pre-move board plus the server's reason.
 */
export async function serverMove(
  b: BoardData,
  id: string,
  to: string,
  send: (id: string, to: string) => Promise<unknown>,
  onLocal?: (b: BoardData) => void
): Promise<MoveOutcome> {
  const from = statusOf(b, id)

  if (!from) {
    return { board: b, ok: false, reason: `task ${id} is not on this board` }
  }

  if (to === 'running') {
    return { board: b, ok: false, reason: "Cannot set status to 'running' directly; use the dispatcher/claim path" }
  }

  const moved = moveLocal(b, id, to)
  onLocal?.(moved)

  try {
    await send(id, to)

    return { board: moved, ok: true, undo: { id, from, to } }
  } catch (e) {
    return { board: b, ok: false, reason: errorReason(e) }
  }
}

export function groupByDay(tasks: BoardTask[], field: 'created_at' | 'completed_at' = 'created_at') {
  const out = new Map<string, BoardTask[]>()

  for (const t of tasks) {
    const s = t[field]
    const key = typeof s === 'number' ? new Date(s * 1000).toISOString().slice(0, 10) : 'unknown'
    out.set(key, [...(out.get(key) ?? []), t])
  }

  return [...out.entries()].sort(([a], [b]) => (a === 'unknown' ? 1 : b === 'unknown' ? -1 : a.localeCompare(b)))
}

export function timelineOrder(tasks: BoardTask[]): BoardTask[] {
  const at = (t: BoardTask) => t.current_run_started_at ?? t.started_at ?? t.created_at ?? Number.MAX_SAFE_INTEGER

  return [...tasks].sort((a, b) => at(a) - at(b))
}

/** Fixed-row windowing: which rows of `total` are mounted for a viewport. */
export function windowRange(total: number, scrollTop: number, viewport: number, rowH: number, overscan = 4) {
  const start = Math.max(0, Math.floor(scrollTop / rowH) - overscan)
  const end = Math.min(total, Math.ceil((scrollTop + viewport) / rowH) + overscan)

  return { start, end, padTop: start * rowH, padBottom: (total - end) * rowH }
}

export function createBoardClient(api: OpsApi = hermesApi) {
  const send = <T>(method: string, path: string, body?: unknown) => api<T>({ ...connectionScoped(), path, method, body })

  return {
    board: (tenant?: string | null) =>
      send<BoardData>('GET', `/api/plugins/kanban/board${tenant ? `?tenant=${encodeURIComponent(tenant)}` : ''}`),
    move: (id: string, status: string) =>
      send<{ task: BoardTask | null }>('PATCH', `/api/plugins/kanban/tasks/${encodeURIComponent(id)}`, { status }),
    assign: (id: string, assignee: string | null) =>
      send<{ task: BoardTask | null }>('PATCH', `/api/plugins/kanban/tasks/${encodeURIComponent(id)}`, { assignee: assignee ?? '' }),
    archive: (id: string) =>
      send<{ task: BoardTask | null }>('PATCH', `/api/plugins/kanban/tasks/${encodeURIComponent(id)}`, { status: 'archived' }),
    bulk: (ids: string[], patch: { status?: string; assignee?: string; archive?: boolean }) =>
      send<{ results: { id: string; ok: boolean; error?: string }[] }>('POST', '/api/plugins/kanban/tasks/bulk', { ids, ...patch }),
    /** R47 / R17: title, body and priority edits go through the same server-validated PATCH. */
    patch: (id: string, fields: { title?: string; body?: string; priority?: number }) =>
      send<{ task: BoardTask | null }>('PATCH', `/api/plugins/kanban/tasks/${encodeURIComponent(id)}`, fields),
    /** R40 / R20: full create (body, priority, assignee, triage); Duplicate reuses it. */
    createFull: (t: { title: string; body?: string | null; assignee?: string | null; priority?: number; column?: string; tenant?: string | null; skills?: string[] | null }) =>
      send<{ task?: BoardTask }>('POST', '/api/plugins/kanban/tasks', {
        title: t.title,
        body: t.body || null,
        assignee: t.assignee || null,
        tenant: t.tenant || null,
        priority: t.priority ?? 0,
        skills: t.skills ?? null,
        triage: t.column === 'triage'
      }),
    /** R68: a task's parent/child links (the board only carries counts). */
    links: (id: string) =>
      send<{ links?: { parents?: string[]; children?: string[] } }>('GET', `/api/plugins/kanban/tasks/${encodeURIComponent(id)}`).then(d => ({
        parents: Array.isArray(d?.links?.parents) ? d.links.parents : [],
        children: Array.isArray(d?.links?.children) ? d.links.children : []
      })),
    /** R11 / R70: attachments of one task; upload is the kanban multipart route. */
    attachments: (id: string) =>
      send<{ attachments?: unknown[] } | unknown[]>('GET', `/api/plugins/kanban/tasks/${encodeURIComponent(id)}/attachments`).then(r =>
        Array.isArray(r) ? r : Array.isArray((r as { attachments?: unknown[] })?.attachments) ? (r as { attachments: unknown[] }).attachments : []
      ),
    upload: (id: string, file: { filename: string; contentType?: string; bytes: ArrayBuffer }) =>
      api<{ attachment: Record<string, unknown> | null }>({ ...connectionScoped(), path: `/api/plugins/kanban/tasks/${encodeURIComponent(id)}/attachments`, method: 'POST', upload: file }),
    create: (title: string, status: string, assignee?: string | null, tenant?: string | null) =>
      send<{ task?: BoardTask }>('POST', '/api/plugins/kanban/tasks', {
        title,
        assignee: assignee || null,
        tenant: tenant || null,
        triage: status === 'triage'
      })
  }
}

export type BoardClient = ReturnType<typeof createBoardClient>
