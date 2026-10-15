/**
 * P7: whether a docked Inspector is on screen. Views that also have an in-place detail (the Canvas
 * node popover) show it only when no docked Inspector would repeat the same facts.
 */
import { useEffect, useSyncExternalStore } from 'react'

let docked = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())

export function useDockedInspectorPresence(on: boolean) {
  useEffect(() => {
    if (!on) {
      return
    }

    docked += 1
    emit()

    return () => {
      docked -= 1
      emit()
    }
  }, [on])
}

export function useDockedInspector(): boolean {
  return useSyncExternalStore(
    f => (subs.add(f), () => void subs.delete(f)),
    () => docked > 0,
    () => false
  )
}
