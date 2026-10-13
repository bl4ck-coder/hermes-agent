// Ops motion, presence, and sigil contracts. Frozen in
// apps/desktop/docs/ops-panel/presence-motion.md (P0-05 r2). This module does
// not invent a second timer, spinner, or hash.

import { contrastRatio } from '@hermes/shared/color'

import { hashString } from '@/lib/profile-color'

export { hashString }

/** O79 motion-row description. Exact sentence. */
export const MOTION_ROW_DESCRIPTION = 'States still change and stay readable'

export const MOTION_MS = {
  micro: 140,
  panel: 220,
  view: 320
} as const

export const EASE = 'cubic-bezier(.23, 1, .32, 1)'
export const EASE_DRAWER = 'cubic-bezier(.32, .72, 0, 1)'

/** T10 glow decay. Not a duration token. */
export const GLOW_DECAY_MS = 600

export const PULSE_PERIOD_MS = 1000
export const PULSE_MIN_OPACITY = 0.72
export const FRESH_MS = 5_000
export const DONE_HOLD_MS = 10_000

export const WHY_INK = '#9A8F7A'
export const WHY_SURFACE = '#16140F'
export const WHY_RAISED = '#1F1B14'
export const MISSING_REASON = 'reason not recorded'

export const SIGIL_DISCS = ['#C9A55A', '#D3B065', '#DEBC6F', '#E8C77A'] as const
export const SIGIL_INK = '#0E0D0B'
export const SIGIL_EMPTY_FILL = '#1F1B14'
export const SIGIL_EMPTY_DOT = '#F2E8D5'

export type MotionPreference = 'full' | 'reduced' | 'system'
export type ResolvedMotion = 'full' | 'reduced'
export type MotionFeature = 'pulse' | 'drift' | 'flip' | 'land' | 'pop' | 'stream' | 'caret'

export type KeyframeName = 'rise' | 'land' | 'done' | 'strike' | 'pop' | 'slide' | 'grow' | 'add'
export type ReducedKeyframe = 'instant-visible' | 'off' | 'static-end'

export interface KeyframeSpec {
  name: KeyframeName
  durationMs: 140 | 220
  ease: 'ease' | 'ease-drawer'
  reduced: ReducedKeyframe
}

export const KEYFRAMES: readonly KeyframeSpec[] = [
  { name: 'rise', durationMs: 220, ease: 'ease', reduced: 'instant-visible' },
  { name: 'land', durationMs: 220, ease: 'ease', reduced: 'off' },
  { name: 'done', durationMs: 220, ease: 'ease', reduced: 'static-end' },
  { name: 'strike', durationMs: 220, ease: 'ease', reduced: 'static-end' },
  { name: 'pop', durationMs: 140, ease: 'ease', reduced: 'off' },
  { name: 'slide', durationMs: 220, ease: 'ease-drawer', reduced: 'instant-visible' },
  { name: 'grow', durationMs: 220, ease: 'ease', reduced: 'instant-visible' },
  { name: 'add', durationMs: 140, ease: 'ease', reduced: 'instant-visible' }
]

export type PresenceState = 'working' | 'needs_you' | 'blocked' | 'idle' | 'offline' | 'unknown' | 'stale'
export type GlyphState = PresenceState | 'done'
export type PresenceShape =
  'disc' | 'reduced-disc' | 'ringed' | 'triangle' | 'dot' | 'hollow' | 'dotted' | 'barred' | 'static-disc'
export type CountedIn = 'working' | 'needs_you' | 'blocked' | 'idle' | 'offline' | 'none'

export interface PresenceInput {
  now: number
  observedAt: number | null
  eventAt: number | null
  /** A read confirmed the backend unreachable. That is an observation, not a missing row. */
  unreachable?: boolean
  /** The only observation is the §3.2 profile-list snapshot older than 60s. A newer A1 read must pass false. */
  snapshotStale?: boolean
  needsYou?: boolean
  blocked?: boolean
  working?: boolean
  subState?: 'thinking' | 'tool' | null
  toolName?: string | null
  completion?: boolean
  gatewayUp?: boolean
  noWork?: boolean
}

export interface PresenceResolution {
  state: GlyphState
  label: string
  shape: PresenceShape
  glyphColor: string
  copyColor: string
  pulse: boolean
  countedIn: CountedIn
}

export interface SigilSpec {
  kind: 'empty' | 'named'
  fill: string
  ink: string
  monogram: string
  disc: string | null
  rim: string | null
  hash: number
  index: number | null
}

export interface WhyMeta {
  source?: string | null
  purpose?: string | null
  why?: string | null
  observedAt?: string | null
}

const GLYPH_COLOR: Record<GlyphState, string> = {
  working: '#E8C77A',
  needs_you: '#D4893A',
  blocked: '#B4533C',
  idle: '#CDBB98',
  offline: '#6E675C',
  unknown: '#9A8F7A',
  stale: '#A89880',
  done: '#CDBB98'
}

const COPY_COLOR: Record<GlyphState, string> = {
  working: '#E8C77A',
  needs_you: '#D4893A',
  blocked: '#BF6D59',
  idle: '#CDBB98',
  offline: '#8A8376',
  unknown: '#9A8F7A',
  stale: '#A89880',
  done: '#CDBB98'
}

const SHAPE: Record<GlyphState, PresenceShape> = {
  working: 'disc',
  needs_you: 'ringed',
  blocked: 'triangle',
  idle: 'dot',
  offline: 'hollow',
  unknown: 'dotted',
  stale: 'barred',
  done: 'static-disc'
}

