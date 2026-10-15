import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SettingsFormGroup, SettingsFormRow } from './settings-form-row'

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

  it('CSS: zero-specificity, container-driven, spec tokens', () => {
    const block = css.slice(css.indexOf('/* P17: SettingsFormRow'))
    expect(block).toMatch(/@container settings-form/)
    expect(block).toMatch(/\[data-sfr-label\]\) \{[^}]*var\(--type-meta/)
    expect(block).not.toMatch(/:has\(|!important|@keyframes/)

    for (const l of block.split('\n').filter(x => x.includes('{') && !x.trim().startsWith('/*') && !x.trim().startsWith('@'))) {expect(l.trim().startsWith(':where(')).toBe(true)}
  })
})
