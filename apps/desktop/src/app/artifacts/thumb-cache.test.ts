import { describe, expect, it, vi } from 'vitest'

import { resolveThumb } from './thumb-cache'

const png = (date?: string) =>
  new Response(new Blob(['x'], { type: 'image/png' }), { headers: { 'content-type': 'image/png', ...(date ? { date } : {}) } })

function fakeCaches(store = new Map<string, Response>()) {
  return {
    store,
    open: async () =>
      ({
        match: async (u: string) => store.get(u)?.clone(),
        put: async (u: string, r: Response) => {
          store.set(u, r)
        }
      }) as unknown as Cache
  }
}

const f = (impl: () => Promise<Response>) => vi.fn(impl) as unknown as typeof fetch

describe('artifact thumbnail cache', () => {
  it('fetches once, stores it, then serves from the cache', async () => {
    const c = fakeCaches()
    const fetchMock = vi.fn(async () => png())
    const deps = { caches: c, fetch: fetchMock as unknown as typeof fetch, toUrl: () => 'blob:ok' }
    expect(await resolveThumb('https://og/1', deps)).toBe('blob:ok')
    expect(await resolveThumb('https://og/1', deps)).toBe('blob:ok')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(c.store.has('https://og/1')).toBe(true)
  })
  it('falls back to null (monogram) on network failure or non-image', async () => {
    const deps = (impl: () => Promise<Response>) => ({ caches: fakeCaches(), fetch: f(impl), toUrl: () => 'blob:x' })
    expect(await resolveThumb('u', deps(async () => { throw new Error('offline') }))).toBeNull()
    expect(await resolveThumb('u', deps(async () => new Response('nope', { status: 404 })))).toBeNull()
    expect(await resolveThumb('u', deps(async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })))).toBeNull()
  })
  it('works without Cache Storage', async () => {
    expect(await resolveThumb('u', { caches: undefined, fetch: f(async () => png()), toUrl: () => 'blob:y' })).toBe('blob:y')
  })
  it('makes no request at all when remote thumbnails are opted out', async () => {
    const fetchMock = vi.fn(async () => png())
    expect(await resolveThumb('u', { caches: fakeCaches(), fetch: fetchMock as unknown as typeof fetch, optedOut: () => true, toUrl: () => 'blob:z' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('refetches a copy older than 7 days and keeps the stale one if the refetch fails', async () => {
    const old = new Date(Date.UTC(2026, 0, 1)).toUTCString()
    const c = fakeCaches(new Map([['u', png(old)]]))
    const now = () => Date.UTC(2026, 0, 20)
    const failing = vi.fn(async () => { throw new Error('offline') })
    expect(await resolveThumb('u', { caches: c, fetch: failing as unknown as typeof fetch, now, toUrl: () => 'blob:stale' })).toBe('blob:stale')
    expect(failing).toHaveBeenCalledTimes(1)
  })
})
