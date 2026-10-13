// Ops shortcut sheet. One Esc closes this layer only. It does not approve.

import { useEffect } from 'react'

import { pushEscapeLayer } from '@/lib/escape-layers'

import { OPS_LAYER_PRIORITY, OPS_SHORTCUTS } from './keymap'

export function OpsShortcutSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const release = pushEscapeLayer(OPS_LAYER_PRIORITY)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !release.isTop()) {
        return
      }

      event.preventDefault()
      onClose()
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      release()
    }
  }, [onClose])

  return (
    <div aria-label="Ops shortcuts" aria-modal="true" data-ops-shortcut-sheet="" role="dialog">
      <h2>Ops shortcuts</h2>
      <p>Ctrl+J stays the Desktop sidebar. The dock toggle is the status bar item.</p>
      <ul>
        {OPS_SHORTCUTS.map(row => (
          <li key={row.chord}>
            <kbd>{row.chord}</kbd>
            <span>{row.action}</span>
          </li>
        ))}
      </ul>
      <button onClick={onClose} type="button">
        Close
      </button>
    </div>
  )
}
