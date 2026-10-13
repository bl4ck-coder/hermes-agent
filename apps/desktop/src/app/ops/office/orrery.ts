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
