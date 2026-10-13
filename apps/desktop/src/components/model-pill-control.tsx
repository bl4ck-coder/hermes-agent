import { Button } from '@/components/ui/button'

/** Shared chrome for the editable composer pill and the scoped read-only Ops pill.
 * Lightweight on purpose: loading chrome must not initialize session/review stores. */
export const MODEL_PILL_CLASS =
  'h-(--composer-control-size) min-w-0 shrink gap-1 rounded-md px-2 text-xs font-normal text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'

export function ReadonlyModelPill({
  connectionId,
  profile,
  label,
  reason
}: {
  connectionId: string
  profile: string
  label: string
  reason: string
}) {
  return (
    <Button
      aria-disabled="true"
      className={MODEL_PILL_CLASS}
      data-model-connection={connectionId}
      data-model-profile={profile}
      data-ops-model-chip=""
      disabled
      title={reason}
      type="button"
      variant="ghost"
    >
      <span className="truncate">{label}</span>
    </Button>
  )
}
