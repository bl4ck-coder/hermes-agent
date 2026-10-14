import type { BoardTask } from './control-room'

export const NOW = 2_000_000

export const T = (id: string, over: Partial<BoardTask> = {}): BoardTask => ({ id, title: `Task ${id}`, status: 'todo', assignee: null, created_at: NOW - 3600, ...over })

/** One board covering every control-room rule. */
export const BOARD: BoardTask[] = [
  T('run-ok', { status: 'running', assignee: 'builder', last_heartbeat_at: NOW - 30 }),
  T('run-stale', { status: 'running', assignee: 'builder', last_heartbeat_at: NOW - 1200 }),
  T('blk', { status: 'blocked', assignee: 'pixel', block_kind: 'needs_input', created_at: NOW - 7200 }),
  T('fail', { status: 'ready', assignee: 'builder', consecutive_failures: 2, last_failure_error: 'tests red' }),
  T('rev-old', { status: 'review', assignee: 'builder', started_at: NOW - 2 * 86_400, created_at: NOW - 3 * 86_400 }),
  T('rev-new', { status: 'review', assignee: 'builder', started_at: NOW - 600 }),
  T('todo-hi', { status: 'todo', assignee: 'builder', priority: 5 }),
  T('done-1h', { status: 'done', assignee: 'builder', completed_at: NOW - 3600, latest_summary: 'shipped the report', project_id: 'p1' }),
  T('done-3d', { status: 'done', assignee: 'pixel', completed_at: NOW - 3 * 86_400, project_id: 'p1' }),
  T('done-9d', { status: 'done', assignee: 'builder', completed_at: NOW - 9 * 86_400 }),
  T('p1-run', { status: 'running', assignee: 'pixel', last_heartbeat_at: NOW - 10, project_id: 'p1' })
]
