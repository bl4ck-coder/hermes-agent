/**
 * Writable Canvas node model (ops-panel P5-01). Per-node dirty/save/discard/conflict over the P2-03
 * transactional routes. The server is the only judge: a 409 conflict keeps the draft and exposes the
 * current hash; policy_blocked carries manual repair suggestions; remote_read_only disables the node.
 * Nothing retries or overwrites on its own.
 */

import { connectionScoped, hermesApi } from '@/api/client'

import { parseApiError } from '../feed/api-error'
import type { OpsApi, PolicyView } from '../feed/ops-client'

export type WritableNode = 'prompt' | 'raw_yaml' | 'model'
export const WRITABLE_NODES: WritableNode[] = ['prompt', 'raw_yaml', 'model']

export interface NodeValue {
  content?: string
  provider?: string
  model?: string
}

export interface NodeRead extends NodeValue {
  profile: string
  node: string
  content_hash: string
  exists: boolean
}

export interface SaveResult {
  ok: true
  outcome: string
  sequence: number
  backup: string
  content_hash: string
  warnings: unknown[]
}

export interface HistoryItem {
  backup: string
  sequence: number
  note?: string | null
  endpoint?: string | null
  outcome?: string | null
  before_composite?: string | null
  readback_composite?: string | null
}

export type NodeStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'blocked' | 'read_only' | 'error' | 'unknown'

export interface Violation {
  field: string
  provider: string
  model: string
  reason: string
}

export interface NodeState {
  node: WritableNode
  hash: string | null
  base: NodeValue
  draft: NodeValue
  status: NodeStatus
  message: string | null
  currentHash?: string | null
  violations?: Violation[]
  warnings?: unknown[]
  lastBackup?: string | null
  /** SPEC v2.1 2b: the op_id whose outcome is not yet known (lost response). */
  pendingOp?: string | null
}

const same = (a: NodeValue, b: NodeValue) => (a.content ?? '') === (b.content ?? '') && (a.provider ?? '') === (b.provider ?? '') && (a.model ?? '') === (b.model ?? '')

export function fromRead(node: WritableNode, r: NodeRead | null): NodeState {
  const v: NodeValue = node === 'model' ? { provider: r?.provider ?? '', model: r?.model ?? '' } : { content: r?.content ?? '' }

  return { node, hash: r?.content_hash ?? null, base: v, draft: v, status: r ? 'clean' : 'error', message: r ? null : 'unknown (node not loaded)' }
}

export function edit(s: NodeState, patch: NodeValue): NodeState {
  if (s.status === 'read_only' || s.status === 'saving') {
    return s
  }

  const draft = { ...s.draft, ...patch }

  return { ...s, draft, status: same(draft, s.base) ? 'clean' : 'dirty', message: null }
}

export function discard(s: NodeState): NodeState {
  return s.status === 'saving' ? s : { ...s, draft: s.base, status: 'clean', message: null, violations: undefined }
}

export function isDirty(s: NodeState) {
  return !same(s.draft, s.base)
}

/** Unified-ish line diff (LCS) for the normalisation preview: what the server will store vs. the draft. */
export function diffLines(a: string, b: string): { op: ' ' | '-' | '+'; line: string }[] {
  const x = a.split('\n')
  const y = b.split('\n')
  const n = x.length
  const m = y.length
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    }
  }

  const out: { op: ' ' | '-' | '+'; line: string }[] = []
  let i = 0
  let j = 0

  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ op: ' ', line: x[i] })
      i++
      j++
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      out.push({ op: '-', line: x[i++] })
    } else {
      out.push({ op: '+', line: y[j++] })
    }
  }

  while (i < n) {
    out.push({ op: '-', line: x[i++] })
  }

  while (j < m) {
    out.push({ op: '+', line: y[j++] })
  }

  return out
}

