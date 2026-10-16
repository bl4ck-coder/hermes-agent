/**
 * P27 (judge pass 21 #5): a prompt.submit the gateway refused is said beside the composer that gets the draft back,
 * not as a transcript bubble or a toast. The submit pipeline records the refusal under the composer-owned submission
 * id; the composer's restore takes it once. Bounded so refusals nobody takes (a hidden pane) never pile up.
 */
const MAX_HELD = 32
const refusals = new Map<string, unknown>()

export function recordSubmitRefusal(submissionIds: readonly (null | string | undefined)[], error: unknown): void {
  for (const id of new Set(submissionIds)) {
    if (!id) {
      continue
    }

    refusals.delete(id)
    refusals.set(id, error)
  }

  for (const id of refusals.keys()) {
    if (refusals.size <= MAX_HELD) {
      break
    }

    refusals.delete(id)
  }
}

/** The refusal recorded for this send, once (`null` when there was none). */
export function takeSubmitRefusal(submissionId: string): { error: unknown } | null {
  if (!refusals.has(submissionId)) {
    return null
  }

  const error = refusals.get(submissionId)
  refusals.delete(submissionId)

  return { error }
}
