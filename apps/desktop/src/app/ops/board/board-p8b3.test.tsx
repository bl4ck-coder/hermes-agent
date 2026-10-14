/** P8 b3: Board rows R67-R71, R74, R11, R17, R20, R40, R47, R58. */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BoardView, type BoardViewProps } from './board'
import { BoardContainer } from './board-container'
import type { BoardClient, BoardData, BoardTask } from './board-model'
import { favStore, groupTasks, heartbeatTone, listViews, saveView, timelineModel, viewScope, viewsStore } from './board-plus'
import { isSafeUrl, Markdown } from './markdown'

const NOW = 1_800_000_000

beforeEach(() => {
  localStorage.clear()
  viewsStore.reset()
  favStore.reset()
})
afterEach(() => cleanup())

const T = (id: string, over: Partial<BoardTask> = {}): BoardTask => ({ id, title: `Task ${id}`, status: 'todo', assignee: 'builder', created_at: NOW - 86_400, ...over })

const board = (): BoardData => ({
  columns: [
    { name: 'triage', tasks: [] },
    { name: 'todo', tasks: [T('a', { priority: 2, skills: ['web', 'qa'], tenant: 'ops', comment_count: 3, progress: { done: 1, total: 3 }, project_id: 'p1', link_counts: { parents: 0, children: 1 } }), T('b', { assignee: 'pixel', project_id: 'p2' })] },
    { name: 'ready', tasks: [] },
    { name: 'running', tasks: [T('r', { status: 'running', last_heartbeat_at: NOW - 400, started_at: NOW - 3600, project_id: 'p1' })] },
    { name: 'review', tasks: [] },
    { name: 'done', tasks: [T('d', { status: 'done', completed_at: NOW - 60, assignee: null })] }
  ],
  tenants: ['ops'],
  assignees: ['builder', 'pixel']
})

const noop = { move: vi.fn(), undo: vi.fn(), archive: vi.fn(), bulkMove: vi.fn(), create: vi.fn() }
const view = (p: Partial<BoardViewProps> = {}) => render(<BoardView {...noop} board={board()} nowS={NOW} {...p} />)

describe('R71 / R58 card signals', () => {
  it('tag chips, priority, subtasks n/m, comment count, heartbeat colour', () => {
    view()
    const a = document.querySelector('[data-ops-card="a"]') as HTMLElement
    expect([...a.querySelectorAll('[data-ops-tag]')].map(e => e.textContent)).toEqual(['web', 'qa', '#ops'])
    expect(a.querySelector('[data-ops-priority]')?.textContent).toBe('P2')
    expect(a.querySelector('[data-ops-progress]')?.getAttribute('data-ops-progress')).toBe('1/3')
    expect(a.querySelector('[data-ops-comments]')?.textContent).toMatch(/3/)
    expect(document.querySelector('[data-ops-card="r"] [data-ops-heartbeat]')?.getAttribute('data-ops-heartbeat')).toBe('aging')
    expect(heartbeatTone(T('x', { status: 'running', last_heartbeat_at: NOW - 30 }), NOW)).toBe('fresh')
    expect(heartbeatTone(T('x', { status: 'running', last_heartbeat_at: NOW - 900 }), NOW)).toBe('stale')
    expect(heartbeatTone(T('x', { status: 'todo', last_heartbeat_at: NOW - 900 }), NOW)).toBeNull()
  })

  it('quick actions are keyboard reachable inside the card', () => {
    view()
    const a = document.querySelector('[data-ops-card="a"]') as HTMLElement
    const quick = a.querySelector('[data-ops-quick]') as HTMLElement
    const focusables = [...quick.querySelectorAll('button, select')] as HTMLElement[]
    expect(focusables.length).toBeGreaterThanOrEqual(4)
    expect(focusables.every(el => el.tabIndex >= 0 && !el.hasAttribute('disabled'))).toBe(true)
  })
})

describe('R20 card menu', () => {
  it('Open, Duplicate, Copy link, Archive (confirmed), Reassign; no Delete; keyboard Shift+F10 opens it', async () => {
    const dup = vi.fn()
    const copy = vi.fn()
    const assign = vi.fn()
    const archive = vi.fn()
    view({ archive, assign, copyLink: copy, duplicate: dup })
    fireEvent.keyDown(document.querySelector('[data-ops-card="a"]')!, { key: 'F10', shiftKey: true })
    const menu = document.querySelector('[data-ops-card-menu="a"]') as HTMLElement
    expect([...menu.querySelectorAll('[role="menuitem"]')].map(e => e.textContent)).toEqual(['Open', 'Duplicate', 'Copy link', 'Archive'])
    expect(document.activeElement?.textContent).toBe('Open')
    expect(within(menu).queryByText('Delete')).toBeNull()
    fireEvent.click(within(menu).getByText('Duplicate'))
    expect(dup).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
    fireEvent.click(document.querySelector('[data-ops-more="a"]')!)
    fireEvent.click(screen.getByText('Copy link'))
    expect(copy).toHaveBeenCalledWith('a')
    fireEvent.click(document.querySelector('[data-ops-more="a"]')!)
    fireEvent.change(screen.getByLabelText('reassign a'), { target: { value: 'pixel' } })
    expect(assign).toHaveBeenCalledWith('a', 'pixel')
    fireEvent.click(document.querySelector('[data-ops-more="a"]')!)
    fireEvent.click(screen.getByText('Archive'))
    expect(archive).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Archive' })))
    await waitFor(() => expect(archive).toHaveBeenCalledWith(['a']))
  })
})

