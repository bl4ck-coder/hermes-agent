import { describe, expect, it } from 'vitest'

import { followOpsSse, isBoardGone, opsSsePath } from './ops-sse-bridge'
import { createRunsProxy, type RunsTransport, type TransportRequest } from './runs-proxy'

const KEY = 'sk-v022'
const target = async () => ({ baseUrl: 'http://127.0.0.1:8642', key: KEY })
const codeOf = (r: unknown) => (r as { code?: string }).code

function fake(responses: Array<{ status: number; text: string }>) {
  const requests: TransportRequest[] = []

  const transport: RunsTransport = {
    async request(req) {
      requests.push(req)

      return responses.shift() ?? { status: 500, text: 'none' }
    },
    async stream() {
      return { status: 401 }
    }
  }

  return { transport, requests }
}

describe('v0.22 runs: clarify and resolve-unknown', () => {
  it('POST /clarify sends exactly request_id, execution_generation, answer', async () => {
    const { transport, requests } = fake([{ status: 200, text: '{"ok":true}' }])
    const proxy = createRunsProxy({ resolveTarget: target, transport })
    const res = await proxy.clarify({}, 'r1', { request_id: 'p1', execution_generation: 3, answer: 'yes' })
    expect(res.ok).toBe(true)
    expect(requests[0].url).toBe('http://127.0.0.1:8642/v1/runs/r1/clarify')
    expect(JSON.parse(String(requests[0].body))).toEqual({ request_id: 'p1', execution_generation: 3, answer: 'yes' })
  })

  it('refuses a clarify without a generation or answer before calling the gateway', async () => {
    const { transport, requests } = fake([])
    const proxy = createRunsProxy({ resolveTarget: target, transport })
    expect(codeOf(await proxy.clarify({}, 'r1', { request_id: 'p1', execution_generation: 1.5, answer: 'x' }))).toBe('invalid_body')
    expect(codeOf(await proxy.clarify({}, 'r1', { request_id: 'p1', execution_generation: 1, answer: '  ' }))).toBe('invalid_body')
    expect(requests).toHaveLength(0)
  })

  it('POST /resolve-unknown echoes admission_id and execution_generation only', async () => {
    const { transport, requests } = fake([{ status: 200, text: '{"run_id":"r1"}' }])
    const proxy = createRunsProxy({ resolveTarget: target, transport })
    await proxy.resolveUnknown({}, 'r1', { admission_id: 'a9', execution_generation: 2 })
    expect(requests[0].url).toBe('http://127.0.0.1:8642/v1/runs/r1/resolve-unknown')
    expect(JSON.parse(String(requests[0].body))).toEqual({ admission_id: 'a9', execution_generation: 2 })
    expect(codeOf(await proxy.resolveUnknown({}, 'r1', { admission_id: '', execution_generation: 2 }))).toBe('invalid_body')
  })

  it('approve forwards an integer execution_generation', async () => {
    const { transport, requests } = fake([{ status: 200, text: '{}' }])
    const proxy = createRunsProxy({ resolveTarget: target, transport })
    await proxy.approve({}, 'r1', { choice: 'once', request_id: 'q', execution_generation: 4 })
    expect(JSON.parse(String(requests[0].body))).toEqual({ choice: 'once', request_id: 'q', execution_generation: 4 })
  })
})

describe('v0.22 ops SSE: one backend, board gone', () => {
  it('names the profile as a query param', () => {
    expect(opsSsePath({ path: '/api/plugins/kanban/events/stream', board: 'b1', profile: 'coder' })).toBe(
      '/api/plugins/kanban/events/stream?board=b1&profile=coder'
    )
  })

  it('404 and 1008 on a named kanban board are board_gone', () => {
    const req = { path: '/api/plugins/kanban/events/stream', board: 'old' }
    expect(isBoardGone(req, 404)).toBe(true)
    expect(isBoardGone(req, 1008)).toBe(true)
    expect(isBoardGone({ path: '/api/plugins/kanban/events/stream' }, 404)).toBe(false)
    expect(isBoardGone({ path: '/api/ops/fleet/stream', board: 'old' }, 404)).toBe(false)
  })

  it('ends with board_gone and does not reconnect', async () => {
    let opens = 0

    const transport: RunsTransport = {
      async request() {
        return { status: 500, text: '' }
      },
      async stream() {
        opens += 1

        return { status: 404 }
      }
    }

    const ends: string[] = []

    const h = followOpsSse({
      request: { path: '/api/plugins/kanban/events/stream', board: 'old' },
      resolveTarget: async () => ({ baseUrl: 'http://x', token: 't' }),
      transport,
      onEvent: () => {},
      onEnd: r => ends.push(r.code),
      backoffMs: 1
    })

    await h.done
    expect(ends).toEqual(['board_gone'])
    expect(opens).toBe(1)
  })
})
