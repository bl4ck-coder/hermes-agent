import { afterEach, describe, expect, it, vi } from 'vitest'

import { createOpsClient, type FleetResponse, isFresh, parseDispatch, shownPresence } from './ops-client'
import { createOpsFeed, OPS_POLL_MS, type OpsSseBridge } from './ops-feed'

afterEach(() => {
  vi.useRealTimers()
})

const fleet = (presence = 'working', observed = 100): FleetResponse => ({
  profiles: [{ profile: 'sandhi', presence: presence as never, observed_at: observed, active_runs: [] }],
  now: observed
})

describe('ops client', () => {
  it('builds the A1-A7 paths and keeps the connection scope', async () => {
    const api = vi.fn().mockResolvedValue({})
    const c = createOpsClient(api)
    await c.fleet()
    await c.pendingApprovals('judge')
    await c.policy(null)
    await c.modelNode('my profile')
    await c.cronJobs()
    await c.board('ops-panel')
    expect(api.mock.calls.map(([r]) => r.path)).toEqual([
      '/api/ops/fleet',
      '/api/approvals/pending?profile=judge',
      '/api/ops/policy?profile=default',
      '/api/ops/profiles/my%20profile/nodes/model',
      '/api/cron/jobs?profile=all',
      '/api/plugins/kanban/board?tenant=ops-panel'
    ])
  })

  it('one-click approve posts a jsonrpc respond and refuses unroutable origins', async () => {
    const api = vi.fn().mockResolvedValue({ resolved: true, outcome: 'resolved', choice: 'once' })
    const c = createOpsClient(api)

    const item = {
      origin: 'jsonrpc', id: 'r1', profile: 'sandhi', session_id: 's1', run_id: null, tenant: null,
      exact_request: { command: 'rm x', pattern_keys: [] }, why: 'w', what_for: 'f', status: 'pending',
      expires_at: null, age_s: null, actions: ['approve', 'deny']
    }

    await c.approve(item)
    expect(api).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST', path: '/api/approvals/respond', body: { origin: 'jsonrpc', id: 'r1', session_id: 's1', choice: 'once' }
    }))
    await expect(c.approve({ ...item, origin: 'kanban_blocked' })).rejects.toMatchObject({ code: 'not_routable' })
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('dispatch parses @assignee', () => {
    expect(parseDispatch('@Builder  fix the build ')).toEqual({ assignee: 'builder', title: 'fix the build' })
    expect(parseDispatch('just a title')).toEqual({ assignee: null, title: 'just a title' })
  })

  it('freshness is at most 5 s and never invents presence', () => {
    expect(isFresh({ observed_at: 100 }, 105)).toBe(true)
    expect(isFresh({ observed_at: 100 }, 105.1)).toBe(false)
    expect(isFresh({ observed_at: null }, 1)).toBe(false)
    expect(shownPresence(fleet('working', 100).profiles[0], 106)).toBe('stale')
    expect(shownPresence(fleet('idle', 100).profiles[0], 101)).toBe('idle')
    expect(shownPresence(fleet('unknown', 100).profiles[0], 101)).toBe('unknown')
  })
})

function fakeBridge() {
  let listener: ((p: never) => void) | null = null

  const bridge: OpsSseBridge & { emit: (p: object) => void } = {
    open: vi.fn().mockResolvedValue({ subscriptionId: 'sub-1', ended: false }),
    close: vi.fn().mockResolvedValue(true),
    onEvent: cb => {
      listener = cb as never

      return () => {
        listener = null
      }
    },
    emit: p => listener?.(p as never)
  }

  return bridge
}

describe('ops feed', () => {
  it('pushes stream frames immediately and polls every 5 s to keep observed_at fresh', async () => {
    vi.useFakeTimers()
    const client = { fleet: vi.fn().mockResolvedValue(fleet('idle', 1)) }
    const bridge = fakeBridge()
    const feed = createOpsFeed({ client, bridge })
    const seen: string[] = []
    feed.subscribe(() => seen.push(feed.getState().fleet?.profiles[0].presence ?? '-'))
    feed.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(feed.getState().mode).toBe('stream')
    bridge.emit({ subscriptionId: 'sub-1', type: 'event', event: 'fleet', data: JSON.stringify(fleet('working', 2)) })
    expect(feed.getState().fleet?.profiles[0].presence).toBe('working')
    bridge.emit({ subscriptionId: 'other', type: 'event', event: 'fleet', data: JSON.stringify(fleet('blocked', 3)) })
    expect(feed.getState().fleet?.profiles[0].presence).toBe('working')
    bridge.emit({ subscriptionId: 'sub-1', type: 'event', event: 'needs_you', data: '{"profiles":["judge"]}' })
    expect(feed.getState().needsYou).toEqual(['judge'])
    expect(client.fleet).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(OPS_POLL_MS)
    expect(client.fleet).toHaveBeenCalledTimes(2)
    feed.stop()
    expect(bridge.close).toHaveBeenCalledWith('sub-1')
    await vi.advanceTimersByTimeAsync(OPS_POLL_MS * 3)
    expect(client.fleet).toHaveBeenCalledTimes(2)
  })

  it('falls back to polling when the stream ends or there is no bridge, and keeps errors', async () => {
    vi.useFakeTimers()
    const client = { fleet: vi.fn().mockRejectedValueOnce({ status: 500 }).mockResolvedValue(fleet()) }
    const bridge = fakeBridge()
    const feed = createOpsFeed({ client, bridge })
    feed.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(feed.getState().error).toEqual({ status: 500 })
    bridge.emit({ subscriptionId: 'sub-1', type: 'end', code: 'reconnect_exhausted' })
    expect(feed.getState().mode).toBe('poll')
    await vi.advanceTimersByTimeAsync(OPS_POLL_MS)
    expect(feed.getState().error).toBeNull()
    feed.stop()

    const solo = createOpsFeed({ client: { fleet: vi.fn().mockResolvedValue(fleet()) }, bridge: null })
    solo.start()
    expect(solo.getState().mode).toBe('poll')
    solo.stop()
  })
})
