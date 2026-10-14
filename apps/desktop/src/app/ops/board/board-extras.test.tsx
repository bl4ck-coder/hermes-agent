import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OpsActions } from '../feed/ops-actions'

import { BoardContainer } from './board-container'
import type { BoardClient } from './board-model'

afterEach(() => cleanup())

const board = { columns: [{ name: 'todo', tasks: [{ id: 't1', title: 'One', status: 'todo', assignee: 'builder' }] }], assignees: ['builder', 'pixel'] }
const client = () => ({ board: vi.fn().mockResolvedValue(board), move: vi.fn(), bulk: vi.fn(), create: vi.fn() }) as unknown as BoardClient
const feedClient = { fleet: () => Promise.resolve({ profiles: [], now: 0 }) }

const actions = (over: Partial<OpsActions> = {}) =>
  ({
    assign: vi.fn().mockResolvedValue({}),
    createSubtask: vi.fn().mockResolvedValue({}),
    setStatus: vi.fn().mockResolvedValue({}),
    archivedBoard: vi.fn().mockResolvedValue({ columns: [{ name: 'archived', tasks: [{ id: 'z1', title: 'Old', status: 'archived' }] }] }),
    ...over
  }) as unknown as OpsActions

describe('board extras (P6 F3)', () => {
  it('drawer assignee picker and subtask go through kanban routes', async () => {
    const a = actions()
    render(<BoardContainer actions={a} client={client()} feedClient={feedClient} />)
    await waitFor(() => expect(document.querySelector('[data-ops-open-task="t1"]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-ops-open-task="t1"]')!)
    await act(async () => fireEvent.change(screen.getByLabelText('drawer assignee'), { target: { value: 'pixel' } }))
    expect(a.assign).toHaveBeenCalledWith('t1', 'pixel')
    fireEvent.change(screen.getByLabelText('drawer subtask'), { target: { value: 'child' } })
    await act(async () => fireEvent.submit(screen.getByLabelText('drawer subtask').closest('form')!))
    expect(a.createSubtask).toHaveBeenCalledWith('t1', 'child')
  })

  it('archived view lists archived tasks and unarchives to todo; refusals are shown', async () => {
    const a = actions({ setStatus: vi.fn().mockRejectedValue(new Error('409: nope')) })
    render(<BoardContainer actions={a} client={client()} feedClient={feedClient} />)
    await waitFor(() => expect(document.querySelector('[data-ops-archived-toggle]')).toBeTruthy())
    await act(async () => fireEvent.click(document.querySelector('[data-ops-archived-toggle]')!))
    await waitFor(() => expect(document.querySelector('[data-ops-archived-task="z1"]')).toBeTruthy())
    await act(async () => fireEvent.click(screen.getByText('Unarchive')))
    expect(a.setStatus).toHaveBeenCalledWith('z1', 'todo')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('nope'))
  })
})
