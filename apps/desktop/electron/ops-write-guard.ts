/**
 * ops-write-guard.ts (ops-panel P2-04, D11)
 *
 * The Desktop main process is the only party that knows which connection a REST call is
 * going to, so main stamps the Ops connection-kind headers on every /api/ops/* request and
 * overwrites anything else. The backend treats a missing kind as remote (403). Ops writes
 * against a non-local backend are refused here before any request is sent. Reads pass.
 */

export const OPS_KIND_HEADER = 'X-Hermes-Ops-Connection-Kind'
export const OPS_ID_HEADER = 'X-Hermes-Ops-Connection-Id'

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export class OpsRemoteReadOnlyError extends Error {
  code = 'remote_read_only'

  constructor() {
    super('403: Ops writes are local-only (D11): this connection is read-only for the Ops Canvas.')
  }
}

export function isOpsPath(path: unknown): boolean {
  if (typeof path !== 'string') {
    return false
  }

  const clean = path.split(/[?#]/, 1)[0].replace(/\/{2,}/g, '/')

  return clean === '/api/ops' || clean.startsWith('/api/ops/')
}

export function isOpsWrite(method: unknown, path: unknown): boolean {
  return isOpsPath(path) && !READ_METHODS.has(String(method || 'GET').toUpperCase())
}

/** `local` only when the backend descriptor says so; anything else (or nothing) is remote. */
export function opsConnectionKind(descriptor: { mode?: unknown } | null | undefined): 'local' | 'remote' {
  return descriptor?.mode === 'local' ? 'local' : 'remote'
}

/**
 * Headers main adds to an /api/ops/* request, or throws for a remote write.
 * Returns {} for non-Ops paths so callers can spread it unconditionally.
 */
export function opsRequestHeaders(
  descriptor: { mode?: unknown; connectionId?: unknown } | null | undefined,
  method: unknown,
  path: unknown
): Record<string, string> {
  if (!isOpsPath(path)) {
    return {}
  }

  const kind = opsConnectionKind(descriptor)

  if (kind !== 'local' && isOpsWrite(method, path)) {
    throw new OpsRemoteReadOnlyError()
  }

  const id = typeof descriptor?.connectionId === 'string' && descriptor.connectionId ? descriptor.connectionId : kind

  return { [OPS_KIND_HEADER]: kind, [OPS_ID_HEADER]: id }
}

/** Merge so main's values win over any same-named header regardless of case. */
export function withOpsHeaders(
  base: Record<string, string> | null | undefined,
  ops: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {}
  const opsKeys = new Set(Object.keys(ops).map(k => k.toLowerCase()))

  for (const [k, v] of Object.entries(base || {})) {
    if (!opsKeys.has(k.toLowerCase())) {
      out[k] = v
    }
  }

  return { ...out, ...ops }
}
