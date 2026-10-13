import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { contrastRatio } from '@hermes/shared/color'

import {
  DONE_HOLD_MS,
  FRESH_MS,
  MISSING_REASON,
  SIGIL_DISCS,
  SIGIL_INK,
  type PresenceInput,
  hashString,
  resolvePresence,
  resolveSigil,
  whyFooterContrast,
  whyFooterText
} from '../motion'
import { CanvasKindIcon, OpsMotionScope, PresenceGlyph, ThinkingReadout } from './presence-glyph'
import { Sigil } from './sigil'
import { WhyFooter } from './why-footer'

afterEach(() => {
  cleanup()
})

const t0 = 1_700_000_000_000

function facts(partial: Partial<PresenceInput> & Pick<PresenceInput, 'now' | 'observedAt' | 'eventAt'>): PresenceInput {
  return {
    unreachable: false,
    snapshotStale: false,
    needsYou: false,
    blocked: false,
    working: false,
    subState: null,
    toolName: null,
    completion: false,
    gatewayUp: false,
    noWork: false,
    ...partial
  }
}

function paint(input: PresenceInput, motion: 'full' | 'reduced' = 'full') {
  const resolved = resolvePresence(input)
  const view = render(
    <PresenceGlyph
      copyColor={resolved.copyColor}
      glyphColor={resolved.glyphColor}
      label={resolved.label}
      motion={motion}
      pulse={resolved.pulse}
      state={resolved.state}
    />
  )

  return { resolved, ...view }
}

