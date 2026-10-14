/** O67 (P8 b5): kanban task ids in free text (comments, summaries) become task-tab links. Text stays text. */
import { Fragment } from 'react'

/** Kanban ids are `t_` + 6-16 lowercase hex (plugin task id format). */
export const TASK_ID_RE = /\bt_[0-9a-f]{6,16}\b/g

export function splitTaskIds(text: string): (string | { id: string })[] {
  const out: (string | { id: string })[] = []
  let last = 0

  for (const m of text.matchAll(TASK_ID_RE)) {
    const at = m.index ?? 0

    if (at > last) {
      out.push(text.slice(last, at))
    }

    out.push({ id: m[0] })
    last = at + m[0].length
  }

  if (last < text.length) {
    out.push(text.slice(last))
  }

  return out
}

export function LinkedText({ text, onOpenTask }: { text: string; onOpenTask?: (id: string) => void }) {
  return (
    <>
      {splitTaskIds(text).map((p, i) =>
        typeof p === 'string' ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <button data-ops-entity={p.id} disabled={!onOpenTask} key={i} onClick={() => onOpenTask?.(p.id)} type="button">
            {p.id}
          </button>
        )
      )}
    </>
  )
}
