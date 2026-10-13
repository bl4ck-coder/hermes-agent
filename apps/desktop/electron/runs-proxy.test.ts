import { describe, expect, it } from 'vitest'

import {
  createRunsProxy,
  createSseParser,
  localGatewayTarget,
  parseDotenv,
  redactKey,
  type RunsTransport,
  type TransportRequest,
  type TransportStream
} from './runs-proxy'

const KEY = 'sk-local-secret-123'

function fakeTransport(responses: Array<{ status: number; text: string }>, streams: Array<(req: TransportStream) => number> = []) {
  const requests: TransportRequest[] = []
  const streamReqs: TransportStream[] = []
  const transport: RunsTransport = {
    async request(req) {
      requests.push(req)
      const r = responses.shift()

      if (!r) {
        throw new Error(`connect ECONNREFUSED with header Bearer ${KEY}`)
      }

      return r
    },
    async stream(req) {
      streamReqs.push(req)
      const next = streams.shift()

      return { status: next ? next(req) : 401 }
    }
  }

  return { transport, requests, streamReqs }
}

const target = async () => ({ baseUrl: 'http://127.0.0.1:8642/', key: KEY })

describe('dotenv + local target', () => {
  it('reads API_SERVER_KEY with export, quotes, comments', () => {
    const env = parseDotenv('# c\nexport API_SERVER_KEY="abc def"\nAPI_SERVER_PORT=9000 # port\nBAD LINE\n')
    expect(env).toEqual({ API_SERVER_KEY: 'abc def', API_SERVER_PORT: '9000' })
  })

  it('defaults to 127.0.0.1:8642, maps wildcard binds to loopback, null key when absent', () => {
    expect(localGatewayTarget('')).toEqual({ baseUrl: 'http://127.0.0.1:8642', key: null })
    expect(localGatewayTarget('API_SERVER_HOST=0.0.0.0\nAPI_SERVER_PORT=8700\nAPI_SERVER_KEY=k')).toEqual({
      baseUrl: 'http://127.0.0.1:8700',
      key: 'k'
    })
    expect(localGatewayTarget('API_SERVER_PORT=nope').baseUrl).toBe('http://127.0.0.1:8642')
  })
})

describe('runs proxy', () => {
  it('GET /v1/runs/{id} sends the bearer key from main and returns typed data', async () => {
    const { transport, requests } = fakeTransport([{ status: 200, text: '{"object":"hermes.run","run_id":"r1","status":"running"}' }])
    const proxy = createRunsProxy({ resolveTarget: target, transport })
    const res = await proxy.getRun({}, 'r1')
    expect(res).toEqual({ ok: true, status: 200, data: { object: 'hermes.run', run_id: 'r1', status: 'running' } })
    expect(requests[0].url).toBe('http://127.0.0.1:8642/v1/runs/r1')
    expect(requests[0].headers.Authorization).toBe(`Bearer ${KEY}`)
  })

  it('rejects path-injection run ids without calling the gateway', async () => {
    const { transport, requests } = fakeTransport([])
    const proxy = createRunsProxy({ resolveTarget: target, transport })

    for (const bad of ['../admin', 'a/b', '', 'x?y=1']) {
      const res = await proxy.getRun({}, bad)
      expect(res).toMatchObject({ ok: false, code: 'invalid_run_id' })
    }

    expect(requests).toHaveLength(0)
  })

  it('approve posts {choice, request_id} and maps 409 approval_not_pending', async () => {
    const { transport, requests } = fakeTransport([
      { status: 200, text: '{"resolved":1}' },
      { status: 409, text: '{"error":{"code":"approval_not_pending","message":"nothing"}}' }
    ])
    const proxy = createRunsProxy({ resolveTarget: target, transport })
    expect(await proxy.approve({}, 'r1', { choice: 'approve', request_id: 'q1' })).toMatchObject({ ok: true, data: { resolved: 1 } })
    expect(JSON.parse(requests[0].body!)).toEqual({ choice: 'approve', request_id: 'q1' })
    expect(requests[0].url).toBe('http://127.0.0.1:8642/v1/runs/r1/approval')
    expect(await proxy.approve({}, 'r1', { choice: 'once', request_id: 'q1' })).toMatchObject({
      ok: false,
      status: 409,
      code: 'approval_not_pending'
    })
    expect(await proxy.approve({}, 'r1', { choice: 'rm -rf' })).toMatchObject({ ok: false, code: 'invalid_choice' })
  })

  it('stop/steer/create hit the right routes', async () => {
    const { transport, requests } = fakeTransport([
      { status: 200, text: '{}' },
      { status: 200, text: '{}' },
      { status: 202, text: '{"run_id":"r9"}' }
    ])
    const proxy = createRunsProxy({ resolveTarget: target, transport })
    await proxy.stop({}, 'r1')
    await proxy.steer({}, 'r1', { text: 'go' })
    expect(await proxy.createRun({}, { input: 'hi' })).toMatchObject({ ok: true, data: { run_id: 'r9' } })
    expect(requests.map(r => `${r.method} ${r.url.slice(21)}`)).toEqual([
      'POST /v1/runs/r1/stop',
      'POST /v1/runs/r1/steer',
      'POST /v1/runs'
    ])
  })

  it('never leaks the key in error results (gateway echo or transport error)', async () => {
    const { transport } = fakeTransport([{ status: 500, text: `boom Authorization: Bearer ${KEY}` }])
    const proxy = createRunsProxy({ resolveTarget: target, transport })
    const r1 = await proxy.getRun({}, 'r1')
    const r2 = await proxy.getRun({}, 'r1') // transport throws with the key in its message
    expect(JSON.stringify([r1, r2])).not.toContain(KEY)
    expect(r2).toMatchObject({ ok: false, code: 'gateway_unreachable' })
  })

  it('missing key resolves to a typed error, not a throw', async () => {
    const { transport } = fakeTransport([])
    const proxy = createRunsProxy({
      resolveTarget: async () => {
        const { RunsProxyError } = await import('./runs-proxy')
        throw new RunsProxyError('gateway_key_missing', 'API_SERVER_KEY not set')
      },
      transport
    })
    expect(await proxy.getRun({}, 'r1')).toMatchObject({ ok: false, code: 'gateway_key_missing' })
  })

  it('redactKey strips bearer tokens and the literal key', () => {
    expect(redactKey(`x ${KEY} Bearer abc`, KEY)).toBe('x <redacted> Bearer <redacted>')
  })
})

