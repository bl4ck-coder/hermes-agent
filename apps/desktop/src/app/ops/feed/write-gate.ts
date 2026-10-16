/** P8 B8 (L2): one write gate for every Ops write control, fed by the /api/status connection check. */
import { useEffect, useSyncExternalStore } from 'react'

import { type ConnectionView } from './diag'

export interface WriteGate {
  enabled: boolean
  reason: string | null
  state: ConnectionView['state'] | 'unchecked'
}

const OPEN: WriteGate = { enabled: true, reason: null, state: 'unchecked' }
let gate: WriteGate = OPEN
const subs = new Set<() => void>()

/** Only a definite check result blocks writes; "connecting" (no answer yet) leaves them to the server guards. */
export function gateFrom(view: ConnectionView | null): WriteGate {
  if (!view || view.state === 'connecting') {
    return { ...OPEN, state: view?.state ?? 'unchecked' }
  }

  return view.writesEnabled
    ? { enabled: true, reason: null, state: view.state }
    : { enabled: false, reason: `Writes are off: ${view.copy}`, state: view.state }
}

export function setOpsConnection(view: ConnectionView | null) {
  const next = gateFrom(view)

  if (next.enabled === gate.enabled && next.reason === gate.reason && next.state === gate.state) {
    return
  }

  gate = next
  subs.forEach(fn => fn())
}

export const opsWriteGate = () => gate
export const subscribeWriteGate = (fn: () => void) => (subs.add(fn), () => void subs.delete(fn))
export const useOpsWriteGate = () => useSyncExternalStore(subscribeWriteGate, opsWriteGate, opsWriteGate)

export const WRITE_SELECTOR = '[data-ops-write]'

/** Disable (or re-enable) every [data-ops-write] control under root; remembers the control's own disabled state. */
export function applyWriteGate(root: HTMLElement, g: WriteGate) {
  root.querySelectorAll<HTMLButtonElement>(WRITE_SELECTOR).forEach(el => {
    if (!g.enabled) {
      if (!el.hasAttribute('data-ops-write-blocked')) {
        el.setAttribute('data-ops-write-blocked', el.disabled ? 'was-disabled' : '')

        if (el.hasAttribute('title')) {
          el.setAttribute('data-ops-write-title', el.getAttribute('title') ?? '')
        }
      }

      const title = g.reason ?? 'Writes are off'

      if (!el.disabled) {
        el.disabled = true
      }

      if (el.getAttribute('aria-disabled') !== 'true') {
        el.setAttribute('aria-disabled', 'true')
      }

      if (el.getAttribute('title') !== title) {
        el.setAttribute('title', title)
      }
    } else if (el.hasAttribute('data-ops-write-blocked')) {
      el.disabled = el.getAttribute('data-ops-write-blocked') === 'was-disabled'
      el.removeAttribute('data-ops-write-blocked')
      el.removeAttribute('aria-disabled')
      const t = el.getAttribute('data-ops-write-title')
      t === null ? el.removeAttribute('title') : el.setAttribute('title', t)
      el.removeAttribute('data-ops-write-title')
    }
  })
}

/** Keeps the gate applied as React re-renders or mounts new controls, and swallows clicks that slip through. */
export function useWriteGateOn(root: { current: HTMLElement | null }) {
  const g = useOpsWriteGate()

  useEffect(() => {
    const node = root.current

    if (!node) {
      return
    }

    applyWriteGate(node, g)

    if (g.enabled) {
      return
    }

    const observer = new MutationObserver(() => applyWriteGate(node, g))
    observer.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'title'] })

    const block = (e: Event) => {
      const t = e.target as Element | null

      if (t?.closest?.(WRITE_SELECTOR)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    node.addEventListener('click', block, true)
    node.addEventListener('submit', block, true)

    return () => {
      observer.disconnect()
      node.removeEventListener('click', block, true)
      node.removeEventListener('submit', block, true)
    }
  }, [g, root])

  return g
}
