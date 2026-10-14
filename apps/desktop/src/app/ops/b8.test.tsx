import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** P8 B8: L2 write gate — every Ops write control is disabled with a reason when the connection check says writes are unsafe. */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { connectionView } from './feed/diag'
import { createOpsActions, isStaleStatus } from './feed/ops-actions'
import { applyWriteGate, gateFrom, opsWriteGate, setOpsConnection, useWriteGateOn } from './feed/write-gate'
import { outcomeCopy } from './office/needs-you'

const caps = { tokens: ['ops.fleet', 'ops.policy', 'ops.tx.nodes.prompt'] }

afterEach(() => setOpsConnection(null))

describe('B8 L2 gate states', () => {
  it('blocks on auth-failed, unreachable and incompatible; allows connected, version-skew and unchecked', () => {
    expect(gateFrom(connectionView(null, new Error('401: no'))).enabled).toBe(false)
    expect(gateFrom(connectionView(null, new Error('ECONNREFUSED'))).enabled).toBe(false)
    expect(gateFrom(connectionView({ version: '0.20.0', ops_capabilities: caps })).enabled).toBe(false)
    expect(gateFrom(connectionView({ version: '0.21.5', ops_capabilities: { tokens: [] } })).reason).toMatch(/^Writes are off: .*lacks/)
    expect(gateFrom(connectionView({ version: '0.21.5', ops_capabilities: caps })).enabled).toBe(true)
    expect(gateFrom(connectionView({ version: '0.22.4', ops_capabilities: caps })).enabled).toBe(true)
    expect(gateFrom(connectionView(undefined)).enabled).toBe(true)
    expect(gateFrom(null)).toMatchObject({ enabled: true, state: 'unchecked' })
  })
})

describe('B8 L2 applyWriteGate', () => {
  it('disables write controls with the reason as tooltip and restores their own state', () => {
    const root = document.createElement('div')
    root.innerHTML = '<button data-ops-write="" title="Own">a</button><button data-ops-write="" disabled>b</button><button>read</button>'
    const [a, b, read] = [...root.querySelectorAll('button')]
    applyWriteGate(root, { enabled: false, reason: 'Writes are off: Hermes is unreachable', state: 'unreachable' })
    expect([a.disabled, b.disabled, read.disabled]).toEqual([true, true, false])
    expect(a.title).toBe('Writes are off: Hermes is unreachable')
    expect(a.getAttribute('aria-disabled')).toBe('true')
    applyWriteGate(root, { enabled: true, reason: null, state: 'connected' })
    expect([a.disabled, b.disabled]).toEqual([false, true])
    expect(a.title).toBe('Own')
    expect(b.hasAttribute('title')).toBe(false)
  })
})

function Harness({ onWrite }: { onWrite: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const [late, setLate] = useState(false)
  useWriteGateOn(root)

  return (
    <div ref={root}>
      <button data-ops-write="" onClick={onWrite} type="button">
        Save
      </button>
      <button onClick={() => setLate(true)} type="button">
        Show more
      </button>
      {late ? (
        <button data-ops-write="" onClick={onWrite} type="button">
          Late save
        </button>
      ) : null}
    </div>
  )
}

describe('B8 L2 live gate', () => {
  it('follows the connection check, covers late-mounted controls and blocks the click', async () => {
    const onWrite = vi.fn()
    render(<Harness onWrite={onWrite} />)
    const save = screen.getByText('Save') as HTMLButtonElement
    expect(save.disabled).toBe(false)
    act(() => setOpsConnection(connectionView(null, new Error('403 forbidden'))))
    expect(save.disabled).toBe(true)
    expect(save.title).toMatch(/refused the key/)
    fireEvent.click(screen.getByText('Show more'))
    await act(async () => {})
    const late = screen.getByText('Late save') as HTMLButtonElement
    expect(late.disabled).toBe(true)
    late.disabled = false
    fireEvent.click(late) // slipped past the attribute: the capture guard still blocks it
    expect(onWrite).not.toHaveBeenCalled()
    act(() => setOpsConnection(connectionView({ version: '0.21.5', ops_capabilities: caps })))
    expect(save.disabled).toBe(false)
    expect(save.hasAttribute('title')).toBe(false)
    fireEvent.click(save)
    expect(onWrite).toHaveBeenCalledTimes(1)
    expect(opsWriteGate().state).toBe('connected')
  })
})

describe('B8 L2 coverage (static)', () => {
  const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')

  it.each([
    ['canvas/node-editor-view.tsx', 3],
    ['canvas/canvas.tsx', 2],
    ['board/board-parts.tsx', 3],
    ['board/board.tsx', 3],
    ['detail/task-tab.tsx', 5],
    ['office/needs-you.tsx', 7],
    ['office/office.tsx', 1],
    ['lenses/b4-lenses.tsx', 1]
  ])('%s tags its %i write controls', (f, n) => {
    expect(read(f).match(/data-ops-write=""/g)?.length ?? 0).toBe(n)
  })

  it('known write handlers only sit on tagged buttons', () => {
    const handlers = /onApprove|onDeny|approve_review|request_changes|kind: 'unblock'|onCronRun|kind: 'retry'|kind: 'stop'|props\.archive|bulkMove|props\.undo/

    for (const f of ['office/needs-you.tsx', 'detail/task-tab.tsx', 'board/board.tsx']) {
      const src = read(f)

      for (const m of src.matchAll(/<button[\s\S]*?type="(?:button|submit)"/g)) {
        if (handlers.test(m[0])) {
          expect(m[0], `${f}: ${m[0].slice(0, 80)}`).toContain('data-ops-write=""')
        }
      }
    }
  })

  it('the shell applies the gate, the host status read feeds it, board drag/bulk moves refuse', () => {
    expect(read('index.tsx')).toContain('useWriteGateOn(root)')
    expect(read('chrome.tsx')).toContain('setOpsConnection(results[0].status')
    expect(read('board/board-container.tsx').match(/opsWriteGate\(\)\.enabled/g)?.length).toBe(2)
  })
})

describe('B8 MF7 review approve carries expected_status', () => {
  it('sends status done guarded by expected_status review', async () => {
    const api = vi.fn(async () => ({ task: { id: 't1', status: 'done' } }))
    await createOpsActions(api as never).kanban({ kind: 'approve_review', taskId: 't1' })
    expect(api).toHaveBeenCalledWith(expect.objectContaining({ method: 'PATCH', body: { status: 'done', expected_status: 'review' } }))
  })

  it('maps a 409 stale_status to "Changed; review again" and rethrows other errors', async () => {
    const stale = vi.fn(async () => {
      throw new Error('409: {"detail":{"code":"stale_status","current_status":"running"}}')
    })

    const r = await createOpsActions(stale as never).kanban({ kind: 'approve_review', taskId: 't1' })
    expect(r).toEqual({ outcome: 'stale_revision' })
    expect(outcomeCopy(r, 'Approved')).toBe('Changed; review again')
    expect(isStaleStatus({ detail: { code: 'stale_status' } })).toBe(true)

    const boom = vi.fn(async () => {
      throw new Error('500: boom')
    })

    await expect(createOpsActions(boom as never).kanban({ kind: 'approve_review', taskId: 't1' })).rejects.toThrow('boom')
  })
})