describe('R47 inline title edit', () => {
  it('commits once on Enter (blur after Enter does not resend), Esc cancels', () => {
    const rename = vi.fn()
    view({ rename })
    fireEvent.doubleClick(document.querySelector('[data-ops-open-task="a"]')!)
    const input = screen.getByLabelText('rename a')
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(rename).toHaveBeenCalledTimes(1)
    expect(rename).toHaveBeenCalledWith('a', 'Renamed')
    fireEvent.keyDown(document.querySelector('[data-ops-open-task="b"]')!, { key: 'F2' })
    const b = screen.getByLabelText('rename b')
    fireEvent.change(b, { target: { value: 'nope' } })
    fireEvent.keyDown(b, { key: 'Escape' })
    expect(rename).toHaveBeenCalledTimes(1)
    fireEvent.doubleClick(document.querySelector('[data-ops-open-task="b"]')!)
    fireEvent.blur(screen.getByLabelText('rename b'))
    expect(rename).toHaveBeenCalledTimes(1)
  })
})

describe('R69 group, sort, collapse', () => {
  it('groups by status/profile/project/priority with counts; sorts; groups collapse', () => {
    const tasks = board().columns.flatMap(c => c.tasks)
    expect(groupTasks(tasks, 'profile', 'manual').map(g => [g.label, g.tasks.length])).toEqual([
      ['builder', 2],
      ['pixel', 1],
      ['Unassigned', 1]
    ])
    expect(groupTasks(tasks, 'status', 'manual', ['todo', 'running', 'done']).map(g => g.key)).toEqual(['todo', 'running', 'done'])
    expect(groupTasks(tasks, 'none', 'priority')[0].tasks[0].id).toBe('a')
    expect(groupTasks(tasks, 'none', 'updated')[0].tasks[0].id).toBe('d')
    view()
    fireEvent.click(document.querySelector('[data-ops-layout="list"]')!)
    fireEvent.change(screen.getByLabelText('group by'), { target: { value: 'project' } })
    expect(document.querySelector('[data-ops-group-count="p1"]')?.textContent).toBe('2')
    fireEvent.click(document.querySelector('[data-ops-group-toggle="p1"]')!)
    expect(document.querySelector('[data-ops-group="p1"] [data-ops-card]')).toBeNull()
    expect(document.querySelector('[data-ops-group-toggle="p1"]')?.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(document.querySelector('[data-ops-layout="table"]')!)
    fireEvent.change(screen.getByLabelText('sort by'), { target: { value: 'priority' } })
    // collapse state is kept across list/table; reopen the group
    fireEvent.click(document.querySelector('[data-ops-group-toggle="p1"]')!)
    expect(document.querySelector('[data-ops-group="p1"] [data-ops-row]')?.getAttribute('data-ops-row')).toBe('a')
  })
})

describe('R67 saved views', () => {
  it('saves the current filters as a named tab per (connection, project) and restores them exactly', () => {
    view({ connection: 'remote-1' })
    fireEvent.change(screen.getByLabelText('profile'), { target: { value: 'pixel' } })
    fireEvent.change(screen.getByLabelText('filter'), { target: { value: 'Task' } })
    fireEvent.click(document.querySelector('[data-ops-layout="list"]')!)
    fireEvent.change(screen.getByLabelText('view name'), { target: { value: 'Pixel work' } })
    fireEvent.click(document.querySelector('[data-ops-save-view]')!)
    expect(listViews(viewScope('remote-1', null))[0]).toMatchObject({ name: 'Pixel work', layout: 'list', filter: { profile: 'pixel', text: 'Task' } })
    expect(listViews(viewScope('local', null))).toEqual([])
    cleanup()
    view({ connection: 'remote-1' })
    fireEvent.click(document.querySelector('[data-ops-view="Pixel work"]')!)
    expect((screen.getByLabelText('profile') as HTMLSelectElement).value).toBe('pixel')
    expect((screen.getByLabelText('filter') as HTMLInputElement).value).toBe('Task')
    expect(document.querySelector('[data-ops-board]')?.getAttribute('data-ops-board')).toBe('list')
    expect(document.querySelectorAll('[data-ops-card]')).toHaveLength(1)
  })

  it('saving again with the same name replaces, not duplicates', () => {
    const s = viewScope('x', 'p1')
    saveView(s, { name: 'A', filter: {}, layout: 'board' })
    saveView(s, { name: 'a', filter: { text: 'z' }, layout: 'table' })
    expect(listViews(s)).toHaveLength(1)
    expect(listViews(s)[0].layout).toBe('table')
  })
})

describe('R68 timeline', () => {
  it('draws parent→child curves for visible links, a today marker, Weeks/Months, Group Project/Profile', () => {
    const tasks = board().columns.flatMap(c => c.tasks)
    const m = timelineModel(tasks, [['a', 'r'], ['a', 'gone']], NOW, 'weeks', 'project')
    expect(m.curves.map(c => `${c.from}->${c.to}`)).toEqual(['a->r'])
    expect(m.lanes.map(l => l.label)).toEqual(['p1', 'p2', 'No project'])
    expect(m.todayX).toBeGreaterThan(0)
    const months = timelineModel(tasks, [], NOW, 'months', 'project')
    expect(months.width).toBeLessThan(m.width)
    view({ links: [['a', 'r']] })
    fireEvent.click(document.querySelector('[data-ops-layout="timeline"]')!)
    expect(document.querySelector('[data-ops-curve="a->r"]')).toBeTruthy()
    expect(document.querySelector('[data-ops-today]')).toBeTruthy()
    fireEvent.click(document.querySelector('[data-ops-scale-btn="months"]')!)
    expect(document.querySelector('[data-ops-timeline]')?.getAttribute('data-ops-scale')).toBe('months')
    fireEvent.change(screen.getByLabelText('timeline group'), { target: { value: 'project' } })
    expect(document.querySelector('[data-ops-lane="p1"]')).toBeTruthy()
  })
})

describe('R11 / R70 files', () => {
  it('lists files with type, size, uploader, age; upload appears without reload', async () => {
    const client = {
      board: vi.fn().mockResolvedValue(board()),
      move: vi.fn(),
      bulk: vi.fn(),
      archive: vi.fn(),
      assign: vi.fn(),
      create: vi.fn(),
      links: vi.fn().mockResolvedValue({ parents: [], children: [] }),
      attachments: vi.fn((id: string) => Promise.resolve(id === 'a' ? [{ id: 1, filename: 'spec.pdf', content_type: 'application/pdf', size: 4096, uploaded_by: 'builder', created_at: Date.now() / 1000 - 120 }] : [])),
      upload: vi.fn().mockResolvedValue({ attachment: { id: 2, filename: 'notes.md', size: 12, uploaded_by: 'dashboard', created_at: Date.now() / 1000 } })
    } as unknown as BoardClient

    render(<BoardContainer bridge={null} client={client} pollMs={60_000} />)
    await waitFor(() => expect(document.querySelector('[data-ops-layout="files"]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-ops-layout="files"]')!)
    await waitFor(() => expect(document.querySelector('[data-ops-file="1"]')).toBeTruthy())
    const row = document.querySelector('[data-ops-file="1"]') as HTMLElement
    expect(row.textContent).toMatch(/spec\.pdf.*pdf.*4\.0 KB.*builder.*2 min ago/)
    const boardReads = (client.board as ReturnType<typeof vi.fn>).mock.calls.length
    const file = new File(['hello notes!'], 'notes.md', { type: 'text/markdown' })
    await act(async () => {
      fireEvent.change(screen.getByLabelText('upload file'), { target: { files: [file] } })
    })
    await waitFor(() => expect(document.querySelector('[data-ops-file="2"]')).toBeTruthy())
    expect(client.upload).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ filename: 'notes.md' }))
    expect((client.board as ReturnType<typeof vi.fn>).mock.calls.length).toBe(boardReads)
    fireEvent.click(document.querySelector('[data-ops-files-mode="grid"]')!)
    expect(document.querySelector('[data-ops-file-grid]')).toBeTruthy()
  })

  it('a drop on the Files view uploads; a refusal is shown', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('413: attachment exceeds 50 MB limit'))
    view({ files: [], upload })
    fireEvent.click(document.querySelector('[data-ops-layout="files"]')!)
    const zone = document.querySelector('[data-ops-files]') as HTMLElement
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'big.bin')] } })
    })
    expect(upload).toHaveBeenCalled()
    await screen.findByText('Upload refused: 413: attachment exceeds 50 MB limit')
    expect(document.querySelector('[data-ops-empty="files"]')).toBeTruthy()
  })
})

