/** P6 F7: Office toasts derived from the needs-you feed (O8/O62/O90). Pure; the queue primitive renders. */
import type { ApprovalItem } from '../feed/ops-client'
import type { OpsToastItem } from '../primitives/toast-queue'

export function toastsFromPending(
  items: ApprovalItem[] | null,
  nowMs: number,
  h: { onApprove?: (i: ApprovalItem) => unknown; onReview?: (rowKey: string) => void; onOpenTask?: (id: string) => void }
): OpsToastItem[] {
  if (!items) {
    return []
  }

  const out: OpsToastItem[] = []

  for (const i of items) {
    const createdAt = nowMs - (typeof i.age_s === 'number' ? i.age_s * 1000 : 0)
    const who = i.profile ?? 'unknown'

    if (i.origin === 'jsonrpc' && i.exact_request?.command) {
      out.push({
        id: `approval:${i.id}`,
        kind: 'approval',
        message: `${who} asks to run:`,
        command: i.exact_request.command,
        createdAt,
        onApprove: h.onApprove ? () => void h.onApprove?.(i) : undefined,
        onReview: h.onReview ? () => h.onReview?.(`${i.origin}:${i.id}`) : undefined
      })
    } else if (i.origin === 'kanban_blocked') {
      out.push({
        id: `blocked:${i.id}`,
        kind: 'blocked',
        message: `${who}: ${i.what_for || i.why || i.id} is blocked`,
        createdAt,
        onOpen: h.onOpenTask ? () => h.onOpenTask?.(i.id) : h.onReview ? () => h.onReview?.(`${i.origin}:${i.id}`) : undefined
      })
    }
  }

  return out
}

/** O8: [Review] is a user click, so it may move focus to that item's Needs-you row (toasts themselves never do). */
export function focusNeedsYouRow(rowKey: string, root: ParentNode = document) {
  const row = root.querySelector<HTMLElement>(`[data-ops-approval="${CSS.escape(rowKey)}"]`)
  row?.scrollIntoView?.({ block: 'nearest' })
  row?.focus()
}

/** Activity rows from /api/approvals/resolved: unknown fields stay "unknown". */
export function activityRow(a: Record<string, unknown>): { what: string; who: string; when: string } {
  const at = typeof a.resolved_at === 'number' ? a.resolved_at : typeof a.created_at === 'number' ? a.created_at : null
  const cmd = typeof a.command === 'string' ? a.command : typeof a.what_for === 'string' ? a.what_for : ''

  return {
    what: `${String(a.outcome ?? a.choice ?? 'resolved')}${cmd ? `: ${cmd}` : ''}`,
    who: typeof a.profile === 'string' && a.profile ? a.profile : 'unknown',
    when: at === null ? 'unknown' : new Date(at * 1000).toISOString()
  }
}
