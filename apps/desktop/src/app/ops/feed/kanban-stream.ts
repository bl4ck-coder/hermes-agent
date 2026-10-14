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

export function createKanbanStream({ bridge, board = null }: { bridge: OpsSseBridge | null; board?: string | null }) {
  let state: KanbanStreamState = { mode: 'connecting', events: [], version: 0 }
  const listeners = new Set<() => void>()
  let sub: string | null = null
  let off: (() => void) | null = null
  let running = false
  const seen = new Set<number>()

  const set = (patch: Partial<KanbanStreamState>) => {
    state = { ...state, ...patch }
    listeners.forEach(l => l())
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
          sub = null
          set({ mode: 'poll' })

          return
        }

        const ev = parseKanbanFrame(p.data)

        if (!ev || seen.has(ev.id)) {
          return
        }

        seen.add(ev.id)
        set({ events: [ev, ...state.events].slice(0, KANBAN_EVENT_CAP), version: state.version + 1, mode: 'stream' })
      })
      bridge
        .open({ path: KANBAN_STREAM_PATH, ...(board ? { board } : {}) } as { path: string })
        .then(r => {
          if (!running || r.ended) {
            if (!running && !r.ended) {
              void bridge.close(r.subscriptionId)
            }

            set({ mode: 'poll' })

            return
          }

          sub = r.subscriptionId
          set({ mode: 'stream' })
        })
        .catch(() => set({ mode: 'poll' }))
    },
    stop() {
      running = false
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
