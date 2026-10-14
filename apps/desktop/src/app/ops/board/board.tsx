/**
 * Board (ops-panel P4-02, P8 b3): Board/List/Table/Calendar/Timeline/Files/Favorites layouts plus the
 * Review lens over one backend board. Columns are windowed (fixed rows) so 400 cards mount only the
 * visible slice. Moves are server-validated: optimistic, then snap-back with the server's reason.
 * P8 b3: saved views (R67), relation timeline (R68), group/sort (R69), files (R11/R70), rich cards
 * (R71/R58), favourites (R74), card menu (R20), New-task modal (R40), inline rename (R47), Markdown body (R17).
 */

import { type KeyboardEvent, type ReactNode, useMemo, useState } from 'react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'

import {
  allTasks,
  type BoardData,
  type BoardFilter,
  type BoardLayout,
  type BoardTask,
  counts,
  filterBoard,
  groupByDay,
  keyboardTarget,
  MOVABLE,
  type MoveRecord,
  windowRange
} from './board-model'
import {
  BodyEditor,
  CardMenu,
  type CardMenuActions,
  CardSignals,
  FavoritesView,
  type FileRow,
  FilesView,
  GroupedTasks,
  InlineTitle,
  type NewTaskInput,
  NewTaskModal,
  StarButton,
  TimelineView,
  updatedLabel
} from './board-parts'
import { effectiveSort, type Favourite, type GroupBy, listViews, removeView, saveView, type SortBy, viewScope, viewsStore } from './board-plus'

/** P8 b3: cards carry signals (tags, priority, subtasks, heartbeat, comments), so rows are taller. */
export const ROW_H = 76
export const LAYOUTS: BoardLayout[] = ['board', 'list', 'table', 'calendar', 'timeline', 'files', 'favorites', 'review']

export interface BoardActions {
  move: (id: string, to: string) => void
  undo: (rec: MoveRecord) => void
  archive: (ids: string[]) => void
  bulkMove: (ids: string[], to: string) => void
  create: (title: string, column: string) => void
  assign?: (id: string, assignee: string | null) => void
  subtask?: (parentId: string, title: string) => void
  unarchive?: (id: string) => void
  loadArchived?: () => void
  /* ---- P8 b3 ---- */
  rename?: (id: string, title: string) => void
  saveBody?: (id: string, body: string) => Promise<unknown>
  duplicate?: (t: BoardTask) => void
  copyLink?: (id: string) => void
  createFull?: (t: NewTaskInput) => Promise<unknown>
  upload?: (taskId: string, file: File) => Promise<unknown>
  openFile?: (f: FileRow) => void
  openTaskTab?: (id: string) => void
  openFavorite?: (f: Favourite) => void
  onLayoutChange?: (l: BoardLayout) => void
}

export interface BoardViewProps extends BoardActions {
  board: BoardData | null
  error?: string | null
  notice?: string | null
  /** P7 F1: live = kanban push stream; poll = 5 s fallback. */
  pushMode?: 'connecting' | 'stream' | 'poll'
  lastMove?: MoveRecord | null
  me?: string | null
  readOnly?: boolean
  viewport?: number
  initialLayout?: BoardLayout
  archived?: BoardTask[] | null
  /* ---- P8 b3 ---- */
  nowS?: number
  /** Connection id for saved views (R67). */
  connection?: string | null
  /** [parent, child] links for the timeline; null = loading. */
  links?: [string, string][] | null
  files?: FileRow[] | null
  filesScanned?: number
  filesHasMore?: boolean
  filesLoadingMore?: boolean
  loadMoreFiles?: () => void
}

function Windowed({ tasks, viewport, render }: { tasks: BoardTask[]; viewport: number; render: (t: BoardTask) => ReactNode }) {
  const [top, setTop] = useState(0)
  const w = windowRange(tasks.length, top, viewport, ROW_H)

  return (
    <div data-ops-window="" onScroll={e => setTop((e.target as HTMLElement).scrollTop)} role="list" style={{ maxHeight: viewport, overflowY: 'auto' }}>
      <div style={{ height: w.padTop }} />
      {tasks.slice(w.start, w.end).map(render)}
      <div style={{ height: w.padBottom }} />
    </div>
  )
}

