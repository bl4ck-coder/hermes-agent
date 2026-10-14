/** P8 batch 2 (F1): fault injection for the kanban push stream: drops, 401/403, slow replies. */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createKanbanStream } from './kanban-stream'
import type { OpsSseBridge } from './ops-feed'

afterEach(() => vi.useRealTimers())

type Payload = Parameters<Parameters<OpsSseBridge['onEvent']>[0]>[0]

function bridgeWith(open: OpsSseBridge['open']) {
  let cb: ((p: Payload) => void) | null = null

  const bridge: OpsSseBridge = { open: vi.fn(open), close: vi.fn().mockResolvedValue(undefined), onEvent: c => ((cb = c), () => (cb = null)) }

  return { bridge, emit: (p: Payload) => cb?.(p) }
}

const frame = (id: number, sub = 's1') => ({ subscriptionId: sub, type: 'event' as const, event: 'kanban', data: JSON.stringify({ id, task_id: 't', kind: 'commented', created_at: 1 }) })

describe('kanban stream faults (P8 b2, F1)', () => {
  it('drop mid-stream: falls back, reconnects, and a replayed event is not counted twice', async () => {
    vi.useFakeTimers()
    let n = 0
    const { bridge, emit } = bridgeWith(async () => ({ subscriptionId: `s${++n}`, ended: false }))
    const s = createKanbanStream({ bridge, reconnectMs: [100] })
    s.start()
    await vi.advanceTimersByTimeAsync(0)
    emit(frame(1))
    emit({ subscriptionId: 's1', type: 'end', code: 'network' } as Payload)
    expect(s.getState()).toMatchObject({ mode: 'poll', reason: 'stream ended (network)' })
    await vi.advanceTimersByTimeAsync(100)
    expect(s.getState().mode).toBe('stream')
    // Last-Event-ID replay of id 1 on the new subscription + a new id 2
    emit(frame(1, 's2'))
    emit(frame(2, 's2'))
    // frames from the dead subscription are ignored
    emit(frame(3, 's1'))
    expect(s.getState().events.map(e => e.id)).toEqual([2, 1])
    expect(s.getState().version).toBe(2)
    s.stop()
  })

  it('401: polls, records the auth reason, and waits the longest step instead of hammering', async () => {
    vi.useFakeTimers()
    const { bridge } = bridgeWith(() => Promise.reject(new Error('401: unauthorized')))
    const s = createKanbanStream({ bridge, reconnectMs: [100, 1000, 5000] })
    s.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(s.getState()).toMatchObject({ mode: 'poll', reason: 'auth refused (401)' })
    await vi.advanceTimersByTimeAsync(4999)
    expect(bridge.open).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(bridge.open).toHaveBeenCalledTimes(2)
    s.stop()
  })

  it('500 retries on the short step', async () => {
    vi.useFakeTimers()
    const { bridge } = bridgeWith(() => Promise.reject(new Error('500: boom')))
    const s = createKanbanStream({ bridge, reconnectMs: [100, 1000, 5000] })
    s.start()
    await vi.advanceTimersByTimeAsync(100)
    expect(bridge.open).toHaveBeenCalledTimes(2)
    expect(s.getState().reason).toBe('500: boom')
    s.stop()
  })

  it('slow reply: an open with no answer in time falls back to poll; the late answer is closed, not used', async () => {
    vi.useFakeTimers()
    let release: (v: { subscriptionId: string; ended: boolean }) => void = () => undefined
    let n = 0
    const { bridge, emit } = bridgeWith(() => (++n === 1 ? new Promise(r => (release = r)) : Promise.resolve({ subscriptionId: 's2', ended: false })))
    const s = createKanbanStream({ bridge, reconnectMs: [1000], openTimeoutMs: 500 })
    s.start()
    await vi.advanceTimersByTimeAsync(500)
    expect(s.getState()).toMatchObject({ mode: 'poll', reason: 'no answer in 0.5 s' })
    release({ subscriptionId: 'late', ended: false })
    await vi.advanceTimersByTimeAsync(0)
    expect(bridge.close).toHaveBeenCalledWith('late')
    emit(frame(9, 'late'))
    expect(s.getState().events).toEqual([])
    await vi.advanceTimersByTimeAsync(1000)
    expect(s.getState().mode).toBe('stream')
    s.stop()
  })

  it('stop during a slow open closes the subscription when it finally answers', async () => {
    vi.useFakeTimers()
    let release: (v: { subscriptionId: string; ended: boolean }) => void = () => undefined
    const { bridge } = bridgeWith(() => new Promise(r => (release = r)))
    const s = createKanbanStream({ bridge, openTimeoutMs: 0 })
    s.start()
    await vi.advanceTimersByTimeAsync(0)
    s.stop()
    release({ subscriptionId: 'x', ended: false })
    await vi.advanceTimersByTimeAsync(0)
    expect(bridge.close).toHaveBeenCalledWith('x')
  })
})
