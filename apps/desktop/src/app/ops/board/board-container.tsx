/** Board container (ops-panel P4-02): A7 push trigger + 5 s poll fallback (D12), server-validated moves. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createOpsClient, type OpsClient } from '../feed/ops-client'
import { OPS_POLL_MS, useOpsFeed } from '../feed/ops-feed'

import { BoardView } from './board'
import { type BoardClient, type BoardData, createBoardClient, errorReason, isBoard, type MoveRecord, serverMove } from './board-model'

export function BoardContainer({
  client: c,
  feedClient,
  me,
  readOnly,
  pollMs = OPS_POLL_MS
}: {
  client?: BoardClient
  feedClient?: Pick<OpsClient, 'fleet'>
  me?: string | null
  readOnly?: boolean
  pollMs?: number
}) {
  const client = useMemo(() => c ?? createBoardClient(), [c])
  const fc = useMemo(() => feedClient ?? createOpsClient(), [feedClient])
  const feed = useOpsFeed(null, fc)
  const [board, setBoard] = useState<BoardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<MoveRecord | null>(null)
  const busy = useRef(0)

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

  // A pushed fleet change triggers an immediate reload; the poll is only the fallback.
  useEffect(() => {
    void reload()
  }, [reload, feed.fleet])

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
      board={board}
      bulkMove={(ids, to) => void bulk(ids, { status: to })}
      create={(title, column) =>
        void client.create(title, column, null).then(reload, e => setNotice(`Not created: ${errorReason(e)}`))
      }
      error={error}
      lastMove={lastMove}
      me={me}
      move={(id, to) => void move(id, to)}
      notice={notice}
      readOnly={readOnly}
      undo={rec => void move(rec.id, rec.from)}
    />
  )
}
