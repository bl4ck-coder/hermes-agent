import { useEffect, useState } from 'react'

/**
 * B35/B36: GitHub Open Graph thumbnails are cached on this machine (Cache Storage, survives restarts).
 * - Opt-out: localStorage `hermes.artifacts.remoteThumbs` = 'off' makes no remote request at all (monograms only).
 * - Freshness: a cached card older than 7 days is refetched; if that fails the stale copy is still shown.
 * - Memory: at most MAX_LIVE blob URLs stay alive (oldest revoked); failures are not memoized, so they retry later.
 * Any failure resolves to null and the card keeps its monogram.
 */
export const THUMB_CACHE = 'hermes-artifact-thumbs-v1'
export const THUMB_OPT_OUT_KEY = 'hermes.artifacts.remoteThumbs'
const MAX_AGE_MS = 7 * 86_400_000
const MAX_LIVE = 150

const memory = new Map<string, Promise<string | null>>()

interface Deps {
  caches?: Pick<CacheStorage, 'open'> | undefined
  fetch: typeof fetch
  now?: () => number
  optedOut?: () => boolean
  toUrl: (blob: Blob) => string
}

export function remoteThumbsOptedOut(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(THUMB_OPT_OUT_KEY) === 'off'
  } catch {
    return false
  }
}

const defaultDeps = (): Deps => ({
  caches: typeof caches === 'undefined' ? undefined : caches,
  fetch: (...a) => fetch(...a),
  optedOut: remoteThumbsOptedOut,
  toUrl: blob => URL.createObjectURL(blob)
})

const isImage = (r: Response) => (r.headers.get('content-type') ?? '').startsWith('image/')

export async function resolveThumb(url: string, deps: Deps = defaultDeps()): Promise<string | null> {
  if (deps.optedOut?.()) return null
  const now = deps.now ?? Date.now
  let stale: Response | undefined
  try {
    const cache = deps.caches ? await deps.caches.open(THUMB_CACHE).catch(() => undefined) : undefined
    const hit = cache ? await cache.match(url) : undefined
    if (hit?.ok) {
      const dated = Date.parse(hit.headers.get('date') ?? '')
      if (!Number.isFinite(dated) || now() - dated < MAX_AGE_MS) return deps.toUrl(await hit.blob())
      stale = hit
    }
    const res = await deps.fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer', credentials: 'omit' }).catch(() => undefined)
    if (!res || !res.ok || !isImage(res)) return stale ? deps.toUrl(await stale.blob()) : null
    if (cache) await cache.put(url, res.clone()).catch(() => undefined)
    return deps.toUrl(await res.blob())
  } catch {
    return null
  }
}

export function cachedThumb(url: string): Promise<string | null> {
  const known = memory.get(url)
  if (known) {
    memory.delete(url)
    memory.set(url, known) // most recently used last
    return known
  }
  const p = resolveThumb(url)
  memory.set(url, p)
  void p.then(src => {
    if (src === null) memory.delete(url) // never memoize a failure
  })
  while (memory.size > MAX_LIVE) {
    const [oldest, op] = memory.entries().next().value as [string, Promise<string | null>]
    memory.delete(oldest)
    void op.then(src => {
      if (src && src.startsWith('blob:')) URL.revokeObjectURL(src)
    })
  }
  return p
}

/** 'pending' while resolving, a blob: URL when cached/fetched, null on any failure (caller shows the monogram). */
export function useCachedThumb(url: string | null): string | null | 'pending' {
  const [src, setSrc] = useState<string | null | 'pending'>(url ? 'pending' : null)
  useEffect(() => {
    if (!url) {
      setSrc(null)
      return
    }
    let live = true
    setSrc('pending')
    void cachedThumb(url).then(s => {
      if (live) setSrc(s)
    })
    return () => {
      live = false
    }
  }, [url])
  return src
}
