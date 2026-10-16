/** P27 (judge pass 21 #4): a refused Ops preference write (motion, artifact previews) never shows success and can be recovered. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { THUMB_OPT_OUT_KEY } from '../../artifacts/thumb-cache'

import { SettingsView } from './settings'

const MOTION_KEY = 'hermes.ops.motion'
let refuse: null | string = null

beforeEach(() => {
  localStorage.clear()
  refuse = null
  const realSet = localStorage.setItem.bind(localStorage)
  const realRemove = localStorage.removeItem.bind(localStorage)
  vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
    if (k === refuse) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    }

    return realSet(k, v)
  })
  vi.spyOn(localStorage, 'removeItem').mockImplementation((k: string) => {
    if (k === refuse) {
      throw new DOMException('The storage is read-only.', 'SecurityError')
    }

    return realRemove(k)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const writes = () =>
  (localStorage.setItem as unknown as { mock: { calls: unknown[] } }).mock.calls.length +
  (localStorage.removeItem as unknown as { mock: { calls: unknown[] } }).mock.calls.length

const rowOf = (el: HTMLElement) => el.closest('[data-settings-form-row]') as HTMLElement

describe('P27 Ops Settings: motion and previews persistence', () => {
  it('motion: a refused write shows the reason with Retry and Revert, never Saved; Revert restores without writing', () => {
    localStorage.setItem(MOTION_KEY, 'full')
    render(<SettingsView defaultModel={null} policy={null} />)
    refuse = MOTION_KEY
    const motion = screen.getByRole('button', { name: /^Motion: / })
    fireEvent.click(motion)

    const row = rowOf(motion)
    const err = row.querySelector('[data-sfr-error]') as HTMLElement
    expect(err).not.toBeNull()
    expect(err.getAttribute('role')).toBe('alert')
    expect(err.textContent).toContain('quota has been exceeded')
    expect(row.textContent).not.toContain('Saved on this device')
    expect(motion.getAttribute('aria-invalid')).toBe('true')
    expect(motion.getAttribute('aria-describedby')?.split(' ')).toContain(err.id)
    expect(row.querySelector('[data-sfr-error] + [data-sfr-actions] [data-ops-pref-retry]')).not.toBeNull()
    expect(motion.getAttribute('data-ops-motion')).toBe('reduced')

    const before = writes()
    fireEvent.click(row.querySelector('[data-ops-pref-revert]')!)
    expect(writes()).toBe(before)
    expect(motion.getAttribute('data-ops-motion')).toBe('full')
    expect(row.querySelector('[data-sfr-error]')).toBeNull()
    expect(row.textContent).not.toContain('Saved on this device')
  })

  it('motion: Retry writes the kept choice once and only then says Saved', () => {
    render(<SettingsView defaultModel={null} policy={null} />)
    refuse = MOTION_KEY
    const motion = screen.getByRole('button', { name: /^Motion: / })
    fireEvent.click(motion)
    const row = rowOf(motion)
    expect(row.querySelector('[data-sfr-error]')).not.toBeNull()

    refuse = null
    fireEvent.click(row.querySelector('[data-ops-pref-retry]')!)
    expect(localStorage.getItem(MOTION_KEY)).toBe(motion.getAttribute('data-ops-motion'))
    expect(row.querySelector('[data-sfr-error]')).toBeNull()
    expect(row.textContent).toContain('Saved on this device')
  })

  it('artifact previews: a refused write keeps the choice with reason, Retry and Revert; Revert restores without writing', () => {
    render(<SettingsView defaultModel={null} policy={null} />)
    refuse = THUMB_OPT_OUT_KEY
    const toggle = screen.getByLabelText('load GitHub preview images') as HTMLInputElement
    expect(toggle.checked).toBe(true)
    fireEvent.click(toggle)

    const row = rowOf(toggle)
    const err = row.querySelector('[data-sfr-error]') as HTMLElement
    expect(err).not.toBeNull()
    expect(err.textContent).toContain('quota has been exceeded')
    expect(row.textContent).not.toContain('Saved on this device')
    expect(toggle.checked).toBe(false)
    expect(toggle.getAttribute('aria-invalid')).toBe('true')
    expect(toggle.getAttribute('aria-describedby')?.split(' ')).toContain(err.id)
    expect(row.querySelector('[data-sfr-error] + [data-sfr-actions] [data-ops-pref-retry]')).not.toBeNull()

    const before = writes()
    fireEvent.click(row.querySelector('[data-ops-pref-revert]')!)
    expect(writes()).toBe(before)
    expect(toggle.checked).toBe(true)
    expect(row.querySelector('[data-sfr-error]')).toBeNull()

    // Retry path: refused again, then accepted -> Saved only after the stored value says so.
    fireEvent.click(toggle)
    refuse = null
    fireEvent.click(row.querySelector('[data-ops-pref-retry]')!)
    expect(localStorage.getItem(THUMB_OPT_OUT_KEY)).toBe('off')
    expect(row.querySelector('[data-sfr-error]')).toBeNull()
    expect(row.textContent).toContain('Saved on this device')
  })
})
