import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SettingsView } from './settings'

describe('P8 Settings | Diagnostics tabs', () => {
  it('keeps both views mounted, moves with arrows, and keeps details folded', async () => {
    render(<SettingsView defaultModel={null} policy={null} />)
    const diag = document.getElementById('ops-settings-panel-diagnostics')!
    expect(diag.hidden).toBe(true)
    const tab = document.querySelector<HTMLElement>('[data-ops-settings-view="settings"]')!
    await act(async () => fireEvent.keyDown(tab, { key: 'ArrowRight' }))
    expect(diag.hidden).toBe(false)
    expect(document.activeElement?.getAttribute('data-ops-settings-view')).toBe('diagnostics')
    expect(document.querySelector('[data-ops-settings-view="diagnostics"]')?.getAttribute('tabindex')).toBe('0')
    expect((document.querySelector('[data-ops-diag-details]') as HTMLDetailsElement).open).toBe(false)
    await act(async () => fireEvent.keyDown(document.activeElement!, { key: 'Home' }))
    expect(diag.hidden).toBe(true)
    expect(document.querySelector('[data-ops-diagnostics]')).not.toBeNull()
  })
})
