/**
 * L8 (SPEC v2.1 3): unsaved Canvas drafts survive a profile switch, delete or disconnect. Kept per
 * (connection, profile, node) in local storage; cleared on save or discard, or by Forget drafts.
 * Raw config.yaml drafts are never stored: config.yaml is secret-bearing (5c), so only the
 * non-secret Prompt and Model drafts persist.
 */
import type { NodeValue, WritableNode } from './node-editor'

const PREFIX = 'hermes.ops.drafts'
export const DRAFT_NODES: readonly WritableNode[] = ['prompt', 'model']

const key = (connection: string, profile: string, node: WritableNode) => `${PREFIX}\u0000${connection || 'local'}\u0000${profile}\u0000${node}`

export function saveDraft(connection: string, profile: string, node: WritableNode, draft: NodeValue): boolean {
  if (!DRAFT_NODES.includes(node)) {
    return false
  }

  try {
    globalThis.localStorage?.setItem(key(connection, profile, node), JSON.stringify({ draft, at: Date.now() }))

    return true
  } catch {
    return false
  }
}

export function loadDraft(connection: string, profile: string, node: WritableNode): { draft: NodeValue; at: number } | null {
  if (!DRAFT_NODES.includes(node)) {
    return null
  }

  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(key(connection, profile, node)) ?? 'null') as { draft?: NodeValue; at?: number } | null

    return v && v.draft && typeof v.draft === 'object' ? { draft: v.draft, at: typeof v.at === 'number' ? v.at : 0 } : null
  } catch {
    return null
  }
}

export function clearDraft(connection: string, profile: string, node: WritableNode) {
  try {
    globalThis.localStorage?.removeItem(key(connection, profile, node))
  } catch {
    /* storage unavailable */
  }
}

/** Forget drafts (explicit only; L9 never clears them on close). */
export function forgetDrafts(): number {
  const ls = globalThis.localStorage

  if (!ls) {
    return 0
  }

  const doomed: string[] = []

  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i)

    if (k?.startsWith(`${PREFIX}\u0000`)) {
      doomed.push(k)
    }
  }

  doomed.forEach(k => ls.removeItem(k))

  return doomed.length
}