/** Manual repair suggestions (never auto-applied): allowed provider/model pairs from the effective policy. */
export function repairSuggestions(policy: PolicyView | null, provider?: string): { provider: string; model: string }[] {
  if (!policy || !Array.isArray(policy.allow)) {
    return []
  }

  const out: { provider: string; model: string }[] = []

  for (const rule of policy.allow) {
    for (const p of rule.provider ?? []) {
      if (provider && p !== provider) {
        continue
      }

      for (const m of rule.models ?? []) {
        if (!m.includes('*')) {
          out.push({ provider: p, model: m })
        }
      }
    }
  }

  return out
}

export function createNodeClient(api: OpsApi = hermesApi) {
  const base = (profile: string, node: string) => `/api/ops/profiles/${encodeURIComponent(profile)}/nodes/${node}`

  // A missing bridge throws synchronously; keep every failure on the promise so the editor degrades.
  const call = <T>(method: string, path: string, body?: unknown) =>
    Promise.resolve().then(() => api<T>({ ...connectionScoped(), path, method, body }))

  return {
    read: (profile: string, node: WritableNode) => call<NodeRead>('GET', base(profile, node)),
    save: (profile: string, node: WritableNode, expected_hash: string, value: NodeValue, note?: string, op_id?: string) =>
      call<SaveResult>('PUT', base(profile, node), { expected_hash, ...value, note: note ?? null, op_id: op_id ?? null }),
    opStatus: (profile: string, node: WritableNode, op_id: string) => call<OpStatus>('GET', `${base(profile, node)}/ops/${encodeURIComponent(op_id)}`),
    history: (profile: string, node: WritableNode) => call<{ items: HistoryItem[] }>('GET', `${base(profile, node)}/history`),
    restore: (profile: string, node: WritableNode, backup: string, expected_hash: string, op_id?: string) =>
      call<SaveResult>('POST', `${base(profile, node)}/restore`, { backup, expected_hash, op_id: op_id ?? null })
  }
}

export type NodeClient = ReturnType<typeof createNodeClient>

/** Map a refused write to node state. The draft is always kept. */
export function refusal(s: NodeState, e: unknown): NodeState {
  const p = parseApiError(e)

  if (p.code === 'conflict') {
    return { ...s, status: 'conflict', currentHash: (p.extra.current_hash as string) ?? null, message: 'Changed on disk since you opened it. Reload theirs or keep editing.' }
  }

  if (p.code === 'policy_blocked') {
    return { ...s, status: 'blocked', violations: (p.extra.blocked as Violation[]) ?? [], warnings: (p.extra.warnings as unknown[]) ?? [], message: p.detail || 'disallowed by policy' }
  }

  if (p.code === 'policy_invalid') {
    return { ...s, status: 'blocked', violations: [], message: 'ops-policy.yaml is invalid, so every governed save is blocked until it is fixed (see Ops settings › Diagnostics).' }
  }

  if (p.code === 'origin_not_allowed') {
    return { ...s, status: 'error', message: 'Refused: this request did not come from Hermes Desktop (Origin check).' }
  }

  if (p.code === 'remote_read_only' || p.status === 403) {
    return { ...s, status: 'read_only', message: 'Remote connection: read-only (D11).' }
  }

  if (p.code === 'backup_coverage_missing' || p.code === 'backup_failed') {
    return { ...s, status: 'error', message: `Not saved, backup unavailable: ${p.detail}` }
  }

  if (p.code === 'busy') {
    return { ...s, status: 'dirty', message: 'Another Ops write is in progress. Try again.' }
  }

  return { ...s, status: 'error', message: [p.code, p.detail].filter(Boolean).join(': ') || 'Not saved (disconnected?)' }
}

export interface OpStatus {
  op_id: string
  state: 'applied' | 'rejected' | 'not_found' | 'indeterminate'
  backup?: string
}

let opSeq = 0

