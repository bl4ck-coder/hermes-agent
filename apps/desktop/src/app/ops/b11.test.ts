import { describe, expect, it } from 'vitest'

import type { FleetProfile, Presence } from './feed/ops-client'
import { layoutOrrery, orbsOverlap, spreadOrbs } from './office/orrery'

const prof = (profile: string, presence: Presence): FleetProfile => ({ profile, presence, observed_at: null })

describe('B11 orrery collision avoidance', () => {
  const names = ['default', 'investigador-largo', 'escritor', 'coder', 'reviewer', 'ops', 'research-assistant', 'kanban-worker', 'mx']

  it('raw ring layout overlaps for a realistic fleet (the bug)', () => {
    const l = layoutOrrery(names.map((n, i) => prof(n, i % 3 ? 'unknown' : 'idle')), p => p.presence)
    expect(orbsOverlap([l.centre, ...l.orbs])).toBe(true)
  })

  it('spread layout has no overlapping labels, keeps the centre, stays in the stage', () => {
    for (const mix of [['unknown'], ['idle', 'unknown'], ['working', 'idle', 'unknown', 'needs_you']] as Presence[][]) {
      const l = layoutOrrery(names.map((n, i) => prof(n, mix[i % mix.length])), p => p.presence)
      const all = spreadOrbs([l.centre, ...l.orbs])
      expect(orbsOverlap(all)).toBe(false)
      expect(all[0]).toMatchObject({ x: 0, y: 0, ring: 0 })
      for (const o of all) expect(Math.abs(o.y)).toBeLessThanOrEqual(96)
    }
  })

  it('is deterministic', () => {
    const l = layoutOrrery(names.map(n => prof(n, 'unknown')), p => p.presence)
    expect(spreadOrbs([l.centre, ...l.orbs])).toEqual(spreadOrbs([l.centre, ...l.orbs]))
  })
})
