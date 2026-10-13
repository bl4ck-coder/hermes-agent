// Reuse Desktop's modal: portal, focus trap, themed layout and focus restoration.
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import { type EscapeLayerHandle, pushEscapeLayer } from '@/lib/escape-layers'
import { Keyboard } from '@/lib/icons'

import { OPS_LAYER_PRIORITY, OPS_SHORTCUTS } from './keymap'

export function OpsShortcutSheet({ onClose }: { onClose: () => void }) {
  const copy = useI18n().t.ops.shortcuts
  const layer = useRef<EscapeLayerHandle | null>(null)
  const restore = useRef(document.activeElement)
  const userClosed = useRef(false)

  const close = () => {
    userClosed.current = true
    onClose()
  }

  // eslint-disable-next-line no-restricted-syntax -- Escape registration token, not mirrored reactive state.
  useEffect(() => {
    layer.current = pushEscapeLayer(OPS_LAYER_PRIORITY)

    return () => {
      layer.current?.()
    }
  }, [])

  return (
    <Dialog
      onOpenChange={open => {
        if (!open) {
          close()
        }
      }}
      open
    >
      <DialogContent
        className="max-w-xl"
        data-ops-shortcut-sheet=""
        onCloseAutoFocus={event => {
          event.preventDefault()
          const target = restore.current

          if (
            userClosed.current &&
            target instanceof HTMLElement &&
            target.isConnected &&
            !target.closest('[hidden], [aria-hidden="true"]')
          ) {
            target.focus()
          }
        }}
        onEscapeKeyDown={event => {
          if (event.isComposing || !layer.current?.isTop()) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle icon={Keyboard}>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {OPS_SHORTCUTS.map(row => (
            <li className="grid grid-cols-[10rem_1fr] items-start gap-3 text-sm" key={row.chord}>
              <kbd className="rounded border border-border bg-muted px-2 py-1 text-xs">{row.chord}</kbd>
              <span className="py-1">{copy.actions[row.id]}</span>
            </li>
          ))}
        </ul>
        <Button onClick={close} type="button" variant="outline">
          {copy.close}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
