import { describe, expect, it } from 'vitest'

import { cardHealth, workerOutputOf } from './board/board-model'
import { applyRunSnapshot, initialRun, pendingClarify } from './canvas/run-stream'
import { createKanbanStream } from './feed/kanban-stream'

describe('v0.22 run snapshot', () => {
  const running = { ...initialRun(), runId: 'r1', status: 'running' as const }

  it('maps status unknown to the unknown badge state and keeps admission/generation', () => {
    const v = applyRunSnapshot(running, { status: 'unknown', admission_id: 'a1', execution_generation: 2, pending_controls: [] }, 5)
    expect(v.status).toBe('unknown')
    expect(v.admissionId).toBe('a1')
    expect(v.executionGeneration).toBe(2)
  })

  it('a pending clarify prompt moves a running run to waiting_for_input', () => {
    const v = applyRunSnapshot(running, {
      status: 'running',
      execution_generation: 1,
      pending_controls: [{ kind: 'clarify', prompt_id: 'p1', payload: { question: 'Which?', choices: ['a', 'b'] } }]
    }, 5)

    expect(v.status).toBe('waiting_for_input')
    expect(v.clarify).toEqual({ requestId: 'p1', question: 'Which?', choices: ['a', 'b'] })
  })

  it('ignores approval prompts for clarify and never resurrects a finished run', () => {
    expect(pendingClarify([{ kind: 'approval', prompt_id: 'x' }])).toBeNull()
    const done = { ...running, status: 'completed' as const }
    expect(applyRunSnapshot(done, { status: 'unknown' }, 1)).toBe(done)
  })
})

describe('v0.22 card health', () => {
  it('reads held reasons and the worker last output from diagnostics', () => {
    const h = cardHealth({
      id: 't1',
      title: 'x',
      status: 'ready',
      diagnostics: [
        { kind: 'stranded_in_ready', title: 'Held: blocker_auth', detail: 'check credentials' },
        { kind: 'repeated_crashes', title: 'Crashed 3x', detail: "exit 1. Worker's last output: 'no API key for openrouter'" }
      ]
    })

    expect(h.held).toEqual({ title: 'Held: blocker_auth', detail: 'check credentials' })
    expect(h.failure).toEqual({ title: 'Crashed 3x', output: 'no API key for openrouter' })
  })

  it('no diagnostics means no health line', () => {
    expect(cardHealth({ id: 't', title: 't', status: 'todo' })).toEqual({ held: null, failure: null })
    expect(workerOutputOf('plain error')).toBe('plain error')
  })
})

describe('v0.22 kanban stream: board gone', () => {
  it('ends terminally on board_gone with no retry timer', async () => {
    let listener: ((p: { subscriptionId: string; type: string; code?: string }) => void) | null = null
    let opens = 0

    const bridge = {
      open: async () => ((opens += 1), { subscriptionId: 's1', ended: false }),
      close: async () => undefined,
      onEvent: (cb: typeof listener) => ((listener = cb), () => (listener = null))
    }

    const s = createKanbanStream({ bridge: bridge as never, reconnectMs: [1], openTimeoutMs: 0 })
    s.start()
    await new Promise(r => setTimeout(r, 0))
    listener!({ subscriptionId: 's1', type: 'end', code: 'board_gone' })
    expect(s.getState()).toMatchObject({ mode: 'poll', gone: true, reason: 'board gone' })
    expect(s.resources().retryTimer).toBe(false)
    await new Promise(r => setTimeout(r, 20))
    expect(opens).toBe(1)
    s.stop()
  })
})
