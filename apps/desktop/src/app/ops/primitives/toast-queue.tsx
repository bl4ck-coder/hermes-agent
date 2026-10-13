import '../motion.css'

import { useLayoutEffect, useRef, useState } from 'react'

import { toastTitleClassName } from '@/components/notifications'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

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

/** O8: a char budget is not enough. Approve only when the full string is inside the toast. */
export function previewIsCropped(preview: HTMLElement, card: HTMLElement) {
  const text = preview.getBoundingClientRect()
  const box = card.getBoundingClientRect()

  if (text.width === 0 && text.height === 0) {
    return false
  }

  const view = preview.ownerDocument.defaultView
  const viewportRight = view?.innerWidth ?? box.right
  const viewportBottom = view?.innerHeight ?? box.bottom
  const eps = 1

  const pastCard =
    text.right > box.right + eps ||
    text.bottom > box.bottom + eps ||
    text.left < box.left - eps ||
    text.top < box.top - eps

  const pastView = text.right > viewportRight + eps || text.bottom > viewportBottom + eps || text.left < -eps
  const overflowed = preview.scrollWidth > preview.clientWidth + eps || preview.scrollHeight > preview.clientHeight + eps

  return pastCard || pastView || overflowed
}

export const approvalPreviewStyle = {
  display: 'block',
  maxWidth: '100%',
  minWidth: 0,
  overflow: 'visible',
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
} as const

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

function ApprovalPreview({ item }: { item: OpsToastItem }) {
  const preview = approvalPreview(item)
  const spanRef = useRef<HTMLSpanElement>(null)
  const [cropped, setCropped] = useState(false)
  const text = preview.fits ? preview.full : preview.text

  useLayoutEffect(() => {
    const el = spanRef.current
    const card = el?.closest('[data-toast-id]')

    if (!el || !(card instanceof HTMLElement) || !preview.fits) {
      setCropped(false)

      return
    }

    const measure = () => setCropped(previewIsCropped(el, card))

    measure()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(measure)
    observer.observe(card)
    observer.observe(el)

    return () => observer.disconnect()
  }, [preview.fits, preview.full])

  const approve = preview.action === 'approve' && !cropped && Boolean(item.onApprove)

  return (
    <>
      <p data-preview-fits={approve ? 'true' : 'false'} style={{ maxWidth: '100%', minWidth: 0, overflow: 'visible' }}>
        {item.message}
        {text ? (
          <span data-approval-preview data-geometrically-cropped={cropped ? 'true' : 'false'} ref={spanRef} style={approvalPreviewStyle}>
            {text}
          </span>
        ) : null}
      </p>
      {approve ? (
        <Button onClick={item.onApprove} type="button">
          Approve
        </Button>
      ) : (
        <Button onClick={item.onReview} type="button">
          Review
        </Button>
      )}
    </>
  )
}

function ToastActions({ item, now }: { item: OpsToastItem; now: number }) {
  const copy = useI18n().t.ops

  if (item.kind === 'approval') {
    return null
  }

  if (item.kind === 'blocked') {
    return (
      <Button onClick={item.onOpen} type="button">
        {copy.toast.open}
      </Button>
    )
  }

  if (undoVisible(item, now)) {
    return (
      <Button data-undo-ms={String(UNDO_MS)} onClick={item.onUndo} type="button">
        {copy.toast.undo}
      </Button>
    )
  }

  return null
}

function ToastBody({ item }: { item: OpsToastItem }) {
  if (item.kind === 'approval') {
    return <ApprovalPreview item={item} />
  }

  return <p>{item.message}</p>
}

export function ToastQueue({ dismissals, items, now, onNeedsYou }: ToastQueueProps) {
  const copy = useI18n().t.ops
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
          style={{ maxWidth: '100%', minWidth: 0, overflow: 'visible' }}
        >
          <AlertTitle className={toastTitleClassName()}>{copy.toast.kinds[item.kind]}</AlertTitle>
          <AlertDescription>
            <ToastBody item={item} />
            <div>
              <ToastActions item={item} now={now} />
              <Button aria-label={copy.toast.dismiss(copy.toast.kinds[item.kind])} onClick={() => dismiss(item.id)} type="button" variant="text">
                ×
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
      {hidden > 0 && (
        <Button data-needs-you="true" onClick={onNeedsYou} type="button" variant="text">
          {copy.toast.moreNeedsYou(hidden)}
        </Button>
      )}
    </div>
  )
}
