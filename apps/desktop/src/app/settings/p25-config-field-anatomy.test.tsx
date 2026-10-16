/** P25 (judge pass 19 #3): a config field uses the shared SettingsFormRow anatomy, also when its save is refused. */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfigField } from './config-field'

afterEach(() => cleanup())

const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('P25 ConfigField failing anatomy', () => {
  it.each([
    ['boolean switch', { type: 'boolean' as const }, false, '[role="switch"]'],
    ['text input', { type: 'string' as const }, 'abc', 'input']
  ])('%s: control -> help -> error (reason) -> recovery, all in the control column', (_name, schema, value, controlSel) => {
    const { container } = render(
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
        error={<span data-err="">Autosave failed: disk is read-only</span>}
        onChange={vi.fn()}
        schema={{ ...schema, description: 'What this field does.' }}
        schemaKey="some.field"
        value={value}
      />
    )

    const row = container.querySelector('[data-settings-form-row]')!
    expect(row).not.toBeNull()
    const label = row.querySelector('[data-sfr-label]')!
    const body = row.querySelector('[data-sfr-body]')!
    const control = body.querySelector(`[data-sfr-control] ${controlSel}`) as HTMLElement
    const help = body.querySelector('[data-sfr-help]')!
    const error = body.querySelector('[data-sfr-error]')!
    const retry = body.querySelector('[data-sfr-actions] [data-retry]')!
    const revert = body.querySelector('[data-sfr-actions] [data-revert]')!

    for (const el of [control, help, error, retry, revert]) {
      expect(el).not.toBeNull()
      expect(label.contains(el)).toBe(false)
    }

    expect(help.textContent).toBe('What this field does.')
    expect(error.textContent).toContain('disk is read-only')
    expect(error.getAttribute('role')).toBe('alert')
    expect(after(control, help) && after(help, error) && after(error, retry) && after(retry, revert)).toBe(true)
    // Association: label -> control; control described by help and error; invalid while refused.
    expect(label.getAttribute('for')).toBe(control.id)
    expect(control.getAttribute('aria-describedby')?.split(' ')).toEqual([help.id, error.id])
    expect(control.getAttribute('aria-invalid')).toBe('true')
  })

  it('no error: no error, no actions, control not invalid; the tour handle stays on the row', () => {
    const { container } = render(<ConfigField onChange={vi.fn()} schema={{ type: 'boolean' }} schemaKey="checkpoints.enabled" value />)

    expect(container.querySelector('[data-sfr-error]')).toBeNull()
    expect(container.querySelector('[data-sfr-actions]')).toBeNull()
    expect(container.querySelector('[role="switch"]')?.getAttribute('aria-invalid')).toBeNull()
    expect(container.querySelector('[data-tour="field-checkpoints.enabled"] [data-settings-form-row]')).not.toBeNull()
  })
})
