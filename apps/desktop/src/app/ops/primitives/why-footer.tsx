import '../motion.css'

import { useI18n } from '@/i18n'

import { WHY_INK, WHY_SURFACE, whyFooterContrast, whyFooterText, type WhyMeta } from '../motion'

export interface WhyFooterProps extends WhyMeta {
  className?: string
}

export function WhyFooter({ source, purpose, why, observedAt, className }: WhyFooterProps) {
  const copy = useI18n().t.ops.why
  const text = whyFooterText({ source, purpose, why, observedAt }, copy)
  const ratio = whyFooterContrast(WHY_SURFACE)

  return (
    <p
      className={className ? `ops-why-footer ${className}` : 'ops-why-footer'}
      data-contrast={ratio == null ? '' : String(ratio)}
      data-ink={WHY_INK}
      data-missing={text.includes(copy.missingReason) ? 'true' : 'false'}
      data-surface={WHY_SURFACE}
      style={{ color: WHY_INK, backgroundColor: WHY_SURFACE }}
    >
      {text}
    </p>
  )
}
