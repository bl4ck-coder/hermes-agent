/** X12 (P8 b6): every Office row can copy a deep link to what it shows (task, run, profile, project, cron job). */
import { useState } from 'react'

export type LinkKind = 'task' | 'run' | 'profile' | 'project' | 'cron'

/** Desktop routes the host already opens (the same strings Office rows navigate to). */
export function linkFor(kind: LinkKind, id: string): string {
  const e = encodeURIComponent(id)

  switch (kind) {
    case 'task':
      return `/kanban?task=${e}`

    case 'run':
      return `/ops/run/${e}`

    case 'profile':
      return `/profiles?profile=${e}`

    case 'project':
      return `/kanban?project=${e}`

    case 'cron':
      return `/cron?job=${e}`
  }
}

let writer: (text: string) => Promise<void> = text => navigator.clipboard.writeText(text)

/** Tests and hosts without a clipboard swap the writer. */
export function setCopyWriter(w: (text: string) => Promise<void>) {
  writer = w
}

export function CopyLink({ kind, id, label }: { kind: LinkKind; id: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  return (
    <button
      aria-label={`Copy link to ${label ?? `${kind} ${id}`}`}
      data-ops-copy-link={`${kind}:${id}`}
      data-ops-copy-state={state}
      onClick={async e => {
        e.stopPropagation()

        try {
          await writer(linkFor(kind, id))
          setState('copied')
        } catch {
          setState('failed')
        }
      }}
      title={state === 'copied' ? 'Link copied' : state === 'failed' ? 'Copy failed' : 'Copy link'}
      type="button"
    >
      {state === 'copied' ? '✓' : '⧉'}
    </button>
  )
}
