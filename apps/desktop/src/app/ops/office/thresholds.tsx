/**
 * Office thresholds (ops-panel P8 b3). Named defaults plus an operator override kept in Ops settings
 * (localStorage, per machine). Every Stuck / Overdue / stale rule reads these; nothing hard-codes a number.
 */

import { useSyncExternalStore } from 'react'

export interface OfficeThresholds {
  /** A running task whose last heartbeat is older than this is "stale" (Stuck, Overdue, Today strip). */
  staleHeartbeatS: number
  /** A task in review longer than this is overdue in My queue. */
  reviewOverdueS: number
}

export const DEFAULT_THRESHOLDS: Readonly<OfficeThresholds> = Object.freeze({ staleHeartbeatS: 600, reviewOverdueS: 86_400 })

/** Allowed ranges: 1 min..24 h for heartbeats, 1 h..14 d for reviews. Out of range → default. */
export const THRESHOLD_LIMITS: Record<keyof OfficeThresholds, [number, number]> = {
  staleHeartbeatS: [60, 86_400],
  reviewOverdueS: [3600, 14 * 86_400]
}

const KEY = 'hermes.ops.officeThresholds'
const listeners = new Set<() => void>()
let cache: OfficeThresholds | null = null

function valid(k: keyof OfficeThresholds, v: unknown): number {
  const [lo, hi] = THRESHOLD_LIMITS[k]

  return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : DEFAULT_THRESHOLDS[k]
}

export function loadThresholds(): OfficeThresholds {
  if (cache) {
    return cache
  }

  let raw: Partial<OfficeThresholds> = {}

  try {
    raw = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}') ?? {}
  } catch {
    raw = {}
  }

  cache = { staleHeartbeatS: valid('staleHeartbeatS', raw.staleHeartbeatS), reviewOverdueS: valid('reviewOverdueS', raw.reviewOverdueS) }

  return cache
}

export function saveThresholds(p: Partial<OfficeThresholds>): OfficeThresholds {
  const cur = loadThresholds()

  const next = {
    staleHeartbeatS: valid('staleHeartbeatS', p.staleHeartbeatS ?? cur.staleHeartbeatS),
    reviewOverdueS: valid('reviewOverdueS', p.reviewOverdueS ?? cur.reviewOverdueS)
  }

  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage blocked: the value still applies for this session
  }

  cache = next
  listeners.forEach(l => l())

  return next
}

export function resetThresholds() {
  cache = null

  try {
    globalThis.localStorage?.removeItem(KEY)
  } catch {
    // ignore
  }

  listeners.forEach(l => l())
}

export function useOfficeThresholds(): OfficeThresholds {
  return useSyncExternalStore(
    l => (listeners.add(l), () => listeners.delete(l)),
    loadThresholds,
    loadThresholds
  )
}

export function ThresholdSettings() {
  const th = useOfficeThresholds()
  const min = (s: number) => Math.round(s / 60)

  return (
    <fieldset aria-label="Office thresholds" data-ops-thresholds="">
      <legend>Office thresholds</legend>
      <label>
        Stale heartbeat after (minutes)
        <input
          aria-label="stale heartbeat minutes"
          max={THRESHOLD_LIMITS.staleHeartbeatS[1] / 60}
          min={THRESHOLD_LIMITS.staleHeartbeatS[0] / 60}
          onChange={e => saveThresholds({ staleHeartbeatS: Number(e.target.value) * 60 })}
          type="number"
          value={min(th.staleHeartbeatS)}
        />
      </label>
      <label>
        Review overdue after (hours)
        <input
          aria-label="review overdue hours"
          max={THRESHOLD_LIMITS.reviewOverdueS[1] / 3600}
          min={THRESHOLD_LIMITS.reviewOverdueS[0] / 3600}
          onChange={e => saveThresholds({ reviewOverdueS: Number(e.target.value) * 3600 })}
          type="number"
          value={Math.round(th.reviewOverdueS / 3600)}
        />
      </label>
      <button onClick={resetThresholds} type="button">
        Reset to defaults ({min(DEFAULT_THRESHOLDS.staleHeartbeatS)} min / {DEFAULT_THRESHOLDS.reviewOverdueS / 3600} h)
      </button>
    </fieldset>
  )
}
