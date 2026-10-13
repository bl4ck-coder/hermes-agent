import http from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'

import { followOpsSse } from './ops-sse-bridge'
import { createRunsProxy } from './runs-proxy'
import { createNodeRunsTransport } from './runs-transport'

let server: http.Server | null = null

afterEach(() => new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve())))

function listen(handler: http.RequestListener): Promise<string> {
  server = http.createServer(handler)

  return new Promise(resolve =>
    server!.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server!.address() as AddressInfo).port}`))
  )
}

describe('node transport against a real http server', () => {
  it('GET run with bearer and 401 without the right key', async () => {
    const base = await listen((req, res) => {
      if (req.headers.authorization !== 'Bearer good') {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end('{"error":{"code":"gateway_auth_failed"}}')

        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ run_id: req.url!.split('/').pop(), status: 'running' }))
    })

    const transport = createNodeRunsTransport()
    const good = createRunsProxy({ resolveTarget: async () => ({ baseUrl: base, key: 'good' }), transport })
    const bad = createRunsProxy({ resolveTarget: async () => ({ baseUrl: base, key: 'bad' }), transport })
    expect(await good.getRun({}, 'r7')).toEqual({ ok: true, status: 200, data: { run_id: 'r7', status: 'running' } })
    expect(await bad.getRun({}, 'r7')).toMatchObject({ ok: false, status: 401, code: 'gateway_auth_failed' })
  })

  it('SSE survives server-side drops and resumes from Last-Event-ID with no gap or duplicate', async () => {
    const events = Array.from({ length: 6 }, (_, i) => i + 1)
    const seenHeaders: Array<string | undefined> = []
    let connections = 0

    const base = await listen((req, res) => {
      connections += 1
      seenHeaders.push(req.headers['last-event-id'] as string | undefined)
      const from = Number(req.headers['last-event-id'] ?? 0)
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      const batch = events.filter(e => e > from).slice(0, 3)

      for (const e of batch) {
        res.write(`id: ${e}\nevent: kanban\ndata: {"id":${e}}\n\n`)
      }

      if (connections >= 3) {
        res.end()
        server!.close()

        return
      }

      res.end() // server drops the stream without the close sentinel
    })

    const got: string[] = []
    let end: any
    await followOpsSse({
      request: { path: '/api/plugins/kanban/events/stream' },
      resolveTarget: async () => ({ baseUrl: base, token: 't' }),
      transport: createNodeRunsTransport(),
      onEvent: e => got.push(e.id!),
      onEnd: r => (end = r),
      backoffMs: 5,
      maxReconnects: 2
    }).done
    expect(got).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(seenHeaders.slice(0, 3)).toEqual([undefined, '3', '6'])
    expect(end.code).toBe('reconnect_exhausted')
  })
})
