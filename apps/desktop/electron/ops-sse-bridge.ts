/**
 * ops-sse-bridge.ts
 *
 * Main-process follower for the backend's Ops SSE routes (ops-panel P1-06,
 * closing the P1-05 gap): the dashboard session token is a header, which a
 * renderer EventSource cannot send, and the renderer never holds it. Main opens
 * the stream with the token, parses frames, forwards events over IPC, and on a
 * dropped connection reconnects with `Last-Event-ID` = the last seen id so the
 * renderer sees one continuous, gap-free stream.
 *
 * Only allowlisted read-only paths may be opened. Standalone (no electron).
 */

import { createSseParser, type RunsTransport, type SseEvent } from './runs-proxy'

export const OPS_SSE_PATHS = ['/api/plugins/kanban/events/stream', '/api/ops/fleet/stream'] as const

export interface ServeTarget {
  baseUrl: string
  token: string
}

export interface OpsSseOpenRequest {
  path: string
  profile?: string | null
  board?: string | null
  lastEventId?: string | null
}

export function opsSsePath(req: OpsSseOpenRequest): string {
  const path = String(req?.path ?? '')

  if (!(OPS_SSE_PATHS as readonly string[]).includes(path)) {
    throw new Error(`ops SSE path not allowed: ${path.slice(0, 120)}`)
  }

  const qs = new URLSearchParams()

  if (req.board) {
    qs.set('board', String(req.board))
  }

  // One backend serves every profile (v0.22): the profile rides as a query param, not a backend pick.
  if (req.profile) {
    qs.set('profile', String(req.profile))
  }

  const q = qs.toString()

  return q ? `${path}?${q}` : path
}

/** 404 (SSE) or 1008 (WS policy close) for a kanban stream opened on a named board means the board is gone. */
export function isBoardGone(req: OpsSseOpenRequest, status: number): boolean {
  return req?.path === OPS_SSE_PATHS[0] && Boolean(req.board) && (status === 404 || status === 1008)
}

export function followOpsSse(opts: {
  request: OpsSseOpenRequest
  resolveTarget: (profile: string | null) => Promise<ServeTarget>
  transport: RunsTransport
  onEvent: (event: SseEvent) => void
  onEnd: (reason: { code: string; status: number }) => void
  maxReconnects?: number
  backoffMs?: number
}): { close(): void; done: Promise<void> } {
  const controller = new AbortController()
  let lastId = opts.request.lastEventId ?? null
  const maxReconnects = opts.maxReconnects ?? 50
  const backoffMs = opts.backoffMs ?? 1000
  let path: string

  try {
    path = opsSsePath(opts.request)
  } catch {
    opts.onEnd({ code: 'path_not_allowed', status: 0 })

    return { close() {}, done: Promise.resolve() }
  }

  const done = (async () => {
    let attempts = 0

    while (!controller.signal.aborted) {
      let target: ServeTarget | null = null

      try {
        target = await opts.resolveTarget(opts.request.profile ?? null)
      } catch {
        target = null
      }

      let status = 0

      if (target) {
        const parser = createSseParser(ev => {
          if (ev.id !== null) {
            lastId = ev.id
          }

          attempts = 0
          opts.onEvent(ev)
        })

        try {
          ;({ status } = await opts.transport.stream({
            url: `${target.baseUrl.replace(/\/+$/, '')}${path}`,
            headers: {
              'X-Hermes-Session-Token': target.token,
              Accept: 'text/event-stream',
              ...(lastId !== null ? { 'Last-Event-ID': lastId } : {})
            },
            onChunk: chunk => parser.feed(chunk),
            signal: controller.signal
          }))
        } catch {
          status = 0
        }
      }

      if (controller.signal.aborted) {
        break
      }

      // A board slug that names an archived or deleted board: the SSE route answers 404, the WS route
      // closes 1008. Either way the board is gone; reconnecting would only repeat the refusal.
      if (isBoardGone(opts.request, status)) {
        opts.onEnd({ code: 'board_gone', status })

        return
      }

      if (status === 401 || status === 403 || status === 404) {
        opts.onEnd({ code: status === 404 ? 'route_not_found' : 'unauthorized', status })

        return
      }

      attempts += 1

      if (attempts > maxReconnects) {
        opts.onEnd({ code: 'reconnect_exhausted', status })

        return
      }

      await new Promise(resolve => setTimeout(resolve, Math.min(backoffMs * attempts, 15_000)))
    }

    opts.onEnd({ code: 'closed', status: 0 })
  })()

  return { close: () => controller.abort(), done }
}
