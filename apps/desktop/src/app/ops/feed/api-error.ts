/**
 * Read side of the Desktop main HTTP error (`new Error(`${status}: ${body}`)`), which crosses IPC
 * as a message only. Returns the status, the FastAPI `detail` (object or string) and its code.
 */

export interface ApiError {
  status: number | null
  code: string | null
  detail: string
  extra: Record<string, unknown>
}

export function parseApiError(e: unknown): ApiError {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  const statusFromProp = Number((e as { statusCode?: unknown } | null)?.statusCode)
  const m = /^(\d{3}): ([\s\S]*)$/.exec(raw)
  const status = m ? Number(m[1]) : Number.isInteger(statusFromProp) ? statusFromProp : null
  const body = m ? m[2] : raw
  let parsed: unknown = null

  try {
    parsed = body ? JSON.parse(body) : null
  } catch {
    parsed = null
  }

  const d = parsed && typeof parsed === 'object' && 'detail' in parsed ? (parsed as { detail: unknown }).detail : parsed

  if (d && typeof d === 'object' && !Array.isArray(d)) {
    const { code, detail, ...extra } = d as Record<string, unknown>

    return { status, code: typeof code === 'string' ? code : null, detail: typeof detail === 'string' ? detail : '', extra }
  }

  return { status, code: null, detail: typeof d === 'string' ? d : body || 'request failed', extra: {} }
}

/** One human sentence for a refusal. */
export function apiErrorText(e: unknown): string {
  const p = parseApiError(e)

  return [p.code, p.detail].filter(Boolean).join(': ') || 'request failed'
}

/* ------------------------- P26: human reason first ------------------------- */

/** What an HTTP status means to the person who was refused (English keys; render through T()). */
const STATUS_MEANING: Record<number, string> = {
  400: 'Bad request',
  401: 'Not signed in',
  403: 'Refused',
  404: 'Not found',
  408: 'Timed out',
  409: 'Conflict',
  410: 'Gone',
  422: 'Invalid',
  423: 'Locked',
  429: 'Too many requests',
  500: 'Server error',
  502: 'Bad gateway',
  503: 'Unavailable',
  504: 'Timed out'
}

/** The standard reason phrase adds nothing to the meaning ("Unavailable (503)", not "…: Service Unavailable"). */
const STATUS_PHRASE: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Request Timeout',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
  504: 'Gateway Timeout'
}

const LINE_MAX = 200

export interface HumanError {
  status: number | null
  /** English meaning of the status, when known. */
  meaning: string | null
  /** The server's own words (or the transport message when there is no HTTP status). */
  reason: string
  /** The full text as received, for a folded detail or a log. */
  raw: string
  /** True when an IPC/transport wrapper was stripped. */
  wrapped: boolean
}

/** Drop Electron's IPC wrapper ("Error invoking remote method 'hermes:api': Error: …") and stacked "Error: " prefixes. */
export function stripTransport(raw: string): { text: string; wrapped: boolean } {
  let text = raw.trim()
  let wrapped = false

  for (;;) {
    const next = text.replace(/^Error invoking remote method '[^']*':\s*/, '').replace(/^(?:Uncaught\s+)?Error:\s*/, '')

    if (next === text) {
      return { text, wrapped }
    }

    wrapped = true
    text = next.trim()
  }
}

/** FastAPI 422 lists `{loc, msg}`; say "field: message", not the JSON. */
function validationText(body: string): string | null {
  try {
    const d = (JSON.parse(body) as { detail?: unknown } | null)?.detail

    if (!Array.isArray(d)) {
      return null
    }

    const parts = d
      .map(x => {
        const item = x as { loc?: unknown; msg?: unknown }
        const loc = Array.isArray(item.loc) ? item.loc.filter(p => p !== 'body' && p !== 'query').join('.') : ''

        return typeof item.msg === 'string' ? (loc ? `${loc}: ${item.msg}` : item.msg) : null
      })
      .filter(Boolean)

    return parts.length ? parts.join('; ') : null
  } catch {
    return null
  }
}

/** Split any thrown value into the status meaning, the server's reason and the raw text (kept whole). */
export function humanError(e: unknown): HumanError {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : e == null ? '' : String(e)
  const { text, wrapped } = stripTransport(raw)
  const statusCode = (e as { statusCode?: unknown } | null)?.statusCode
  const p = parseApiError(Object.assign(new Error(text), typeof statusCode === 'number' ? { statusCode } : {}))
  const body = /^\d{3}: ([\s\S]*)$/.exec(text)?.[1] ?? text
  let reason = p.status === null ? text : (validationText(body) ?? (p.detail || p.code || ''))

  // An HTML error page says nothing a person can act on; the status meaning does.
  if (/^\s*</.test(reason)) {
    reason = ''
  }

  return { status: p.status, meaning: p.status === null ? null : (STATUS_MEANING[p.status] ?? null), reason: reason.trim(), raw, wrapped }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** One short line: "Conflict (409): Task moved", or the bare transport message. `t` localizes the meaning. */
export function humanErrorLine(h: HumanError, t: (s: string) => string = s => s): string {
  const reason = h.reason.length > LINE_MAX - 30 ? `${h.reason.slice(0, LINE_MAX - 31).trimEnd()}…` : h.reason

  if (h.status !== null && h.meaning) {
    const says = reason && norm(reason) !== norm(h.meaning) && norm(reason) !== norm(STATUS_PHRASE[h.status] ?? '')

    return says ? `${t(h.meaning)} (${h.status}): ${reason}` : `${t(h.meaning)} (${h.status})`
  }

  if (h.status !== null) {
    return reason ? `${h.status}: ${reason}` : String(h.status)
  }

  return reason || 'request failed'
}

/** True when the raw text holds more than the line says (a wrapper, a JSON body): worth a folded detail. */
export function humanErrorHasMore(h: HumanError): boolean {
  const plain = h.status === null ? h.reason : `${h.status}: ${h.reason}`

  return Boolean(h.raw.trim()) && h.raw.trim() !== plain
}
