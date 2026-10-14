/**
 * Ops actions and detail reads (ops-panel P6). Thin wrappers over existing Hermes routes only:
 * kanban comments/status/links/task detail/runs, cron trigger, profiles and env key presence.
 * All failures stay on the promise (a missing bridge throws synchronously otherwise).
 */

import { connectionScoped, hermesApi } from '@/api/client'

import type { KanbanAction } from '../office/needs-you'

import type { OpsApi } from './ops-client'

const K = '/api/plugins/kanban'
const enc = encodeURIComponent

export interface TaskEvent {
  id: number
  task_id: string
  kind: string
  payload: unknown
  created_at: number
  run_id?: number | null
}

export interface TaskComment {
  id?: number
  author: string | null
  body: string
  created_at: number
}

export interface TaskRun {
  id: number
  task_id: string
  profile: string | null
  step_key?: string | null
  status: string
  outcome?: string | null
  error?: string | null
  summary?: string | null
  started_at?: number | null
  ended_at?: number | null
}

export interface TaskDetail {
  task: { id: string; title: string; status: string; assignee?: string | null; body?: string | null; tenant?: string | null; current_step_key?: string | null; workspace_path?: string | null; branch_name?: string | null; last_failure_error?: string | null }
  comments: TaskComment[]
  events: TaskEvent[]
  attachments: { id: string; filename: string; size?: number | null; content_type?: string | null }[]
  links: { parents: string[]; children: string[] }
  child_results: { id: string; title: string; status: string; latest_summary?: string | null }[]
  runs: TaskRun[]
}

export interface ProfileRow {
  name: string
  model: string | null
  provider: string | null
  skill_count?: number
  has_env?: boolean
  display_name?: string
  bot_title?: string
}

export type EnvRows = Record<string, { is_set: boolean; category?: string; description?: string }>

export function createOpsActions(api: OpsApi = hermesApi) {
  const call = <T>(method: string, path: string, body?: unknown) =>
    Promise.resolve().then(() => api<T>({ ...connectionScoped(), path, method, body }))

  const comment = (taskId: string, body: string) => call<{ ok: boolean }>('POST', `${K}/tasks/${enc(taskId)}/comments`, { body, author: 'ops' })
  const setStatus = (taskId: string, status: string) => call<unknown>('PATCH', `${K}/tasks/${enc(taskId)}`, { status })

  return {
    comment,
    setStatus,
    assign: (taskId: string, assignee: string | null) => call<unknown>('PATCH', `${K}/tasks/${enc(taskId)}`, { assignee: assignee ?? '' }),
    taskDetail: (taskId: string) => call<TaskDetail>('GET', `${K}/tasks/${enc(taskId)}`),
    runDetail: (runId: string | number) => call<TaskRun & Record<string, unknown>>('GET', `${K}/runs/${enc(String(runId))}`),
    reclaim: (taskId: string) => call<unknown>('POST', `${K}/tasks/${enc(taskId)}/reclaim`, {}),
    createSubtask: (parentId: string, title: string, assignee?: string | null) =>
      call<{ task?: { id: string } }>('POST', `${K}/tasks`, { title, assignee: assignee || null, parents: [parentId] }),
    archivedBoard: () => call<{ columns: { name: string; tasks: { id: string; title: string; status: string; assignee?: string | null }[] }[] }>('GET', `${K}/board?include_archived=true`),
    latestEventId: () => call<{ latest_event_id?: number }>('GET', `${K}/board`).then(b => (typeof b?.latest_event_id === 'number' ? b.latest_event_id : null)),
    cronTrigger: (jobId: string) => call<unknown>('POST', `/api/cron/jobs/${enc(jobId)}/trigger`, {}),
    profiles: () => call<{ profiles: ProfileRow[] }>('GET', '/api/profiles'),
    envPresence: (profile: string) => call<EnvRows>('GET', `/api/env?profile=${enc(profile)}`),
    /** Needs-you kanban actions: a note is always a comment first, then the server-validated transition. */
    kanban: async (a: KanbanAction) => {
      if (a.kind === 'approve_review') {
        return setStatus(a.taskId, 'done')
      }

      if (!a.note?.trim()) {
        throw new Error('a note is required')
      }

      await comment(a.taskId, a.kind === 'unblock' ? `Unblocked from Ops: ${a.note}` : `Changes requested from Ops: ${a.note}`)

      return setStatus(a.taskId, a.kind === 'unblock' ? 'ready' : 'todo')
    }
  }
}

export type OpsActions = ReturnType<typeof createOpsActions>

/** Only key names and set/unset ever leave this helper (SPEC §7: never values). */
export function envPresenceList(rows: EnvRows | null | undefined): { name: string; set: boolean }[] | null {
  if (!rows || typeof rows !== 'object') {
    return null
  }

  return Object.entries(rows)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([name, v]) => ({ name, set: Boolean(v.is_set) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
