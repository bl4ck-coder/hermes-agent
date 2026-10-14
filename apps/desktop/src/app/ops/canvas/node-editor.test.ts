import { describe, expect, it, vi } from 'vitest'

import { apiErrorText, parseApiError } from '../feed/api-error'

import {
  createNodeClient,
  diffLines,
  discard,
  edit,
  fromRead,
  type NodeClient,
  rebaseMine,
  reloadTheirs,
  repairSuggestions,
  restore,
  save
} from './node-editor'

const err = (status: number, detail: unknown) => new Error(`${status}: ${JSON.stringify({ detail })}`)
const read = (content: string, hash = 'h1') => ({ profile: 'p', node: 'prompt', content_hash: hash, exists: true, content })

const fake = (over: Partial<NodeClient> = {}) =>
  ({
    read: vi.fn().mockResolvedValue(read('new', 'h2')),
    save: vi.fn().mockResolvedValue({ ok: true, outcome: 'committed', sequence: 1, backup: 'tx1', content_hash: 'h2', warnings: [] }),
    history: vi.fn().mockResolvedValue({ items: [] }),
    restore: vi.fn().mockResolvedValue({ ok: true, outcome: 'committed', sequence: 2, backup: 'tx2', content_hash: 'h3', warnings: [] }),
    ...over
  }) as unknown as NodeClient

describe('api error parsing (P5-01)', () => {
  it('reads status, code, detail and extras from the main-process error message', () => {
    const p = parseApiError(err(409, { code: 'conflict', detail: 'changed', current_hash: 'abc' }))
    expect(p).toEqual({ status: 409, code: 'conflict', detail: 'changed', extra: { current_hash: 'abc' } })
    expect(parseApiError(err(409, 'blocked by parent')).detail).toBe('blocked by parent')
    expect(parseApiError(new Error('socket hang up'))).toMatchObject({ status: null, code: null, detail: 'socket hang up' })
    expect(apiErrorText(err(403, { code: 'remote_read_only', detail: 'local-only' }))).toBe('remote_read_only: local-only')
  })
})

describe('node editor model (P5-01)', () => {
  it('tracks dirty and discard', () => {
    const s = fromRead('prompt', read('a'))
    const d = edit(s, { content: 'b' })
    expect(d.status).toBe('dirty')
    expect(edit(d, { content: 'a' }).status).toBe('clean')
    expect(discard(d).draft.content).toBe('a')
    expect(fromRead('prompt', null).status).toBe('error')
  })

  it('save sends the expected hash, re-reads the normalised value and records the backup', async () => {
    const c = fake()
    const out = await save(edit(fromRead('prompt', read('a')), { content: 'new' }), 'p', c, 'why')
    expect(c.save).toHaveBeenCalledWith('p', 'prompt', 'h1', { content: 'new' }, 'why')
    expect(out).toMatchObject({ status: 'saved', hash: 'h2', lastBackup: 'tx1' })
    expect(out.base.content).toBe('new')
  })

  it('conflict keeps the draft; reload theirs or rebase mine resolve it explicitly', async () => {
    const c = fake({ save: vi.fn().mockRejectedValue(err(409, { code: 'conflict', detail: 'x', current_hash: 'h9' })) })
    const s = edit(fromRead('prompt', read('a')), { content: 'mine' })
    const conflicted = await save(s, 'p', c)
    expect(conflicted).toMatchObject({ status: 'conflict', currentHash: 'h9' })
    expect(conflicted.draft.content).toBe('mine')
    expect((await reloadTheirs(conflicted, 'p', c)).draft.content).toBe('new')
    const rebased = await rebaseMine(conflicted, 'p', c)
    expect(rebased).toMatchObject({ status: 'dirty', hash: 'h2' })
    expect(rebased.draft.content).toBe('mine')
  })

  it('maps policy, backup, remote and disconnect refusals without losing the draft', async () => {
    const s = edit(fromRead('model', { profile: 'p', node: 'model', content_hash: 'h', exists: true, provider: 'xai', model: 'grok' }), { model: 'bad' })
    const blocked = await save(s, 'p', fake({ save: vi.fn().mockRejectedValue(err(400, { code: 'policy_blocked', detail: 'disallowed', blocked: [{ field: 'model', provider: 'xai', model: 'bad', reason: 'r' }], warnings: [] })) }))
    expect(blocked.status).toBe('blocked')
    expect(blocked.violations?.[0].model).toBe('bad')
    expect((await save(s, 'p', fake({ save: vi.fn().mockRejectedValue(err(409, { code: 'backup_coverage_missing', detail: 'no protector' })) }))).message).toMatch(/backup unavailable/)
    const ro = await save(s, 'p', fake({ save: vi.fn().mockRejectedValue(err(403, { code: 'remote_read_only', detail: '' })) }))
    expect(ro.status).toBe('read_only')
    expect(edit(ro, { model: 'x' })).toBe(ro)
    const dc = await save(s, 'p', fake({ save: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) }))
    expect(dc).toMatchObject({ status: 'error' })
    expect(dc.draft.model).toBe('bad')
  })

  it('restore uses the current hash and reports the new backup', async () => {
    const c = fake()
    const out = await restore(fromRead('prompt', read('a')), 'p', 'tx0', c)
    expect(c.restore).toHaveBeenCalledWith('p', 'prompt', 'tx0', 'h1')
    expect(out.message).toMatch(/Restored tx0 \(new backup tx2\)/)
  })

  it('diffs lines and suggests only concrete allowed models', () => {
    expect(diffLines('a\nb\nc', 'a\nc\nd').map(d => d.op + d.line)).toEqual([' a', '-b', ' c', '+d'])
    const policy = { source: 'b', error: null, enabled: true, allow: [{ provider: ['xai'], models: ['grok-4', 'grok-*'] }, { provider: ['anthropic'], models: ['claude-x'] }] }
    expect(repairSuggestions(policy, 'xai')).toEqual([{ provider: 'xai', model: 'grok-4' }])
    expect(repairSuggestions(null)).toEqual([])
  })

  it('client hits the P2-03 routes', async () => {
    const api = vi.fn().mockResolvedValue({})
    const c = createNodeClient(api)
    await c.save('my p', 'raw_yaml', 'h', { content: 'x' })
    await c.restore('p', 'model', 'tx', 'h')
    await c.history('p', 'prompt')
    expect(api.mock.calls[0][0]).toMatchObject({ method: 'PUT', path: '/api/ops/profiles/my%20p/nodes/raw_yaml', body: { expected_hash: 'h', content: 'x', note: null } })
    expect(api.mock.calls[1][0]).toMatchObject({ method: 'POST', path: '/api/ops/profiles/p/nodes/model/restore', body: { backup: 'tx', expected_hash: 'h' } })
    expect(api.mock.calls[2][0].path).toBe('/api/ops/profiles/p/nodes/prompt/history')
  })
})
