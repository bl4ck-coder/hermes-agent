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
  savers.clear()
  listeners.forEach(l => l())
}

/* G57 (P8 b5): each dirty node editor registers how to save itself; the Canvas header saves them all. */
type Saver = () => Promise<boolean>
const savers = new Map<string, Map<string, Saver>>()

export function registerCanvasSaver(profile: string, node: string, save: Saver | null) {
  const m = savers.get(profile) ?? new Map<string, Saver>()

  if (save) {
    m.set(node, save)
  } else {
    m.delete(node)
  }

  savers.set(profile, m)
}

export const canvasDirtyCount = (profile: string) => dirty.get(profile)?.size ?? 0

export function useCanvasDirtyCount(profile: string): number {
  return useSyncExternalStore(
    l => (listeners.add(l), () => listeners.delete(l)),
    () => canvasDirtyCount(profile),
    () => canvasDirtyCount(profile)
  )
}

/** Saves sequentially (each save is its own A5 transaction); a refusal never stops the rest. */
export async function saveAllCanvas(profile: string): Promise<{ saved: number; failed: string[] }> {
  const failed: string[] = []
  let saved = 0

  for (const [node, save] of [...(savers.get(profile) ?? new Map<string, Saver>()).entries()]) {
    if (!dirty.get(profile)?.has(node)) {
      continue
    }

    try {
      if (await save()) {
        saved += 1
      } else {
        failed.push(node)
      }
    } catch {
      failed.push(node)
    }
  }

  return { saved, failed }
}
