import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { NodeClient } from './node-editor'
import { NodeEditor, NodeEditors } from './node-editor-view'

afterEach(() => cleanup())

const err = (status: number, detail: unknown) => new Error(`${status}: ${JSON.stringify({ detail })}`)
const policy = { source: 'b', error: null, enabled: true, allow: [{ provider: ['xai'], models: ['grok-4'] }] }

const fake = (over: Partial<NodeClient> = {}) =>
  ({
    read: vi.fn().mockImplementation((_p: string, node: string) =>
      Promise.resolve(
        node === 'model'
          ? { profile: 'p', node, content_hash: 'm1', exists: true, provider: 'xai', model: 'grok-3' }
          : { profile: 'p', node, content_hash: 'h1', exists: true, content: 'line a\nline b' }
      )
    ),
    save: vi.fn().mockResolvedValue({ ok: true, outcome: 'committed', sequence: 4, backup: 'tx4', content_hash: 'h2', warnings: [] }),
    history: vi.fn().mockResolvedValue({ items: [{ backup: 'tx3', sequence: 3, note: 'old' }] }),
    restore: vi.fn().mockResolvedValue({ ok: true, outcome: 'committed', sequence: 5, backup: 'tx5', content_hash: 'h3', warnings: [] }),
    ...over
  }) as unknown as NodeClient

const ui = async (client: NodeClient, node: 'prompt' | 'model' = 'prompt', readOnly = false) => {
  render(<NodeEditor client={client} node={node} policy={policy} profile="p" readOnly={readOnly} />)
  await waitFor(() => expect(document.querySelector('[data-ops-node-status]')).toBeTruthy())
}

describe('writable node editors (P5-02)', () => {
  it('dirty → diff preview → save with the read hash → saved with backup', async () => {
    const c = fake()
    await ui(c)
    fireEvent.change(screen.getByLabelText('prompt content'), { target: { value: 'line a\nline c' } })
    expect(screen.getByText('● unsaved')).toBeTruthy()
    fireEvent.click(screen.getByText('Review & save'))
    expect(document.querySelector('[data-ops-diff]')?.textContent).toBe('- line b\n+ line c')
    await act(async () => fireEvent.click(document.querySelector('[data-ops-confirm-save]')!))
    expect(c.save).toHaveBeenCalledWith('p', 'prompt', 'h1', { content: 'line a\nline c' }, undefined, expect.stringMatching(/^op-/))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('tx4'))
  })

  it('conflict offers reload theirs and keep mine; discard restores the base', async () => {
    const c = fake({ save: vi.fn().mockRejectedValue(err(409, { code: 'conflict', detail: '', current_hash: 'h9' })) })
    await ui(c)
    fireEvent.change(screen.getByLabelText('prompt content'), { target: { value: 'mine' } })
    fireEvent.click(screen.getByText('Review & save'))
    await act(async () => fireEvent.click(document.querySelector('[data-ops-confirm-save]')!))
    await waitFor(() => expect(document.querySelector('[data-ops-conflict]')).toBeTruthy())
    expect((screen.getByLabelText('prompt content') as HTMLTextAreaElement).value).toBe('mine')
    await act(async () => fireEvent.click(screen.getByText('Keep mine (rebase)')))
    expect((screen.getByLabelText('prompt content') as HTMLTextAreaElement).value).toBe('mine')
    fireEvent.click(screen.getByText('Discard'))
    expect((screen.getByLabelText('prompt content') as HTMLTextAreaElement).value).toBe('line a\nline b')
  })

  it('model picker uses the policy; a blocked save shows violations and manual repair', async () => {
    const c = fake({
      save: vi.fn().mockRejectedValue(err(400, { code: 'policy_blocked', detail: 'disallowed', blocked: [{ field: 'model', provider: 'xai', model: 'bad', reason: 'not allowed' }], warnings: [] }))
    })

    await ui(c, 'model')
    fireEvent.change(screen.getByLabelText('model'), { target: { value: 'bad' } })
    fireEvent.click(screen.getByText('Review & save'))
    expect(document.querySelector('[data-ops-diff]')?.textContent).toContain('xai/grok-3 → xai/bad')
    await act(async () => fireEvent.click(document.querySelector('[data-ops-confirm-save]')!))
    await waitFor(() => expect(document.querySelector('[data-ops-policy-blocked]')?.textContent).toContain('not allowed'))
    fireEvent.click(document.querySelector('[data-ops-repair="xai/grok-4"]')!)
    expect((screen.getByLabelText('model') as HTMLInputElement).value).toBe('grok-4')
    expect(c.save).toHaveBeenCalledTimes(1)
  })

  it('backup failure and disconnect keep the draft and say so', async () => {
    const c = fake({ save: vi.fn().mockRejectedValueOnce(err(409, { code: 'backup_coverage_missing', detail: 'no protector' })).mockRejectedValueOnce(new Error('ECONNREFUSED')) })
    await ui(c)
    fireEvent.change(screen.getByLabelText('prompt content'), { target: { value: 'x' } })
    fireEvent.click(screen.getByText('Review & save'))
    await act(async () => fireEvent.click(document.querySelector('[data-ops-confirm-save]')!))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/backup unavailable/))
    fireEvent.click(screen.getByText('Review & save'))
    await act(async () => fireEvent.click(document.querySelector('[data-ops-confirm-save]')!))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Outcome unknown/))
    expect((screen.getByLabelText('prompt content') as HTMLTextAreaElement).value).toBe('x')
  })

  it('history lists backups and restore goes through the restore route', async () => {
    const c = fake()
    await ui(c)
    await act(async () => fireEvent.click(screen.getByText('History')))
    await waitFor(() => expect(document.querySelector('[data-ops-history-item="tx3"]')).toBeTruthy())
    await act(async () => fireEvent.click(screen.getByText('Restore')))
    expect(c.restore).toHaveBeenCalledWith('p', 'prompt', 'tx3', 'h1')
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Restored tx3'))
  })

  it('remote read-only path: no write controls and inputs disabled', async () => {
    const c = fake()
    await ui(c, 'prompt', true)
    expect(screen.queryByText('Review & save')).toBeNull()
    expect((screen.getByLabelText('prompt content') as HTMLTextAreaElement).disabled).toBe(true)
  })

  it('switches between the three writable nodes', async () => {
    render(<NodeEditors client={fake()} policy={policy} profile="p" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Raw config.yaml' }))
    await waitFor(() => expect(document.querySelector('[data-ops-node-editor="raw_yaml"]')).toBeTruthy())
  })
})