const COUNTED: Record<GlyphState, CountedIn> = {
  working: 'working',
  needs_you: 'needs_you',
  blocked: 'blocked',
  idle: 'idle',
  offline: 'offline',
  unknown: 'none',
  stale: 'none',
  done: 'none'
}

const clean = (value: string | null | undefined) => (value ?? '').trim()

export function resolveMotion(preference: MotionPreference, systemReduced: boolean): ResolvedMotion {
  if (preference === 'reduced') return 'reduced'
  if (preference === 'full') return 'full'

  return systemReduced ? 'reduced' : 'full'
}

export function motionFeatureOn(mode: ResolvedMotion, feature: MotionFeature): boolean {
  if (feature === 'stream') return true
  if (mode === 'reduced') return false

  return true
}

export function easeValue(token: 'ease' | 'ease-drawer'): string {
  return token === 'ease-drawer' ? EASE_DRAWER : EASE
}

export function keyframePlan(name: KeyframeName, mode: ResolvedMotion): KeyframeSpec & { plays: boolean } {
  const spec = KEYFRAMES.find(item => item.name === name)

  if (!spec) {
    throw new Error(`unknown keyframe ${name}`)
  }

  const plays = mode === 'full' || spec.reduced !== 'off'

  return { ...spec, plays }
}

function pack(
  state: GlyphState,
  label = state === 'needs_you' ? 'needs-you' : state,
  pulse = false
): PresenceResolution {
  return {
    state,
    label,
    shape: SHAPE[state],
    glyphColor: GLYPH_COLOR[state],
    copyColor: COPY_COLOR[state],
    pulse,
    countedIn: COUNTED[state]
  }
}

function toolLabel(name: string | null | undefined): string {
  const trimmed = clean(name)

  return trimmed ? `tool:${trimmed}` : 'tool'
}

/**
 * Event-backed presence. Unknown and stale never become idle. The done timer
 * alone never yields idle: idle needs a fresh gateway-up + no-work read.
 */
export function resolvePresence(input: PresenceInput): PresenceResolution {
  if (input.unreachable) return pack('offline')
  if (input.observedAt === null) return pack('unknown')

  const age = input.now - input.observedAt
  const fresh = age <= FRESH_MS && !input.snapshotStale

  if (!fresh) return pack('stale')
  if (input.needsYou) return pack('needs_you')
  if (input.blocked) return pack('blocked')

  if (input.working) {
    if (input.subState === 'thinking') return pack('working', 'thinking', true)
    if (input.subState === 'tool') return pack('working', toolLabel(input.toolName), true)

    return pack('working', 'working', false)
  }

  if (input.completion && input.eventAt !== null) {
    const elapsed = input.now - input.eventAt

    if (elapsed < DONE_HOLD_MS) return pack('done')
  }

  if (input.gatewayUp && input.noWork) return pack('idle')

  // Fresh read, no idle confirmation, no work event. Do not paint idle.
  return pack('unknown')
}

export function presenceShape(state: GlyphState, mode: ResolvedMotion): PresenceShape {
  if (mode === 'reduced' && (state === 'working' || state === 'done')) {
    return state === 'working' ? 'reduced-disc' : 'static-disc'
  }

  return SHAPE[state]
}

export function monogram(name: string): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const parts: string[] = []

  for (const { segment } of segmenter.segment(name)) {
    parts.push(segment)
    if (parts.length === 2) break
  }

  return parts.join('').toUpperCase()
}

/** Gold disc from hashString. A rim is painted only for a real override entry, never the hsl fallback. */
export function resolveSigil(name: string | null | undefined, overrides: Record<string, string> = {}): SigilSpec {
  const key = clean(name)
  const hash = hashString(key)

  if (!key || key === 'default') {
    return {
      kind: 'empty',
      fill: SIGIL_EMPTY_FILL,
      ink: SIGIL_EMPTY_DOT,
      monogram: '',
      disc: null,
      rim: null,
      hash,
      index: null
    }
  }

  const index = hash % SIGIL_DISCS.length
  const disc = SIGIL_DISCS[index]!
  const override = Object.prototype.hasOwnProperty.call(overrides, key) ? clean(overrides[key]) : ''

  return {
    kind: 'named',
    fill: disc,
    ink: SIGIL_INK,
    monogram: monogram(key),
    disc,
    rim: override || null,
    hash,
    index
  }
}

/** Joins only fields the caller supplied. Missing purpose is the frozen fallback, not a guessed sentence. */
export function whyFooterText(meta: WhyMeta): string {
  const source = clean(meta.source)
  const reason = clean(meta.purpose) || clean(meta.why)
  const observed = clean(meta.observedAt)

  if (!source && !reason && !observed) return MISSING_REASON

  const parts = ['why · what for:']

  if (source) parts.push(source)
  if (observed) parts.push(`observed ${observed}`)
  parts.push(reason || MISSING_REASON)

  return parts.join(' · ')
}

export function whyFooterContrast(surface: string = WHY_SURFACE): number | null {
  return contrastRatio(WHY_INK, surface)
}

export function tokensText(tokens: number | null | undefined): string {
  if (tokens == null || Number.isNaN(tokens)) return ''

  return String(tokens)
}

export const PRESENCE_STATES: readonly PresenceState[] = [
  'working',
  'needs_you',
  'blocked',
  'idle',
  'offline',
  'unknown',
  'stale'
]

export const SHAPE_NAME: Record<PresenceShape, string> = {
  disc: 'filled disc',
  'reduced-disc': 'filled disc with hugging stroke',
  ringed: 'ringed disc',
  triangle: 'triangle',
  dot: 'middle dot',
  hollow: 'hollow disc',
  dotted: 'dotted circle',
  barred: 'barred circle',
  'static-disc': 'static disc'
}