describe('R74 favourites', () => {
  it('starred tasks, profiles, projects and runs; empty copy', () => {
    view()
    fireEvent.click(document.querySelector('[data-ops-layout="favorites"]')!)
    expect(screen.getByText('Star a project or task to pin it here.')).toBeTruthy()
    fireEvent.click(document.querySelector('[data-ops-layout="board"]')!)
    fireEvent.click(document.querySelector('[data-ops-star="task:a"]')!)
    act(() => {
      favStore.set([...favStore.get(), { kind: 'profile', id: 'pixel', label: 'pixel', at: 1 }, { kind: 'run', id: '41', label: 'run 41', at: 2 }])
    })
    localStorage.setItem('hermes.ops.projectFavs', JSON.stringify(['p9']))
    favStore.reset()
    const open = vi.fn()
    cleanup()
    view({ openFavorite: open })
    fireEvent.click(document.querySelector('[data-ops-layout="favorites"]')!)
    expect([...document.querySelectorAll('[data-ops-fav-kind]')].map(e => e.getAttribute('data-ops-fav-kind'))).toEqual(['task', 'profile', 'project', 'run'])
    expect(document.querySelector('[data-ops-fav-item="task:a"]')?.textContent).toMatch(/Task a.*todo/)
    fireEvent.click(within(document.querySelector('[data-ops-fav-item="profile:pixel"]') as HTMLElement).getByText('pixel'))
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ kind: 'profile', id: 'pixel' }))
  })
})

