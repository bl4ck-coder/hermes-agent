/**
 * P8 b5: Ops diagnostics plumbing (L1 probe, L4/R77 fault simulation, L6/S7 redacted error ring).
 * Pure + tiny stores; nothing here talks to the network except `probe`, which is a list of GETs.
 */

/* ------------------------------- redaction -------------------------------- */

const SECRET_PATTERNS: [RegExp, string][] = [
  [/\b(sk|pk|rk|xai|ghp|gho|ghs|glpat|xox[abpr])[-_][A-Za-z0-9_-]{8,}\b/g, '[redacted-key]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [redacted]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g, '[redacted-jwt]'],
  [/\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH)[A-Z0-9_]*)\s*[=:]\s*("[^"]*"|'[^']*'|\S+)/g, '$1=[redacted]'],
  [/([?&](?:token|key|secret|access_token|api_key)=)[^&\s]+/gi, '$1[redacted]']
]

/** S7: keys, tokens and .env-style values never leave Diagnostics in clear. */
export function redact(text: string): string {
  return SECRET_PATTERNS.reduce((s, [re, to]) => s.replace(re, to), text)
}

/* ------------------------------- error ring -------------------------------- */

export const ERROR_RING_MAX = 50

export interface OpsErrorRow {
  at: number
  method: string
  path: string
  message: string
}

let ring: OpsErrorRow[] = []
const ringListeners = new Set<() => void>()

export function recordOpsError(method: string, path: string, e: unknown) {
  const message = redact(e instanceof Error ? e.message : String(e))
  ring = [{ at: Date.now(), method, path: redact(path), message }, ...ring].slice(0, ERROR_RING_MAX)
  ringListeners.forEach(l => l())
}

export const opsErrors = () => ring
export const subscribeOpsErrors = (l: () => void) => (ringListeners.add(l), () => ringListeners.delete(l))

export function clearOpsErrors() {
  ring = []
  ringListeners.forEach(l => l())
}

/* ----------------------------- fault simulation ---------------------------- */

export type SimMode = 'off' | 'offline' | 'slow' | 'auth'
export const SIM_SLOW_MS = 11_000

/** R77: dev builds only. A production build never simulates, whatever is stored. */
export const simAllowed = (): boolean => {
  try {
    return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV)
  } catch {
    return false
  }
}

let sim: SimMode = 'off'
const simListeners = new Set<() => void>()

export const simMode = (): SimMode => (simAllowed() ? sim : 'off')
export const subscribeSim = (l: () => void) => (simListeners.add(l), () => simListeners.delete(l))

export function setSimMode(m: SimMode) {
  sim = simAllowed() ? m : 'off'
  simListeners.forEach(l => l())
}

/** Applied before every Ops request: offline = network error, auth = 401, slow = > 10 s. */
export async function applySim(wait: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms))) {
  const m = simMode()

  if (m === 'offline') {
    throw new Error('simulated offline: backend unreachable')
  }

  if (m === 'auth') {
    throw new Error('401: simulated auth refused')
  }

  if (m === 'slow') {
    await wait(SIM_SLOW_MS)
  }
}

/* ---------------------------------- probe ---------------------------------- */

export interface ProbeRoute {
  id: string
  label: string
  path: string
  /** Hermes feature that ships this route, for the "needs Hermes with …" copy. */
  needs: string
}

export const PROBE_ROUTES: ProbeRoute[] = [
  { id: 'A1', label: 'Fleet feed', path: '/api/ops/fleet', needs: 'the Ops fleet feed' },
  { id: 'A2', label: 'Kanban board', path: '/api/plugins/kanban/board', needs: 'the kanban plugin' },
  { id: 'A3', label: 'Pending approvals', path: '/api/approvals/pending', needs: 'approvals' },
  { id: 'A4', label: 'Usage today', path: '/api/ops/usage/today', needs: 'usage reporting' },
  { id: 'A5', label: 'Node editor', path: '/api/ops/profiles/default/nodes/prompt', needs: 'Ops node editing (A5)' },
  { id: 'A6', label: 'Policy', path: '/api/ops/policy', needs: 'the P2 policy check (A6)' },
  { id: 'A7', label: 'Delegation', path: '/api/ops/delegation', needs: 'the Ops delegation view' }
]

export type ProbeState = 'ok' | 'missing' | 'refused' | 'error'

export interface ProbeResult extends ProbeRoute {
  state: ProbeState
  detail: string
}

/** L1: each route is classified; a 404 names the Hermes feature it needs, never a blank section. */
export async function probe(get: (path: string) => Promise<unknown>, routes = PROBE_ROUTES): Promise<ProbeResult[]> {
  return Promise.all(
    routes.map(async r => {
      try {
        await get(r.path)

        return { ...r, state: 'ok' as const, detail: 'available' }
      } catch (e) {
        const msg = redact(e instanceof Error ? e.message : String(e))

        return /\b404\b|not found/i.test(msg)
          ? { ...r, state: 'missing' as const, detail: `needs Hermes with ${r.needs}` }
          : /\b40[13]\b/.test(msg)
            ? { ...r, state: 'refused' as const, detail: msg }
            : { ...r, state: 'error' as const, detail: msg }
      }
    })
  )
}

/** L6: the copy is the panel's text, redacted once more as a whole. */
export function diagnosticsText(p: { probe: ProbeResult[] | null; stream: { mode: string; reason?: string | null }; policySource: string | null; errors: OpsErrorRow[]; version?: string }) {
  const lines = [
    `Hermes Ops diagnostics ${new Date().toISOString()}`,
    `stream: ${p.stream.mode}${p.stream.reason ? ` (${p.stream.reason})` : ''}`,
    `policy source: ${p.policySource ?? 'unknown'}`,
    'probe:',
    ...(p.probe ?? []).map(r => `  ${r.id} ${r.label}: ${r.state} - ${r.detail}`),
    `errors (last ${p.errors.length}):`,
    ...p.errors.map(e => `  ${new Date(e.at).toISOString()} ${e.method} ${e.path}: ${e.message}`)
  ]

  return redact(lines.join('\n'))
}

/* ------------------------------ notifications ------------------------------ */

export interface NotifyPrefs {
  approvals: boolean
  blocked: boolean
}

/** R54: ids not seen before; the first observation only primes (no burst on open). */
export function newIds(prev: Set<string> | null, next: string[]): string[] {
  return prev ? next.filter(id => !prev.has(id)) : []
}

/** OS notification, opt-in. Silent, no window focus, no-op when the platform refuses. */
export function opsNotify(title: string, body: string): boolean {
  const N = (globalThis as { Notification?: { permission: string; new (t: string, o?: object): unknown } }).Notification

  if (!N || N.permission !== 'granted') {
    return false
  }

  try {
    new N(title, { body: redact(body), silent: true })

    return true
  } catch {
    return false
  }
}

/** Every Ops request goes through here: simulation first (dev only), failures land in the ring. */
export async function opsCall<T>(method: string, path: string, run: () => Promise<T>): Promise<T> {
  try {
    await applySim()

    return await run()
  } catch (e) {
    recordOpsError(method, path, e)
    throw e
  }
}
