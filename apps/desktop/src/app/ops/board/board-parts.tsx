/**
 * Board P8 b3 parts: rich card (R71/R58/R47/R20), grouped List/Table (R69), relation Timeline (R68; task_links are hierarchy, not execution dependencies),
 * Files (R11/R70), Favourites (R74), New-task modal (R40) and the Markdown body editor (R17).
 */

import { type DragEvent, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'

import { Tip } from '@/components/ui/tooltip'

import { P, T } from '../main-i18n'
import { fmtAge, fmtBytes } from '../office/control-room'

import { type BoardTask, cardHealth } from './board-model'
import {
  type Favourite,
  favStore,
  type GroupBy,
  groupTasks,
  heartbeatTone,
  isFav,
  LANE_H,
  progressOf,
  type SortBy,
  tagsOf,
  timelineModel,
  type TimeScale,
  toggleFav,
  touched
} from './board-plus'
import { Markdown } from './markdown'

/* ------------------------------ R47 inline title ------------------------------ */

export function InlineTitle({ task, readOnly, onOpen, onRename }: { task: BoardTask; readOnly?: boolean; onOpen: () => void; onRename?: (title: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const done = useRef(false)

  if (!editing || readOnly || !onRename) {
    return (
      // P24a: the full title stays recoverable on hover when it is clamped to two lines: in the rename tip when there is
      // one, else a native title (no tooltip per card, the board stays cheap to render). Focus expands the card instead.
      <Tip label={readOnly || !onRename ? undefined : `${task.title} · ${T('Double-click or F2 to rename')}`}><button
        data-ops-open-task={task.id}
        onClick={onOpen}
        onDoubleClick={() => !readOnly && onRename && (setDraft(task.title), (done.current = false), setEditing(true))}
        onKeyDown={e => e.key === 'F2' && !readOnly && onRename && (e.preventDefault(), setDraft(task.title), (done.current = false), setEditing(true))}
        title={readOnly || !onRename ? task.title : undefined}
        type="button"
      >
        {task.title}
      </button></Tip>
    )
  }

  // Commit once: Enter and the blur that follows must not send twice; Esc cancels without sending.
  const commit = () => {
    if (done.current) {
      return
    }

    done.current = true
    setEditing(false)
    const t = draft.trim()

    if (t && t !== task.title) {
      onRename(t)
    }
  }

  return (
    <input
      aria-label={`rename ${task.id}`}
      autoFocus
      data-ops-title-edit={task.id}
      onBlur={commit}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => {
        e.stopPropagation()

        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          done.current = true
          setEditing(false)
        }
      }}
      value={draft}
    />
  )
}

/* ------------------------------- R20 card menu ------------------------------- */

export interface CardMenuActions {
  open: (id: string) => void
  duplicate?: (t: BoardTask) => void
  copyLink?: (id: string) => void
  archive?: (id: string) => void
  reassign?: (id: string, who: string | null) => void
}

export function CardMenu({ task, assignees, actions, onClose }: { task: BoardTask; assignees: string[]; actions: CardMenuActions; onClose: () => void }) {
  const first = useRef<HTMLButtonElement | null>(null)

  useEffect(() => first.current?.focus(), [])

  const item = (label: string, fn: (() => void) | undefined, ref?: (el: HTMLButtonElement | null) => void) => (
    <button data-ops-menu-item={label} disabled={!fn} onClick={() => (fn?.(), onClose())} ref={ref} role="menuitem" type="button">
      {label}
    </button>
  )

  return (
    <div
      aria-label={`Actions for ${task.title}`}
      data-ops-card-menu={task.id}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          const items = [...(e.currentTarget.querySelectorAll('[role="menuitem"]:not(:disabled), select') as NodeListOf<HTMLElement>)]
          const i = items.indexOf(document.activeElement as HTMLElement)
          items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
        }
      }}
      role="menu"
    >
      {item('Open', () => actions.open(task.id), el => (first.current = el))}
      {item('Duplicate', actions.duplicate && (() => actions.duplicate?.(task)))}
      {item('Copy link', actions.copyLink && (() => actions.copyLink?.(task.id)))}
      {item('Archive', actions.archive && (() => actions.archive?.(task.id)))}
      {actions.reassign ? (
        <select aria-label={`reassign ${task.id}`} onChange={e => (actions.reassign?.(task.id, e.target.value || null), onClose())} value={task.assignee ?? ''}>
          <option value="">{T("Reassign: unassigned")}</option>
          {[...new Set([...assignees, ...(task.assignee ? [task.assignee] : [])])].map(a => (
            <option key={a} value={a}>
              {T("Reassign:")}{' '}{a}
            </option>
          ))}
        </select>
      ) : null}
      <span data-ops-cut="delete">{T("Delete is not offered (archive instead).")}</span>
    </div>
  )
}

