import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

import { humanError, humanErrorHasMore, humanErrorLine } from '../../ops/feed/api-error'
import { T } from '../../ops/main-i18n'

import type { ComposerSubmitRefusal } from './hooks/use-composer-submit'

/**
 * P27 (judge pass 21 #5): the gateway refused the send. Said here, beside the draft it gave back: one short line with
 * the human reason first (status meaning + the server's words), the raw text folded after it. Never moves focus — the
 * caret stays in the composer so the user can fix and resend.
 */
export function SubmitRefusalNotice({ onDismiss, refusal }: { onDismiss: () => void; refusal: ComposerSubmitRefusal | null }) {
  const { t } = useI18n()

  if (!refusal) {
    return null
  }

  const h = humanError(refusal.error)

  return (
    <div
      className="flex items-start justify-between gap-2 rounded-lg border border-[color-mix(in_srgb,var(--destructive)_40%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_8%,transparent)] px-2 py-1"
      data-slot="composer-submit-refusal"
    >
      <div className="min-w-0 text-(length:--type-meta) leading-(--type-meta-lh) text-foreground">
        <p className="m-0 wrap-anywhere" data-composer-refusal-reason="" role="alert">
          <span className="font-medium">{T('Not sent')}</span> · {humanErrorLine(h, T)}
        </p>
        {humanErrorHasMore(h) ? (
          <details className="text-muted-foreground" data-composer-refusal-raw="">
            <summary className="cursor-pointer">{T('Details')}</summary>
            <code className="block font-mono text-xs whitespace-pre-wrap wrap-anywhere">{h.raw}</code>
          </details>
        ) : null}
      </div>
      <Button
        aria-label={t.common.close}
        className="h-6 shrink-0 rounded-md px-2 text-xs"
        onClick={onDismiss}
        type="button"
        variant="ghost"
      >
        ×
      </Button>
    </div>
  )
}
