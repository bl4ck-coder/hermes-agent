import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgentCardContainer } from '../detail/details'
import { approvalMode, type OpsActions, roleFromDescription } from '../feed/ops-actions'
import type { OpsClient } from '../feed/ops-client'
import { SettingsView } from '../motion/settings'

import { CANVAS_COLUMN, CANVAS_NODES, type CanvasData, CanvasView } from './canvas'
import { isCanvasDirty, resetCanvasDirty, setCanvasDirty, useCanvasDirty } from './dirty-store'

afterEach(() => (cleanup(), resetCanvasDirty()))

const data = (o: Partial<CanvasData> = {}): CanvasData => ({ model: null, policy: null, prompt: null, cron: null, delegation: null, ...o })

describe('canvas P7 F4: pan, zoom placement, layout, identity/memory nodes', () => {
  it('drag on the background pans; drags that start on a node control do not (G39/G56)', () => {
    render(<CanvasView data={data()} profile="p" />)
    const vp = document.querySelector('[data-ops-canvas-viewport]') as HTMLElement
    fireEvent.pointerDown(vp, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(vp, { clientX: 60, clientY: 30 })
    fireEvent.pointerUp(vp)
    expect(document.querySelector('[data-ops-pan]')?.getAttribute('data-ops-pan')).toBe('50,20')
    fireEvent.pointerDown(screen.getByLabelText('Collapse model'), { clientX: 0, clientY: 0 })
    fireEvent.pointerMove(vp, { clientX: 500, clientY: 500 })
    expect(document.querySelector('[data-ops-pan]')?.getAttribute('data-ops-pan')).toBe('50,20')
    fireEvent.keyDown(vp, { key: 'ArrowLeft', shiftKey: true })
    expect(document.querySelector('[data-ops-pan]')?.getAttribute('data-ops-pan')).toBe('10,20')
    fireEvent.click(screen.getByLabelText('Fit'))
    expect(document.querySelector('[data-ops-pan]')?.getAttribute('data-ops-pan')).toBe('0,0')
  })

  it('zoom toolbar sits bottom-centre after the viewport (G55)', () => {
    render(<CanvasView data={data()} profile="p" />)
    const bar = document.querySelector('[data-ops-zoom-position="bottom-centre"]') as HTMLElement
    expect(bar.style.position).toBe('sticky')
    expect(bar.style.left).toBe('50%')
    expect(bar.previousElementSibling?.hasAttribute('data-ops-canvas-viewport')).toBe(true)
  })

  it('fixed three-column layout and port colours (G48/G49)', () => {
    render(<CanvasView data={data({ model: { provider: 'p', model: 'm' } as never })} profile="p" />)

    for (const id of CANVAS_NODES) {
      expect(document.querySelector(`[data-ops-node="${id}"]`)?.getAttribute('data-ops-column')).toBe(CANVAS_COLUMN[id])
    }

    expect(CANVAS_COLUMN.identity).toBe('centre')
    expect(document.querySelector('[data-ops-node="model"]')?.getAttribute('data-ops-port-colour')).toBe('champagne')
    expect(document.querySelector('[data-ops-node="prompt"]')?.getAttribute('data-ops-port-colour')).toBe('muted')
  })

  it('identity and memory nodes show real data, unset or unknown (G30/G31)', () => {
    render(<CanvasView data={data({ identity: { name: 'builder', description: 'Builds things. Fast.' }, memory: { active: '', builtin_files: { memory: 10, user: 5 } } })} profile="p" />)
    expect(document.querySelector('[data-ops-node="identity"]')?.textContent).toContain('builder: Builds things. Fast.')
    expect(document.querySelector('[data-ops-node="memory"]')?.textContent).toContain('built-in memory, 15 bytes')
    cleanup()
    render(<CanvasView data={data({ identity: { name: 'x', description: '' } })} profile="p" />)
    expect(document.querySelector('[data-ops-node="identity"]')?.getAttribute('data-ops-port')).toBe('unset')
    expect(document.querySelector('[data-ops-node="memory"] [data-ops-node-body]')?.textContent).toBe('unknown')
  })

  it('run panel starts collapsed and opens on demand (G26, P10)', () => {
    render(<CanvasView data={data()} profile="p" />)
    expect((document.querySelector('[data-ops-run-panel]') as HTMLElement).hidden).toBe(true)
    fireEvent.click(document.querySelector('[data-ops-run-toggle]')!)
    expect((document.querySelector('[data-ops-run-panel]') as HTMLElement).hidden).toBe(false)
  })
})

describe('O47 dirty store, O41 approval mode, O76 role, O40 model editor', () => {
  it('dirty store tracks per profile/node and notifies', () => {
    function Probe() {
      return <span data-probe={String(useCanvasDirty('p'))} />
    }

    render(<Probe />)
    act(() => setCanvasDirty('p', 'model', true))
    expect(document.querySelector('[data-probe]')?.getAttribute('data-probe')).toBe('true')
    act(() => setCanvasDirty('p', 'model', false))
    expect(isCanvasDirty('p')).toBe(false)
  })

  it('role is the first clause of the description; approval mode from config', () => {
    expect(roleFromDescription('Builds the desktop app. Also reviews.')).toBe('Builds the desktop app')
    expect(roleFromDescription('Researcher, writes reports')).toBe('Researcher')
    expect(roleFromDescription('')).toBeNull()
    expect(approvalMode({ approvals: { mode: 'smart' } })).toBe('smart')
    expect(approvalMode({ approvals: { mode: false } })).toBe('false')
    expect(approvalMode({})).toBeNull()
  })

  it('settings show approval mode and embed the policy-checked model editor', () => {
    render(<SettingsView approval="manual" defaultModel={null} editModel policy={null} profile="builder" />)
    expect(document.querySelector('[data-ops-field="approval-mode"]')?.textContent).toBe('manual')
    expect(document.querySelector('[data-ops-field="model-editor"] [data-ops-node-editor="model"]')).toBeTruthy()
    cleanup()
    render(<SettingsView approval={null} defaultModel={null} policy={null} />)
    expect(document.querySelector('[data-ops-field="approval-mode"]')?.textContent).toMatch(/not set/)
  })

  it('agent card role comes from the kanban roster description', async () => {
    const actions = {
      profiles: vi.fn().mockResolvedValue({ profiles: [] }),
      kanbanProfiles: vi.fn().mockResolvedValue({ profiles: [{ name: 'builder', description: 'Ships features; reviews PRs' }] })
    } as unknown as OpsActions

    const client = {
      fleet: vi.fn().mockResolvedValue({ profiles: [] }),
      modelNode: vi.fn().mockResolvedValue(null),
      policy: vi.fn().mockResolvedValue(null),
      pendingApprovals: vi.fn().mockResolvedValue({ items: [] }),
      cronJobs: vi.fn().mockResolvedValue([])
    } as unknown as OpsClient

    render(<AgentCardContainer actions={actions} client={client} name="builder" />)
    await waitFor(() => expect(document.querySelector('[data-ops-field="role"]')?.textContent).toBe('Ships features'))
  })
})
