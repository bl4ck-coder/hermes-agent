import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

/* Glass primitives. The look lives in styles/glass/glass.css (data-glass attributes), so these
   stay plain elements that keep any className or props passed to them. */

type Tone = 'neutral' | 'gold'

export function GlassPanel({
  as,
  blur = false,
  elevation = 'low',
  children,
  ...rest
}: {
  as?: ElementType
  blur?: boolean
  elevation?: 'low' | 'high'
  children?: ReactNode
} & ComponentPropsWithoutRef<'div'>) {
  const Tag = (as ?? 'div') as ElementType
  return (
    <Tag data-glass="panel" data-glass-blur={blur ? '' : undefined} data-glass-elevation={elevation} {...rest}>
      {children}
    </Tag>
  )
}

export function GlassPill({
  tone = 'neutral',
  children,
  ...rest
}: { tone?: Tone; children?: ReactNode } & ComponentPropsWithoutRef<'span'>) {
  return (
    <span data-glass="pill" data-glass-tone={tone} {...rest}>
      {children}
    </span>
  )
}

export function GlassButton({
  tone = 'neutral',
  type = 'button',
  children,
  ...rest
}: { tone?: Tone } & ComponentPropsWithoutRef<'button'>) {
  return (
    <button data-glass="button" data-glass-tone={tone} type={type} {...rest}>
      {children}
    </button>
  )
}

/** Decorative light pool; place inside a relatively positioned parent. */
export function Glow({ size = 160, style, ...rest }: { size?: number } & ComponentPropsWithoutRef<'span'>) {
  return <span aria-hidden="true" data-glass="glow" style={{ height: size, width: size, ...style }} {...rest} />
}
