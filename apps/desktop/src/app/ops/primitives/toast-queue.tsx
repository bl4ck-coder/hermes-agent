import '../motion.css'

import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { toastTitleClassName } from '@/components/notifications'

import { opsDensityStyle } from './data-table'

/** R46. Undo is a caller callback. This queue never mutates. */
export const UNDO_MS = 8_000
export const UNDO_KINDS = ['move', 'archive', 'reassign'] as const
export const PROHIBITED_UNDO_KINDS = ['approval', 'stop'] as const
export const PREVIEW_BUDGET = 64

export type UndoKind = (typeof UNDO_KINDS)[number]
export type OpsToastKind = UndoKind | 'approval' | 'blocked' | 'stop'

export interface OpsToastItem {
  id: string
  kind: OpsToastKind
  message: string
  command?: string
  args?: string
  createdAt: number
  onUndo?: () => void
  onOpen?: () => void
  onReview?: () => void
  onApprove?: () => void
}

export interface DismissalStore {
  has(id: string): boolean
  dismiss(id: string): void
}

export function createDismissalStore(): DismissalStore {
  const ids = new Set<string>()

  return {
    dismiss(id) {
      ids.add(id)
    },
    has(id) {
      return ids.has(id)
    }
  }
}

export function undoAllowed(kind: OpsToastKind) {
  return (UNDO_KINDS as readonly string[]).includes(kind)
}

export function undoVisible(item: OpsToastItem, now: number) {
  if (!undoAllowed(item.kind) || !item.onUndo) {
    return false
  }

  return now - item.createdAt <= UNDO_MS
}

export function approvalPreview(item: Pick<OpsToastItem, 'command' | 'args'>, budget = PREVIEW_BUDGET) {
  const full = [item.command ?? '', item.args ?? ''].filter(Boolean).join(' ')
  const fits = full.length > 0 && full.length <= budget

  return {
    action: fits ? ('approve' as const) : ('review' as const),
    fits,
    full,
    text: fits || full.length === 0 ? full : `${full.slice(0, budget).trimEnd()}…`
  }
}

export function queueToasts(items: OpsToastItem[], dismissed: Pick<DismissalStore, 'has'>) {
  const seen = new Set<string>()
  const fresh = items.filter(item => {
    if (dismissed.has(item.id) || seen.has(item.id)) {
      return false
    }

    seen.add(item.id)
    return true
  })
  const byKind = new Map<OpsToastKind, OpsToastItem>()

  for (const item of fresh) {
    const current = byKind.get(item.kind)

    if (!current || item.createdAt >= current.createdAt) {
      byKind.set(item.kind, item)
    }
  }

  const shown = [...byKind.values()]

  return { hidden: fresh.length - shown.length, shown }
}

export interface ToastQueueProps {
  items: OpsToastItem[]
  now: number
  onNeedsYou?: () => void
  dismissals?: DismissalStore
}

function ToastActions({ item, now }: { item: OpsToastItem; now: number }) {
  const preview = approvalPreview(item)

  if (item.kind === 'approval') {
    if (preview.action === 'approve' && item.onApprove) {
      return (
        <Button onClick={item.onApprove} type="button">
          Approve
        </Button>
      )
    }

    return (
      <Button onClick={item.onReview} type="button">
        Review
      </Button>
    )
  }

  if (item.kind === 'blocked') {
    return (
      <Button onClick={item.onOpen} type="button">
        Open
      </Button>
    )
  }

  if (undoVisible(item, now)) {
    return (
      <Button data-undo-ms={String(UNDO_MS)} onClick={item.onUndo} type="button">
        Undo
      </Button>
    )
  }

  return null
}

function ToastBody({ item }: { item: OpsToastItem }) {
  if (item.kind !== 'approval') {
    return <p>{item.message}</p>
  }

  const preview = approvalPreview(item)

  return (
    <p data-preview-fits={preview.fits ? 'true' : 'false'}>
      {item.message}
      {preview.text ? <span data-approval-preview>{preview.text}</span> : null}
    </p>
  )
}

export function ToastQueue({ dismissals, items, now, onNeedsYou }: ToastQueueProps) {
  const [localDismissals] = useState(createDismissalStore)
  const [revision, setRevision] = useState(0)
  const store = dismissals ?? localDismissals
  const { hidden, shown } = queueToasts(items, store)

  const dismiss = (id: string) => {
    store.dismiss(id)
    setRevision(value => value + 1)
  }

  return (
    <div
      aria-live="polite"
      className="ops-toast-queue"
      data-dismiss-revision={String(revision)}
      data-steals-focus="false"
      role="status"
      style={opsDensityStyle()}
    >
      {shown.map(item => (
        <Alert
          aria-live="polite"
          className="ops-toast"
          data-kind={item.kind}
          data-toast-id={item.id}
          key={item.id}
          role="status"
        >
          <AlertTitle className={toastTitleClassName()}>{item.kind}</AlertTitle>
          <AlertDescription>
            <ToastBody item={item} />
            <div>
              <ToastActions item={item} now={now} />
              <Button aria-label={`Dismiss ${item.kind}`} onClick={() => dismiss(item.id)} type="button" variant="text">
                ×
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
      {hidden > 0 && (
        <Button data-needs-you="true" onClick={onNeedsYou} type="button" variant="text">
          +{hidden} more → Needs-you
        </Button>
      )}
    </div>
  )
}
