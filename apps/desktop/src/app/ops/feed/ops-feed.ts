/**
 * Live fleet feed (ops-panel P3-01). Push via the P1-06 main-process SSE bridge
 * (/api/ops/fleet/stream) for sub-second changes, plus a 5 s poll that keeps observed_at
 * fresh (the stream only pushes on change) and takes over entirely when the bridge is
 * missing or the stream ends. Never steals focus: it only notifies subscribers.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react'

import type { FleetFeed } from '../navigation-store'

import { createOpsClient, type FleetResponse, type OpsClient, shownPresence } from './ops-client'

export const OPS_POLL_MS = 5_000

interface SsePayload {
  subscriptionId: string
  type: 'event' | 'end'
  event?: string
  data?: string
  code?: string
}

export interface OpsSseBridge {
  open: (request: { path: string; profile?: string | null }) => Promise<{ subscriptionId: string; ended: boolean }>
  close: (subscriptionId: string) => Promise<unknown>
  onEvent: (callback: (payload: SsePayload) => void) => () => void
}

export interface FeedState {
  fleet: FleetResponse | null
  error: unknown
  mode: 'connecting' | 'stream' | 'poll'
  updatedAt: number | null
  needsYou: string[]
}

export interface OpsFeed {
  getState: () => FeedState
  subscribe: (listener: () => void) => () => void
  start: () => void
  stop: () => void
  refresh: () => Promise<void>
}

export function createOpsFeed({
  client,
  bridge,
  profile = null,
  pollMs = OPS_POLL_MS,
  now = () => Date.now()
}: {
  client: Pick<OpsClient, 'fleet'>
  bridge?: OpsSseBridge | null
  profile?: string | null
  pollMs?: number
  now?: () => number
}): OpsFeed {
  let state: FeedState = { fleet: null, error: null, mode: 'connecting', updatedAt: null, needsYou: [] }
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setInterval> | null = null
  let sub: string | null = null
  let off: (() => void) | null = null
  let running = false

  const set = (patch: Partial<FeedState>) => {
    state = { ...state, ...patch }
    listeners.forEach(l => l())
  }

  const refresh = async () => {
    try {
      const fleet = await client.fleet()

      if (running) {
        set({ fleet, error: null, updatedAt: now() })
      }
    } catch (error) {
      if (running) {
        set({ error })
      }
    }
  }

  const startPolling = () => {
    if (!timer) {
      timer = setInterval(() => void refresh(), pollMs)
    }
  }

  const handle = (p: SsePayload) => {
    if (!sub || p.subscriptionId !== sub) {
      return
    }

    if (p.type === 'end') {
      sub = null
      set({ mode: 'poll' })

      return
    }

    try {
      const data = JSON.parse(p.data || 'null')

      if (p.event === 'fleet' && data && Array.isArray(data.profiles)) {
        set({ fleet: data as FleetResponse, error: null, updatedAt: now(), mode: 'stream' })
      } else if (p.event === 'needs_you' && data && Array.isArray(data.profiles)) {
        set({ needsYou: data.profiles.map(String) })
      }
    } catch {
      // A malformed frame is ignored; the 5 s poll still converges.
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
    start() {
      if (running) {
        return
      }

      running = true
      void refresh()
      startPolling()

      if (!bridge) {
        set({ mode: 'poll' })

        return
      }

      off = bridge.onEvent(handle)
      bridge
        .open({ path: '/api/ops/fleet/stream', profile })
        .then(r => {
          if (!running || r.ended) {
            set({ mode: 'poll' })

            if (!running && !r.ended) {
              void bridge.close(r.subscriptionId)
            }

            return
          }

          sub = r.subscriptionId
          set({ mode: 'stream' })
        })
        .catch(() => set({ mode: 'poll' }))
    },
    stop() {
      running = false

      if (timer) {
        clearInterval(timer)
        timer = null
      }

      off?.()
      off = null

      if (sub && bridge) {
        void bridge.close(sub)
      }

      sub = null
    },
    refresh
  }
}

function desktopBridge(): OpsSseBridge | null {
  const d = (globalThis as { window?: { hermesDesktop?: { opsSse?: OpsSseBridge } } }).window?.hermesDesktop

  return d?.opsSse ?? null
}

export function useOpsFeed(profile: string | null = null, client?: Pick<OpsClient, 'fleet'>): FeedState {
  const feed = useMemo(
    () => createOpsFeed({ client: client ?? createOpsClient(), bridge: desktopBridge(), profile }),
    [client, profile]
  )

  useEffect(() => {
    feed.start()

    return () => feed.stop()
  }, [feed])

  return useSyncExternalStore(feed.subscribe, feed.getState, feed.getState)
}

/** Live pass B9: the shell's rail and inspector take a FleetFeed; the host built none, so both said
 *  "Fleet · unavailable" even with A1 live. A1 and the Needs-you count both ride the fleet response. */
export function fleetFeedFrom(state: Pick<FeedState, 'fleet'>, nowS = Date.now() / 1000): FleetFeed {
  if (!state.fleet) {
    return { a1: 'missing', a3: 'missing', rows: [] }
  }

  return {
    a1: 'ready',
    a3: 'ready',
    rows: state.fleet.profiles.map(p => {
      const presence = shownPresence(p, nowS)

      return { id: p.profile, label: p.profile, presence, fresh: p.observed_at != null && presence !== 'stale' }
    })
  }
}