describe('presence states', () => {
  const rows: Array<{ input: PresenceInput; state: string; label: string; shape: string }> = [
    {
      input: facts({ now: t0, observedAt: t0, eventAt: t0, working: true, subState: 'thinking' }),
      state: 'working',
      label: 'thinking',
      shape: 'disc'
    },
    {
      input: facts({ now: t0, observedAt: t0, eventAt: t0, needsYou: true }),
      state: 'needs_you',
      label: 'needs-you',
      shape: 'ringed'
    },
    {
      input: facts({ now: t0, observedAt: t0, eventAt: t0, blocked: true }),
      state: 'blocked',
      label: 'blocked',
      shape: 'triangle'
    },
    {
      input: facts({ now: t0, observedAt: t0, eventAt: null, gatewayUp: true, noWork: true }),
      state: 'idle',
      label: 'idle',
      shape: 'dot'
    },
    {
      input: facts({ now: t0, observedAt: t0, eventAt: t0, unreachable: true }),
      state: 'offline',
      label: 'offline',
      shape: 'hollow'
    },
    {
      input: facts({ now: t0, observedAt: null, eventAt: null, gatewayUp: true, noWork: true }),
      state: 'unknown',
      label: 'unknown',
      shape: 'dotted'
    },
    {
      input: facts({ now: t0 + FRESH_MS + 1, observedAt: t0, eventAt: t0, gatewayUp: true, noWork: true }),
      state: 'stale',
      label: 'stale',
      shape: 'barred'
    }
  ]

  it('renders shape, label, and colour for every presence state', () => {
    for (const row of rows) {
      const { resolved, container, unmount } = paint(row.input)
      const root = container.querySelector('.ops-presence')
      const glyph = container.querySelector('.ops-presence__glyph')
      const label = container.querySelector('.ops-presence__label')

      expect(resolved.state).toBe(row.state)
      expect(resolved.label).toBe(row.label)
      expect(root?.getAttribute('data-state')).toBe(row.state)
      expect(root?.getAttribute('aria-label')).toContain(row.label)
      expect(glyph?.getAttribute('data-shape')).toBe(row.shape)
      expect(glyph?.getAttribute('width')).toBe('12')
      expect(glyph?.getAttribute('height')).toBe('12')
      expect(label?.textContent).toBe(row.label)
      expect(label?.getAttribute('data-copy')).toBe(resolved.copyColor)
      expect(resolved.copyColor).toMatch(/^#[0-9A-F]{6}$/)
      unmount()
    }
  })

  it('does not let unknown or stale render as idle', () => {
    const unknown = paint(facts({ now: t0, observedAt: null, eventAt: null, gatewayUp: true, noWork: true }))
    expect(unknown.resolved.state).not.toBe('idle')
    expect(unknown.container.querySelector('.ops-presence__label')?.textContent).not.toBe('idle')
    unknown.unmount()

    const stale = paint(
      facts({ now: t0 + 6_000, observedAt: t0, eventAt: t0, completion: true, gatewayUp: true, noWork: true })
    )
    expect(stale.resolved.state).toBe('stale')
    expect(stale.resolved.state).not.toBe('idle')
    expect(stale.container.querySelector('[data-shape]')?.getAttribute('data-shape')).not.toBe('dot')
  })

  it('follows the S1–S4 freshness sequence', () => {
    const s1a = resolvePresence(facts({ now: t0, observedAt: t0, eventAt: t0, completion: true }))
    const s1b = resolvePresence(
      facts({ now: t0 + 6_000, observedAt: t0 + 6_000, eventAt: t0, completion: true, gatewayUp: true, noWork: true })
    )
    const s1c = resolvePresence(
      facts({
        now: t0 + DONE_HOLD_MS,
        observedAt: t0 + DONE_HOLD_MS,
        eventAt: t0,
        completion: true,
        gatewayUp: true,
        noWork: true
      })
    )
    const s2b = resolvePresence(facts({ now: t0 + 6_000, observedAt: t0, eventAt: t0, completion: true }))
    const s2c = resolvePresence(facts({ now: t0 + DONE_HOLD_MS, observedAt: t0, eventAt: t0, completion: true }))
    const s3 = resolvePresence(facts({ now: t0, observedAt: t0, eventAt: t0 - 10 * 60_000, needsYou: true }))
    const s4 = resolvePresence(facts({ now: t0, observedAt: t0, eventAt: t0, unreachable: true }))

    expect(s1a).toMatchObject({ state: 'done', label: 'done', countedIn: 'none' })
    expect(s1b).toMatchObject({ state: 'done', label: 'done', countedIn: 'none' })
    expect(s1c).toMatchObject({ state: 'idle', label: 'idle', countedIn: 'idle' })
    expect(s2b.state).toBe('stale')
    expect(s2c.state).toBe('stale')
    expect(s2c.state).not.toBe('idle')
    expect(s3).toMatchObject({ state: 'needs_you', label: 'needs-you', countedIn: 'needs_you' })
    expect(s4).toMatchObject({ state: 'offline', label: 'offline', countedIn: 'offline' })
  })

  it('names a tool only when the event carries one, and pulses at most while thinking or tool', () => {
    const named = resolvePresence(
      facts({ now: t0, observedAt: t0, eventAt: t0, working: true, subState: 'tool', toolName: 'read_file' })
    )
    const unnamed = resolvePresence(
      facts({ now: t0, observedAt: t0, eventAt: t0, working: true, subState: 'tool', toolName: '  ' })
    )
    const quiet = resolvePresence(facts({ now: t0, observedAt: t0, eventAt: t0, working: true }))

    expect(named.label).toBe('tool:read_file')
    expect(named.pulse).toBe(true)
    expect(unnamed.label).toBe('tool')
    expect(quiet.pulse).toBe(false)
  })

  it('uses the reduced-motion working glyph, not the needs-you ring, and stops the pulse', () => {
    const { container } = paint(
      facts({ now: t0, observedAt: t0, eventAt: t0, working: true, subState: 'thinking' }),
      'reduced'
    )
    const glyph = container.querySelector('.ops-presence__glyph')

    expect(container.querySelector('.ops-presence')?.getAttribute('data-pulse')).toBe('off')
    expect(glyph?.getAttribute('data-shape')).toBe('reduced-disc')
    expect(glyph?.getAttribute('data-hollow')).toBe('false')
    expect(glyph?.getAttribute('data-gap')).toBe('0')
    expect(glyph?.getAttribute('width')).toBe('12')
    expect(glyph?.getAttribute('height')).toBe('12')
    expect(container.querySelector('.ops-presence')?.getAttribute('data-paused')).toBe('true')
    expect(glyph?.getAttribute('data-shape')).not.toBe('ringed')
    expect(container.querySelector('.ops-presence__label')?.textContent).toBe('thinking')
  })

  it('keeps focus on a rect around the control, not on the glyph', () => {
    const { container } = paint(facts({ now: t0, observedAt: t0, eventAt: t0, working: true, subState: 'thinking' }))
    const root = container.querySelector('.ops-presence')
    const glyph = container.querySelector('.ops-presence__glyph')

    root?.dispatchEvent(new window.Event('focus'))
    expect(root?.getAttribute('data-focus-shape')).toBe('rect')
    expect(glyph?.getAttribute('data-shape')).toBe('disc')
    expect(glyph?.getAttribute('data-shape')).not.toBe('ringed')
  })
})

describe('sigil identity', () => {
  it('matches the frozen hash, disc, and monogram vectors', () => {
    const emile = '\u00C9mile'
    const flame = '\u{1F525}ops'
    const vectors = [
      { name: '', hash: 0, index: null, disc: null, monogram: '' },
      { name: 'default', hash: 1544803905, index: null, disc: null, monogram: '' },
      { name: 'sandhi', hash: 3385310341, index: 1, disc: '#D3B065', monogram: 'SA' },
      { name: 'sandra', hash: 3385310643, index: 3, disc: '#E8C77A', monogram: 'SA' },
      { name: emile, hash: 188979294, index: 2, disc: '#DEBC6F', monogram: '\u00C9M' },
      { name: flame, hash: 1270412586, index: 2, disc: '#DEBC6F', monogram: '\u{1F525}O' }
    ]

    for (const vector of vectors) {
      const spec = resolveSigil(vector.name)

      expect(hashString(vector.name)).toBe(vector.hash)
      expect(spec.hash).toBe(vector.hash)
      expect(spec.index).toBe(vector.index)
      expect(spec.disc).toBe(vector.disc)
      expect(spec.monogram).toBe(vector.monogram)
      expect(spec.fill.startsWith('hsl(')).toBe(false)
    }
  })

  it('is deterministic and paints a rim only from a verified override', () => {
    const first = render(<Sigil name="sandhi" />)
    const second = render(<Sigil name="sandhi" />)
    const a = first.container.querySelector('.ops-sigil')
    const b = second.container.querySelector('.ops-sigil')

    expect(a?.getAttribute('data-disc')).toBe(b?.getAttribute('data-disc'))
    expect(a?.getAttribute('data-monogram')).toBe('SA')
    expect(a?.getAttribute('data-rim')).toBe('none')
    expect(a?.getAttribute('data-disc')).toBe(SIGIL_DISCS[1])
    first.unmount()
    second.unmount()

    const painted = render(<Sigil colorOverride="#336699" name="sandhi" />)
    const node = painted.container.querySelector('.ops-sigil')

    expect(node?.getAttribute('data-rim')).toBe('#336699')
    expect(node?.getAttribute('data-disc')).toBe('#D3B065')
    expect(node?.getAttribute('data-ink')).toBe(SIGIL_INK)
    expect(node?.getAttribute('style')?.toLowerCase()).not.toContain('hsl(')
  })

  it('keeps empty and default off the gold disc', () => {
    for (const name of ['', 'default']) {
      const spec = resolveSigil(name)
      const view = render(<Sigil name={name} />)

      expect(spec.kind).toBe('empty')
      expect(spec.disc).toBeNull()
      expect(spec.rim).toBeNull()
      expect(view.container.querySelector('[data-empty-dot="true"]')).not.toBeNull()
      const dot = view.container.querySelector('.ops-sigil__dot') as HTMLElement | null
      expect(dot?.style.width).toBe('3px')
      expect(dot?.style.height).toBe('3px')
      expect(view.container.querySelector('.ops-sigil')?.getAttribute('data-size')).toBe('12')
      view.unmount()
    }
  })
})

describe('why footer', () => {
  it('shows the supplied source and purpose, and an honest missing reason', () => {
    expect(whyFooterText({})).toBe(MISSING_REASON)
    expect(whyFooterText({ source: '  ', purpose: '' })).toBe(MISSING_REASON)

    const sourceOnly = whyFooterText({ source: '/api/ops/fleet' })
    expect(sourceOnly).toContain('/api/ops/fleet')
    expect(sourceOnly).toContain(MISSING_REASON)
    expect(sourceOnly).not.toContain('approve')

    const purposeOnly = whyFooterText({ purpose: 'approve to resume worker' })
    expect(purposeOnly).toContain('approve to resume worker')
    expect(purposeOnly).not.toContain('/api/')

    const both = whyFooterText({
      source: '/api/plugins/kanban/tasks/t1',
      purpose: 'approve to resume worker',
      observedAt: '18:31:04'
    })
    expect(both).toContain('/api/plugins/kanban/tasks/t1')
    expect(both).toContain('observed 18:31:04')
    expect(both).toContain('approve to resume worker')
    expect(both).not.toContain(MISSING_REASON)
  })

  it('measures footer contrast at or above 4.5:1 on panel and raised', () => {
    const view = render(<WhyFooter source="/api/ops/fleet" purpose="fleet presence" />)
    const node = view.container.querySelector('.ops-why-footer')
    const ink = node?.getAttribute('data-ink') ?? ''
    const surface = node?.getAttribute('data-surface') ?? ''
    const panel = contrastRatio(ink, surface)
    const raised = whyFooterContrast('#1F1B14')

    expect(panel).not.toBeNull()
    expect(raised).not.toBeNull()
    expect(panel!).toBeGreaterThanOrEqual(4.5)
    expect(raised!).toBeGreaterThanOrEqual(4.5)
    expect(node?.textContent).toContain('/api/ops/fleet')
  })
})

describe('reused readout and kind icons', () => {
  it('reuses GlyphSpinner and leaves null tokens blank', () => {
    const empty = render(<ThinkingReadout seconds={66} tokens={null} />)

    expect(empty.container.querySelector('[aria-label="thinking"]')).not.toBeNull()
    expect(empty.container.querySelector('.glyph-spinner')?.getAttribute('data-paused')).toBeNull()
    expect(empty.container.querySelector('[data-tokens]')?.textContent).toBe('')
    empty.unmount()

    const reduced = render(
      <OpsMotionScope preference="reduced">
        <ThinkingReadout seconds={66} tokens={null} />
      </OpsMotionScope>
    )
    expect(reduced.container.querySelector('.glyph-spinner')?.getAttribute('data-paused')).toBe('true')
    expect(reduced.container.querySelector('.ops-thinking')?.getAttribute('data-ops-motion')).toBe('reduced')
    reduced.unmount()

    const known = render(<ThinkingReadout seconds={66} tokens={2700} />)
    expect(known.container.querySelector('[data-tokens]')?.textContent).toBe('2700')
  })

  it('uses lucide per kind and a platform logo for channels', () => {
    const schedule = render(<CanvasKindIcon kind="schedule" />)
    expect(schedule.container.querySelector('[data-platform="lucide"]')?.getAttribute('data-kind')).toBe('schedule')
    schedule.unmount()

    const channel = render(<CanvasKindIcon kind="channels" platformHost="github.com" />)
    expect(channel.container.querySelector('[data-platform="brand"]')?.getAttribute('data-kind')).toBe('channels')
  })
})
