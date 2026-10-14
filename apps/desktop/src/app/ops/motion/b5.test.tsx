/** P8 b5: Canvas (G42 G51 G57 G86, wheel zoom, drawn edges), partials (G66 O67), settings + lifecycle (R54 R55 R75 R77 L1 L6 S2 S7 X10). */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CANVAS_EDGES, CanvasView, edgePath, nodeSlot, wheelAction } from '../canvas/canvas'
import { registerCanvasSaver, resetCanvasDirty, saveAllCanvas, setCanvasDirty } from '../canvas/dirty-store'
import { LinkedText, splitTaskIds } from '../detail/entity-links'
import { applySim, clearOpsErrors, diagnosticsText, newIds, opsCall, opsErrors, probe, redact, setSimMode, simMode } from '../feed/diag'
import { parseDispatch } from '../feed/ops-client'
import { DiagnosticsPanel } from '../motion/diagnostics'
import { loadPrefs, opsLaunchRoute, SettingsView } from '../motion/settings'
import { routingLine } from '../office/office'

const data = {
  model: { provider: 'xai', model: 'grok-4' },
  policy: { source: 'file', violations: [] },
  prompt: { exists: true, content: 'You are the builder.\nBe brief.' },
  cron: [],
  delegation: { inherit_model: true },
  skills: 3,
  identity: { name: 'builder', description: '' },
  memory: { active: '', builtin_files: { memory: 10 } },
  promptNote: 'severity override'
} as never

beforeEach(() => {
  localStorage.clear()
  resetCanvasDirty()
  clearOpsErrors()
  setSimMode('off')
})
afterEach(() => cleanup())

