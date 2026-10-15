import { useEffect, useState } from 'react'

/**
 * B35: GitHub Open Graph thumbnails are cached on this machine (Cache Storage, per-origin, survives restarts)
 * so a card renders from disk after the first fetch, and a page of cards never re-hits opengraph.githubassets.com.
 * Any failure (offline, CORS, non-image, quota) resolves to null and the card keeps its monogram.
 */
export const THUMB_CACHE = 'hermes-artifact-thumbs-v1'

const memory = new Map<string, Promise<string | null>>()

interface Deps {
  caches?: Pick<CacheStorage, 'open'> | undefined
  fetch: typeof fetch
  toUrl: (blob: Blob) => string
}

const defaultDeps = (): Deps => ({
  caches: typeof caches === 'undefined' ? undefined : caches,
  fetch: (...a) => fetch(...a),
  toUrl: blob => URL.createObjectURL(blob)
})

export async function resolveThumb(url: string, deps: Deps = defaultDeps()): Promise<string | null> {
  try {
    const cache = deps.caches ? await deps.caches.open(THUMB_CACHE).catch(() => undefined) : undefined
    const hit = cache ? await cache.match(url) : undefined
    if (hit?.ok) return deps.toUrl(await hit.blob())
    const res = await deps.fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer', credentials: 'omit' })
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return null
    if (cache) await cache.put(url, res.clone()).catch(() => undefined)
    return deps.toUrl(await res.blob())
  } catch {
    return null
  }
}

export function cachedThumb(url: string): Promise<string | null> {
  let p = memory.get(url)
  if (!p) {
    p = resolveThumb(url)
    memory.set(url, p)
  }
  return p
}

/** 'pending' while resolving, a blob: URL when cached/fetched, null on any failure (caller shows the monogram). */
export function useCachedThumb(url: string | null): string | null | 'pending' {
  const [src, setSrc] = useState<string | null | 'pending'>(url ? 'pending' : null)
  useEffect(() => {
    if (!url) { setSrc(null); return }
    let live = true
    setSrc('pending')
    void cachedThumb(url).then(s => { if (live) setSrc(s) })
    return () => { live = false }
  }, [url])
  return src
}
