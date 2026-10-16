/** Test-run stream reducer (ops-panel P3-03). Pure: SSE payloads in, run view state out. */

export interface RunTool {
  id: string
  tool: string
  preview: string | null
  status: 'running' | 'done' | 'failed'
  kind: 'tool' | 'skill'
}

export interface RunView {
  runId: string | null
  status: RunStatus
  text: string
  tokens: number
  startedAt: number | null
  endedAt: number | null
  tools: RunTool[]
  subagents: { id: string; goal: string | null; status: 'running' | 'done' }[]
  error: string | null
  lit: Set<string>
  /** v0.22: the admission/generation pair `resolve-unknown` and `clarify` must echo back. */
  admissionId?: string | null
  executionGeneration?: number | null
  /** v0.22: the pending clarify prompt, from the run snapshot's `pending_controls`. */
  clarify?: { requestId: string; question: string; choices: string[] } | null
}

/**
 * `unknown` (v0.22): the run lost its owner epoch. It is not terminal; later turns wait until someone
 * acknowledges it with `POST /v1/runs/{id}/resolve-unknown`. `waiting_for_input`: a clarify prompt is open.
 */
export type RunStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'waiting_for_approval'
  | 'waiting_for_input'
  | 'unknown'
  | 'completed'
  | 'failed'

/** Statuses that still need the run panel's attention (ticking clock, polling, Test run disabled). */
export const ACTIVE_RUN_STATUSES: ReadonlySet<RunStatus> = new Set([
  'starting',
  'running',
  'waiting_for_approval',
  'waiting_for_input',
  'unknown'
])

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Pull the first pending clarify prompt out of `pending_controls` (shape varies: fields may sit in `payload`). */
export function pendingClarify(controls: unknown): RunView['clarify'] {
  if (!Array.isArray(controls)) {
    return null
  }

  for (const raw of controls) {
    const c = (raw ?? {}) as Record<string, unknown>
    const p = (c.payload && typeof c.payload === 'object' ? c.payload : {}) as Record<string, unknown>

    if (c.kind !== 'clarify') {
      continue
    }

    const requestId = str(c.prompt_id) || str(c.request_id) || str(c.id)

    if (!requestId) {
      continue
    }

    const choices = (Array.isArray(c.choices) ? c.choices : Array.isArray(p.choices) ? p.choices : []).filter(
      (x): x is string => typeof x === 'string'
    )

    return { requestId, question: str(c.question) || str(p.question) || str(c.text), choices }
  }

  return null
}

/**
 * Fold a `GET /v1/runs/{id}` snapshot (v0.22 authority shape) into the view. Terminal states already
 * reached by the stream win; a snapshot never resurrects a finished run.
 */
export function applyRunSnapshot(state: RunView, snap: unknown, now: number): RunView {
  if (!snap || typeof snap !== 'object' || state.status === 'completed' || state.status === 'failed') {
    return state
  }

  const s = snap as Record<string, unknown>

  const next: RunView = {
    ...state,
    admissionId: str(s.admission_id) || state.admissionId || null,
    executionGeneration: Number.isInteger(s.execution_generation) ? (s.execution_generation as number) : (state.executionGeneration ?? null),
    clarify: pendingClarify(s.pending_controls)
  }

  switch (s.status) {
    case 'unknown':
      return { ...next, status: 'unknown' }

    case 'waiting_for_approval':
      return { ...next, status: 'waiting_for_approval' }

    case 'completed':
      return { ...next, status: 'completed', endedAt: now }

    case 'failed':

    case 'cancelled':
      return { ...next, status: 'failed', endedAt: now, error: state.error ?? String(s.status) }

    case 'running':

    case 'queued':
      return { ...next, status: next.clarify ? 'waiting_for_input' : state.status === 'starting' ? 'starting' : 'running' }

    default:
      return next
  }
}

export const initialRun = (): RunView => ({
  runId: null,
  status: 'idle',
  text: '',
  tokens: 0,
  startedAt: null,
  endedAt: null,
  tools: [],
  subagents: [],
  error: null,
  lit: new Set()
})

const isSkill = (tool: string) => /^skill[s_]?|skill_view|skills_list/i.test(tool)

/** Tokens are counted from streamed deltas (whitespace-delimited), labelled as streamed, not billed. */
const countTokens = (s: string) => (s.match(/\S+/g) || []).length

export function reduceRun(state: RunView, ev: { event?: string; data?: string }, now: number): RunView {
  let data: Record<string, unknown> = {}

  try {
    data = JSON.parse(ev.data || '{}') || {}
  } catch {
    return state
  }

  const name = String(data.event ?? ev.event ?? '')
  const lit = new Set(state.lit)

  switch (name) {
    case 'message.delta': {
      const delta = String(data.delta ?? '')
      lit.add('model')

      return { ...state, status: 'running', text: state.text + delta, tokens: state.tokens + countTokens(delta), lit }
    }

    case 'tool.started': {
      const tool = String(data.tool ?? 'tool')
      const kind = isSkill(tool) ? 'skill' : 'tool'
      lit.add(kind === 'skill' ? 'skills' : 'tools')

      return {
        ...state,
        lit,
        tools: [
          ...state.tools,
          { id: `${tool}-${state.tools.length}`, tool, preview: (data.preview as string) ?? null, status: 'running', kind }
        ]
      }
    }

    case 'tool.completed':
    case 'tool.failed': {
      const tool = String(data.tool ?? '')
      const idx = [...state.tools].reverse().findIndex(t => t.tool === tool && t.status === 'running')

      if (idx < 0) {
        return state
      }

      const real = state.tools.length - 1 - idx
      const tools = state.tools.map((t, i) => (i === real ? { ...t, status: name === 'tool.failed' ? 'failed' : 'done' } : t)) as RunTool[]

      return { ...state, tools }
    }

    case 'subagent.start':
      lit.add('delegation')

      return {
        ...state,
        lit,
        subagents: [
          ...state.subagents,
          { id: String(data.subagent_id ?? state.subagents.length), goal: (data.goal as string) ?? null, status: 'running' }
        ]
      }

    case 'subagent.complete':
      return {
        ...state,
        subagents: state.subagents.map(s => (s.id === String(data.subagent_id ?? '') ? { ...s, status: 'done' } : s))
      }

    case 'approval.request':
      return { ...state, status: 'waiting_for_approval' }

    case 'run.completed':
      return { ...state, status: 'completed', endedAt: now }

    case 'run.failed':
      return { ...state, status: 'failed', endedAt: now, error: String(data.error ?? 'run failed') }

    default:
      return state
  }
}

export function elapsedMs(state: RunView, now: number): number | null {
  if (state.startedAt === null) {
    return null
  }

  return (state.endedAt ?? now) - state.startedAt
}
