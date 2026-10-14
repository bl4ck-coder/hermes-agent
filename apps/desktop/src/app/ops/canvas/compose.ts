/**
 * B13: Chat -> Canvas compose (Outglow-style), client-only and proposal-first.
 * Text is parsed deterministically (no model call, no tokens) into a reviewable proposal. Nothing
 * is ever applied on parse. Accept only stages drafts into the Prompt/Model node editors; the user
 * still reviews the diff and saves through the governed A5 path (op_id, policy, backup).
 * Nodes and edges are derived from config, so those items are shown as notes, never written.
 */
import { useSyncExternalStore } from 'react'

import { T } from '../main-i18n'

import type { NodeValue, WritableNode } from './node-editor'

export type ProposalItem =
  | { kind: 'model'; provider: string; model: string }
  | { kind: 'prompt'; mode: 'append' | 'replace'; text: string }
  | { kind: 'note'; text: string }

export interface Proposal {
  id: string
  profile: string
  source: string
  items: ProposalItem[]
}

const EDGE_HINT = 'Canvas links come from config (tools, skills, delegation); change the node they point to instead.'

let seq = 0

export function propose(profile: string, text: string, edges: readonly (readonly [string, string])[] = []): Proposal {
  const items: ProposalItem[] = []
  const appended: string[] = []

  for (const raw of text.split(/\n|;/)) {
    const line = raw.trim()

    if (!line) {
      continue
    }

    const model = /(?:^model\s*[:=]\s*|\b(?:use|switch to|set)\s+(?:the\s+)?model\s+(?:to\s+)?)([\w.-]+)\s*\/\s*([\w.:-]+)/i.exec(line)

    if (model) {
      items.push({ kind: 'model', provider: model[1], model: model[2] })

      continue
    }

    const replace = /^(?:system\s+)?prompt\s*[:=]\s*(.+)$/i.exec(line)

    if (replace) {
      items.push({ kind: 'prompt', mode: 'replace', text: replace[1].trim() })

      continue
    }

    const edge = /\bconnect\s+(\w+)\s+(?:to|->|→)\s+(\w+)/i.exec(line)

    if (edge) {
      const [a, b] = [edge[1].toLowerCase(), edge[2].toLowerCase()]
      const wired = edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
      items.push({ kind: 'note', text: wired ? `${a} → ${b} ${T('is already linked.')}` : `${a} → ${b}: ${T(EDGE_HINT)}` })

      continue
    }

    const node = /\badd\s+(?:an?\s+)?(\w+)\s+node\b/i.exec(line)

    if (node) {
      items.push({ kind: 'note', text: `${node[1]}: ${T(EDGE_HINT)}` })

      continue
    }

    appended.push(line.replace(/^(?:add to (?:the )?prompt|append|also)\s*:?\s*/i, ''))
  }

  if (appended.length) {
    items.push({ kind: 'prompt', mode: 'append', text: appended.join('\n') })
  }

  return { id: `p${Date.now().toString(36)}${(seq++).toString(36)}`, profile, source: text, items }
}

export function patchFor(item: ProposalItem, draft: NodeValue): { node: WritableNode; patch: NodeValue } | null {
  if (item.kind === 'model') {
    return { node: 'model', patch: { provider: item.provider, model: item.model } }
  }

  if (item.kind === 'prompt') {
    const base = draft.content ?? ''
    const content = item.mode === 'replace' ? item.text : `${base}${base && !base.endsWith('\n') ? '\n' : ''}${item.text}\n`

    return { node: 'prompt', patch: { content } }
  }

  return null
}

/* Staged (accepted) items wait here until the matching node editor consumes them into its draft. */
const staged = new Map<string, ProposalItem[]>()
const listeners = new Set<() => void>()
let version = 0
const k = (profile: string, node: WritableNode) => `${profile}\u0000${node}`

export function acceptProposal(p: Proposal): number {
  let n = 0

  for (const item of p.items) {
    const node: WritableNode | null = item.kind === 'model' ? 'model' : item.kind === 'prompt' ? 'prompt' : null

    if (node) {
      staged.set(k(p.profile, node), [...(staged.get(k(p.profile, node)) ?? []), item])
      n += 1
    }
  }

  version += 1
  listeners.forEach(l => l())

  return n
}

export function takeStaged(profile: string, node: WritableNode): ProposalItem[] {
  const items = staged.get(k(profile, node)) ?? []
  staged.delete(k(profile, node))

  return items
}

export function hasStaged(profile: string, node: WritableNode) {
  return (staged.get(k(profile, node))?.length ?? 0) > 0
}

export function useStagedVersion(): number {
  return useSyncExternalStore(
    l => (listeners.add(l), () => listeners.delete(l)),
    () => version,
    () => version
  )
}

export function resetStaged() {
  staged.clear()
  version += 1
  listeners.forEach(l => l())
}