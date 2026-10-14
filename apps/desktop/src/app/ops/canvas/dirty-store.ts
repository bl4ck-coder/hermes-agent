/** O47 (P7 F4): which profiles hold an unsaved Canvas node draft. Drives the gold tab dot. */
import { useSyncExternalStore } from 'react'

const dirty = new Map<string, Set<string>>()
const listeners = new Set<() => void>()

export function setCanvasDirty(profile: string, node: string, isDirty: boolean) {
  const set = dirty.get(profile) ?? new Set<string>()
  const had = set.has(node)

  if (isDirty === had) {
    return
  }

  if (isDirty) {
    set.add(node)
  } else {
    set.delete(node)
  }

  dirty.set(profile, set)
  listeners.forEach(l => l())
}

export function isCanvasDirty(profile: string) {
  return (dirty.get(profile)?.size ?? 0) > 0
}

export function useCanvasDirty(profile: string): boolean {
  return useSyncExternalStore(
    l => (listeners.add(l), () => listeners.delete(l)),
    () => isCanvasDirty(profile),
    () => isCanvasDirty(profile)
  )
}

export function resetCanvasDirty() {
  dirty.clear()
  listeners.forEach(l => l())
}
