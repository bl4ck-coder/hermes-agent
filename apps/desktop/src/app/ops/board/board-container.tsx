/** Board container (ops-panel P4-02, P7 F1): kanban task_events push (A7 SSE) + 5 s poll fallback (D12), server-validated moves. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useKanbanStream } from '../feed/kanban-stream'
import { createOpsActions, type OpsActions } from '../feed/ops-actions'
import type { OpsClient } from '../feed/ops-client'
import { OPS_POLL_MS, type OpsSseBridge } from '../feed/ops-feed'

import { BoardView } from './board'
import { type BoardClient, type BoardData, type BoardTask, createBoardClient, errorReason, isBoard, type MoveRecord, serverMove } from './board-model'

export function BoardContainer({
  client: c,
  actions: a,
  feedClient: _feedClient,
  bridge,
  me,
  readOnly,
  pollMs = OPS_POLL_MS
}: {
  client?: BoardClient
  actions?: OpsActions
  /** @deprecated P7: the board follows its own kanban stream; kept for callers. */
  feedClient?: Pick<OpsClient, 'fleet'>
  bridge?: OpsSseBridge | null
  me?: string | null
  readOnly?: boolean
  pollMs?: number
}) {
  const client = useMemo(() => c ?? createBoardClient(), [c])
  const stream = useKanbanStream(bridge)
  const [board, setBoard] = useState<BoardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<MoveRecord | null>(null)
  const busy = useRef(0)
  const actions = useMemo(() => a ?? createOpsActions(), [a])
  const [archived, setArchived] = useState<BoardTask[] | null>(null)

  const loadArchived = useCallback(async () => {
    try {
      const b = await actions.archivedBoard()
      const col = Array.isArray(b?.columns) ? b.columns.find(x => x.name === 'archived') : undefined
      setArchived(col && Array.isArray(col.tasks) ? col.tasks : [])
    } catch (e) {
      setArchived(null)
      setNotice(`Archived unavailable: ${errorReason(e)}`)
    }
  }, [actions])

  const write = useCallback(
    async (fn: () => Promise<unknown>, after?: () => void) => {
      try {
        await fn()
        setNotice(null)
      } catch (e) {
        setNotice(`Refused: ${errorReason(e)}`)
      }

      after?.()
    },
    []
  )

  const reload = useCallback(async () => {
    try {
      const b = await client.board()

      // Never overwrite an in-flight optimistic move with a stale read (claim races).
      if (busy.current === 0) {
        setBoard(isBoard(b) ? b : null)
        setError(isBoard(b) ? null : 'malformed board')
      }
    } catch (e) {
      setError(errorReason(e))
    }
  }, [client])

  // A pushed kanban event triggers an immediate reload; the poll is only the fallback.
  useEffect(() => {
    void reload()
  }, [reload, stream.version])

  useEffect(() => {
    const t = setInterval(() => void reload(), pollMs)

    return () => clearInterval(t)
  }, [reload, pollMs])

  const move = useCallback(
    async (id: string, to: string) => {
      if (!board) {
        return
      }

      busy.current += 1
      const out = await serverMove(board, id, to, client.move, setBoard)
      busy.current -= 1
      setBoard(out.board)
      setNotice(out.ok ? null : `Moved back: ${out.reason}`)
      setLastMove(out.undo ?? null)

      if (out.ok) {
        void reload()
      }
    },
    [board, client, reload]
  )

  const bulk = useCallback(
    async (ids: string[], patch: { status?: string; archive?: boolean }) => {
      try {
        const r = await client.bulk(ids, patch)
        const failed = (r?.results ?? []).filter(x => !x.ok)
        setNotice(failed.length ? `Refused: ${failed.map(f => `${f.id} (${f.error ?? 'refused'})`).join(', ')}` : null)
      } catch (e) {
        setNotice(`Refused: ${errorReason(e)}`)
      }

      void reload()
    },
    [client, reload]
  )

  return (
    <BoardView
      archive={ids => void bulk(ids, { archive: true })}
      archived={archived}
      assign={(id, who) => void write(() => actions.assign(id, who), () => void reload())}
      board={board}
      bulkMove={(ids, to) => void bulk(ids, { status: to })}
      create={(title, column) =>
        void client.create(title, column, null).then(reload, e => setNotice(`Not created: ${errorReason(e)}`))
      }
      error={error}
      lastMove={lastMove}
      loadArchived={() => void loadArchived()}
      me={me}
      move={(id, to) => void move(id, to)}
      notice={notice}
      pushMode={stream.mode}
      readOnly={readOnly}
      subtask={(parent, title) => void write(() => actions.createSubtask(parent, title), () => void reload())}
      unarchive={id => void write(() => actions.setStatus(id, 'todo'), () => (void loadArchived(), void reload()))}
      undo={rec => void move(rec.id, rec.from)}
    />
  )
}
