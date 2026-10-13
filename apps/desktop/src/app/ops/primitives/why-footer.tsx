import '../motion.css'

import { WHY_INK, WHY_SURFACE, type WhyMeta, whyFooterContrast, whyFooterText } from '../motion'

export interface WhyFooterProps extends WhyMeta {
  className?: string
}

export function WhyFooter({ source, purpose, why, observedAt, className }: WhyFooterProps) {
  const text = whyFooterText({ source, purpose, why, observedAt })
  const ratio = whyFooterContrast(WHY_SURFACE)

  return (
    <p
      className={className ? `ops-why-footer ${className}` : 'ops-why-footer'}
      data-contrast={ratio == null ? '' : String(ratio)}
      data-ink={WHY_INK}
      data-missing={text.includes('reason not recorded') ? 'true' : 'false'}
      data-surface={WHY_SURFACE}
      style={{ color: WHY_INK, backgroundColor: WHY_SURFACE }}
    >
      {text}
    </p>
  )
}
