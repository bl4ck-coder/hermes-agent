import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { settingsControlProps, SettingsFormGroup, SettingsFormRow } from './settings-form-row'

const css = readFileSync(join(__dirname, '..', '..', 'styles', 'hierarchy.css'), 'utf8')

describe('P17 SettingsFormRow', () => {
  it('associates label, help and error with the control, in reading order', () => {
    const { container, getByLabelText } = render(
      <SettingsFormGroup id="g" title="Model">
        <SettingsFormRow error="Too large" help="Tokens" id="ctx" label="Context length" status="Saved">
          <input aria-describedby="ctx-help ctx-error" aria-invalid id="ctx" />
        </SettingsFormRow>
      </SettingsFormGroup>
    )

    const input = getByLabelText('Context length')
    expect(input.id).toBe('ctx')
    expect(container.querySelector('#ctx-help')?.textContent).toBe('Tokens')
    expect(container.querySelector('#ctx-error')?.getAttribute('role')).toBe('alert')
    const order = [...container.querySelectorAll('[data-sfr-label],[data-sfr-control],[data-sfr-help],[data-sfr-error],[data-sfr-status]')].map(n => [...n.attributes].find(a => a.name.startsWith('data-sfr'))!.name)
    expect(order).toEqual(['data-sfr-label', 'data-sfr-control', 'data-sfr-help', 'data-sfr-error', 'data-sfr-status'])
    expect(container.querySelector('[data-settings-form-group-title]')?.id).toBe('g-title')
  })

  it('P25: recovery actions have their own slot in the control column: control -> help -> error -> actions -> status', () => {
    const { container } = render(
      <SettingsFormRow actions={<button type="button">Retry</button>} error="Not saved: disk full" help="Tokens" id="ctx" label="Context" status="Saving…">
        <input id="ctx" />
      </SettingsFormRow>
    )

    const body = container.querySelector('[data-sfr-body]')!
    const order = [...body.children].map(n => [...n.attributes].find(a => a.name.startsWith('data-sfr'))!.name)
    expect(order).toEqual(['data-sfr-control', 'data-sfr-help', 'data-sfr-error', 'data-sfr-actions', 'data-sfr-status'])
    expect(container.querySelector('[data-sfr-error]')?.textContent).toBe('Not saved: disk full')
    expect(container.querySelector('[data-sfr-label]')?.contains(screen.getByText('Retry'))).toBe(false)
  })

  it('P25: settingsControlProps wires id, label, help and error onto the control', () => {
    expect(settingsControlProps('ctx', { help: true, error: true })).toEqual({
      id: 'ctx',
      'aria-labelledby': 'ctx-label',
      'aria-describedby': 'ctx-help ctx-error',
      'aria-invalid': true
    })
    expect(settingsControlProps('ctx', {})).toEqual({ id: 'ctx', 'aria-labelledby': 'ctx-label', 'aria-describedby': undefined, 'aria-invalid': undefined })
  })

  it('keyboard: focusable controls follow row order (no tabindex reordering) and each label resolves to its control', () => {
    const { container } = render(
      <SettingsFormGroup id="g" title="T">
        <SettingsFormRow id="a" label="First">
          <input id="a" />
        </SettingsFormRow>
        <SettingsFormRow id="b" label="Second">
          <input id="b" />
        </SettingsFormRow>
      </SettingsFormGroup>
    )

    const focusables = [...container.querySelectorAll('input, button, select, textarea, [tabindex]')]
    expect(focusables.map(n => n.id)).toEqual(['a', 'b'])
    expect(focusables.every(n => !n.hasAttribute('tabindex'))).toBe(true)
    expect(screen.getByLabelText('Second').id).toBe('b')
    ;(screen.getByLabelText('First') as HTMLInputElement).focus()
    expect(document.activeElement?.id).toBe('a')
  })

  it('a rejected save shows the error next to the field, keeps the draft, and marks the row invalid', () => {
    function Field() {
      const [v, setV] = useState('100')
      const [err, setErr] = useState<string | null>(null)

      return (
        <SettingsFormRow error={err} id="ctx" label="Context" status={err ? undefined : 'Saved automatically'}>
          <input aria-describedby={err ? 'ctx-error' : undefined} aria-invalid={!!err} id="ctx" onBlur={() => setErr('Rejected: too large')} onChange={e => setV(e.target.value)} value={v} />
        </SettingsFormRow>
      )
    }

    const { container } = render(<Field />)
    const input = screen.getByLabelText('Context') as HTMLInputElement
    fireEvent.change(input, { target: { value: '999999' } })
    fireEvent.blur(input)
    expect(screen.getByRole('alert').textContent).toBe('Rejected: too large')
    expect(input.value).toBe('999999')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('ctx-error')
    expect(container.querySelector('[data-settings-form-row-invalid]')).not.toBeNull()
    expect(container.querySelector('[data-sfr-status]')).toBeNull()
  })

  it('CSS: zero-specificity, container-driven, spec tokens', () => {
    const block = css.slice(css.indexOf('/* P17: SettingsFormRow'))
    expect(block).toMatch(/@container settings-form/)
    expect(block).toMatch(/\[data-sfr-label\]\) \{[^}]*var\(--type-meta/)
    expect(block).not.toMatch(/:has\(|!important|@keyframes/)

    for (const l of block.split('\n').filter(x => x.includes('{') && !x.trim().startsWith('/*') && !x.trim().startsWith('@'))) {expect(l.trim().startsWith(':where(')).toBe(true)}
  })
})
