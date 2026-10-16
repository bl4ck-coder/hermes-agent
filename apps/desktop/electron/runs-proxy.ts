/**
 * runs-proxy.ts
 *
 * Typed main-process proxy for the gateway API server's `/v1/runs/*` routes
 * (ops-panel P1-06, SPEC section 7: `API_SERVER_KEY` stays in the main process).
 *
 * Key source (decision, Nacho 2026-10-13 19:47 ART):
 *  - local connection: main reads `API_SERVER_KEY` from the local profile's `.env`;
 *  - remote / SSH connection: main keeps the key in the OS keychain (see
 *    run-key-store.ts, Electron safeStorage). The renderer never receives it.
 *
 * Kept standalone (no `import 'electron'`) so it unit-tests under the electron
 * vitest project; main.ts injects the transport and the target resolver.
 */

export interface RunsTarget {
  baseUrl: string
  key: string
}

export interface RunsTargetRef {
  connectionId?: string | null
  profile?: string | null
}

export interface TransportRequest {
  method: 'GET' | 'POST'
  url: string
  headers: Record<string, string>
  body?: string
  timeoutMs?: number
}

export interface TransportResponse {
  status: number
  text: string
}

export interface TransportStream {
  url: string
  headers: Record<string, string>
  onChunk: (chunk: string) => void
  signal: AbortSignal
}

export interface RunsTransport {
  request(req: TransportRequest): Promise<TransportResponse>
  /** Resolves with the HTTP status once the stream ends (or fails to open). */
  stream(req: TransportStream): Promise<{ status: number }>
}

export type RunsResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; message: string }

export class RunsProxyError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
  }
}

export const RUN_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/
const APPROVAL_CHOICES = new Set(['once', 'session', 'always', 'deny', 'approve', 'approved', 'allow'])

/** Minimal dotenv reader: `KEY=value`, optional `export`, quotes, `#` comments. */
export function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {}

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)

    if (!m) {
      continue
    }

    let value = m[2]

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else {
      const hash = value.indexOf(' #')

      if (hash >= 0) {
        value = value.slice(0, hash)
      }

      value = value.trim()
    }

    out[m[1]] = value
  }

  return out
}

/** Local gateway address + key from a profile's `.env` text (defaults 127.0.0.1:8642). */
export function localGatewayTarget(envText: string): { baseUrl: string; key: string | null } {
  const env = parseDotenv(envText)
  let host = env.API_SERVER_HOST || '127.0.0.1'

  if (host === '0.0.0.0' || host === '::') {
    host = '127.0.0.1'
  }

  const port = Number.parseInt(env.API_SERVER_PORT || '', 10)
  const safePort = Number.isFinite(port) && port > 0 && port < 65536 ? port : 8642
  const hostPart = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host

  return { baseUrl: `http://${hostPart}:${safePort}`, key: env.API_SERVER_KEY || null }
}

