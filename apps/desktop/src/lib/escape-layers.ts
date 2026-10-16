/**
 * Ordered Escape ownership for the app's transient window-level layers.
 *
 * Several surfaces bind their own `window` `keydown` Escape handler (narrow-pane
 * reveal, layout edit mode, the zone editor, full-page overlays). Without a
 * shared order a single Escape fired all of them at once — closing a pinned
 * pane *and* exiting edit mode, or dismissing an overlay *and* the pane beneath
 * it. Radix dialogs already stop propagation / preventDefault, so this is only
 * about the app's own handlers.
 *
 * Contract for a layer handler:
 *   1. bail if `event.defaultPrevented` (a higher, propagation-stopping layer
 *      — a Radix dialog — already handled it);
 *   2. bail unless `isTopEscapeLayer(myPriority)` (a higher app layer is open);
 *   3. otherwise act and `event.preventDefault()`.
 *
 * A layer registers its priority (via `pushEscapeLayer`) only while it's open.
 */

// Higher number = closer to the user. Gaps leave room to slot new layers.
export const ESCAPE_PRIORITY = {
  narrowOverlay: 10,
  layoutEdit: 20,
  zoneEditor: 30,
  overlay: 40,
  // An in-flight pane drag: Esc means "abort the drag", never ALSO exit edit
  // mode / close the overlay the drag started over. Registered only for the
  // drag's few-hundred-ms lifetime (drag-session.ts).
  drag: 50
} as const

const active = new Map<symbol, number>()

export interface EscapeLayerHandle {
  (): void
  /** True only for the latest registration at the winning priority. */
  isTop: () => boolean
}

function winningKey(): symbol | null {
  let top = -Infinity
  let key: symbol | null = null

  for (const [candidate, priority] of active) {
    if (priority >= top) {
      top = priority
      key = candidate
    }
  }

  return key
}

/** Register a layer as open; call the returned disposer when it closes.
 *  Ties: only the most recently pushed registration at the winning priority acts. */
export function pushEscapeLayer(priority: number): EscapeLayerHandle {
  const key = Symbol('escape-layer')
  active.set(key, priority)

  const dispose = (() => {
    active.delete(key)
  }) as EscapeLayerHandle

  dispose.isTop = () => winningKey() === key

  return dispose
}

/** True when this priority is the unique winner. A tie returns false — callers
 *  that share a priority must use the handle's `isTop`. */
export function isTopEscapeLayer(priority: number): boolean {
  const key = winningKey()

  if (!key) {
    return true
  }

  const winning = active.get(key) ?? -Infinity

  if (priority < winning) {
    return false
  }

  if (priority > winning) {
    return true
  }

  let count = 0

  for (const value of active.values()) {
    if (value === priority) {
      count += 1
    }
  }

  return count === 1
}
