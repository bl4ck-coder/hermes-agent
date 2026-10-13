import '../motion.css'

import type { ReactNode } from 'react'
import { Brain, Circle, Clock, Cpu, FileText, Radio, Sparkles, Users, Webhook, Wrench } from 'lucide-react'

import { GlyphSpinner } from '@/components/ui/glyph-spinner'
import { usePaneVisible } from '@/components/pane-shell/pane-visibility'
import { ActivityTimerText } from '@/components/chat/activity-timer-text'
import { useMediaQuery } from '@/hooks/use-media-query'
import { resolveBrandIcon } from '@/lib/brand-icon'
import { cn } from '@/lib/utils'

import {
  type GlyphState,
  type MotionPreference,
  type PresenceShape,
  type ResolvedMotion,
  SHAPE_NAME,
  motionFeatureOn,
  presenceShape,
  resolveMotion,
  tokensText
} from '../motion'

const KIND_ICONS = {
  schedule: Clock,
  trigger: Webhook,
  memory: Brain,
  prompt: FileText,
  model: Cpu,
  tools: Wrench,
  subagents: Users,
  skills: Sparkles,
  channels: Radio
} as const

export type CanvasKind = keyof typeof KIND_ICONS

const GEOMETRY: Record<PresenceShape, Record<string, string>> = {
  disc: { 'data-disc-d': '8', 'data-stroke': '0', 'data-hollow': 'false' },
  'reduced-disc': {
    'data-disc-d': '8',
    'data-stroke': '1',
    'data-outer-d': '10',
    'data-gap': '0',
    'data-hollow': 'false'
  },
  ringed: { 'data-outer-d': '12', 'data-stroke': '1.5', 'data-inner-dot': '3', 'data-hollow-gap': '3' },
  triangle: { 'data-mark': 'triangle' },
  dot: { 'data-mark': 'dot' },
  hollow: { 'data-mark': 'hollow' },
  dotted: { 'data-outer-d': '10', 'data-stroke': '1', 'data-dash': '1 1' },
  barred: { 'data-outer-d': '10', 'data-stroke': '1.5', 'data-bar': '6x1' },
  'static-disc': { 'data-disc-d': '8', 'data-stroke': '0', 'data-pulse': 'off' }
}

