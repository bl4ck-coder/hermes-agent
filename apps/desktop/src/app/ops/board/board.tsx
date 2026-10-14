/**
 * Board (ops-panel P4-02): Board/List/Table/Calendar/Timeline layouts plus the Review lens over one
 * backend board. Columns are windowed (fixed rows) so 400 cards mount only the visible slice.
 * Moves are server-validated: optimistic, then snap-back with the server's reason on refusal.
 */

import { type KeyboardEvent, useMemo, useState } from 'react'

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
  timelineOrder,
  windowRange
} from './board-model'

export const ROW_H = 40
export const LAYOUTS: BoardLayout[] = ['board', 'list', 'table', 'calendar', 'timeline', 'review']

export interface BoardActions {
  move: (id: string, to: string) => void
  undo: (rec: MoveRecord) => void
  archive: (ids: string[]) => void
  bulkMove: (ids: string[], to: string) => void
  create: (title: string, column: string) => void
}

export interface BoardViewProps extends BoardActions {
  board: BoardData | null
  error?: string | null
  notice?: string | null
  lastMove?: MoveRecord | null
  me?: string | null
  readOnly?: boolean
  viewport?: number
  initialLayout?: BoardLayout
}

function Card({
  task,
  selected,
  pinned,
  onSelect,
  onOpen,
  onKey,
  onPin,
  menu
}: {
  task: BoardTask
  selected: boolean
  pinned: boolean
  onSelect: () => void
  onOpen: () => void
  onKey: (e: KeyboardEvent) => void
  onPin: () => void
  menu: React.ReactNode
}) {
  return (
    <div data-ops-card={task.id} onKeyDown={onKey} role="listitem" style={{ height: ROW_H }} tabIndex={0}>
      <input aria-label={`select ${task.id}`} checked={selected} onChange={onSelect} type="checkbox" />
      <button data-ops-open-task={task.id} onClick={onOpen} type="button">
        {task.title}
      </button>
      <span data-ops-assignee="">{task.assignee ?? 'unassigned'}</span>
      <button aria-pressed={pinned} data-ops-pin={task.id} onClick={onPin} type="button">
        {pinned ? 'Unpin' : 'Pin'}
      </button>
      {menu}
    </div>
  )
}

function Windowed({ tasks, viewport, render }: { tasks: BoardTask[]; viewport: number; render: (t: BoardTask) => React.ReactNode }) {
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
  const [layout, setLayout] = useState<BoardLayout>(props.initialLayout ?? 'board')
  const [filter, setFilter] = useState<BoardFilter>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pins, setPins] = useState<Set<string>>(new Set())
  const [drawer, setDrawer] = useState<{ id: string; full: boolean } | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [bulkTo, setBulkTo] = useState('ready')

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
  const pinnedFirst = (list: BoardTask[]) => [...list.filter(t => pins.has(t.id)), ...list.filter(t => !pins.has(t.id))]

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
    if (readOnly) {
      return
    }

    if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const to = keyboardTarget(board, t.id, e.key === 'ArrowRight' ? 1 : -1)

      if (to) {
        e.preventDefault()
        props.move(t.id, to)
      }
    }
  }

  const menuFor = (t: BoardTask) =>
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
    <Card
      key={t.id}
      menu={menuFor(t)}
      onKey={keyFor(t)}
      onOpen={() => setDrawer({ id: t.id, full: false })}
      onPin={() => setPins(p => toggle(p, t.id))}
      onSelect={() => setSelected(s => toggle(s, t.id))}
      pinned={pins.has(t.id)}
      selected={selected.has(t.id)}
      task={t}
    />
  )

  const c = counts(shown)
  const open = drawer ? allTasks(board).find(t => t.id === drawer.id) : null

  return (
    <section aria-label="Board" data-ops-board={layout} onKeyDown={e => (e.ctrlKey || e.metaKey) && e.key === 'z' && props.lastMove && props.undo(props.lastMove)}>
      <div role="toolbar">
        {LAYOUTS.map(l => (
          <button aria-pressed={l === layout} data-ops-layout={l} key={l} onClick={() => setLayout(l)} type="button">
            {l}
          </button>
        ))}
        <input aria-label="filter" onChange={e => setFilter(f => ({ ...f, text: e.target.value }))} placeholder="Filter" value={filter.text ?? ''} />
        <select aria-label="tenant" onChange={e => setFilter(f => ({ ...f, tenant: e.target.value || null }))} value={filter.tenant ?? ''}>
          <option value="">all tenants</option>
          {(board.tenants ?? []).map(t => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select aria-label="profile" onChange={e => setFilter(f => ({ ...f, profile: e.target.value || null }))} value={filter.profile ?? ''}>
          <option value="">all profiles</option>
          {(board.assignees ?? []).map(a => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <input aria-label="project" onChange={e => setFilter(f => ({ ...f, project: e.target.value || null }))} placeholder="project" value={filter.project ?? ''} />
        <label>
          <input checked={Boolean(filter.mine)} disabled={!props.me} onChange={e => setFilter(f => ({ ...f, mine: e.target.checked ? 'me' : null }))} type="checkbox" />
          Mine
        </label>
      </div>

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
        <Windowed render={card} tasks={pinnedFirst(tasks)} viewport={viewport} />
      ) : layout === 'table' ? (
        <table data-ops-table="">
          <thead>
            <tr>
              <th>id</th>
              <th>title</th>
              <th>status</th>
              <th>assignee</th>
              <th>tenant</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <tr data-ops-row={t.id} key={t.id}>
                <td>{t.id}</td>
                <td>{t.title}</td>
                <td>{t.status}</td>
                <td>{t.assignee ?? 'unassigned'}</td>
                <td>{t.tenant ?? 'unknown'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : layout === 'calendar' ? (
        <div data-ops-calendar="">
          {groupByDay(tasks).map(([day, list]) => (
            <section data-ops-day={day} key={day}>
              <h4>{day}</h4>
              {list.map(card)}
            </section>
          ))}
        </div>
      ) : (
        <ol data-ops-timeline="">
          {timelineOrder(tasks).map(t => (
            <li data-ops-timeline-item={t.id} key={t.id}>
              {t.title}
            </li>
          ))}
        </ol>
      )}

      {drawer ? (
        <aside data-ops-drawer={drawer.full ? 'full' : 'drawer'}>
          {open ? (
            <dl>
              <dt>Title</dt>
              <dd>{open.title}</dd>
              <dt>Status</dt>
              <dd>{open.status}</dd>
              <dt>Assignee</dt>
              <dd>{open.assignee ?? 'unassigned'}</dd>
            </dl>
          ) : (
            <p>Task is no longer on this board.</p>
          )}
          <button onClick={() => setDrawer(d => d && { ...d, full: !d.full })} type="button">
            {drawer.full ? 'Drawer' : 'Full page'}
          </button>
          <button onClick={() => setDrawer(null)} type="button">
            Close
          </button>
        </aside>
      ) : null}
    </section>
  )
}
