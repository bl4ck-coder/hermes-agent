/** Orrery layout (ops-panel P3-02, D6): sandhi at the centre, 3 rings, 8-orb cap. */

import type { FleetProfile, Presence } from '../feed/ops-client'

export const ORRERY_CENTRE = 'sandhi'
export const ORRERY_CAP = 8

const PRIORITY: Presence[] = ['needs_you', 'blocked', 'working', 'idle', 'stale', 'unknown', 'offline']

export function ringOf(presence: Presence): 1 | 2 | 3 {
  if (presence === 'working' || presence === 'needs_you' || presence === 'blocked') {
    return 1
  }

  return presence === 'idle' ? 2 : 3
}

export interface Orb {
  profile: string
  presence: Presence
  ring: 0 | 1 | 2 | 3
  x: number
  y: number
}

export interface OrreryLayout {
  centre: Orb
  orbs: Orb[]
  overflow: string[]
}

export function layoutOrrery(
  profiles: FleetProfile[],
  presenceOf: (p: FleetProfile) => Presence,
  radius = 100
): OrreryLayout {
  const centreProfile = profiles.find(p => p.profile === ORRERY_CENTRE)

  const centre: Orb = {
    profile: ORRERY_CENTRE,
    presence: centreProfile ? presenceOf(centreProfile) : 'unknown',
    ring: 0,
    x: 0,
    y: 0
  }

  const rest = profiles
    .filter(p => p.profile !== ORRERY_CENTRE)
    .map(p => ({ profile: p.profile, presence: presenceOf(p) }))
    .sort((a, b) => PRIORITY.indexOf(a.presence) - PRIORITY.indexOf(b.presence) || a.profile.localeCompare(b.profile))

  const shown = rest.slice(0, ORRERY_CAP)
  const overflow = rest.slice(ORRERY_CAP).map(p => p.profile)
  const byRing = new Map<number, typeof shown>()

  for (const p of shown) {
    const ring = ringOf(p.presence)
    byRing.set(ring, [...(byRing.get(ring) ?? []), p])
  }

  const orbs: Orb[] = []

  for (const [ring, members] of byRing) {
    members.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / members.length - Math.PI / 2 + ring * 0.4
      const r = (radius * ring) / 3
      orbs.push({
        profile: p.profile,
        presence: p.presence,
        ring: ring as 1 | 2 | 3,
        x: Math.round(r * Math.cos(angle) * 10) / 10,
        y: Math.round(r * Math.sin(angle) * 10) / 10
      })
    })
  }

  return { centre, orbs, overflow }
}

/** B11: label box estimate for an orb pill (12px UI font ~7px/char plus padding). */
export function orbLabelBox(name: string): { w: number; h: number } {
  return { w: Math.min(170, 18 + name.length * 7), h: 24 }
}

export interface SpreadOptions {
  /** Horizontal stretch of the rings: the orrery is a wide strip, not a square. */
  sx?: number
  gap?: number
  /** Half-height clamp so orbs stay inside the 240px stage. */
  maxY?: number
  iterations?: number
}

/**
 * B11 collision avoidance: stretch the rings into an ellipse, then relax overlapping label
 * boxes apart along the axis of least overlap. The centre (ring 0) never moves. Pure and
 * deterministic, so the same fleet always draws the same picture.
 */
export function spreadOrbs<T extends { profile: string; ring: number; x: number; y: number }>(
  orbs: T[],
  { sx = 2.6, gap = 6, maxY = 96, iterations = 80 }: SpreadOptions = {}
): T[] {
  const out = orbs.map(o => ({ ...o, x: o.ring === 0 ? o.x : o.x * sx, y: o.y }))

  for (let it = 0; it < iterations; it++) {
    let moved = false

    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]
        const b = out[j]
        const A = orbLabelBox(a.profile)
        const B = orbLabelBox(b.profile)
        const ox = (A.w + B.w) / 2 + gap - Math.abs(a.x - b.x)
        const oy = (A.h + B.h) / 2 + gap - Math.abs(a.y - b.y)

        if (ox <= 0 || oy <= 0) {
          continue
        }

        moved = true
        const fa = a.ring === 0
        const fb = b.ring === 0
        const share = fa || fb ? 1 : 0.5
        // Prefer vertical separation while there is room, else go sideways.
        const room = Math.abs(a.y) < maxY - 1 || Math.abs(b.y) < maxY - 1

        if (oy <= ox && room) {
          const s = (a.y <= b.y ? -1 : 1) * oy * share

          if (!fa) {a.y += s}

          if (!fb) {b.y -= s}
        } else {
          const s = (a.x <= b.x ? -1 : 1) * ox * share

          if (!fa) {a.x += s}

          if (!fb) {b.x -= s}
        }
      }
    }

    for (const o of out) {
      if (o.ring !== 0) {
        o.y = Math.max(-maxY, Math.min(maxY, o.y))
      }
    }

    if (!moved) {
      break
    }
  }

  return out.map(o => ({ ...o, x: Math.round(o.x), y: Math.round(o.y) }))
}

/** True when any two label boxes overlap (test/diagnostic helper). */
export function orbsOverlap(orbs: { profile: string; x: number; y: number }[]): boolean {
  for (let i = 0; i < orbs.length; i++) {
    for (let j = i + 1; j < orbs.length; j++) {
      const A = orbLabelBox(orbs[i].profile)
      const B = orbLabelBox(orbs[j].profile)

      if (Math.abs(orbs[i].x - orbs[j].x) < (A.w + B.w) / 2 && Math.abs(orbs[i].y - orbs[j].y) < (A.h + B.h) / 2) {
        return true
      }
    }
  }

  return false
}