/* -------------------------------- R71 rich card -------------------------------- */

export function CardSignals({ task, nowS }: { task: BoardTask; nowS: number }) {
  const tags = tagsOf(task)
  const prog = progressOf(task)
  const tone = heartbeatTone(task, nowS)
  const pri = typeof task.priority === 'number' && task.priority > 0 ? task.priority : null
  const comments = typeof task.comment_count === 'number' ? task.comment_count : null
  const health = cardHealth(task)

  return (
    <span data-ops-card-signals="">
      {pri !== null ? (
        <span aria-label={`priority ${pri}`} data-ops-priority={pri}>
          P{pri}
        </span>
      ) : null}
      {tags.slice(0, 3).map(t => (
        <span data-ops-tag={t} key={t}>
          {t}
        </span>
      ))}
      {tags.length > 3 ? <span data-ops-tag-more="">+{tags.length - 3}</span> : null}
      {prog ? (
        <span aria-label={`subtasks ${prog.done} of ${prog.total} done`} data-ops-progress={`${prog.done}/${prog.total}`}>
          ☑ {prog.done}/{prog.total}
        </span>
      ) : null}
      {tone ? (
        <span
          aria-label={`heartbeat ${tone}`}
          data-ops-heartbeat={tone}
          title={typeof task.last_heartbeat_at === 'number' ? `last heartbeat ${fmtAge(nowS - task.last_heartbeat_at)} ago` : undefined}
        >
          ●
        </span>
      ) : null}
      {comments ? (
        <span aria-label={P(comments, '{n} comments', '{n} comment')} data-ops-comments={comments}>
          💬 {comments}
        </span>
      ) : null}
      {health.held ? (
        <span aria-label={`held: ${health.held.title}`} data-ops-card-held="" title={[health.held.title, health.held.detail].filter(Boolean).join('\n')}>
          ⏸ {T("held")}: {health.held.title}
        </span>
      ) : null}
      {health.failure ? (
        <span aria-label={`last failure: ${health.failure.output.slice(0, 200)}`} data-ops-card-failure="" title={`${health.failure.title}\n${health.failure.output}`}>
          ⚠ {health.failure.output.slice(0, 80) || health.failure.title}
        </span>
      ) : null}
    </span>
  )
}

export function StarButton({ kind, id, label }: { kind: Favourite['kind']; id: string; label: string }) {
  const list = favStore.use()
  const on = isFav(kind, id, list)

  return (
    <button aria-label={`${on ? 'Unstar' : 'Star'} ${label}`} aria-pressed={on} data-ops-star={`${kind}:${id}`} onClick={() => toggleFav(kind, id, label)} type="button">
      {on ? '★' : '☆'}
    </button>
  )
}

/* ------------------------------ R69 grouped list ------------------------------ */

