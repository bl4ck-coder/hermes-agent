import { describe, expect, it } from 'vitest'

import { createRunKeyStore } from './run-key-store'
import { createRunsProxy, type RunsTransport, type TransportStream } from './runs-proxy'
import { RUNS_IPC, registerRunsProxyIpc } from './runs-proxy-ipc'
import { followOpsSse, opsSsePath } from './ops-sse-bridge'

const KEY = 'sk-main-only'
const TOKEN = 'session-token-main-only'

function harness(streams: Array<(r: TransportStream) => number> = []) {
  const handlers = new Map<string, (...a: any[]) => any>()
  const sent: Array<{ channel: string; payload: any }> = []
  let destroyed: (() => void) | null = null
  const sender = {
    id: 7,
    send: (channel: string, payload: unknown) => sent.push({ channel, payload }),
    isDestroyed: () => false,
    once: (_e: 'destroyed', cb: () => void) => {
      destroyed = cb
    }
  }
  const streamReqs: TransportStream[] = []
  const transport: RunsTransport = {
    request: async () => ({ status: 200, text: `{"run_id":"r1","echo":"ok"}` }),
    stream: async req => {
      streamReqs.push(req)
      const s = streams.shift()

      if (!s) {
        // hang until aborted
        await new Promise<void>(resolve => req.signal.addEventListener('abort', () => resolve()))

        return { status: 0 }
      }

      return { status: s(req) }
    }
  }
  let text = ''
  const keyStore = createRunKeyStore({
    isEncryptionAvailable: () => true,
    encryptString: s => Buffer.from([...Buffer.from(s)].map(b => b ^ 0x55)),
    decryptString: b => Buffer.from([...Buffer.from(b)].map(x => x ^ 0x55)).toString(),
    readStoreText: () => text || '{}',
    writeStoreText: t => {
      text = t
    }
  })
  const proxy = createRunsProxy({ resolveTarget: async () => ({ baseUrl: 'http://127.0.0.1:8642', key: KEY }), transport })
  const reg = registerRunsProxyIpc({
    ipcMain: { handle: (c, fn) => handlers.set(c, fn) },
    proxy,
    keyStore,
    transport,
    resolveServeTarget: async () => ({ baseUrl: 'http://127.0.0.1:5000', token: TOKEN })
  })
  const invoke = (c: string, ...a: any[]) => handlers.get(c)!({ sender }, ...a)

  return { invoke, sent, streamReqs, reg, destroy: () => destroyed?.(), handlers, keyText: () => text }
}

describe('runs proxy IPC', () => {
  it('registers every channel and never returns a key or token to the renderer', async () => {
    const h = harness()
    expect([...h.handlers.keys()].sort()).toEqual(
      Object.values(RUNS_IPC)
        .filter(c => !c.endsWith(':event'))
        .sort()
    )
    const results = [
      await h.invoke(RUNS_IPC.get, { connectionId: 'local' }, 'r1'),
      await h.invoke(RUNS_IPC.keySet, 'homelab', 'https://gw.example', 'sk-remote'),
      await h.invoke(RUNS_IPC.keyStatus, 'homelab')
    ]
    const blob = JSON.stringify(results)
    expect(blob).not.toContain(KEY)
    expect(blob).not.toContain('sk-remote')
    expect(results[2]).toEqual({ configured: true, baseUrl: 'https://gw.example' })
    expect(h.keyText()).not.toContain('sk-remote')
  })

  it('run events are forwarded and closed per sender; renderer destroy tears down', async () => {
    const h = harness()
    const { subscriptionId } = await h.invoke(RUNS_IPC.eventsOpen, {}, 'r1', {})
    expect(h.reg.activeSubscriptions()).toBe(1)
    h.destroy()
    expect(h.reg.activeSubscriptions()).toBe(0)
    expect(subscriptionId).toMatch(/^sub-/)
  })

  it('ops SSE bridge adds the session token in main and forwards events', async () => {
    const h = harness([
      req => {
        req.onChunk('id: 5\nevent: kanban\ndata: {"id":5}\n\n')

        return 401
      }
    ])
    await h.invoke(RUNS_IPC.opsSseOpen, { path: '/api/plugins/kanban/events/stream', board: 'ops' })
    await new Promise(r => setTimeout(r, 20))
    expect(h.streamReqs[0].headers['X-Hermes-Session-Token']).toBe(TOKEN)
    expect(h.streamReqs[0].url).toBe('http://127.0.0.1:5000/api/plugins/kanban/events/stream?board=ops')
    const payloads = h.sent.map(s => s.payload)
    expect(payloads[0]).toMatchObject({ type: 'event', id: '5', event: 'kanban' })
    expect(payloads[1]).toMatchObject({ type: 'end', code: 'unauthorized' })
    expect(JSON.stringify(h.sent)).not.toContain(TOKEN)
  })

  it('ops SSE rejects non-allowlisted paths', async () => {
    expect(() => opsSsePath({ path: '/api/env' })).toThrow()
    const h = harness()
    const r = await h.invoke(RUNS_IPC.opsSseOpen, { path: '/api/config' })
    expect(r.ended).toBe(true)
    expect(h.sent[0].payload).toMatchObject({ type: 'end', code: 'path_not_allowed' })
  })
})

describe('ops SSE reconnect', () => {
  it('resumes with Last-Event-ID after a drop: no lost, no repeated events', async () => {
    const got: string[] = []
    const reqs: TransportStream[] = []
    const plan = [
      (r: TransportStream) => {
        r.onChunk('id: 10\ndata: a\n\nid: 11\ndata: b\n\n')

        return 200
      },
      (r: TransportStream) => {
        r.onChunk('id: 12\ndata: c\n\n')

        return 404
      }
    ]
    const transport: RunsTransport = {
      request: async () => ({ status: 200, text: '{}' }),
      stream: async r => {
        reqs.push(r)

        return { status: plan.shift()!(r) }
      }
    }
    let end: any
    await followOpsSse({
      request: { path: '/api/ops/fleet/stream', lastEventId: '9' },
      resolveTarget: async () => ({ baseUrl: 'http://b', token: 't' }),
      transport,
      onEvent: e => got.push(e.id!),
      onEnd: r => (end = r),
      backoffMs: 1
    }).done
    expect(got).toEqual(['10', '11', '12'])
    expect(reqs.map(r => r.headers['Last-Event-ID'])).toEqual(['9', '11'])
    expect(end.code).toBe('route_not_found')
  })
})
