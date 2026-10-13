import '../motion.css'

import type { CSSProperties } from 'react'

import { resolveSigil } from '../motion'

export interface SigilProps {
  name: string | null | undefined
  /** User-stored override only. Do not pass the hsl fallback from profileColor. */
  colorOverride?: string | null
  className?: string
}

export function Sigil({ name, colorOverride, className }: SigilProps) {
  const key = (name ?? '').trim()
  const overrides = colorOverride && key && key !== 'default' ? { [key]: colorOverride } : {}
  const spec = resolveSigil(name, overrides)
  const style: CSSProperties = {
    backgroundColor: spec.fill,
    color: spec.ink,
    boxShadow: spec.rim ? `inset 0 0 0 2px ${spec.rim}` : undefined
  }

  return (
    <span
      aria-label={spec.monogram ? `${key} ${spec.monogram}` : 'default profile'}
      className={className ? `ops-sigil ${className}` : 'ops-sigil'}
      data-disc={spec.disc ?? 'none'}
      data-hash={String(spec.hash)}
      data-index={spec.index == null ? 'none' : String(spec.index)}
      data-ink={spec.ink}
      data-monogram={spec.monogram}
      data-rim={spec.rim ?? 'none'}
      role="img"
      style={style}
    >
      {spec.monogram ? (
        spec.monogram
      ) : (
        <span
          aria-hidden="true"
          className="ops-sigil__dot"
          data-empty-dot="true"
          style={{ backgroundColor: spec.ink }}
        />
      )}
    </span>
  )
}