describe('SSE parser + run events', () => {
  it('parses ids, events, multi-line data, comments, CRLF and split chunks', () => {
    const out: any[] = []
    const comments: string[] = []
    const p = createSseParser(e => out.push(e), c => comments.push(c))
    p.feed(': open\r\nid: 1\r\nevent: run.delta\r\ndata: a\r\n')
    p.feed('data: b\r\n\r\nid: 2\ndata: {"x":1}\n\n: keep')
    p.feed('alive\n')
    expect(out).toEqual([
      { id: '1', event: 'run.delta', data: 'a\nb' },
      { id: '2', event: 'message', data: '{"x":1}' }
    ])
    expect(comments).toEqual(['open', 'keepalive'])
    expect(p.lastEventId).toBe('2')
  })

  it('reconnects with Last-Event-ID after a drop: no gap, no duplicate; ends on stream closed', async () => {
    const delivered: string[] = []
    const { transport, streamReqs } = fakeTransport(
      [],
      [
        req => {
          req.onChunk('id: 1\ndata: a\n\nid: 2\ndata: b\n\n')

          return 200 // dropped mid-run (no "stream closed")
        },
        req => {
          req.onChunk('id: 3\ndata: c\n\n: stream closed\n')

          return 200
        }
      ]
    )
    const proxy = createRunsProxy({ resolveTarget: target, transport })
    let end: any
    const h = proxy.openEvents({}, 'r1', { backoffMs: 1 }, e => delivered.push(e.id!), r => (end = r))
    await h.done
    expect(delivered).toEqual(['1', '2', '3'])
    expect(streamReqs[0].headers['Last-Event-ID']).toBeUndefined()
    expect(streamReqs[1].headers['Last-Event-ID']).toBe('2')
    expect(streamReqs[1].headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(end).toEqual({ code: 'stream_closed', status: 200 })
  })

  it('auth failure ends the stream without retry', async () => {
    const { transport, streamReqs } = fakeTransport([], [() => 401])
    const proxy = createRunsProxy({ resolveTarget: target, transport })
    let end: any
    await proxy.openEvents({}, 'r1', { backoffMs: 1 }, () => {}, r => (end = r)).done
    expect(end).toEqual({ code: 'gateway_auth_failed', status: 401 })
    expect(streamReqs).toHaveLength(1)
  })
})