export function GroupedTasks({
  tasks,
  groupBy,
  sortBy,
  statusOrder,
  table,
  render
}: {
  tasks: BoardTask[]
  groupBy: GroupBy
  sortBy: SortBy
  statusOrder: string[]
  table: boolean
  render: (t: BoardTask) => ReactNode
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const groups = groupTasks(tasks, groupBy, sortBy, statusOrder)

  return (
    <div data-ops-groups={groupBy}>
      {groups.map(g => {
        const isClosed = closed.has(g.key)

        return (
          <section aria-label={g.label} data-ops-group={g.key} key={g.key}>
            {groupBy !== 'none' ? (
              <button
                aria-expanded={!isClosed}
                data-ops-group-toggle={g.key}
                onClick={() => setClosed(s => (s.has(g.key) ? new Set([...s].filter(x => x !== g.key)) : new Set([...s, g.key])))}
                type="button"
              >
                {isClosed ? '▸' : '▾'} {g.label} <span data-ops-group-count={g.key}>{g.tasks.length}</span>
              </button>
            ) : null}
            {isClosed ? null : table ? (
              <table data-ops-table="">
                <thead>
                  <tr>
                    <th>id</th>
                    <th>{T("title")}</th>
                    <th>{T("status")}</th>
                    <th>{T("assignee")}</th>
                    <th>{T("priority")}</th>
                    <th>{T("updated")}</th>
                  </tr>
                </thead>
                <tbody>{g.tasks.map(render)}</tbody>
              </table>
            ) : (
              <div role="list">{g.tasks.map(render)}</div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export const updatedLabel = (t: BoardTask, nowS: number) => {
  const u = touched(t)

  return u === null ? 'unknown' : `${fmtAge(nowS - u)} ${T('ago')}`
}

/* ------------------------------- R68 timeline ------------------------------- */

export function TimelineView({
  tasks,
  links,
  nowS,
  onOpen
}: {
  tasks: BoardTask[]
  /** [parent, child]; null = links still loading. */
  links: [string, string][] | null
  nowS: number
  onOpen: (id: string) => void
}) {
  const [scale, setScale] = useState<TimeScale>('weeks')
  const [group, setGroup] = useState<'project' | 'profile'>('profile')
  const m = timelineModel(tasks, links ?? [], nowS, scale, group)

  return (
    <section aria-label={T("Timeline")} data-ops-scale={scale} data-ops-timeline="">
      <div role="toolbar">
        {(['weeks', 'months'] as const).map(s => (
          <button aria-pressed={scale === s} data-ops-scale-btn={s} key={s} onClick={() => setScale(s)} type="button">
            {s === 'weeks' ? 'Weeks' : 'Months'}
          </button>
        ))}
        <label>
          {T("Group")}<select aria-label={T("timeline group")} onChange={e => setGroup(e.target.value as 'project' | 'profile')} value={group}>
            <option value="profile">{T("Profile")}</option>
            <option value="project">{T("Project")}</option>
          </select>
        </label>
        {links === null ? <span data-ops-loading="">{T("relations loading")}</span> : <span data-ops-field="links">{m.curves.length} {T("parent/child relations")}</span>}
      </div>
      {tasks.length === 0 ? (
        <p data-ops-empty="timeline">{T("No tasks match.")}</p>
      ) : (
        <div style={{ overflowX: 'auto', position: 'relative' }}>
          <svg aria-hidden="true" data-ops-timeline-svg="" height={m.height} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} width={m.width}>
            <line data-ops-today="" stroke="currentColor" x1={m.todayX} x2={m.todayX} y1={0} y2={m.height} />
            {m.curves.map(c => (
              <path d={c.d} data-ops-curve={`${c.from}->${c.to}`} fill="none" key={`${c.from}-${c.to}`} stroke="currentColor" />
            ))}
          </svg>
          <div style={{ height: m.height, position: 'relative', width: m.width }}>
            {m.lanes.map(l => (
              <span data-ops-lane={l.key} key={l.key} style={{ left: 0, position: 'sticky', top: l.y }}>
                {l.label}
              </span>
            ))}
            {m.bars.map(b => (
              <button
                aria-label={`${b.task.title}${b.estimated ? ' (start unknown)' : ''}`}
                data-ops-estimated={b.estimated ? '' : undefined}
                data-ops-timeline-item={b.task.id}
                key={b.task.id}
                onClick={() => onOpen(b.task.id)}
                style={{ height: LANE_H - 6, left: b.x, position: 'absolute', top: b.y + 3, width: b.w }}
                type="button"
              >
                {b.task.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/* ------------------------------ R11 / R70 files ------------------------------ */

export interface FileRow {
  taskId: string
  taskTitle: string
  id: string
  filename: string
  size?: number | null
  content_type?: string | null
  uploaded_by?: string | null
  created_at?: number | null
  stored_path?: string | null
}

const typeOf = (f: FileRow) => (f.content_type?.split('/')[1] || f.filename.split('.').pop() || 'file').toLowerCase()

export function FilesView({
  files,
  tasks,
  nowS,
  scanned,
  hasMore,
  loadingMore,
  onLoadMore,
  readOnly,
  onUpload,
  onOpenFile,
  onOpenTask
}: {
  files: FileRow[] | null
  tasks: BoardTask[]
  nowS: number
  /** How many tasks were scanned for files (old backends only; honest scope note). */
  scanned?: number
  /** R70 (P8 b6): board-wide paging. */
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  readOnly?: boolean
  onUpload?: (taskId: string, file: File) => Promise<unknown>
  onOpenFile?: (f: FileRow) => void
  onOpenTask?: (id: string) => void
}) {
  const [mode, setMode] = useState<'grid' | 'list'>('list')
  const [target, setTarget] = useState(tasks[0]?.id ?? '')
  const [over, setOver] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const input = useRef<HTMLInputElement | null>(null)

  const send = async (list: FileList | File[] | null) => {
    const fs = list ? [...list] : []

    if (!fs.length || !onUpload) {
      return
    }

    if (!target) {
      setMsg('Pick a task to attach the file to.')

      return
    }

    for (const f of fs) {
      try {
        await onUpload(target, f)
        setMsg(`Uploaded ${f.name}`)
      } catch (e) {
        setMsg(`Upload refused: ${e instanceof Error ? e.message : 'request failed'}`)
      }
    }
  }

  const sorted = files ? [...files].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)) : null

  return (
    <section
      aria-label={T("Files")}
      data-ops-drop-over={over ? '' : undefined}
      data-ops-files={mode}
      onDragLeave={() => setOver(false)}
      onDragOver={(e: DragEvent) => {
        if (!readOnly && onUpload) {
          e.preventDefault()
          setOver(true)
        }
      }}
      onDrop={(e: DragEvent) => {
        e.preventDefault()
        setOver(false)

        if (!readOnly) {
          void send(e.dataTransfer?.files ?? null)
        }
      }}
    >
      <div role="toolbar">
        {(['list', 'grid'] as const).map(m => (
          <button aria-pressed={mode === m} data-ops-files-mode={m} key={m} onClick={() => setMode(m)} type="button">
            {m === 'list' ? 'List' : 'Grid'}
          </button>
        ))}
        {!readOnly && onUpload ? (
          <>
            <select aria-label={T("attach to task")} onChange={e => setTarget(e.target.value)} value={target}>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <button data-ops-upload="" data-ops-write="" disabled={!target} onClick={() => input.current?.click()} type="button">
              {T("Upload")}</button>
            <input aria-label={T("upload file")} hidden multiple onChange={e => void send(e.target.files)} ref={input} type="file" />
            <span data-ops-drop-zone="">{T("or drop files here")}</span>
          </>
        ) : null}
      </div>
      {msg ? <p role="status">{msg}</p> : null}
      {typeof scanned === 'number' ? (
        <p data-ops-field="scope">{T("Files from the")}{' '}{scanned} {T("most recently active tasks (this Hermes has no board-wide file list).")}</p>
      ) : sorted ? (
        <p data-ops-field="scope">
          {sorted.length} {T("file")}{sorted.length === 1 ? '' : 's'} {T("on this board")}{hasMore ? ' so far' : ''}.
          {hasMore ? (
            <button data-ops-files-more="" disabled={loadingMore || !onLoadMore} onClick={() => onLoadMore?.()} type="button">
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
        </p>
      ) : null}
      {sorted === null ? (
        <p data-ops-loading="">{T("Files loading…")}</p>
      ) : sorted.length === 0 ? (
        <p data-ops-empty="files">{T("No files attached yet.")}</p>
      ) : mode === 'list' ? (
        <table>
          <thead>
            <tr>
              <th>{T("Name")}</th>
              <th>{T("Type")}</th>
              <th>{T("Size")}</th>
              <th>{T("Uploader")}</th>
              <th>{T("Age")}</th>
              <th>{T("Task")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(f => (
              <tr data-ops-file={f.id} key={`${f.taskId}:${f.id}`}>
                <td>
                  <button disabled={!onOpenFile || !f.stored_path} onClick={() => onOpenFile?.(f)} type="button">
                    {f.filename}
                  </button>
                </td>
                <td data-ops-field="type">{typeOf(f)}</td>
                <td>{fmtBytes(f.size)}</td>
                <td>{f.uploaded_by ?? T('unknown')}</td>
                <td>{typeof f.created_at === 'number' ? `${fmtAge(nowS - f.created_at)} ${T('ago')}` : T('unknown')}</td>
                <td>
                  <button disabled={!onOpenTask} onClick={() => onOpenTask?.(f.taskId)} type="button">
                    {f.taskTitle}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul data-ops-file-grid="">
          {sorted.map(f => (
            <li data-ops-file={f.id} key={`${f.taskId}:${f.id}`}>
              <button disabled={!onOpenFile || !f.stored_path} onClick={() => onOpenFile?.(f)} type="button">
                <strong>{typeOf(f).toUpperCase()}</strong> {f.filename}
              </button>
              <small>
                {fmtBytes(f.size)} · {f.uploaded_by ?? T('unknown')} · {typeof f.created_at === 'number' ? `${fmtAge(nowS - f.created_at)} ${T('ago')}` : T('unknown')}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------- R74 favourites ------------------------------- */

const KIND_LABEL: Record<Favourite['kind'], string> = { task: 'Tasks', profile: 'Profiles', project: 'Projects', run: 'Runs' }

export function FavoritesView({ tasks, onOpen }: { tasks: BoardTask[]; onOpen: (f: Favourite) => void }) {
  const list = favStore.use()

  if (!list.length) {
    return <p data-ops-empty="favorites">{T("Star a project or task to pin it here.")}</p>
  }

  return (
    <section aria-label={T("Favorites")} data-ops-favorites="">
      {(['task', 'profile', 'project', 'run'] as const).map(kind => {
        const xs = list.filter(f => f.kind === kind)

        return xs.length ? (
          <section aria-label={KIND_LABEL[kind]} data-ops-fav-kind={kind} key={kind}>
            <h4>
              {KIND_LABEL[kind]} ({xs.length})
            </h4>
            <ul>
              {xs.map(f => {
                const live = kind === 'task' ? tasks.find(t => t.id === f.id) : undefined

                return (
                  <li data-ops-fav-item={`${f.kind}:${f.id}`} key={`${f.kind}:${f.id}`}>
                    <button onClick={() => onOpen(f)} type="button">
                      {live?.title ?? f.label}
                    </button>
                    {kind === 'task' ? <span data-ops-field="status"> {live ? live.status : 'not on this board'}</span> : null}
                    <StarButton id={f.id} kind={f.kind} label={f.label} />
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null
      })}
    </section>
  )
}

/* ------------------------------ R40 new-task modal ------------------------------ */

export interface NewTaskInput {
  title: string
  body: string
  column: string
  assignee: string | null
  priority: number
}

export function NewTaskModal({
  columns,
  assignees,
  initialColumn,
  onCreate,
  onClose
}: {
  columns: string[]
  assignees: string[]
  initialColumn?: string
  onCreate: (t: NewTaskInput) => Promise<unknown>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [column, setColumn] = useState(initialColumn && columns.includes(initialColumn) ? initialColumn : columns.includes('todo') ? 'todo' : columns[0] ?? 'todo')
  const [assignee, setAssignee] = useState('')
  const [priority, setPriority] = useState(0)
  const [preview, setPreview] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const first = useRef<HTMLInputElement | null>(null)

  useEffect(() => first.current?.focus(), [])

  // "@builder fix the build" fills the assignee from the title, like the Office composer.
  const parsed = /^@([\w.-]+)\s+(.*)$/.exec(title.trim())
  const who = assignee || (parsed && assignees.includes(parsed[1]) ? parsed[1] : '')
  const cleanTitle = parsed && who === parsed[1] ? parsed[2] : title.trim()

  const submit = async () => {
    if (!cleanTitle || busy) {
      return
    }

    setBusy(true)
    setErr(null)

    try {
      await onCreate({ title: cleanTitle, body, column, assignee: who || null, priority })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      aria-label={T("New task")}
      aria-modal="true"
      data-ops-new-task-modal=""
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }

        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          void submit()
        }
      }}
      role="dialog"
    >
      <h3>{T("New task")}</h3>
      <input aria-label={T("new task title")} onChange={e => setTitle(e.target.value)} placeholder={T("Title (start with @profile to assign)")} ref={first} value={title} />
      <div role="toolbar">
        <button aria-pressed={!preview} onClick={() => setPreview(false)} type="button">
          {T("Write")}</button>
        <button aria-pressed={preview} onClick={() => setPreview(true)} type="button">
          {T("Preview")}</button>
      </div>
      {preview ? <Markdown text={body} /> : <textarea aria-label={T("new task description")} onChange={e => setBody(e.target.value)} placeholder={T("Description (Markdown)")} value={body} />}
      <label>
        {T("Column")}<select aria-label={T("new task column")} onChange={e => setColumn(e.target.value)} value={column}>
          {columns.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        {T("Assignee")}<select aria-label={T("new task assignee")} onChange={e => setAssignee(e.target.value)} value={who}>
          <option value="">{column === 'triage' ? 'triage decides' : 'unassigned'}</option>
          {assignees.map(a => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <label>
        {T("Priority")}<input aria-label={T("new task priority")} max={10} min={0} onChange={e => setPriority(Math.max(0, Math.min(10, Number(e.target.value) || 0)))} type="number" value={priority} />
      </label>
      {err ? <p role="alert">{T("Not created:")}{' '}{err}</p> : null}
      <button data-ops-create="" data-ops-write="" disabled={!cleanTitle || busy} onClick={() => void submit()} type="button">
        {busy ? 'Creating…' : 'Create'} <kbd>{T("Ctrl+Enter")}</kbd>
      </button>
      <button onClick={onClose} type="button">
        {T("Cancel")}</button>
    </div>
  )
}

/* ------------------------------ R17 body editor ------------------------------ */

export function BodyEditor({ body, readOnly, onSave }: { body: string | null | undefined; readOnly?: boolean; onSave?: (body: string) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(body ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!editing) {
    return (
      <div data-ops-body="">
        <Markdown text={body} />
        {!readOnly && onSave ? (
          <button data-ops-edit-body="" onClick={() => (setDraft(body ?? ''), setErr(null), setEditing(true))} type="button">
            {T("Edit description")}</button>
        ) : null}
      </div>
    )
  }

  const wrap = (before: string, after = before) => setDraft(d => `${d}${d && !d.endsWith('\n') ? ' ' : ''}${before}text${after}`)

  return (
    <div data-ops-body-editor="" onKeyDown={e => e.key === 'Escape' && (e.stopPropagation(), setEditing(false))}>
      <div aria-label={T("Formatting")} role="toolbar">
        <button onClick={() => wrap('**')} type="button">
          {T("Bold")}</button>
        <button onClick={() => setDraft(d => `${d}${d ? '\n' : ''}- item`)} type="button">
          {T("List")}</button>
        <button onClick={() => setDraft(d => `${d}${d ? '\n' : ''}## Heading`)} type="button">
          {T("Heading")}</button>
        <button onClick={() => wrap('[', '](https://)')} type="button">
          {T("Link")}</button>
      </div>
      <textarea aria-label={T("description")} onChange={e => setDraft(e.target.value)} value={draft} />
      <div data-ops-body-preview="">
        <Markdown text={draft} />
      </div>
      {err ? <p role="alert">{T("Not saved:")}{' '}{err}</p> : null}
      <button data-ops-save-body=""
        data-ops-write=""
        disabled={busy || draft === (body ?? '')}
        onClick={async () => {
          setBusy(true)

          try {
            await onSave?.(draft)
            setEditing(false)
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'request failed')
          } finally {
            setBusy(false)
          }
        }}
        type="button"
      >
        {T("Save")}</button>
      <button onClick={() => setEditing(false)} type="button">
        {T("Cancel")}</button>
    </div>
  )
}