function GlyphSvg({ shape, color }: { shape: PresenceShape; color: string }) {
  const common = {
    'aria-hidden': true as const,
    className: 'ops-presence__glyph',
    'data-shape': shape,
    ...GEOMETRY[shape]
  }

  if (shape === 'disc' || shape === 'static-disc') {
    return (
      <svg viewBox="0 0 12 12" {...common}>
        <circle cx="6" cy="6" fill={color} r="4" />
      </svg>
    )
  }

  if (shape === 'reduced-disc') {
    return (
      <svg viewBox="0 0 12 12" {...common}>
        <circle cx="6" cy="6" fill={color} r="4" />
        <circle cx="6" cy="6" fill="none" r="4.5" stroke={color} strokeWidth="1" />
      </svg>
    )
  }

  if (shape === 'ringed') {
    return (
      <svg viewBox="0 0 12 12" {...common}>
        <circle cx="6" cy="6" fill="none" r="5.25" stroke={color} strokeWidth="1.5" />
        <circle cx="6" cy="6" fill={color} r="1.5" />
      </svg>
    )
  }

  if (shape === 'triangle') {
    return (
      <svg viewBox="0 0 12 12" {...common}>
        <polygon fill={color} points="6,1.5 11,10.5 1,10.5" />
      </svg>
    )
  }

  if (shape === 'dot') {
    return (
      <svg viewBox="0 0 12 12" {...common}>
        <circle cx="6" cy="6" fill={color} r="1.5" />
      </svg>
    )
  }

  if (shape === 'hollow') {
    return (
      <svg viewBox="0 0 12 12" {...common}>
        <circle cx="6" cy="6" fill="none" r="4.25" stroke={color} strokeWidth="1.5" />
      </svg>
    )
  }

  if (shape === 'dotted') {
    return (
      <svg viewBox="0 0 12 12" {...common}>
        <circle cx="6" cy="6" fill="none" r="4.5" stroke={color} strokeDasharray="1 1" strokeWidth="1" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 12 12" {...common}>
      <circle cx="6" cy="6" fill="none" r="4.25" stroke={color} strokeWidth="1.5" />
      <rect fill={color} height="1" width="6" x="3" y="5.5" />
    </svg>
  )
}

export interface PresenceGlyphProps {
  state: GlyphState
  label: string
  glyphColor: string
  copyColor: string
  pulse?: boolean
  motion?: ResolvedMotion
  className?: string
}

export function PresenceGlyph({
  state,
  label,
  glyphColor,
  copyColor,
  pulse = false,
  motion = 'full',
  className
}: PresenceGlyphProps) {
  const visible = usePaneVisible()
  const shape = presenceShape(state, motion)
  const pulsing = pulse && motionFeatureOn(motion, 'pulse') && visible && state === 'working'
  const shapeName = SHAPE_NAME[shape]

  return (
    <span
      aria-label={`${label}, ${shapeName}`}
      className={cn('ops-presence', className)}
      data-focus-shape="rect"
      data-ops-motion={motion}
      data-paused={visible ? undefined : 'true'}
      data-pulse={pulsing ? 'on' : 'off'}
      data-state={state}
      role="img"
    >
      <span className={pulsing ? 'ops-presence-pulse' : undefined}>
        <GlyphSvg color={glyphColor} shape={shape} />
      </span>
      <span className="ops-presence__label" data-copy={copyColor} style={{ color: copyColor }}>
        {label}
      </span>
    </span>
  )
}

export function useOpsMotion(preference: MotionPreference): ResolvedMotion {
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)')

  return resolveMotion(preference, systemReduced)
}

export function OpsMotionScope({ preference, children }: { preference: MotionPreference; children: ReactNode }) {
  const mode = useOpsMotion(preference)

  return (
    <div data-ops-motion={mode} data-ops-motion-preference={preference}>
      {children}
    </div>
  )
}

export function OpsMotionReadout({ preference }: { preference: MotionPreference }) {
  const mode = useOpsMotion(preference)

  return <span data-testid="ops-motion-mode">{mode}</span>
}

/** SSE text stays in the DOM. Reduced motion stops the caret blink, not the words. */
export function OpsStreamText({ text, motion }: { text: string; motion: ResolvedMotion }) {
  const blink = motionFeatureOn(motion, 'caret')

  return (
    <span className="ops-stream" data-motion={motion} data-ops-motion={motion} data-readable="true">
      <span className="ops-stream__text">{text}</span>
      <span aria-hidden="true" className="ops-stream__caret" data-blink={blink ? 'on' : 'off'} />
    </span>
  )
}

/** G45: existing GlyphSpinner breathe + ActivityTimerText. Null tokens render nothing. */
export function ThinkingReadout({ seconds, tokens }: { seconds: number; tokens: number | null }) {
  const shown = tokensText(tokens)

  return (
    <span className="ops-thinking">
      <GlyphSpinner ariaLabel="thinking" className="ops-thinking__spinner" spinner="breathe" />
      <ActivityTimerText seconds={seconds} />
      <span data-tokens="">{shown}</span>
    </span>
  )
}

/** G53: lucide per canvas kind. Channels use a platform logo when the host resolves. */
export function CanvasKindIcon({ kind, platformHost }: { kind: string; platformHost?: string | null }) {
  if (kind === 'channels' && platformHost) {
    const Brand = resolveBrandIcon(platformHost)

    if (Brand) {
      return <Brand aria-hidden data-kind="channels" data-platform="brand" />
    }
  }

  const Icon = KIND_ICONS[kind as CanvasKind] ?? Circle

  return <Icon aria-hidden data-kind={kind} data-platform={kind in KIND_ICONS ? 'lucide' : 'none'} />
}
