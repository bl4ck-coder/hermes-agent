/**
 * P26 (judge pass 20 #2): every control a config row renders is associated with the row: labelled by the row label,
 * described by its help and error, invalid while refused. Composite fields (fallback providers) wire each of their
 * controls, with names that say which entry they act on. The error and recovery stay in the control column at any panel
 * width: each field is its own container, and the narrow container rule only stacks label above body.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConfigFieldSchema } from '@/types/hermes'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})

const getGlobalModelOptions = vi.fn()

vi.mock('@/hermes', () => ({ getGlobalModelOptions: () => getGlobalModelOptions() }))

const { ConfigField } = await import('./config-field')

beforeEach(() => {
  getGlobalModelOptions.mockResolvedValue({
    providers: [
      { name: 'GitHub Copilot', slug: 'copilot', models: ['gpt-5-mini'] },
      { name: 'OpenAI Codex', slug: 'openai-codex', models: ['gpt-5.4-mini'] }
    ]
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const withQuery = (node: ReactNode) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>

function renderRefused(schemaKey: string, schema: ConfigFieldSchema, value: unknown, enumOptions?: string[]) {
  return render(
    withQuery(
      <ConfigField
        actions={
          <>
            <button data-retry="" type="button">
              Retry
            </button>
            <button data-revert="" type="button">
              Revert to saved value
            </button>
          </>
        }
        enumOptions={enumOptions}
        error={<span>Autosave failed: disk is read-only</span>}
        onChange={vi.fn()}
        schema={{ ...schema, description: 'What this field does.' }}
        schemaKey={schemaKey}
        value={value}
      />
    )
  )
}

const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

function rowParts(container: HTMLElement) {
  const row = container.querySelector('[data-settings-form-row]') as HTMLElement
  const label = row.querySelector('[data-sfr-label]') as HTMLElement
  const help = row.querySelector('[data-sfr-help]') as HTMLElement
  const error = row.querySelector('[data-sfr-error]') as HTMLElement
  const control = row.querySelector('[data-sfr-control]') as HTMLElement

  return { row, label, help, error, control }
}

describe('P26 every ConfigField kind is associated with its row', () => {
  it.each([
    ['list', 'agent.toolsets', { type: 'list' as const }, ['web', 'terminal'], undefined, 'input'],
    ['JSON object (textarea)', 'some.mapping', { type: 'string' as const }, { a: 1 }, undefined, 'textarea'],
    ['long text (textarea)', 'agent.system_prompt', { type: 'text' as const }, 'hello', undefined, 'textarea'],
    ['number', 'model_context_length', { type: 'number' as const }, 4096, undefined, 'input'],
    ['enum select', 'display.personality', { type: 'select' as const, options: ['', 'kind'] }, 'kind', undefined, '[role="combobox"]'],
    ['searchable select', 'timezone', { type: 'select' as const, options: ['UTC', 'Europe/Paris'], searchable: true }, 'UTC', undefined, 'button, [role="combobox"]'],
    ['voice free input', 'tts.edge.voice', { type: 'string' as const }, 'en-US-AriaNeural', ['en-US-AriaNeural'], 'input']
  ])('%s: labelled by the row, described by help + error, invalid', (_kind, key, schema, value, options, sel) => {
    const { container } = renderRefused(key, schema, value, options)
    const { label, help, error, control } = rowParts(container)
    const el = control.querySelector(sel) as HTMLElement

    expect(el, _kind).not.toBeNull()
    expect(label.getAttribute('for')).toBe(el.id)
    expect(el.getAttribute('aria-labelledby')).toBe(label.id)
    expect(el.getAttribute('aria-describedby')?.split(' ')).toEqual([help.id, error.id])
    expect(el.getAttribute('aria-invalid')).toBe('true')
  })

  it('fallback providers: the list is a group named by the row; every select, input and button inside is described and named per entry', async () => {
    const { container } = renderRefused('fallback_providers', { type: 'list' }, [
      { provider: 'copilot', model: 'gpt-5-mini' },
      { provider: 'openai-codex', model: 'gpt-5.4-mini' }
    ])

    await waitFor(() => expect(getGlobalModelOptions).toHaveBeenCalled())
    const { label, help, error, control } = rowParts(container)
    const labelText = label.textContent ?? ''
    const group = control.querySelector('[role="group"]') as HTMLElement
    expect(group).not.toBeNull()
    expect(label.getAttribute('for')).toBe(group.id)
    expect(group.getAttribute('aria-labelledby')).toBe(label.id)
    expect(group.getAttribute('aria-describedby')?.split(' ')).toEqual([help.id, error.id])

    const g = within(group)
    await waitFor(() => expect(g.getByRole('combobox', { name: new RegExp(`Model 1 \\(GitHub Copilot\\)$`) })).toBeTruthy())

    const controls = [
      g.getByRole('combobox', { name: `${labelText} Provider 1` }),
      g.getByRole('combobox', { name: `${labelText} Provider 2` }),
      g.getByRole('combobox', { name: `${labelText} Model 1 (GitHub Copilot)` }),
      g.getByRole('combobox', { name: `${labelText} Model 2 (OpenAI Codex)` })
    ]

    for (const el of controls) {
      expect(el.getAttribute('aria-describedby')?.split(' ')).toEqual([help.id, error.id])
      expect(el.getAttribute('aria-invalid')).toBe('true')
    }

    const removes = [g.getByRole('button', { name: 'Remove 1: GitHub Copilot / gpt-5-mini' }), g.getByRole('button', { name: 'Remove 2: OpenAI Codex / gpt-5.4-mini' })]
    const add = g.getByRole('button', { name: 'Add fallback' })

    for (const el of [...removes, add]) {
      expect(el.getAttribute('aria-describedby')?.split(' ')).toEqual([help.id, error.id])
    }

    // Every id is unique, and nothing is a native tooltip.
    const ids = [...container.querySelectorAll('[id]')].map(n => n.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(container.querySelector('[title]')).toBeNull()
    // Error and recovery come after the whole editor, inside the same control column.
    const retry = container.querySelector('[data-sfr-actions] [data-retry]')!
    expect(after(add, error) && after(error, retry)).toBe(true)
  })

  it('fallback providers without an error: described by help only, not invalid', async () => {
    const { container } = render(withQuery(<ConfigField onChange={vi.fn()} schema={{ type: 'list', description: 'Backups.' }} schemaKey="fallback_providers" value={[{ provider: 'copilot', model: 'gpt-5-mini' }]} />))
    await waitFor(() => expect(getGlobalModelOptions).toHaveBeenCalled())
    const { help } = rowParts(container)
    const provider = within(container).getByRole('combobox', { name: /Provider 1$/ })
    expect(provider.getAttribute('aria-describedby')).toBe(help.id)
    expect(provider.getAttribute('aria-invalid')).toBeNull()
  })
})

describe('P26 narrow panels: error and recovery stay under their control', () => {
  it('each field is its own container; label stacks above the body below 40rem (covers 320/420px), the body never reorders', () => {
    const { container } = renderRefused('agent.toolsets', { type: 'list' }, ['web'])
    const { row, control, error } = rowParts(container)
    // The direct parent is the per-field container (container-type), so a narrow side panel stacks this row by its own width.
    expect(row.parentElement?.hasAttribute('data-settings-form-rows')).toBe(true)
    const body = row.querySelector('[data-sfr-body]')!
    // control -> help -> error -> actions are siblings of one body column, in that order.
    expect([...body.children].map(c => [...c.attributes].find(a => a.name.startsWith('data-sfr-'))?.name)).toEqual(['data-sfr-control', 'data-sfr-help', 'data-sfr-error', 'data-sfr-actions'])
    expect(after(control, error)).toBe(true)

    const css = readFileSync(join(__dirname, '../../styles/hierarchy.css'), 'utf8')
    expect(css).toMatch(/:where\(\[data-settings-form-rows\]\) \{ container-type: inline-size; container-name: settings-form;/)
    expect(css).toMatch(/@container settings-form \(max-width: 40rem\) \{ :where\(\[data-settings-form-row\]\) \{ grid-template-columns: minmax\(0, 1fr\);/)
    // The body is one column; nothing places help/error/actions beside the control.
    expect(css).toMatch(/:where\(\[data-sfr-body\]\) \{ display: grid; gap: [^;]+; min-width: 0; justify-items: start; \}/)
    expect(css).not.toMatch(/data-sfr-(error|actions)\]\)[^{]*\{[^}]*grid-(column|row|area)/)
  })
})
