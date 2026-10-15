import { useEffect, useState } from 'react'

/**
 * B35-B37: GitHub Open Graph thumbnails cached on this machine (Cache Storage, survives restarts).
 * - Opt-out: localStorage `hermes.artifacts.remoteThumbs` = 'off' => no remote request and no cached image served.
 * - Freshness: every stored copy carries its own `x-hermes-cached-at`; older than 7 days is refetched (stale kept on failure).
 *   Memory entries are age-checked too.
 * - Blob URLs are reference-counted: an entry evicted past MAX_LIVE is revoked only when no mounted card still uses it.
 * - Failures are never memoized. Any failure resolves to null and the card keeps its monogram.
 */
export const THUMB_CACHE = 'hermes-artifact-thumbs-v1'
export const THUMB_OPT_OUT_KEY = 'hermes.artifacts.remoteThumbs'
export const CACHED_AT = 'x-hermes-cached-at'
/** Dispatch on window after changing THUMB_OPT_OUT_KEY in this window. */
export const THUMB_PREF_EVENT = 'hermes:artifact-thumbs-pref'
const MAX_AGE_MS = 7 * 86_400_000
const MAX_LIVE = 150

interface Entry { at: number; evicted: boolean; p: Promise<string | null>; refs: number }
const memory = new Map<string, Entry>()

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
      const at = Number(hit.headers.get(CACHED_AT))
      // No own timestamp (older entries) counts as stale: refetch, keep it only as a fallback.
      if (Number.isFinite(at) && at > 0 && now() - at < MAX_AGE_MS) return deps.toUrl(await hit.blob())
      stale = hit
    }
    const res = await deps.fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer', credentials: 'omit' }).catch(() => undefined)
    if (!res || !res.ok || !isImage(res)) return stale ? deps.toUrl(await stale.blob()) : null
    const blob = await res.blob()
    if (cache) {
      const headers = new Headers({ 'content-type': res.headers.get('content-type') ?? 'image/png', [CACHED_AT]: String(now()) })
      await cache.put(url, new Response(blob, { headers })).catch(() => undefined)
    }
    return deps.toUrl(blob)
  } catch {
    return null
  }
}

const revoke = (e: Entry) => void e.p.then(src => { if (src && src.startsWith('blob:')) URL.revokeObjectURL(src) })

function drop(url: string, e: Entry) {
  memory.delete(url)
  e.evicted = true
  if (e.refs === 0) revoke(e)
}

/** Acquire a thumbnail; call the returned release() when the consumer unmounts. */
export function acquireThumb(url: string): { p: Promise<string | null>; release: () => void } {
  if (remoteThumbsOptedOut()) return { p: Promise.resolve(null), release: () => {} }
  let e = memory.get(url)
  if (e && Date.now() - e.at >= MAX_AGE_MS) {
    drop(url, e)
    e = undefined
  }
  if (e) {
    memory.delete(url)
    memory.set(url, e) // most recently used last
  } else {
    const entry: Entry = { at: Date.now(), evicted: false, p: resolveThumb(url), refs: 0 }
    e = entry
    memory.set(url, entry)
    void entry.p.then(src => { if (src === null && memory.get(url) === entry) memory.delete(url) }) // never memoize a failure
    for (const [oldUrl, old] of memory) {
      if (memory.size <= MAX_LIVE) break
      if (old !== entry) drop(oldUrl, old)
    }
  }
  const held = e
  held.refs++
  let released = false
  return {
    p: held.p,
    release: () => {
      if (released) return
      released = true
      held.refs--
      if (held.evicted && held.refs === 0) revoke(held)
    }
  }
}

/** 'pending' while resolving, a blob: URL when cached/fetched, null on any failure or opt-out (caller shows the monogram). */
export function useCachedThumb(url: string | null): string | null | 'pending' {
  const [src, setSrc] = useState<string | null | 'pending'>(url ? 'pending' : null)
  useEffect(() => {
    if (!url) {
      setSrc(null)
      return
    }
    let live = true
    setSrc('pending')
    const { p, release } = acquireThumb(url)
    // B37b: re-check the preference when a pending request lands, so an opt-out made meanwhile is never undone.
    void p.then(s => { if (live) setSrc(remoteThumbsOptedOut() ? null : s) })
    const onPref = (ev?: Event) => { if ((!(ev instanceof StorageEvent) || ev.key === THUMB_OPT_OUT_KEY) && remoteThumbsOptedOut()) setSrc(null) }
    // storage fires in other windows; THUMB_PREF_EVENT covers the window that changed it.
    window.addEventListener('storage', onPref)
    window.addEventListener(THUMB_PREF_EVENT, onPref)
    return () => {
      live = false
      window.removeEventListener('storage', onPref)
      window.removeEventListener(THUMB_PREF_EVENT, onPref)
      release()
    }
  }, [url])
  return src
}
