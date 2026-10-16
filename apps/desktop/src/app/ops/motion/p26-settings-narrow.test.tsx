/** P26 (judge pass 20 #2): an Ops Settings preference refused at any panel width keeps its error and recovery under its control. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SettingsView } from './settings'

let refuse = false

beforeEach(() => {
  localStorage.clear()
  refuse = false
  const realSet = localStorage.setItem.bind(localStorage)
  vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
    if (refuse && k === 'hermes.ops.prefs') {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    }

    return realSet(k, v)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('P26 Ops Settings refused preference, narrow panels', () => {
  it('control -> error -> Retry/Revert are one body column inside a container-query form; the narrow rule only stacks the label', () => {
    render(<SettingsView defaultModel={null} policy={null} />)
    refuse = true
    fireEvent.change(screen.getByLabelText('theme'), { target: { value: 'light' } })

    const control = screen.getByLabelText('theme')
    const row = control.closest('[data-settings-form-row]') as HTMLElement
    const body = row.querySelector('[data-sfr-body]') as HTMLElement
    const error = body.querySelector('[data-sfr-error]') as HTMLElement
    const actions = body.querySelector('[data-sfr-actions]') as HTMLElement

    expect(row.closest('[data-settings-form-rows]')).not.toBeNull()
    expect(body.contains(control)).toBe(true)
    expect([...body.children].map(c => [...c.attributes].find(a => a.name.startsWith('data-sfr-'))?.name)).toEqual(['data-sfr-control', 'data-sfr-error', 'data-sfr-actions'])
    expect(error.textContent).toContain('quota has been exceeded')
    expect(actions.querySelector('[data-ops-pref-retry]')).not.toBeNull()
    expect(actions.querySelector('[data-ops-pref-revert]')).not.toBeNull()
    expect(control.getAttribute('aria-describedby')?.split(' ')).toContain(error.id)

    // Ops CSS never pulls the error or the recovery out of the body column.
    const css = readFileSync(join(__dirname, '../ops-base.css'), 'utf8')
    expect(css).not.toMatch(/data-sfr-(error|actions)\]\)[^{]*\{[^}]*(grid-(column|row|area)|position: absolute)/)
  })
})
