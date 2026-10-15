import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CANVAS_EDGES, CANVAS_NODES, type CanvasData, CanvasView } from './canvas'
import { CanvasContainer } from './canvas-container'
import { initialRun, reduceRun } from './run-stream'

afterEach(() => cleanup())

const data: CanvasData = {
  model: { profile: 'judge', node: 'model', content_hash: 'h', exists: true, provider: 'openai-codex', model: 'gpt-6.1-sol' },
  policy: { source: 'builtin', error: null, enabled: true, allow: [], violations: [] },
  prompt: { profile: 'judge', node: 'prompt', content_hash: 'h', exists: true, content: '\n# Judge soul\nmore' },
  cron: [],
  delegation: null
}

function fakeRuns() {
  let cb: ((p: never) => void) | null = null

  return {
    create: vi.fn().mockResolvedValue({ ok: true, status: 202, data: { run_id: 'run_1' } }),
    openEvents: vi.fn().mockResolvedValue({ subscriptionId: 'sub-9', ended: false }),
    closeEvents: vi.fn().mockResolvedValue(true),
    onEvent: (f: (p: never) => void) => {
      cb = f

      return () => {
        cb = null
      }
    },
    emit: (event: string, payload: object) =>
      cb?.({ subscriptionId: 'sub-9', type: 'event', event, data: JSON.stringify({ event, ...payload }) } as never)
  }
}

describe('Canvas read', () => {
  it('renders every node and edge, real values or explicit unknown/unavailable', () => {
    render(<CanvasView data={data} profile="judge" />)
    expect(document.querySelectorAll('[data-ops-node]').length).toBe(CANVAS_NODES.length)
    expect(document.querySelectorAll('[data-ops-edge]').length).toBe(CANVAS_EDGES.length)
    expect(document.querySelector('[data-ops-node="model"]')?.textContent).toContain('openai-codex · gpt-6.1-sol')
    expect(document.querySelector('[data-ops-node="prompt"]')?.textContent).toContain('# Judge soul')
    expect(document.querySelector('[data-ops-node="delegation"]')?.getAttribute('data-ops-port')).toBe('unknown')
    expect(document.querySelector('[data-ops-node="channels"]')?.textContent).toContain('Not available yet')
    expect(document.querySelector('[data-ops-node="schedule"]')?.getAttribute('data-ops-port')).toBe('unset')
  })

  it('marks a policy violation on the model and shows the remote read-only badge, with no write controls', () => {
    render(
      <CanvasView
        data={{ ...data, policy: { ...data.policy!, violations: [{ field: 'model', provider: 'x', model: 'y', reason: 'provider_not_allowed' }] } }}
        profile="judge"
        readOnly
      />
    )
    expect(document.querySelector('[data-ops-node="model"]')?.getAttribute('data-ops-port')).toBe('policy')
    expect(screen.getByText('remote: read-only')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /save|discard|restore/i })).toBeNull()
  })
})

describe('Test run (D7)', () => {
  it('starts on one click with no confirm and no token cap, streams tokens/elapsed, expanders and light-up', async () => {
    const runs = fakeRuns()
    let t = 1000
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<CanvasView data={data} now={() => t} profile="judge" runs={runs as never} />)
    await act(async () => {
      fireEvent.click(document.querySelector('[data-ops-test-run]') as HTMLElement)
    })
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(runs.create).toHaveBeenCalledTimes(1)
    const [ref, body] = runs.create.mock.calls[0]
    expect(ref).toEqual({ profile: 'judge' })
    expect(Object.keys(body)).toEqual(['input'])
    await waitFor(() => expect(runs.openEvents).toHaveBeenCalledWith({ profile: 'judge' }, 'run_1'))
    t = 2500
    act(() => {
      runs.emit('message.delta', { delta: 'Hello there ' })
      runs.emit('message.delta', { delta: 'friend' })
      runs.emit('tool.started', { tool: 'terminal', preview: 'ls' })
      runs.emit('tool.started', { tool: 'skill_view', preview: 'kanban' })
      runs.emit('tool.completed', { tool: 'terminal' })
      runs.emit('subagent.start', { subagent_id: 'sa1', goal: 'research' })
    })
    expect(document.querySelector('[data-ops-run-text]')?.textContent).toBe('Hello there friend')
    expect(document.querySelector('[data-ops-run-tokens]')?.textContent).toBe('3 streamed tokens')
    expect(document.querySelector('[data-ops-run-elapsed]')?.textContent).toBe('1.5 s')
    expect(document.querySelector('[data-ops-run-tool="tool"] summary')?.textContent).toContain('terminal (done)')
    expect(document.querySelector('[data-ops-run-tool="skill"]')).not.toBeNull()
    expect(document.querySelector('[data-ops-run-subagent="sa1"]')?.textContent).toContain('research')

    for (const id of ['model', 'tools', 'skills', 'delegation']) {
      expect(document.querySelector(`[data-ops-node="${id}"]`)?.hasAttribute('data-ops-lit')).toBe(true)
    }

    t = 4000
    act(() => runs.emit('run.completed', {}))
    expect(document.querySelector('[data-ops-run-status]')?.textContent).toBe('completed')
    expect(document.querySelector('[data-ops-run-elapsed]')?.textContent).toBe('3.0 s')
  })

  it('reports a failed start and ignores foreign subscriptions', async () => {
    const runs = fakeRuns()
    runs.create.mockResolvedValueOnce({ ok: false, status: 0, code: 'gateway_key_missing', message: 'x' })
    render(<CanvasView data={data} profile="judge" runs={runs as never} />)
    fireEvent.click(document.querySelector('[data-ops-run-toggle]') as HTMLElement) // P10: the run panel opens on demand
    await act(async () => {
      fireEvent.click(document.querySelector('[data-ops-test-run]') as HTMLElement)
    })
    expect(screen.getByRole('alert').textContent).toBe('gateway_key_missing')
    expect(runs.openEvents).not.toHaveBeenCalled()
  })

  it('reducer ignores malformed frames and unknown tool completions', () => {
    const s = initialRun()
    expect(reduceRun(s, { data: 'not json' }, 1)).toBe(s)
    expect(reduceRun(s, { data: '{"event":"tool.completed","tool":"x"}' }, 1)).toBe(s)
  })
})

describe('Canvas container', () => {
  it('loads read-only data for the profile', async () => {
    const client = {
      modelNode: vi.fn().mockResolvedValue(data.model),
      policy: vi.fn().mockResolvedValue(data.policy),
      promptNode: vi.fn().mockResolvedValue(data.prompt),
      cronJobs: vi.fn().mockResolvedValue([{ id: 'c' }]),
      delegation: vi.fn().mockResolvedValue({ profile: 'judge', model: null, provider: null, inherit_model: true, inherit_provider: true, fallback_providers: null, api_key_set: false })
    }

    render(<CanvasContainer client={client as never} profile="judge" />)
    await waitFor(() => expect(document.querySelector('[data-ops-node="schedule"]')?.textContent).toContain('1 cron jobs'))
    expect(client.modelNode).toHaveBeenCalledWith('judge')
    expect(client.cronJobs).toHaveBeenCalledWith('judge')
    expect(document.querySelector('[data-ops-node="delegation"]')?.textContent).toContain('inherits main model')
  })
})