describe('R40 new-task modal', () => {
  it('title (@profile parsed), Markdown body, column, priority; Ctrl+Enter creates; refusal keeps the modal', async () => {
    const createFull = vi.fn().mockRejectedValueOnce(new Error('400: bad')).mockResolvedValue({})
    view({ createFull })
    fireEvent.keyDown(document.querySelector('[data-ops-board]')!, { key: 'n' })
    const dlg = screen.getByRole('dialog', { name: 'New task' })
    expect(document.activeElement).toBe(screen.getByLabelText('new task title'))
    fireEvent.change(screen.getByLabelText('new task title'), { target: { value: '@pixel draw the logo' } })
    fireEvent.change(screen.getByLabelText('new task description'), { target: { value: '**bold** brief' } })
    fireEvent.change(screen.getByLabelText('new task priority'), { target: { value: '3' } })
    expect((screen.getByLabelText('new task assignee') as HTMLSelectElement).value).toBe('pixel')
    await act(async () => fireEvent.keyDown(dlg, { key: 'Enter', ctrlKey: true }))
    expect(await screen.findByText('Not created: 400: bad')).toBeTruthy()
    await act(async () => fireEvent.click(document.querySelector('[data-ops-create]')!))
    expect(createFull).toHaveBeenLastCalledWith({ title: 'draw the logo', body: '**bold** brief', column: 'todo', assignee: 'pixel', priority: 3 })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New task' })).toBeNull())
  })
})

describe('R17 Markdown body', () => {
  it('renders headings, lists, bold, code and safe links; hostile HTML and javascript: stay inert', () => {
    render(<Markdown text={'## Plan\n- **ship** it\n- `npm test`\n\n[docs](https://x.dev) [bad](javascript:alert(1)) <img src=x onerror=alert(1)>'} />)
    expect(document.querySelector('h5')?.textContent).toBe('Plan')
    expect(document.querySelectorAll('li')).toHaveLength(2)
    expect(document.querySelector('strong')?.textContent).toBe('ship')
    expect(document.querySelector('a')?.getAttribute('href')).toBe('https://x.dev')
    expect(document.querySelectorAll('a')).toHaveLength(1)
    expect(document.querySelector('img')).toBeNull()
    expect(document.body.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
  })

  it('drawer edits the description with live preview and saves via PATCH; a refusal keeps the editor', async () => {
    const saveBody = vi.fn().mockRejectedValueOnce(new Error('409: changed')).mockResolvedValue({})
    view({ saveBody })
    fireEvent.click(document.querySelector('[data-ops-open-task="a"]')!)
    fireEvent.click(document.querySelector('[data-ops-edit-body]')!)
    fireEvent.change(screen.getByLabelText('description'), { target: { value: '# Title' } })
    expect(document.querySelector('[data-ops-body-preview] h4')?.textContent).toBe('Title')
    await act(async () => fireEvent.click(document.querySelector('[data-ops-save-body]')!))
    expect(await screen.findByText('Not saved: 409: changed')).toBeTruthy()
    await act(async () => fireEvent.click(document.querySelector('[data-ops-save-body]')!))
    expect(saveBody).toHaveBeenLastCalledWith('a', '# Title')
    await waitFor(() => expect(document.querySelector('[data-ops-body-editor]')).toBeNull())
  })
})
