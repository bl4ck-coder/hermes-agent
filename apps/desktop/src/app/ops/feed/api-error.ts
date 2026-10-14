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
