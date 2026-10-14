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

      for (const o of all) {expect(Math.abs(o.y)).toBeLessThanOrEqual(96)}
    }
  })

  it('is deterministic', () => {
    const l = layoutOrrery(names.map(n => prof(n, 'unknown')), p => p.presence)
    expect(spreadOrbs([l.centre, ...l.orbs])).toEqual(spreadOrbs([l.centre, ...l.orbs]))
  })
})

import { INSPECTOR_KEYS, INSPECTOR_TRANSLATIONS, inspectorFields, localizeInspector, UNKNOWN_HINT_KEY } from './inspector-i18n'
import { OPS_LOCALE_IDS, OPS_LOCALES } from './locales'

describe('B11 inspector localization', () => {
  it('every non-English locale has a full, non-empty table', () => {
    for (const id of OPS_LOCALE_IDS.filter(l => l !== 'en')) {
      const row = INSPECTOR_TRANSLATIONS[id]
      expect(row, id).toBeDefined()
      expect(row.length, id).toBe(INSPECTOR_KEYS.length)
      expect(row.every(v => v.trim().length > 0), id).toBe(true)
      // Most labels must actually change (guards against copy-pasted English).
      const same = row.filter((v, i) => v === INSPECTOR_KEYS[i]).length
      expect(same, id).toBeLessThan(12)
    }
  })

  it('copy exposes fields per locale and English is identity', () => {
    expect(OPS_LOCALES.en.inspector.fields.Assignee).toBe('Assignee')
    expect(OPS_LOCALES.es.inspector.fields.Assignee).toBe('Asignado')
    expect(OPS_LOCALES.ja.inspector.fields[UNKNOWN_HINT_KEY]).toMatch(/プロセス/)
  })

  it('localizes labels, templates, suffixes and pairs; passes unknown text through', () => {
    const es = inspectorFields('es')
    expect(localizeInspector('Last heartbeat', es)).toBe('Último latido')
    expect(localizeInspector('3 of 5', es)).toBe('3 de 5')
    expect(localizeInspector('41 cards', es)).toBe('41 tarjetas')
    expect(localizeInspector('2 failing', inspectorFields('de'))).toBe('2 fehlerhaft')
    expect(localizeInspector('config.yaml (invalid, writes blocked)', es)).toBe('config.yaml (inválida, escrituras bloqueadas)')
    expect(localizeInspector('unset / unset', es)).toBe('sin definir / sin definir')
    expect(localizeInspector('nightly-digest', es)).toBe('nightly-digest')
    expect(localizeInspector(null, es)).toBe('')
  })

  it('no locale still claims the detail is "not built in this shell"', () => {
    for (const id of OPS_LOCALE_IDS) {
      const text = OPS_LOCALES[id].inspector.detailUnavailable('Board')
      expect(text, id).not.toMatch(/shell|尚未构建|尚未建置|シェル|الغلاف|оболочке|Shell/)
    }
  })
})
