import { describe, expect, it, vi } from 'vitest'

import { resolveThumb } from './thumb-cache'

const png = () => new Response(new Blob(['x'], { type: 'image/png' }), { headers: { 'content-type': 'image/png' } })

function fakeCaches(store = new Map<string, Response>()) {
  return {
    store,
    open: async () => ({
      match: async (u: string) => store.get(u)?.clone(),
      put: async (u: string, r: Response) => { store.set(u, r) }
    }) as unknown as Cache
  }
}

describe('B35 artifact thumbnail cache', () => {
  it('fetches once, stores it, then serves from the cache', async () => {
    const c = fakeCaches()
    const f = vi.fn(async () => png())
    const deps = { caches: c, fetch: f as unknown as typeof fetch, toUrl: () => 'blob:ok' }
    expect(await resolveThumb('https://og/1', deps)).toBe('blob:ok')
    expect(await resolveThumb('https://og/1', deps)).toBe('blob:ok')
    expect(f).toHaveBeenCalledTimes(1)
    expect(c.store.has('https://og/1')).toBe(true)
  })
  it('falls back to null (monogram) on network failure or non-image', async () => {
    const deps = (fetchImpl: () => Promise<Response>) => ({ caches: fakeCaches(), fetch: fetchImpl as unknown as typeof fetch, toUrl: () => 'blob:x' })
    expect(await resolveThumb('u', deps(async () => { throw new Error('offline') }))).toBeNull()
    expect(await resolveThumb('u', deps(async () => new Response('nope', { status: 404 })))).toBeNull()
    expect(await resolveThumb('u', deps(async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })))).toBeNull()
  })
  it('works without Cache Storage', async () => {
    expect(await resolveThumb('u', { caches: undefined, fetch: (async () => png()) as unknown as typeof fetch, toUrl: () => 'blob:y' })).toBe('blob:y')
  })
})
