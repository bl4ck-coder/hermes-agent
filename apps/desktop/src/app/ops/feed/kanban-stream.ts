/**
 * Board push (ops-panel P7 F1): the kanban task_events SSE (/api/plugins/kanban/events/stream, A7)
 * through the P1-06 main-process bridge. Each frame is one task_events row; the bridge resumes with
 * Last-Event-ID so nothing is lost or repeated. Consumers reload on a push; the 5 s poll stays the
 * fallback when the bridge is missing or the stream ends. Never steals focus.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react'

import type { OpsSseBridge } from './ops-feed'

export const KANBAN_STREAM_PATH = '/api/plugins/kanban/events/stream'
export const KANBAN_EVENT_CAP = 50

export interface KanbanEvent {
  id: number
  task_id: string
  kind: string
  payload: unknown
  created_at: number
  run_id?: number | null
}

export interface KanbanStreamState {
  mode: 'connecting' | 'stream' | 'poll'
  /** Newest first, capped. */
  events: KanbanEvent[]
  /** Bumps once per pushed batch; consumers reload on change. */
  version: number
  /** P8 b2: why the stream is not live (shown by Diagnostics / Activity); null while live. */
  reason?: string | null
  /** SPEC v2.1 0b: subscription generation; bumps on every (re)open and on stop. Late frames from an older generation are dropped. */
  generation?: number
  /** v0.22: the board was archived or deleted (404 / WS 1008). Terminal: no reconnect, the poll keeps the view. */
  gone?: boolean
}

/** End codes after which reconnecting cannot help. */
export const KANBAN_TERMINAL_END_CODES: ReadonlySet<string> = new Set(['board_gone'])

/** L9 teardown accounting: everything this stream holds. All false after stop(). */
export interface KanbanStreamResources {
  subscription: boolean
  listener: boolean
  retryTimer: boolean
  openTimer: boolean
}

/** P8 b2: an open that has not answered after this long counts as failed (the poll covers meanwhile). */
export const KANBAN_OPEN_TIMEOUT_MS = 10_000

const statusOf = (e: unknown) => {
  const m = /^(\d{3})\b/.exec(e instanceof Error ? e.message : String(e ?? ''))

  return m ? Number(m[1]) : null
}

export function parseKanbanFrame(data: string | undefined): KanbanEvent | null {
  try {
    const v = JSON.parse(data || 'null') as Partial<KanbanEvent> | null

    if (!v || typeof v !== 'object' || typeof v.id !== 'number' || typeof v.task_id !== 'string' || typeof v.kind !== 'string') {
      return null
    }

    return {
      id: v.id,
      task_id: v.task_id,
      kind: v.kind,
      payload: v.payload ?? null,
      created_at: typeof v.created_at === 'number' ? v.created_at : 0,
      run_id: v.run_id ?? null
    }
  } catch {
    return null
  }
}

/** P8: reconnect backoff after the stream ends or fails to open (ms); the last step repeats. */
export const KANBAN_RECONNECT_MS = [2_000, 5_000, 15_000, 30_000] as const

