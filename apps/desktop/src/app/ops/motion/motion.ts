/**
 * Ops motion (ops-panel P5-03): SPEC 12.3 tokens and the 12.4 transition table T1-T15 as data, the
 * Full / Reduced / System mode (persisted, cycled by the status-bar readout) and the performance guard.
 * Components ask `transitionMs(id, ctx)` instead of hard-coding durations, so reduced motion and the
 * guard apply everywhere the same way.
 */

export const MOTION = { micro: 140, panel: 220, view: 320, glow: 600 } as const
export const EASE = 'cubic-bezier(.23,1,.32,1)'
export const EASE_DRAWER = 'cubic-bezier(.32,.72,0,1)'

export type MotionMode = 'full' | 'reduced' | 'system'
export type TransitionId = `T${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15}`

export interface TransitionSpec {
  id: TransitionId
  from: string
  ms: number
  ease: 'ease' | 'drawer'
  keyframe: string
  /** Under reduced motion: 'instant' swaps, 'static' keeps a non-moving cue, 'keep' keeps the fade. */
  reduced: 'instant' | 'static' | 'keep'
  layout: boolean
  rule: string
}

export const TRANSITIONS: TransitionSpec[] = [
  { id: 'T1', from: 'Orrery orb / fleet row → Canvas Identity node', ms: MOTION.view, ease: 'ease', keyframe: 'flip', reduced: 'instant', layout: true, rule: 'target unmounted: 140 ms crossfade; any input cancels' },
  { id: 'T2', from: 'Needs-you card → task drawer', ms: MOTION.panel, ease: 'drawer', keyframe: 'slide', reduced: 'instant', layout: false, rule: '"Open in Board" is explicit' },
  { id: 'T3', from: 'Drawer → Full-page tab', ms: MOTION.view, ease: 'drawer', keyframe: 'add', reduced: 'instant', layout: true, rule: 'reverse: Pop out to drawer' },
  { id: 'T4', from: 'Canvas test run → Office', ms: MOTION.panel, ease: 'ease', keyframe: 'rise', reduced: 'keep', layout: false, rule: 'no navigation' },
  { id: 'T5', from: 'Tab switch', ms: MOTION.micro, ease: 'ease', keyframe: 'fade', reduced: 'keep', layout: false, rule: 'instant switch, content fade' },
  { id: 'T6', from: 'Board drop', ms: MOTION.panel, ease: 'ease', keyframe: 'land', reduced: 'instant', layout: false, rule: 'illegal drop: snap-back + reason toast' },
  { id: 'T7', from: 'Status change / done', ms: MOTION.micro, ease: 'ease', keyframe: 'pop', reduced: 'static', layout: false, rule: 'badge pop / strike + fade' },
  { id: 'T8', from: 'New Needs-you row', ms: MOTION.panel, ease: 'ease', keyframe: 'rise', reduced: 'keep', layout: false, rule: 'never re-sorted under the pointer' },
  { id: 'T9', from: 'Presence change', ms: MOTION.panel, ease: 'ease', keyframe: 'crossfade', reduced: 'keep', layout: false, rule: 'colour crossfade' },
  { id: 'T10', from: 'Live run touches a node', ms: MOTION.glow, ease: 'ease', keyframe: 'glow', reduced: 'static', layout: false, rule: 'gold glow decay' },
  { id: 'T11', from: 'Zoom', ms: MOTION.micro, ease: 'ease', keyframe: 'zoom', reduced: 'instant', layout: false, rule: 'buttons only, none on wheel' },
  { id: 'T12', from: 'Toast enter/exit', ms: MOTION.panel, ease: 'ease', keyframe: 'rise', reduced: 'keep', layout: false, rule: 'max 1 per kind + "+n more"; never steals focus' },
  { id: 'T13', from: 'Rail / inspector / dock toggle', ms: MOTION.panel, ease: 'drawer', keyframe: 'slide', reduced: 'instant', layout: true, rule: 'persisted state' },
  { id: 'T14', from: 'Drawer close / palette page push', ms: MOTION.micro, ease: 'drawer', keyframe: 'slide', reduced: 'instant', layout: false, rule: '' },
  { id: 'T15', from: 'Node / expander open', ms: MOTION.panel, ease: 'ease', keyframe: 'grow', reduced: 'instant', layout: true, rule: '' }
]

export function transition(id: TransitionId): TransitionSpec {
  return TRANSITIONS.find(t => t.id === id)!
}

export interface MotionContext {
  mode: MotionMode
  systemReduced: boolean
  /** Moving items in the same container (performance guard: >50 disables layout animation). */
  movingItems?: number
  virtualized?: boolean
  offscreen?: boolean
}

export function effectiveReduced(mode: MotionMode, systemReduced: boolean) {
  return mode === 'reduced' || (mode === 'system' && systemReduced)
}

/** Duration to use, 0 = instant. Applies reduced motion and the 12.4 performance guard. */
export function transitionMs(id: TransitionId, ctx: MotionContext): number {
  const t = transition(id)

  if (effectiveReduced(ctx.mode, ctx.systemReduced) && t.reduced !== 'keep') {
    return 0
  }

  if (t.layout && (ctx.virtualized || ctx.offscreen || (ctx.movingItems ?? 0) > 50)) {
    return 0
  }

  return t.ms
}

export function cycleMotion(m: MotionMode): MotionMode {
  return m === 'full' ? 'reduced' : m === 'reduced' ? 'system' : 'full'
}

const KEY = 'hermes.ops.motion'

export function loadMotion(storage: Pick<Storage, 'getItem'> | null = globalThis.localStorage ?? null): MotionMode {
  const v = storage?.getItem(KEY)

  return v === 'full' || v === 'reduced' || v === 'system' ? v : 'system'
}

export function saveMotion(m: MotionMode, storage: Pick<Storage, 'setItem'> | null = globalThis.localStorage ?? null) {
  storage?.setItem(KEY, m)
}

export function systemPrefersReduced(): boolean {
  return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/** CSS custom properties for the Ops root; reduced motion zeroes every duration except kept fades. */
export function motionCssVars(ctx: MotionContext): Record<string, string> {
  const reduced = effectiveReduced(ctx.mode, ctx.systemReduced)

  return {
    '--ops-ease': EASE,
    '--ops-ease-drawer': EASE_DRAWER,
    '--ops-micro': `${MOTION.micro}ms`,
    '--ops-panel': `${reduced ? 0 : MOTION.panel}ms`,
    '--ops-view': `${reduced ? 0 : MOTION.view}ms`,
    '--ops-glow': `${reduced ? 0 : MOTION.glow}ms`
  }
}