/** Unique per write; a retry always gets a new one (SPEC v2.1 2b). */
export function newOpId(): string {
  opSeq += 1

  return `op-${Date.now().toString(36)}-${opSeq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** A refusal with no HTTP status means the response was lost: the write may or may not have landed. */
export function outcomeUnknown(e: unknown): boolean {
  return parseApiError(e).status === null
}

/** Resolve an outcome-unknown write by its op_id, never by comparing the current hash. */
export async function reconcile(s: NodeState, profile: string, client: NodeClient): Promise<NodeState> {
  if (!s.pendingOp) {
    return s
  }

  let st: OpStatus

  try {
    st = await client.opStatus(profile, s.node, s.pendingOp)
  } catch {
    return { ...s, status: 'unknown', message: 'Outcome unknown: Hermes is unreachable. Check again, retry (new op) or discard.' }
  }

  if (st.state === 'applied') {
    const fresh = await client.read(profile, s.node).catch(() => null)
    const next = fresh ? fromRead(s.node, fresh) : { ...s, base: s.draft }

    return { ...next, status: 'saved', pendingOp: null, message: `Saved (confirmed after a lost response${st.backup ? `, backup ${st.backup}` : ''})`, lastBackup: st.backup ?? null }
  }

  if (st.state === 'indeterminate') {
    return { ...s, status: 'unknown', message: 'Outcome unknown: the write is still settling on the backend. Check again shortly.' }
  }

  return { ...s, status: 'dirty', pendingOp: null, message: st.state === 'rejected' ? 'Not applied (the backend rejected it). Your draft is kept.' : 'Not applied. Your draft is kept; saving again is safe.' }
}

export async function save(s: NodeState, profile: string, client: NodeClient, note?: string): Promise<NodeState> {
  if (s.status === 'read_only' || !s.hash || !isDirty(s)) {
    return s
  }

  const op = newOpId()

  try {
    const r = await client.save(profile, s.node, s.hash, s.draft, note, op)
    // Re-read: the server may normalise (model saves re-dump config.yaml); the base becomes what is on disk.
    const fresh = await client.read(profile, s.node).catch(() => null)
    const next = fresh ? fromRead(s.node, fresh) : { ...s, base: s.draft, hash: r.content_hash }

    return { ...next, status: 'saved', pendingOp: null, message: `Saved (backup ${r.backup})`, warnings: r.warnings, lastBackup: r.backup }
  } catch (e) {
    if (outcomeUnknown(e)) {
      return reconcile({ ...s, status: 'unknown', pendingOp: op, message: 'Outcome unknown: checking with Hermes…' }, profile, client)
    }

    return refusal(s, e)
  }
}

/** Conflict resolution "reload theirs": discard the draft and take the disk state. */
export async function reloadTheirs(s: NodeState, profile: string, client: NodeClient): Promise<NodeState> {
  try {
    return fromRead(s.node, await client.read(profile, s.node))
  } catch (e) {
    return refusal(s, e)
  }
}

/** Conflict resolution "keep mine": rebase the draft on the current hash; the user must press Save again. */
export async function rebaseMine(s: NodeState, profile: string, client: NodeClient): Promise<NodeState> {
  try {
    const fresh = fromRead(s.node, await client.read(profile, s.node))

    return { ...fresh, draft: s.draft, status: same(s.draft, fresh.base) ? 'clean' : 'dirty', message: 'Rebased on the disk version; review and save.' }
  } catch (e) {
    return refusal(s, e)
  }
}

export async function restore(s: NodeState, profile: string, backup: string, client: NodeClient): Promise<NodeState> {
  if (!s.hash || s.status === 'read_only') {
    return s
  }

  try {
    const r = await client.restore(profile, s.node, backup, s.hash)
    const fresh = fromRead(s.node, await client.read(profile, s.node))

    return { ...fresh, status: 'saved', message: `Restored ${backup} (new backup ${r.backup})`, lastBackup: r.backup }
  } catch (e) {
    return refusal(s, e)
  }
}