describe('Canvas', () => {
  it('drawn edges: one SVG path per edge, geometry from slots', () => {
    render(<CanvasView data={data} profile="builder" />)
    expect(document.querySelectorAll('[data-ops-edge-path]')).toHaveLength(CANVAS_EDGES.length)
    expect(document.querySelector('[data-ops-edge-path="model->tools"]')?.getAttribute('d')).toBe(edgePath('model', 'tools'))
    expect(nodeSlot('identity').x).toBeLessThan(nodeSlot('tools').x)
    expect(edgePath('identity', 'prompt')).toMatch(/^M \d+ \d+ C/)
  })

  it('wheel: Ctrl+wheel zooms one step, plain wheel pans (clamped)', () => {
    expect(wheelAction({ deltaY: -100, ctrlKey: true, metaKey: false, shiftKey: false })).toEqual({ zoom: 1 })
    expect(wheelAction({ deltaY: 50, ctrlKey: false, metaKey: false, shiftKey: true })).toEqual({ pan: [-50, 0] })
    render(<CanvasView data={data} profile="builder" />)
    const vp = document.querySelector('[data-ops-canvas-viewport]')!
    fireEvent.wheel(vp, { deltaY: -100, ctrlKey: true })
    expect(document.querySelector('[data-ops-canvas-zoom]')?.getAttribute('data-ops-canvas-zoom')).toBe('1.25')
    fireEvent.wheel(vp, { deltaY: 100, metaKey: true })
    fireEvent.wheel(vp, { deltaY: 100, metaKey: true })
    expect(document.querySelector('[data-ops-canvas-zoom]')?.getAttribute('data-ops-canvas-zoom')).toBe('0.75')
    fireEvent.wheel(vp, { deltaY: 120 })
    expect(document.querySelector('[data-ops-pan]')?.getAttribute('data-ops-pan')).toBe('0,-120')

    for (let i = 0; i < 30; i++) {
      fireEvent.wheel(vp, { deltaY: 500 })
    }

    expect(document.querySelector('[data-ops-pan]')?.getAttribute('data-ops-pan')).toBe('0,-2000')
  })

  it('G42 every node opens a detail popover; Esc closes', () => {
    render(<CanvasView data={data} profile="builder" />)

    for (const id of ['model', 'prompt', 'memory', 'delegation', 'tools']) {
      fireEvent.click(document.querySelector(`[data-ops-node="${id}"] [data-ops-node-title]`)!)
      expect(screen.getByRole('dialog', { name: `${id} details` })).toBeTruthy()
    }

    expect(screen.getByRole('dialog', { name: 'tools details' }).textContent).toMatch(/Not available yet/)
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'tools details' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(document.querySelector('[data-ops-node="model"] [data-ops-node-title]')!)
    expect(screen.getByRole('dialog', { name: 'model details' }).textContent).toMatch(/Providerxai.*Modelgrok-4/)
  })

  it('G51 unset identity shows an amber CTA that opens profile setup; hidden on remote', () => {
    const open = vi.fn()
    render(<CanvasView data={data} onOpenRoute={open} profile="builder" />)
    fireEvent.click(document.querySelector('[data-ops-identity-cta]')!)
    expect(open).toHaveBeenCalledWith('/profiles?profile=builder&edit=identity')
    cleanup()
    render(<CanvasView data={{ ...(data as object), identity: { name: 'b', description: 'Builder' } } as never} onOpenRoute={open} profile="b" />)
    expect(document.querySelector('[data-ops-identity-cta]')).toBeNull()
    cleanup()
    render(<CanvasView data={data} onOpenRoute={open} profile="builder" readOnly />)
    expect((document.querySelector('[data-ops-identity-cta]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('G86 the Prompt node shows the last change note', () => {
    render(<CanvasView data={data} profile="builder" />)
    expect(document.querySelector('[data-ops-node="prompt"] [data-ops-node-body]')?.textContent).toBe('You are the builder. · last change: severity override')
  })

  it('G57 Save all (n): disabled at 0, saves every dirty node, reports the refused ones', async () => {
    render(<CanvasView data={data} profile="builder" />)
    const btn = () => document.querySelector('[data-ops-save-all]') as HTMLButtonElement
    expect(btn().disabled).toBe(true)
    expect(btn().textContent).toBe('Save all (0)')
    const ok = vi.fn().mockResolvedValue(true)
    const refused = vi.fn().mockResolvedValue(false)
    act(() => {
      setCanvasDirty('builder', 'prompt', true)
      setCanvasDirty('builder', 'model', true)
      setCanvasDirty('other', 'prompt', true)
    })
    registerCanvasSaver('builder', 'prompt', ok)
    registerCanvasSaver('builder', 'model', refused)
    registerCanvasSaver('other', 'prompt', vi.fn())
    expect(btn().textContent).toBe('Save all (2)')
    await act(async () => fireEvent.click(btn()))
    expect(ok).toHaveBeenCalledTimes(1)
    expect(refused).toHaveBeenCalledTimes(1)
    await screen.findByText('Saved 1; not saved: model')
    expect(await saveAllCanvas('nobody')).toEqual({ saved: 0, failed: [] })
  })
})

describe('Partials', () => {
  it('G66 dispatch: @profile assigns, #project files it', () => {
    expect(parseDispatch('@pixel draw the logo #brand')).toEqual({ assignee: 'pixel', title: 'draw the logo', project: 'brand' })
    expect(parseDispatch('fix #site-v2 nav')).toEqual({ assignee: null, title: 'fix nav', project: 'site-v2' })
    expect(parseDispatch('ship it')).toEqual({ assignee: null, title: 'ship it', project: null })
    expect(routingLine('@pixel logo #brand')).toBe('Assigned to pixel · project brand')
  })

  it('O67 task ids in text open a task tab; the rest stays text', () => {
    expect(splitTaskIds('see t_07745259 and t_zz')).toEqual(['see ', { id: 't_07745259' }, ' and t_zz'])
    const open = vi.fn()
    render(<LinkedText onOpenTask={open} text={'blocked by t_0a213c3f <img src=x onerror=alert(1)>'} />)
    fireEvent.click(document.querySelector('[data-ops-entity="t_0a213c3f"]')!)
    expect(open).toHaveBeenCalledWith('t_0a213c3f')
    expect(document.querySelector('img')).toBeNull()
  })
})

describe('Settings and lifecycle', () => {
  it('R75 groups + Gold Night default theme; R55 open on launch; R54 opt-in notifications', () => {
    render(<SettingsView defaultModel={null} policy={null} />)
    expect([...document.querySelectorAll('[data-ops-settings-group]')].map(g => g.getAttribute('data-ops-settings-group'))).toEqual([
      'general',
      'ops',
      'notifications',
      'shortcuts',
      'diagnostics',
      'security'
    ])
    expect(document.querySelector('[data-ops-settings]')?.getAttribute('data-ops-theme')).toBe('gold-night')
    fireEvent.change(screen.getByLabelText('theme'), { target: { value: 'light' } })
    expect(loadPrefs().theme).toBe('light')
    expect(opsLaunchRoute()).toBeNull()
    fireEvent.click(screen.getByLabelText('open ops on launch'))
    fireEvent.change(screen.getByLabelText('default tab'), { target: { value: 'board' } })
    expect(opsLaunchRoute()).toBe('/ops/board')
    expect(document.querySelector('[data-ops-launch-route]')?.textContent).toBe('/ops/board')
    expect(loadPrefs().notifyApprovals).toBe(false)
    fireEvent.click(screen.getByLabelText('notify approvals'))
    expect(loadPrefs()).toMatchObject({ notifyApprovals: true, notifyBlocked: false })
    expect(newIds(null, ['a'])).toEqual([])
    expect(newIds(new Set(['a']), ['a', 'b'])).toEqual(['b'])
  })

  it('S7 redaction: keys, bearer tokens, JWTs, KEY=value and query tokens', () => {
    const raw = 'sk-abcdefghijklmnop Bearer abc.def.ghijklmnop OPENAI_API_KEY=sk-live-123456789 eyJhbGciOiJI.eyJzdWIiOiIx.c2lnbmF0dXJl /x?token=hunter22&a=1'
    const out = redact(raw)

    for (const leak of ['abcdefghijklmnop', 'ghijklmnop', 'sk-live-123456789', 'eyJzdWIiOiIx', 'hunter22']) {
      expect(out).not.toContain(leak)
    }

    expect(out).toContain('OPENAI_API_KEY=[redacted]')
    expect(out).toContain('a=1')
  })

  it('L6 error ring keeps the last 50, redacted; diagnostics text is redacted', async () => {
    for (let i = 0; i < 55; i++) {
      await opsCall('GET', `/api/x?token=secret${i}`, () => Promise.reject(new Error(`500: boom ${i} Bearer zzzzzzzzzzzz`))).catch(() => {})
    }

    expect(opsErrors()).toHaveLength(50)
    expect(opsErrors()[0].message).toBe('500: boom 54 Bearer [redacted]')
    expect(opsErrors()[0].path).toBe('/api/x?token=[redacted]')
    const txt = diagnosticsText({ probe: null, stream: { mode: 'poll', reason: 'auth refused (401)' }, policySource: 'file', errors: opsErrors() })
    expect(txt).not.toMatch(/secret\d|zzzzzzzz/)
    expect(txt).toContain('stream: poll (auth refused (401))')
  })

  it('L1 probe: 404 names the needed Hermes feature, 401 is refused, others error; never blank', async () => {
    const get = vi.fn((p: string) =>
      p.includes('usage') ? Promise.reject(new Error('404: Not Found')) : p.includes('policy') ? Promise.reject(new Error('401: no')) : p.includes('delegation') ? Promise.reject(new Error('500: x')) : Promise.resolve({})
    )

    const r = await probe(get)
    expect(r.find(x => x.id === 'A4')).toMatchObject({ state: 'missing', detail: 'needs Hermes with usage reporting' })
    expect(r.find(x => x.id === 'A6')?.state).toBe('refused')
    expect(r.find(x => x.id === 'A7')?.state).toBe('error')
    expect(r.filter(x => x.state === 'ok')).toHaveLength(4)
  })

  it('Diagnostics panel: probe rows, error list, redacted copy', async () => {
    const copy = vi.fn()
    await opsCall('POST', '/api/plugins/kanban/tasks', () => Promise.reject(new Error('409: GITHUB_TOKEN=ghp_abcdefghijklmnop'))).catch(() => {})
    render(<DiagnosticsPanel copy={copy} get={() => Promise.reject(new Error('404'))} policySource="file" />)
    expect(document.querySelector('[data-ops-error-count]')?.textContent).toBe('1')
    expect(document.querySelector('[data-ops-errors]')?.textContent).not.toContain('ghp_abcdefghijklmnop')
    await act(async () => fireEvent.click(document.querySelector('[data-ops-probe]')!))
    await waitFor(() => expect(document.querySelectorAll('[data-ops-probe-state="missing"]').length).toBe(7))
    await act(async () => fireEvent.click(document.querySelector('[data-ops-copy-diagnostics]')!))
    expect(copy).toHaveBeenCalledTimes(1)
    expect(copy.mock.calls[0][0]).not.toContain('ghp_abcdefghijklmnop')
    expect(copy.mock.calls[0][0]).toContain('GITHUB_TOKEN=[redacted]')
    await screen.findByText('Diagnostics copied (redacted).')
  })

  it('R77 / L4 simulate (dev build): offline, 401 and slow (> 10 s) drive request failures; off restores', async () => {
    setSimMode('offline')
    expect(simMode()).toBe('offline')
    await expect(opsCall('GET', '/a', () => Promise.resolve(1))).rejects.toThrow('simulated offline')
    setSimMode('auth')
    await expect(opsCall('GET', '/a', () => Promise.resolve(1))).rejects.toThrow('401')
    setSimMode('slow')
    const wait = vi.fn().mockResolvedValue(undefined)
    await applySim(wait)
    expect(wait.mock.calls[0][0]).toBeGreaterThan(10_000)
    setSimMode('off')
    await expect(opsCall('GET', '/a', () => Promise.resolve(1))).resolves.toBe(1)
    render(<DiagnosticsPanel policySource={null} />)
    expect(screen.getByLabelText('simulate')).toBeTruthy()
  })
})

describe('S2 hostile text is inert across Ops', () => {
  it('no dangerouslySetInnerHTML / innerHTML writes in any Ops source file', () => {
    const files = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/*.test.*'], { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
    expect(Object.keys(files).length).toBeGreaterThan(40)
    const bad = Object.entries(files).filter(([, src]) => /dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML/.test(src)).map(([f]) => f)
    expect(bad).toEqual([])
  })
})