/** Never let the key leak through an error message or log line. */
export function redactKey(text: string, key: string | null | undefined): string {
  let s = String(text ?? '')

  if (key) {
    s = s.split(key).join('<redacted>')
  }

  return s.replace(/(Bearer\s+)[^\s"']+/gi, '$1<redacted>').slice(0, 2000)
}

function errorCode(status: number, text: string): string {
  try {
    const body = JSON.parse(text)
    const code = body?.error?.code ?? body?.code ?? body?.error

    if (typeof code === 'string' && code) {
      return code
    }
  } catch {
    // not JSON
  }

  return status === 401 ? 'gateway_auth_failed' : `http_${status}`
}

export interface SseEvent {
  id: string | null
  event: string
  data: string
}

/** Incremental text/event-stream parser (comments ignored; CRLF tolerant). */
export function createSseParser(onEvent: (event: SseEvent) => void, onComment?: (text: string) => void) {
  let buffer = ''
  let id: string | null = null
  let event = ''
  let data: string[] = []

  const dispatch = () => {
    if (data.length) {
      onEvent({ id, event: event || 'message', data: data.join('\n') })
    }

    event = ''
    data = []
  }

  return {
    feed(chunk: string) {
      buffer += chunk
      let nl: number

      while ((nl = buffer.search(/\r?\n/)) >= 0) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(buffer[nl] === '\r' ? nl + 2 : nl + 1)

        if (line === '') {
          dispatch()

          continue
        }

        if (line.startsWith(':')) {
          onComment?.(line.slice(1).trim())

          continue
        }

        const colon = line.indexOf(':')
        const field = colon < 0 ? line : line.slice(0, colon)
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')

        if (field === 'id') {
          id = value
        } else if (field === 'event') {
          event = value
        } else if (field === 'data') {
          data.push(value)
        }
      }
    },
    get lastEventId() {
      return id
    }
  }
}

export interface RunsProxyDeps {
  resolveTarget: (ref: RunsTargetRef) => Promise<RunsTarget>
  transport: RunsTransport
  timeoutMs?: number
}

export interface RunEventsHandle {
  close(): void
  done: Promise<void>
}

export function createRunsProxy({ resolveTarget, transport, timeoutMs = 20_000 }: RunsProxyDeps) {
  const runPath = (runId: string, suffix = '') => {
    if (!RUN_ID_RE.test(String(runId ?? ''))) {
      throw new RunsProxyError('invalid_run_id', 'invalid run id')
    }

    return `/v1/runs/${encodeURIComponent(runId)}${suffix}`
  }

  async function call<T>(ref: RunsTargetRef, method: 'GET' | 'POST', path: string, body?: unknown): Promise<RunsResult<T>> {
    let target: RunsTarget

    try {
      target = await resolveTarget(ref)
    } catch (error) {
      const code = error instanceof RunsProxyError ? error.code : 'gateway_unavailable'

      return { ok: false, status: 0, code, message: redactKey(String((error as Error)?.message ?? error), null) }
    }

    try {
      const res = await transport.request({
        method,
        url: `${target.baseUrl.replace(/\/+$/, '')}${path}`,
        headers: {
          Authorization: `Bearer ${target.key}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        timeoutMs
      })

      if (res.status >= 400) {
        return { ok: false, status: res.status, code: errorCode(res.status, res.text), message: redactKey(res.text, target.key) }
      }

      let data: any = null

      try {
        data = res.text ? JSON.parse(res.text) : null
      } catch {
        return { ok: false, status: res.status, code: 'invalid_json', message: 'gateway returned non-JSON' }
      }

      return { ok: true, status: res.status, data }
    } catch (error) {
      return { ok: false, status: 0, code: 'gateway_unreachable', message: redactKey(String((error as Error)?.message ?? error), target.key) }
    }
  }

  const guard = async <T>(fn: () => Promise<RunsResult<T>>): Promise<RunsResult<T>> => {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof RunsProxyError) {
        return { ok: false, status: 0, code: error.code, message: error.message }
      }

      throw error
    }
  }

  return {
    getRun: (ref: RunsTargetRef, runId: string) => guard(() => call(ref, 'GET', runPath(runId))),

    createRun: (ref: RunsTargetRef, body: Record<string, unknown>) =>
      guard(async () => {
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new RunsProxyError('invalid_body', 'run body must be an object')
        }

        return call(ref, 'POST', '/v1/runs', body)
      }),

    approve: (ref: RunsTargetRef, runId: string, body: { choice: string; request_id?: string; all?: boolean; execution_generation?: number }) =>
      guard(async () => {
        const choice = String(body?.choice ?? '').toLowerCase()

        if (!APPROVAL_CHOICES.has(choice)) {
          throw new RunsProxyError('invalid_choice', 'invalid approval choice')
        }

        const payload: Record<string, unknown> = { choice }

        if (body.request_id) {
          payload.request_id = String(body.request_id)
        }

        if (body.all === true) {
          payload.all = true
        }

        // v0.22 authority runs answer one exact prompt of one execution generation.
        if (Number.isInteger(body.execution_generation)) {
          payload.execution_generation = body.execution_generation
        }

        return call(ref, 'POST', runPath(runId, '/approval'), payload)
      }),

    steer: (ref: RunsTargetRef, runId: string, body: Record<string, unknown>) =>
      guard(() => call(ref, 'POST', runPath(runId, '/steer'), body ?? {})),

    stop: (ref: RunsTargetRef, runId: string) => guard(() => call(ref, 'POST', runPath(runId, '/stop'), {})),

    /** v0.22 `POST /v1/runs/{id}/clarify`: answer one pending clarify prompt. The gateway wants exactly these three keys. */
    clarify: (ref: RunsTargetRef, runId: string, body: { request_id: string; execution_generation: number; answer: string }) =>
      guard(async () => {
        const requestId = String(body?.request_id ?? '')
        const answer = typeof body?.answer === 'string' ? body.answer : ''

        if (!requestId || !Number.isInteger(body?.execution_generation) || !answer.trim()) {
          throw new RunsProxyError('invalid_body', 'clarify needs request_id, execution_generation and a non-empty answer')
        }

        return call(ref, 'POST', runPath(runId, '/clarify'), {
          request_id: requestId,
          execution_generation: body.execution_generation,
          answer
        })
      }),

    /**
     * v0.22 `POST /v1/runs/{id}/resolve-unknown`: acknowledge the lost owner epoch of a run whose status is
     * `unknown` (not terminal; later turns wait on it). Ends the run like a stop.
     */
    resolveUnknown: (ref: RunsTargetRef, runId: string, body: { admission_id: string; execution_generation: number }) =>
      guard(async () => {
        const admissionId = String(body?.admission_id ?? '')

        if (!admissionId || !Number.isInteger(body?.execution_generation)) {
          throw new RunsProxyError('invalid_body', 'resolve-unknown needs admission_id and execution_generation')
        }

        return call(ref, 'POST', runPath(runId, '/resolve-unknown'), {
          admission_id: admissionId,
          execution_generation: body.execution_generation
        })
      }),

    /**
     * Follow `GET /v1/runs/{id}/events` in main and forward parsed events. On a
     * dropped connection it reconnects with `Last-Event-ID` = the last seen id
     * (the gateway replays from its buffer or emits `replay.truncated`), so the
     * renderer sees one continuous stream. Auth failures (401/403/404) end it.
     */
    openEvents(
      ref: RunsTargetRef,
      runId: string,
      opts: { lastEventId?: string | null; maxReconnects?: number; backoffMs?: number },
      onEvent: (event: SseEvent) => void,
      onEnd: (reason: { code: string; status: number }) => void
    ): RunEventsHandle {
      const controller = new AbortController()
      let lastId = opts.lastEventId ?? null
      const maxReconnects = opts.maxReconnects ?? 20
      const backoffMs = opts.backoffMs ?? 1000
      let path: string

      try {
        path = runPath(runId, '/events')
      } catch (error) {
        onEnd({ code: (error as RunsProxyError).code, status: 0 })

        return { close() {}, done: Promise.resolve() }
      }

      const done = (async () => {
        let attempts = 0

        while (!controller.signal.aborted) {
          let target: RunsTarget

          try {
            target = await resolveTarget(ref)
          } catch (error) {
            onEnd({ code: error instanceof RunsProxyError ? error.code : 'gateway_unavailable', status: 0 })

            return
          }

          let serverClosed = false

          const parser = createSseParser(
            ev => {
              if (ev.id !== null) {
                lastId = ev.id
              }

              attempts = 0
              onEvent(ev)
            },
            comment => {
              if (comment === 'stream closed') {
                serverClosed = true
              }
            }
          )

          let status = 0

          try {
            ;({ status } = await transport.stream({
              url: `${target.baseUrl.replace(/\/+$/, '')}${path}`,
              headers: {
                Authorization: `Bearer ${target.key}`,
                Accept: 'text/event-stream',
                ...(lastId !== null ? { 'Last-Event-ID': lastId } : {})
              },
              onChunk: chunk => parser.feed(chunk),
              signal: controller.signal
            }))
          } catch {
            status = 0
          }

          if (controller.signal.aborted) {
            onEnd({ code: 'closed', status })

            return
          }

          if (serverClosed) {
            onEnd({ code: 'stream_closed', status })

            return
          }

          if (status === 401 || status === 403 || status === 404) {
            onEnd({ code: status === 404 ? 'run_not_found' : 'gateway_auth_failed', status })

            return
          }

          attempts += 1

          if (attempts > maxReconnects) {
            onEnd({ code: 'reconnect_exhausted', status })

            return
          }

          await new Promise(resolve => setTimeout(resolve, Math.min(backoffMs * attempts, 15_000)))
        }

        onEnd({ code: 'closed', status: 0 })
      })()

      return { close: () => controller.abort(), done }
    }
  }
}

export type RunsProxy = ReturnType<typeof createRunsProxy>
