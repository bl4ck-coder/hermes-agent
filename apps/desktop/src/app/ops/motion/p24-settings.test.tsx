/** P24 (judge pass 18 must-fix): Ops Settings preferences use the shared SettingsFormRow with local recovery. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadPrefs, SettingsView } from './settings'

const PREF = 'hermes.ops.prefs'
let refuse = false

beforeEach(() => {
  localStorage.clear()
  refuse = false
  const realSet = localStorage.setItem.bind(localStorage)
  vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
    if (refuse && k === PREF) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    }

    return realSet(k, v)
  })
})

const setCalls = () => (localStorage.setItem as unknown as { mock: { calls: unknown[] } }).mock.calls.length

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const rowOf = (label: string) => screen.getByLabelText(label).closest('[data-settings-form-row]') as HTMLElement

describe('P24 Ops Settings recovery', () => {
  it('preference rows are SettingsFormRow rows inside a container-query form', () => {
    render(<SettingsView defaultModel={null} policy={null} />)

    for (const label of ['theme', 'default tab', 'open ops on launch', 'timezone', 'date format', 'notify approvals', 'notify blocked']) {
      const row = rowOf(label)
      expect(row, label).not.toBeNull()
      expect(row.closest('[data-settings-form-rows]'), label).not.toBeNull()
      // label → control association is real, not only aria-label.
      const control = screen.getByLabelText(label)
      expect(row.querySelector('[data-sfr-label]')?.getAttribute('for')).toBe(control.id)
    }
  })

  it('a refused save shows the reason beside the field and keeps the draft; Retry saves only that field', () => {
    render(<SettingsView defaultModel={null} policy={null} />)
    refuse = true
    fireEvent.change(screen.getByLabelText('theme'), { target: { value: 'light' } })
    fireEvent.change(screen.getByLabelText('date format'), { target: { value: 'iso' } })

    const themeRow = rowOf('theme')
    const err = themeRow.querySelector('[data-sfr-error]')!
    expect(err.getAttribute('role')).toBe('alert')
    expect(err.textContent).toContain('quota has been exceeded')
    expect((screen.getByLabelText('theme') as HTMLSelectElement).value).toBe('light')
    expect(screen.getByLabelText('theme').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('theme').getAttribute('aria-describedby')).toContain(err.id)
    expect(loadPrefs().theme).toBe('gold-night')

    refuse = false
    fireEvent.click(themeRow.querySelector('[data-ops-pref-retry]')!)
    expect(themeRow.querySelector('[data-sfr-error]')).toBeNull()
    expect(loadPrefs().theme).toBe('light')
    // The other failed draft was not sent along with it.
    expect(loadPrefs().dateFormat).toBe('relative')
    expect(rowOf('date format').querySelector('[data-sfr-error]')).not.toBeNull()
    expect((screen.getByLabelText('date format') as HTMLSelectElement).value).toBe('iso')
  })

  it('Revert puts the saved value back and clears only that error, with storage still refusing', () => {
    render(<SettingsView defaultModel={null} policy={null} />)
    refuse = true
    fireEvent.change(screen.getByLabelText('theme'), { target: { value: 'dark' } })
    fireEvent.click(screen.getByLabelText('notify approvals'))
    const calls = setCalls()

    fireEvent.click(rowOf('theme').querySelector('[data-ops-pref-revert]')!)
    expect((screen.getByLabelText('theme') as HTMLSelectElement).value).toBe('gold-night')
    expect(rowOf('theme').querySelector('[data-sfr-error]')).toBeNull()
    expect(setCalls()).toBe(calls)
    // The other draft keeps its value and its error.
    expect((screen.getByLabelText('notify approvals') as HTMLInputElement).checked).toBe(true)
    expect(rowOf('notify approvals').querySelector('[data-sfr-error]')).not.toBeNull()
  })

  it('a later edit to another field does not smuggle a failed draft to disk', () => {
    render(<SettingsView defaultModel={null} policy={null} />)
    refuse = true
    fireEvent.change(screen.getByLabelText('theme'), { target: { value: 'dark' } })
    refuse = false
    fireEvent.change(screen.getByLabelText('default tab'), { target: { value: 'board' } })
    expect(loadPrefs()).toMatchObject({ defaultTab: 'board', theme: 'gold-night' })
    expect(rowOf('theme').querySelector('[data-sfr-error]')).not.toBeNull()
    expect(rowOf('default tab').querySelector('[data-sfr-status]')?.textContent).toBeTruthy()
  })

  it('Retry / Revert are 40px targets', () => {
    const css = readFileSync(join(__dirname, '..', 'ops-base.css'), 'utf8')
    expect(css).toMatch(/:where\(\[data-ops-pref-retry\], \[data-ops-pref-revert\]\) \{[^}]*min-height: 40px/)
    expect(css).toMatch(/:where\(\[data-ops-settings\]\) :where\(\[data-sfr-control\]\) :where\([^)]*select[^)]*\) \{[^}]*min-height: 40px/)
  })
})

describe('P24 Ops Settings layout by panel width (container query, not window)', () => {
  // jsdom cannot lay out container queries; assert the contract the browser applies instead.
  const css = readFileSync(join(__dirname, '..', '..', '..', 'styles', 'hierarchy.css'), 'utf8')
  const stackAt = Number(/@container settings-form \(max-width: (\d+(?:\.\d+)?)rem\) \{ :where\(\[data-settings-form-row\]\) \{ grid-template-columns: minmax\(0, 1fr\)/.exec(css)?.[1]) * 16

  it.each([
    [320, 'stacked'],
    [420, 'stacked'],
    [760, 'two columns']
  ])('panel %ipx: rows are %s', (width, expected) => {
    expect(css).toMatch(/:where\(\[data-settings-form-rows\]\) \{[^}]*container-type: inline-size; container-name: settings-form/)
    expect(stackAt).toBe(640)
    expect(width <= stackAt ? 'stacked' : 'two columns').toBe(expected)
  })

  it('Ops rows sit in the settings-form container', () => {
    render(<SettingsView defaultModel={null} policy={null} />)
    const groups = ['general', 'dates', 'notifications'].map(id => document.querySelector(`[data-ops-settings-group="${id}"] [data-settings-form-rows]`))
    expect(groups.every(Boolean)).toBe(true)
  })
})
