/**
 * Typed Ops data client (ops-panel P3-01). Thin wrappers over the A1-A7 routes and the
 * P1-06 main-process bridges. Values the backend reports as null stay null: the UI renders
 * "unknown", never 0 (no invented metrics).
 */

import { connectionScoped, hermesApi } from '@/api/client'
import type { HermesApiRequest } from '@/global'

import { opsCall } from './diag'

export type Presence = 'working' | 'needs_you' | 'blocked' | 'idle' | 'offline' | 'unknown' | 'stale'

export interface FleetRun {
  source: string
  id: string | number
  task_id?: string | null
  started_at?: number | null
}

export interface FleetProfile {
  profile: string
  presence: Presence
  sub_state?: string | null
  observed_at: number | null
  event_at?: number | null
  freshness_s?: number | null
  next_run_at?: number | null
  active_runs?: FleetRun[]
  precedence?: string
}

export interface FleetResponse {
  profiles: FleetProfile[]
  board?: string | null
  now: number
}

export interface ApprovalItem {
  origin: 'jsonrpc' | 'kanban_blocked' | 'kanban_review' | 'gateway_run' | string
  id: string
  profile: string | null
  session_id: string | null
  run_id: string | null
  tenant: string | null
  exact_request: { command: string; pattern_keys: string[] } | null
  why: string
  what_for: string
  status: string
  expires_at: number | null
  age_s: number | null
  actions: string[]
}

export interface PendingApprovals {
  items: ApprovalItem[]
  observed_at: Record<string, number | null>
}

export interface UsageToday {
  input_tokens: number | null
  output_tokens: number | null
  provenance?: string
}

export interface KanbanTask {
  id: string
  title: string
  status: string
  assignee?: string | null
  tenant?: string | null
  current_run_started_at?: number | null
}

export interface KanbanBoard {
  columns: { name: string; tasks: KanbanTask[] }[]
  tenants?: string[]
}

export interface CronJobLite {
  id: string
  name?: string | null
  enabled?: boolean
  next_run_at?: string | number | null
  last_status?: string | null
  failure_streak?: number | null
  profile?: string | null
}

export interface PolicyViolation {
  field: string
  provider: string
  model: string
  reason: string
}

export interface PolicyView {
  source: string
  error: string | null
  enabled: boolean
  allow: { provider: string[]; models: string[] }[]
  violations?: PolicyViolation[] | null
}

export interface ModelNode {
  profile: string
  node: 'model'
  content_hash: string
  exists: boolean
  provider?: string | null
  model?: string | null
}

export interface PromptNode {
  profile: string
  node: 'prompt'
  content_hash: string
  exists: boolean
  content?: string
}

export interface DelegationView {
  profile: string
  model: string | null
  provider: string | null
  inherit_model: boolean
  inherit_provider: boolean
  fallback_providers: unknown[] | null
  api_key_set: boolean
}

export type OpsApi = <T>(request: HermesApiRequest) => Promise<T>

const q = (params: Record<string, string | null | undefined>) => {
  const s = new URLSearchParams()

  for (const [k, v] of Object.entries(params)) {
    if (v) {
      s.set(k, v)
    }
  }

  const text = s.toString()

  return text ? `?${text}` : ''
}

export function createOpsClient(api: OpsApi = hermesApi) {
  const get = <T>(path: string) => opsCall('GET', path, () => api<T>({ ...connectionScoped(), path }))
  const send = <T>(method: string, path: string, body: unknown) => opsCall(method, path, () => api<T>({ ...connectionScoped(), path, method, body }))

  return {
    fleet: (board?: string | null) => get<FleetResponse>(`/api/ops/fleet${q({ board })}`),
    pendingApprovals: (profile?: string | null) => get<PendingApprovals>(`/api/approvals/pending${q({ profile })}`),
    resolvedApprovals: () => get<{ items: Record<string, unknown>[] }>('/api/approvals/resolved?limit=20'),
    /** One click (D3). Only jsonrpc items are routable from this connection (A3). */
    approve: (item: ApprovalItem, choice: 'once' | 'deny' = 'once') => {
      if (item.origin !== 'jsonrpc' || !item.session_id) {
        return Promise.reject(Object.assign(new Error('not routable from this connection'), { code: 'not_routable' }))
      }

      return send<{ resolved: boolean; outcome: string; choice: string }>('POST', '/api/approvals/respond', {
        origin: item.origin,
        id: item.id,
        session_id: item.session_id,
        choice
      })
    },
    usageToday: () => get<UsageToday>('/api/ops/usage/today'),
    board: (tenant?: string | null) => get<KanbanBoard>(`/api/plugins/kanban/board${q({ tenant })}`),
    cronJobs: (profile?: string | null) => get<CronJobLite[]>(`/api/cron/jobs${q({ profile: profile || 'all' })}`),
    dispatch: (title: string, assignee: string | null, tenant?: string | null, projectId?: string | null) =>
      send<{ task?: KanbanTask; id?: string }>('POST', '/api/plugins/kanban/tasks', {
        title,
        assignee: assignee || null,
        tenant: tenant || null,
        ...(projectId ? { project_id: projectId } : {}),
        // O58: no @assignee means the kanban triage lane routes it (honest "Unassigned → triage").
        triage: !assignee
      }),
    policy: (profile?: string | null) => get<PolicyView>(`/api/ops/policy${q({ profile: profile || 'default' })}`),
    modelNode: (profile: string) => get<ModelNode>(`/api/ops/profiles/${encodeURIComponent(profile)}/nodes/model`),
    promptNode: (profile: string) => get<PromptNode>(`/api/ops/profiles/${encodeURIComponent(profile)}/nodes/prompt`),
    delegation: (profile?: string | null) => get<DelegationView>(`/api/ops/delegation${q({ profile })}`)
  }
}

export type OpsClient = ReturnType<typeof createOpsClient>

/** "@builder fix the build" -> { assignee: 'builder', title: 'fix the build' } */
/** G66 (P8 b5): a leading @profile assigns; a #project token anywhere files it (first one wins). */
export function parseDispatch(text: string): { assignee: string | null; title: string; project: string | null } {
  let rest = text.trim()
  let project: string | null = null
  const pm = /(^|\s)#([a-z0-9][a-z0-9_-]{0,63})(?=\s|$)/i.exec(rest)

  if (pm) {
    project = pm[2].toLowerCase()
    rest = (rest.slice(0, pm.index) + rest.slice(pm.index + pm[0].length)).replace(/\s+/g, ' ').trim()
  }

  const m = /^@([a-z0-9][a-z0-9_-]{0,63})\s+(.+)$/i.exec(rest)

  return m ? { assignee: m[1].toLowerCase(), title: m[2].trim(), project } : { assignee: null, title: rest, project }
}

export const FRESH_S = 5

/** A profile's presence is only trusted when its observation is at most 5 s old. */
export function isFresh(p: Pick<FleetProfile, 'observed_at'>, nowS: number): boolean {
  return typeof p.observed_at === 'number' && nowS - p.observed_at <= FRESH_S
}

export function shownPresence(p: FleetProfile, nowS: number): Presence {
  if (p.presence === 'unknown' || p.presence === 'stale' || p.presence === 'offline') {
    return p.presence
  }

  return isFresh(p, nowS) ? p.presence : 'stale'
}
