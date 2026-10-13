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
  status: 'idle' | 'starting' | 'running' | 'waiting_for_approval' | 'completed' | 'failed'
  text: string
  tokens: number
  startedAt: number | null
  endedAt: number | null
  tools: RunTool[]
  subagents: { id: string; goal: string | null; status: 'running' | 'done' }[]
  error: string | null
  lit: Set<string>
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
