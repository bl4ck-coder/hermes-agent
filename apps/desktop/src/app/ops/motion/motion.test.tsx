import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { envPresenceList } from '../feed/ops-actions'

import { cycleMotion, loadMotion, motionCssVars, transition, transitionMs, TRANSITIONS } from './motion'
import { loadPrefs, MotionReadout, SettingsView } from './settings'

beforeEach(() => localStorage.clear())
afterEach(() => cleanup())

const full = { mode: 'full' as const, systemReduced: false }

describe('motion tokens and transitions (P5-03)', () => {
  it('defines T1-T15 with the 140/220/320 ms set', () => {
    expect(TRANSITIONS.map(t => t.id)).toEqual(Array.from({ length: 15 }, (_, i) => `T${i + 1}`))
    expect(transition('T1').ms).toBe(320)
    expect(transition('T5').ms).toBe(140)
    expect(transition('T10').ms).toBe(600)
    expect(TRANSITIONS.every(t => [140, 220, 320, 600].includes(t.ms))).toBe(true)
  })

  it('reduced motion makes FLIP instant but keeps fades; system follows the OS', () => {
    expect(transitionMs('T1', { mode: 'reduced', systemReduced: false })).toBe(0)
    expect(transitionMs('T5', { mode: 'reduced', systemReduced: false })).toBe(140)
    expect(transitionMs('T1', { mode: 'system', systemReduced: true })).toBe(0)
    expect(transitionMs('T1', { mode: 'system', systemReduced: false })).toBe(320)
    expect(transitionMs('T1', { mode: 'full', systemReduced: true })).toBe(320)
  })

  it('performance guard: no layout animation in virtualized lists, offscreen or with >50 movers', () => {
    expect(transitionMs('T15', { ...full, virtualized: true })).toBe(0)
    expect(transitionMs('T1', { ...full, offscreen: true })).toBe(0)
    expect(transitionMs('T13', { ...full, movingItems: 51 })).toBe(0)
    expect(transitionMs('T6', { ...full, movingItems: 400 })).toBe(220)
  })

  it('css vars zero durations under reduced motion', () => {
    expect(motionCssVars(full)['--ops-view']).toBe('320ms')
    expect(motionCssVars({ mode: 'reduced', systemReduced: false })['--ops-view']).toBe('0ms')
  })

  it('readout cycles Full → Reduced → System and persists', () => {
    expect(cycleMotion('full')).toBe('reduced')
    expect(cycleMotion('system')).toBe('full')
    expect(loadMotion()).toBe('system')
    let mode = 'full' as 'full' | 'reduced' | 'system'
    render(<MotionReadout mode={mode} onChange={m => (mode = m)} />)
    fireEvent.click(screen.getByText('Motion: Full'))
    expect(mode).toBe('reduced')
  })
})

describe('W9 settings (P5-03)', () => {
  it('settings persist prefs and motion, show unknown when unsourced', () => {
    const routes: string[] = []
    render(<SettingsView defaultModel={null} onOpenRoute={r => routes.push(r)} policy={null} />)
    expect(document.querySelector('[data-ops-field="default-model"]')?.textContent).toBe('unknown')
    expect(screen.queryAllByText('Not available yet').length).toBe(0)
    expect(document.querySelector('[data-ops-field="approval-mode"]')?.textContent).toBe('unknown')
    expect(document.querySelector('[data-ops-field="secrets"]')?.textContent).toBe('unknown')
    fireEvent.change(screen.getByLabelText('default tab'), { target: { value: 'board' } })
    expect(loadPrefs().defaultTab).toBe('board')
    fireEvent.click(screen.getByLabelText('Motion: System'))
    expect(localStorage.getItem('hermes.ops.motion')).toBe('full')
    fireEvent.click(screen.getByText('Desktop appearance'))
    expect(routes).toEqual(['/settings'])
    fireEvent.click(screen.getByText('Shortcut sheet'))
    expect(document.querySelector('[data-ops-shortcut-sheet]')).toBeTruthy()
  })

  it('malformed prefs fall back to defaults', () => {
    localStorage.setItem('hermes.ops.prefs', '{bad')
    expect(loadPrefs()).toEqual({ defaultTab: 'office', dateFormat: 'relative', theme: 'gold-night', openOnLaunch: false, notifyApprovals: false, notifyBlocked: false })
  })
})

describe('W9 secret presence (P6 F5, O42)', () => {
  it('lists names and set/unset only, never values', () => {
    const rows = envPresenceList({ OPENAI_API_KEY: { is_set: true, redacted_value: 'sk-***' } as never, SLACK_TOKEN: { is_set: false } })
    render(<SettingsView defaultModel={null} policy={null} secrets={rows} />)
    expect(document.querySelector('[data-ops-secret="OPENAI_API_KEY"]')?.getAttribute('data-ops-set')).toBe('yes')
    expect(document.querySelector('[data-ops-secret="SLACK_TOKEN"]')?.textContent).toBe('SLACK_TOKEN: not set')
    expect(document.body.textContent).not.toContain('sk-')
  })
})