export function BoardView(props: BoardViewProps) {
  const { board, readOnly = false, viewport = 600 } = props
  const nowS = props.nowS ?? Date.now() / 1000
  const [layout, setLayoutState] = useState<BoardLayout>(props.initialLayout ?? 'board')
  const [filter, setFilter] = useState<BoardFilter>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pins, setPins] = useState<Set<string>>(new Set())
  const [drawer, setDrawer] = useState<{ id: string; full: boolean } | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [bulkTo, setBulkTo] = useState('ready')
  const [subDraft, setSubDraft] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [sortBy, setSortBy] = useState<SortBy>('priority')
  const [menu, setMenu] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<BoardTask | null>(null)
  const [modal, setModal] = useState<string | null>(null)
  const [viewName, setViewName] = useState('')
  const [activeView, setActiveView] = useState<string | null>(null)
  viewsStore.use()

  const setLayout = (l: BoardLayout) => {
    setLayoutState(l)
    props.onLayoutChange?.(l)
  }

  const scope = viewScope(props.connection, filter.project, filter.tenant, props.me ?? null)
  const views = listViews(scope)

  const shown = useMemo(() => {
    if (!board) {
      return null
    }

    const f = filterBoard(board, { ...filter, mine: filter.mine ? (props.me ?? null) : null })

    return layout === 'review' ? { ...f, columns: f.columns.filter(c => c.name === 'review') } : f
  }, [board, filter, layout, props.me])

  if (!board || !shown) {
    return <p data-ops-unavailable="">{props.error ? `Board unavailable: ${props.error}` : 'Board is loading (unknown).'}</p>
  }

  const tasks = allTasks(shown)
  const statusOrder = board.columns.map(c => c.name)
  const pinnedFirst = (list: BoardTask[]) => [...list.filter(t => pins.has(t.id)), ...list.filter(t => !pins.has(t.id))]
  const openDrawer = (id: string) => setDrawer({ id, full: false })

  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set)

    if (n.has(id)) {
      n.delete(id)
    } else {
      n.add(id)
    }

    return n
  }

  const keyFor = (t: BoardTask) => (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget && (e.target as HTMLElement).tagName === 'INPUT') {
      return
    }

    if (!readOnly && e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const to = keyboardTarget(board, t.id, e.key === 'ArrowRight' ? 1 : -1)

      if (to) {
        e.preventDefault()
        props.move(t.id, to)
      }
    }

    // R20: the context menu is keyboard reachable (Shift+F10 / ContextMenu key), like the OS.
    if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
      e.preventDefault()
      setMenu(t.id)
    }
  }

  const menuActions: CardMenuActions = {
    open: openDrawer,
    duplicate: readOnly ? undefined : props.duplicate,
    copyLink: props.copyLink,
    archive: readOnly ? undefined : id => setConfirmArchive(allTasks(board).find(t => t.id === id) ?? null),
    reassign: readOnly ? undefined : props.assign
  }

  const moveSelect = (t: BoardTask) =>
    readOnly ? null : (
      <select aria-label={`move ${t.id}`} data-ops-menu={t.id} onChange={e => e.target.value && props.move(t.id, e.target.value)} value="">
        <option value="">Move…</option>
        {MOVABLE.filter(s => s !== t.status).map(s => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    )

  const card = (t: BoardTask) => (
    <div
      data-ops-card={t.id}
      key={t.id}
      onContextMenu={e => (e.preventDefault(), setMenu(t.id))}
      onKeyDown={keyFor(t)}
      role="listitem"
      style={{ height: ROW_H }}
      tabIndex={0}
    >
      <input aria-label={`select ${t.id}`} checked={selected.has(t.id)} onChange={() => setSelected(s => toggle(s, t.id))} type="checkbox" />
      <InlineTitle onOpen={() => openDrawer(t.id)} onRename={props.rename ? title => props.rename?.(t.id, title) : undefined} readOnly={readOnly} task={t} />
      <span data-ops-assignee="">{t.assignee ?? 'unassigned'}</span>
      <CardSignals nowS={nowS} task={t} />
      {/* Quick actions: always in the DOM (keyboard reachable); CSS reveals them on hover / focus-within. */}
      <span data-ops-quick="">
        <StarButton id={t.id} kind="task" label={t.title} />
        <button aria-pressed={pins.has(t.id)} data-ops-pin={t.id} onClick={() => setPins(p => toggle(p, t.id))} type="button">
          {pins.has(t.id) ? 'Unpin' : 'Pin'}
        </button>
        {moveSelect(t)}
        <button aria-expanded={menu === t.id} aria-haspopup="menu" aria-label={`more actions for ${t.title}`} data-ops-more={t.id} onClick={() => setMenu(m => (m === t.id ? null : t.id))} type="button">
          ⋯
        </button>
      </span>
      {menu === t.id ? <CardMenu actions={menuActions} assignees={board.assignees ?? []} onClose={() => setMenu(null)} task={t} /> : null}
    </div>
  )

  const row = (t: BoardTask) => (
    <tr data-ops-row={t.id} key={t.id} onContextMenu={e => (e.preventDefault(), setMenu(t.id))}>
      <td>{t.id}</td>
      <td>
        <InlineTitle onOpen={() => openDrawer(t.id)} onRename={props.rename ? title => props.rename?.(t.id, title) : undefined} readOnly={readOnly} task={t} />
        <CardSignals nowS={nowS} task={t} />
        {menu === t.id ? <CardMenu actions={menuActions} assignees={board.assignees ?? []} onClose={() => setMenu(null)} task={t} /> : null}
      </td>
      <td>{t.status}</td>
      <td>{t.assignee ?? 'unassigned'}</td>
      <td>{typeof t.priority === 'number' ? t.priority : 'unknown'}</td>
      <td>{updatedLabel(t, nowS)}</td>
    </tr>
  )

  const c = counts(shown)
  const open = drawer ? allTasks(board).find(t => t.id === drawer.id) : null

  const applyView = (id: string) => {
    const v = views.find(x => x.id === id)

    if (v) {
      setFilter({ ...v.filter })
      setLayout(v.layout)
      setGroupBy(v.groupBy ?? 'status')
      setSortBy(effectiveSort(v.sortBy))
      setActiveView(v.id)
    }
  }

  return (
    <section
      aria-label="Board"
      data-ops-board={layout}
      onKeyDown={e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && props.lastMove) {
          props.undo(props.lastMove)
        }

        // R40: "n" opens the New-task modal when focus is not in a field.
        if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !readOnly && props.createFull && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) {
          e.preventDefault()
          setModal('todo')
        }
      }}
    >
      <div role="toolbar">
        {LAYOUTS.map(l => (
          <button aria-pressed={l === layout} data-ops-layout={l} key={l} onClick={() => setLayout(l)} type="button">
            {l}
          </button>
        ))}
        {!readOnly && props.createFull ? (
          <button aria-keyshortcuts="n" data-ops-new-task-btn="" onClick={() => setModal('todo')} type="button">
            New task
          </button>
        ) : null}
        <input aria-label="filter" onChange={e => (setFilter(f => ({ ...f, text: e.target.value })), setActiveView(null))} placeholder="Filter" value={filter.text ?? ''} />
        <select aria-label="tenant" onChange={e => (setFilter(f => ({ ...f, tenant: e.target.value || null })), setActiveView(null))} value={filter.tenant ?? ''}>
          <option value="">all tenants</option>
          {(board.tenants ?? []).map(t => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select aria-label="profile" onChange={e => (setFilter(f => ({ ...f, profile: e.target.value || null })), setActiveView(null))} value={filter.profile ?? ''}>
          <option value="">all profiles</option>
          {(board.assignees ?? []).map(a => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <input aria-label="project" onChange={e => (setFilter(f => ({ ...f, project: e.target.value || null })), setActiveView(null))} placeholder="project" value={filter.project ?? ''} />
        <label>
          <input checked={Boolean(filter.mine)} disabled={!props.me} onChange={e => setFilter(f => ({ ...f, mine: e.target.checked ? 'me' : null }))} type="checkbox" />
          Mine
        </label>
        {layout === 'list' || layout === 'table' ? (
          <>
            <select aria-label="group by" onChange={e => setGroupBy(e.target.value as GroupBy)} value={groupBy}>
              <option value="none">No grouping</option>
              <option value="status">Group: Status</option>
              <option value="profile">Group: Profile</option>
              <option value="project">Group: Project</option>
              <option value="priority">Group: Priority</option>
            </select>
            <select aria-label="sort by" onChange={e => setSortBy(e.target.value as SortBy)} value={sortBy}>
              <option value="priority">Sort: Priority</option>
              <option value="updated">Sort: Updated</option>
            </select>
          </>
        ) : null}
        {props.loadArchived ? (
          <button
            aria-pressed={showArchived}
            data-ops-archived-toggle=""
            onClick={() => {
              if (!showArchived) {
                props.loadArchived?.()
              }

              setShowArchived(v => !v)
            }}
            type="button"
          >
            Archived
          </button>
        ) : null}
      </div>

      <div aria-label="Saved views" data-ops-views="" role="tablist">
        {views.map(v => (
          <span key={v.id}>
            <button aria-selected={activeView === v.id} data-ops-view={v.name} onClick={() => applyView(v.id)} role="tab" type="button">
              {v.name}
            </button>
            <button aria-label={`delete view ${v.name}`} onClick={() => (removeView(scope, v.id), activeView === v.id && setActiveView(null))} type="button">
              ×
            </button>
          </span>
        ))}
        <form
          onSubmit={e => {
            e.preventDefault()
            const name = viewName.trim()

            if (name) {
              const v = saveView(scope, { name, filter: { ...filter, mine: filter.mine ? 'me' : null }, layout, groupBy, sortBy })
              setActiveView(v.id)
              setViewName('')
            }
          }}
        >
          <input aria-label="view name" onChange={e => setViewName(e.target.value)} placeholder="Save current view as…" value={viewName} />
          <button data-ops-save-view="" disabled={!viewName.trim()} type="submit">
            Save view
          </button>
        </form>
      </div>

      {showArchived ? (
        <section aria-label="Archived" data-ops-archived="">
          {props.archived === undefined || props.archived === null ? (
            <p>Archived tasks unknown (loading).</p>
          ) : props.archived.length === 0 ? (
            <p>No archived tasks.</p>
          ) : (
            <ul>
              {props.archived.map(t => (
                <li data-ops-archived-task={t.id} key={t.id}>
                  {t.title}{' '}
                  {!readOnly && props.unarchive ? (
                    <button onClick={() => props.unarchive?.(t.id)} type="button">
                      Unarchive
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {props.pushMode ? (
        <span data-ops-push={props.pushMode} role="status">
          {props.pushMode === 'stream' ? 'Live' : props.pushMode === 'poll' ? 'Polling every 5 s' : 'Connecting'}
        </span>
      ) : null}
      {props.notice ? (
        <p data-ops-snapback="" role="alert">
          {props.notice}
        </p>
      ) : null}
      {props.lastMove && !readOnly ? (
        <button data-ops-undo="" onClick={() => props.undo(props.lastMove!)} type="button">
          Undo move {props.lastMove.id} to {props.lastMove.to}
        </button>
      ) : null}

      {selected.size > 0 && !readOnly ? (
        <div data-ops-bulk="" role="region">
          {selected.size} selected
          <select aria-label="bulk status" onChange={e => setBulkTo(e.target.value)} value={bulkTo}>
            {MOVABLE.map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button onClick={() => (props.bulkMove([...selected], bulkTo), setSelected(new Set()))} type="button">
            Move selected
          </button>
          <button onClick={() => (props.archive([...selected]), setSelected(new Set()))} type="button">
            Archive selected
          </button>
        </div>
      ) : null}

      {layout === 'board' || layout === 'review' ? (
        <div data-ops-columns="">
          {shown.columns.map(col => (
            <section aria-label={col.name} data-ops-column={col.name} key={col.name}>
              <h3>
                {col.name} <span data-ops-count={col.name}>{c[col.name]}</span>
              </h3>
              <Windowed render={card} tasks={pinnedFirst(col.tasks)} viewport={viewport} />
              {!readOnly && (MOVABLE as readonly string[]).includes(col.name) ? (
                adding === col.name ? (
                  <form
                    onSubmit={e => {
                      e.preventDefault()

                      if (draft.trim()) {
                        props.create(draft.trim(), col.name)
                      }

                      setDraft('')
                      setAdding(null)
                    }}
                  >
                    <input aria-label={`new task in ${col.name}`} onChange={e => setDraft(e.target.value)} value={draft} />
                    {props.createFull ? (
                      <button onClick={() => (setAdding(null), setModal(col.name))} type="button">
                        More fields…
                      </button>
                    ) : null}
                  </form>
                ) : (
                  <button data-ops-add={col.name} onClick={() => setAdding(col.name)} type="button">
                    + Add
                  </button>
                )
              ) : null}
            </section>
          ))}
        </div>
      ) : layout === 'list' ? (
        <GroupedTasks groupBy={groupBy} render={card} sortBy={sortBy} statusOrder={statusOrder} table={false} tasks={pinnedFirst(tasks)} />
      ) : layout === 'table' ? (
        <GroupedTasks groupBy={groupBy} render={row} sortBy={sortBy} statusOrder={statusOrder} table tasks={tasks} />
      ) : layout === 'calendar' ? (
        <div data-ops-calendar="">
          {groupByDay(tasks).map(([day, list]) => (
            <section data-ops-day={day} key={day}>
              <h4>{day}</h4>
              {list.map(card)}
            </section>
          ))}
        </div>
      ) : layout === 'timeline' ? (
        <TimelineView links={props.links === undefined ? [] : props.links} nowS={nowS} onOpen={openDrawer} tasks={tasks} />
      ) : layout === 'files' ? (
        <FilesView
          files={props.files ?? null}
          hasMore={props.filesHasMore}
          loadingMore={props.filesLoadingMore}
          nowS={nowS}
          onLoadMore={props.loadMoreFiles}
          onOpenFile={props.openFile}
          onOpenTask={openDrawer}
          onUpload={props.upload}
          readOnly={readOnly}
          scanned={props.filesScanned}
          tasks={tasks}
        />
      ) : (
        <FavoritesView onOpen={f => (f.kind === 'task' ? openDrawer(f.id) : props.openFavorite?.(f))} tasks={allTasks(board)} />
      )}

      {drawer ? (
        <aside data-ops-drawer={drawer.full ? 'full' : 'drawer'}>
          {open ? (
            <>
              <dl>
                <dt>Title</dt>
                <dd>
                  <InlineTitle onOpen={() => undefined} onRename={props.rename ? title => props.rename?.(open.id, title) : undefined} readOnly={readOnly} task={open} />
                </dd>
                <dt>Status</dt>
                <dd>{open.status}</dd>
                <dt>Assignee</dt>
                <dd>
                  {!readOnly && props.assign ? (
                    <select aria-label="drawer assignee" onChange={e => props.assign?.(open.id, e.target.value || null)} value={open.assignee ?? ''}>
                      <option value="">unassigned</option>
                      {[...new Set([...(board.assignees ?? []), ...(open.assignee ? [open.assignee] : [])])].map(a => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  ) : (
                    (open.assignee ?? 'unassigned')
                  )}
                </dd>
                <dt>Signals</dt>
                <dd>
                  <CardSignals nowS={nowS} task={open} />
                </dd>
              </dl>
              <BodyEditor body={open.body} onSave={props.saveBody ? body => props.saveBody!(open.id, body) : undefined} readOnly={readOnly} />
              {props.openTaskTab ? (
                <button data-ops-open-task-tab={open.id} onClick={() => props.openTaskTab?.(open.id)} type="button">
                  Open task tab (timeline, runs, log)
                </button>
              ) : null}
            </>
          ) : (
            <p>Task is no longer on this board.</p>
          )}
          {open && !readOnly && props.subtask ? (
            <form
              onSubmit={e => {
                e.preventDefault()

                if (subDraft.trim()) {
                  props.subtask?.(open.id, subDraft.trim())
                }

                setSubDraft('')
              }}
            >
              <input aria-label="drawer subtask" onChange={e => setSubDraft(e.target.value)} placeholder="Add subtask" value={subDraft} />
            </form>
          ) : null}
          <button onClick={() => setDrawer(d => d && { ...d, full: !d.full })} type="button">
            {drawer.full ? 'Drawer' : 'Full page'}
          </button>
          <button onClick={() => setDrawer(null)} type="button">
            Close
          </button>
        </aside>
      ) : null}

      {modal !== null && props.createFull ? (
        <NewTaskModal
          assignees={board.assignees ?? []}
          columns={MOVABLE.filter(m => m !== 'done' && board.columns.some(c => c.name === m))}
          initialColumn={modal}
          onClose={() => setModal(null)}
          onCreate={props.createFull}
        />
      ) : null}

      <ConfirmDialog
        confirmLabel="Archive"
        description={confirmArchive ? `"${confirmArchive.title}" leaves the board. Unarchive brings it back.` : undefined}
        destructive
        onClose={() => setConfirmArchive(null)}
        onConfirm={() => {
          if (confirmArchive) {
            props.archive([confirmArchive.id])
          }

          setConfirmArchive(null)
        }}
        open={confirmArchive !== null}
        title="Archive task?"
      />
    </section>
  )
}
