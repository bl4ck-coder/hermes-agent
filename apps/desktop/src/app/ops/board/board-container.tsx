/** Board container (ops-panel P4-02, P7 F1): kanban task_events push (A7 SSE) + 5 s poll fallback (D12), server-validated moves. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { captureGatewayFileDownload } from '@/lib/media'

import { useKanbanStream } from '../feed/kanban-stream'
import { createOpsActions, type OpsActions } from '../feed/ops-actions'
import type { OpsClient } from '../feed/ops-client'
import { OPS_POLL_MS, type OpsSseBridge } from '../feed/ops-feed'

import { BoardView } from './board'
import { allTasks, type BoardClient, type BoardData, type BoardLayout, type BoardTask, createBoardClient, errorReason, isBoard, MOVE_UNDO_MS, type MoveRecord, serverMove, undoRefusal } from './board-model'
import type { FileRow } from './board-parts'
import { copyText, taskLink, touched } from './board-plus'

/** R68 / R70: how many tasks the timeline and Files views read links/attachments for (one request each). */
export const LINK_SCAN_MAX = 40
export const FILE_SCAN_MAX = 40

export function BoardContainer({
  client: c,
  actions: a,
  feedClient: _feedClient,
  bridge,
  me,
  readOnly,
  pollMs = OPS_POLL_MS,
  connection,
  onOpenRoute
}: {
  connection?: string | null
  onOpenRoute?: (route: string) => void
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
  const [layout, setLayout] = useState<BoardLayout>('board')
  const [links, setLinks] = useState<[string, string][] | null>(null)
  const [files, setFiles] = useState<FileRow[] | null>(null)
  const tasks = board ? allTasks(board) : []
  // Most recently active first; the key changes only when the scanned set changes.
  const recent = [...tasks].sort((x, y) => (touched(y) ?? 0) - (touched(x) ?? 0))
  const linkKey = recent.filter(t => (t.link_counts?.children ?? 0) > 0).slice(0, LINK_SCAN_MAX).map(t => t.id).join(',')
  const fileTasks = recent.slice(0, FILE_SCAN_MAX)
  const fileKey = fileTasks.map(t => t.id).join(',')

  // R68: parent→child links for the timeline, read only while the timeline is open.
  useEffect(() => {
    if (layout !== 'timeline') {
      return
    }

    let live = true
    const ids = linkKey ? linkKey.split(',') : []
    setLinks(ids.length ? null : [])
    Promise.all(ids.map(id => Promise.resolve().then(() => client.links(id)).then(l => l.children.map(ch => [id, ch] as [string, string]), () => [] as [string, string][]))).then(
      all => live && setLinks(all.flat())
    )

    return () => {
      live = false
    }
  }, [client, layout, linkKey])

  // R11 / R70: files, read only while Files is open. Board-wide paged route first (P8 b6); an older
  // backend without it (404) falls back to scanning the most recently active tasks.
  const [filesNext, setFilesNext] = useState<string | null>(null)
  const [filesScope, setFilesScope] = useState<'board' | 'scan' | null>(null)
  const [filesMore, setFilesMore] = useState(false)

  const toRow = (a: Record<string, unknown>, title: Map<string, string>): FileRow => {
    const taskId = String(a.task_id ?? '')

    return { ...(a as object), id: String(a.id), filename: String(a.filename ?? 'file'), taskId, taskTitle: String(a.task_title ?? title.get(taskId) ?? taskId) } as FileRow
  }

  useEffect(() => {
    if (layout !== 'files') {
      return
    }

    let live = true
    const title = new Map(tasks.map(t => [t.id, t.title]))
    setFiles(null)
    Promise.resolve()
      .then(() => client.recentAttachments(null))
      .then(
        page => {
          if (live) {
            setFilesScope('board')
            setFiles(page.attachments.map(x => toRow(x, title)))
            setFilesNext(page.next)
          }
        },
        () => {
          const ids = fileKey ? fileKey.split(',') : []
          Promise.all(
            ids.map(id =>
              Promise.resolve()
                .then(() => client.attachments(id))
                .then(
                  xs => (xs as Record<string, unknown>[]).map(x => toRow({ task_id: id, ...x }, title)),
                  () => [] as FileRow[]
                )
            )
          ).then(all => {
            if (live) {
              setFilesScope('scan')
              setFiles(all.flat())
              setFilesNext(null)
            }
          })
        }
      )

    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, layout, fileKey])

  const loadMoreFiles = useCallback(async () => {
    if (!filesNext || filesMore) {
      return
    }

    setFilesMore(true)

    try {
      const title = new Map(tasks.map(t => [t.id, t.title]))
      const page = await client.recentAttachments(filesNext)
      setFiles(f => [...(f ?? []), ...page.attachments.map(x => toRow(x, title))])
      setFilesNext(page.next)
    } catch (e) {
      setNotice(`More files unavailable: ${errorReason(e)}`)
    } finally {
      setFilesMore(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, filesNext, filesMore, board])

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

  // Undo is offered for MOVE_UNDO_MS only.
  useEffect(() => {
    if (!lastMove) {
      return
    }

    const t = setTimeout(() => setLastMove(null), MOVE_UNDO_MS)

    return () => clearTimeout(t)
  }, [lastMove])

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

  const openTaskTab = onOpenRoute ? (id: string) => onOpenRoute(taskLink(id)) : undefined

  return (
    <BoardView
      archive={ids => void bulk(ids, { archive: true })}
      archived={archived}
      assign={(id, who) => void write(() => actions.assign(id, who), () => void reload())}
      board={board}
      bulkMove={(ids, to) => void bulk(ids, { status: to })}
      connection={connection}
      copyLink={id => void copyText(taskLink(id)).then(ok => setNotice(ok ? `Copied link to ${id}` : 'Copy failed: clipboard unavailable'))}
      create={(title, column) =>
        void client.create(title, column, null).then(reload, e => setNotice(`Not created: ${errorReason(e)}`))
      }
      createFull={async t => {
        await client.createFull(t)
        void reload()
      }}
      duplicate={t =>
        void write(
          () => client.createFull({ title: `${t.title} (copy)`, body: t.body ?? null, assignee: t.assignee ?? null, priority: t.priority ?? 0, column: t.status, tenant: t.tenant ?? null, skills: t.skills ?? null }),
          () => void reload()
        )
      }
      error={error}
      files={files}
      filesHasMore={!!filesNext}
      filesLoadingMore={filesMore}
      filesScanned={filesScope === 'scan' ? fileTasks.length : undefined}
      lastMove={lastMove}
      links={links}
      loadArchived={() => void loadArchived()}
      loadMoreFiles={loadMoreFiles}
      me={me}
      move={(id, to) => void move(id, to)}
      notice={notice}
      onLayoutChange={setLayout}
      openFavorite={f => onOpenRoute?.(f.kind === 'project' ? `/kanban?project=${encodeURIComponent(f.id)}` : f.kind === 'profile' ? `/profiles/${encodeURIComponent(f.id)}` : taskLink(f.id))}
      openFile={f => {
        if (f.stored_path) {
          void captureGatewayFileDownload()(f.stored_path, f.filename)
        }
      }}
      openTaskTab={openTaskTab}
      pushMode={stream.mode}
      readOnly={readOnly}
      rename={(id, title) => void write(() => client.patch(id, { title }), () => void reload())}
      saveBody={async (id, body) => {
        await client.patch(id, { body })
        void reload()
      }}
      subtask={(parent, title) => void write(() => actions.createSubtask(parent, title), () => void reload())}
      unarchive={id => void write(() => actions.setStatus(id, 'todo'), () => (void loadArchived(), void reload()))}
      undo={rec => {
        const why = undoRefusal(board, rec)

        setLastMove(null)

        if (why) {
          setNotice(why)

          return
        }

        void move(rec.id, rec.from)
      }}
      upload={async (taskId, file) => {
        const bytes = await file.arrayBuffer()
        const r = await client.upload(taskId, { filename: file.name, contentType: file.type || undefined, bytes })
        const a = r?.attachment

        // R70: the new file appears at once from the server's answer (no reload).
        if (a) {
          setFiles(fs => [{ ...(a as object), id: String(a.id), filename: String(a.filename ?? file.name), taskId, taskTitle: tasks.find(t => t.id === taskId)?.title ?? taskId } as FileRow, ...(fs ?? [])])
        }
      }}
    />
  )
}