export function createKanbanStream({
  bridge,
  board = null,
  reconnectMs = KANBAN_RECONNECT_MS,
  openTimeoutMs = KANBAN_OPEN_TIMEOUT_MS
}: {
  bridge: OpsSseBridge | null
  board?: string | null
  reconnectMs?: readonly number[]
  openTimeoutMs?: number
}) {
  let state: KanbanStreamState = { mode: 'connecting', events: [], version: 0 }
  const listeners = new Set<() => void>()
  let sub: string | null = null
  let off: (() => void) | null = null
  let running = false
  let attempt = 0
  let opens = 0
  let retry: ReturnType<typeof setTimeout> | null = null
  let openTimer: ReturnType<typeof setTimeout> | null = null
  // Bounded dedupe: the ids that can still be replayed are the recent ones.
  const seen = new Set<number>()
  const SEEN_CAP = 1000

  const set = (patch: Partial<KanbanStreamState>) => {
    state = { ...state, ...patch }
    listeners.forEach(l => l())
  }

  // P8: an ended or failed stream falls back to poll, then reconnects with backoff (was: poll forever).
  const fallBack = (why: unknown = 'stream ended') => {
    sub = null
    const status = statusOf(why)
    // 401/403: credentials will not fix themselves in 2 s; wait the longest step instead of hammering.
    const auth = status === 401 || status === 403

    if (auth) {
      attempt = Math.max(attempt, reconnectMs.length - 1)
    }

    set({ mode: 'poll', reason: auth ? `auth refused (${status})` : why instanceof Error ? why.message : String(why) })

    if (!running || !reconnectMs.length || retry) {
      return
    }

    const wait = reconnectMs[Math.min(attempt, reconnectMs.length - 1)]
    attempt += 1
    retry = setTimeout(() => {
      retry = null

      if (running) {
        open()
      }
    }, wait)
  }

  const open = () => {
    if (!bridge) {
      return
    }

    let settled = false
    const myOpen = ++opens

    // Slow reply: give up on this open after openTimeoutMs; if it answers later it is closed unused.
    if (openTimer) {
      clearTimeout(openTimer)
    }

    const timer = openTimeoutMs > 0 ? setTimeout(() => ((openTimer = null), !settled && myOpen === opens && fallBack(`no answer in ${openTimeoutMs / 1000} s`)), openTimeoutMs) : null
    openTimer = timer
    set({ generation: myOpen })

    Promise.resolve()
      .then(() => bridge.open({ path: KANBAN_STREAM_PATH, ...(board ? { board } : {}) } as { path: string }))
      .then(r => {
        settled = true

        if (timer) {
          clearTimeout(timer)

          if (openTimer === timer) {
            openTimer = null
          }
        }

        if (!running || myOpen !== opens || (state.mode === 'poll' && retry !== null)) {
          if (!r.ended) {
            void bridge.close(r.subscriptionId)
          }

          return
        }

        if (r.ended) {
          fallBack()

          return
        }

        sub = r.subscriptionId
        attempt = 0
        set({ mode: 'stream', reason: null })
      })
      .catch(e => {
        settled = true

        if (timer) {
          clearTimeout(timer)

          if (openTimer === timer) {
            openTimer = null
          }
        }

        if (myOpen === opens) {
          fallBack(e)
        }
      })
  }

  return {
    getState: () => state,
    subscribe(l: () => void) {
      listeners.add(l)

      return () => listeners.delete(l)
    },
    start() {
      if (running) {
        return
      }

      running = true

      if (!bridge) {
        set({ mode: 'poll' })

        return
      }

      off = bridge.onEvent(p => {
        if (!sub || p.subscriptionId !== sub) {
          return
        }

        if (p.type === 'end') {
          const code = (p as { code?: string }).code

          if (code && KANBAN_TERMINAL_END_CODES.has(code)) {
            // Board gone: stop for good (no backoff timer), keep polling as the fallback view.
            sub = null
            set({ mode: 'poll', reason: 'board gone', gone: true })

            return
          }

          fallBack(`stream ended${code ? ` (${code})` : ''}`)

          return
        }

        const ev = parseKanbanFrame(p.data)

        if (!ev || seen.has(ev.id)) {
          return
        }

        seen.add(ev.id)

        if (seen.size > SEEN_CAP) {
          seen.delete(seen.values().next().value as number)
        }

        set({ events: [ev, ...state.events].slice(0, KANBAN_EVENT_CAP), version: state.version + 1, mode: 'stream' })
      })
      open()
    },
    resources(): KanbanStreamResources {
      return { subscription: sub !== null, listener: off !== null, retryTimer: retry !== null, openTimer: openTimer !== null }
    },
    stop() {
      running = false
      // Generation bump: any open still in flight is closed unused when it answers.
      opens += 1

      if (openTimer) {
        clearTimeout(openTimer)
        openTimer = null
      }

      if (retry) {
        clearTimeout(retry)
        retry = null
      }

      attempt = 0
      off?.()
      off = null

      if (sub && bridge) {
        void bridge.close(sub)
      }

      sub = null
    }
  }
}

export function kanbanBridge(): OpsSseBridge | null {
  return (globalThis as { window?: { hermesDesktop?: { opsSse?: OpsSseBridge } } }).window?.hermesDesktop?.opsSse ?? null
}

export function useKanbanStream(bridge?: OpsSseBridge | null): KanbanStreamState {
  const s = useMemo(() => createKanbanStream({ bridge: bridge === undefined ? kanbanBridge() : bridge }), [bridge])

  useEffect(() => {
    s.start()

    return () => s.stop()
  }, [s])

  return useSyncExternalStore(s.subscribe, s.getState, s.getState)
}
