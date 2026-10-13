import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { registry } from '@/contrib/registry'
import { Slot } from '@/contrib/react/slot'
import { $commandPaletteOpen, $commandPalettePage, closeCommandPalette } from '@/store/command-palette'

import { $opsProblemsCount, OpsChrome, OPS_STATUSBAR_GROUP, opsStatusbarItems, type OpsChromeProps } from './chrome'
import { opsHost, resetOpsKeymapForTests } from './keymap'

const base: OpsChromeProps = {
  connectionId: 'local',
  connectionLabel: 'Local',
  profile: 'judge',
  profileLabel: 'judge',
  viewLabel: 'Office',
  sources: {}
}

function mount(props: Partial<OpsChromeProps> = {}) {
  return render(
    <>
      <OpsChrome {...base} {...props} />
      <Slot area="titleBar.center" />
    </>
  )
}

function statusIds(side: 'left' | 'right'): string[] {
  return registry.getArea(`statusBar.${side}`).map(item => String((item.data as { id?: string }).id ?? item.id))
}

afterEach(() => {
  cleanup()
  closeCommandPalette()
  resetOpsKeymapForTests()
  $opsProblemsCount.set(null)
  document.body.replaceChildren()
})

describe('Ops chrome', () => {
  it('puts breadcrumb and Search Ops in the existing titlebar slot', () => {
    mount()

    expect(screen.getByRole('navigation', { name: 'Ops breadcrumb' }).textContent).toBe('Local / judge / Office')
    fireEvent.click(screen.getByRole('button', { name: 'Search Ops' }))
    expect($commandPalettePage.get()).toBe('ops')
    expect($commandPaletteOpen.get()).toBe(true)
    expect(document.querySelectorAll('[cmdk-root], [data-ops-palette-root]')).toHaveLength(0)
  })

  it('reuses one scoped model chip only while chat is hot-hidden, and does not edit', () => {
    const { rerender } = mount({ chatHotHidden: false, modelLabel: 'judge · gpt-6.1-sol' })
    expect(screen.queryByRole('button', { name: 'judge · gpt-6.1-sol' })).toBeNull()

    rerender(
      <>
        <OpsChrome {...base} chatHotHidden modelLabel="judge · gpt-6.1-sol" />
        <Slot area="titleBar.center" />
      </>
    )

    const chip = screen.getByRole('button', { name: 'judge · gpt-6.1-sol' })
    expect(screen.getAllByRole('button', { name: 'judge · gpt-6.1-sol' })).toHaveLength(1)
    expect((chip as HTMLButtonElement).disabled).toBe(true)
    expect(chip.getAttribute('title')).toMatch(/A5\/A6/)
    fireEvent.click(chip)
    expect($commandPaletteOpen.get()).toBe(false)
  })

  it('registers one lifecycle-managed statusbar group and omits unknown counters', () => {
    const items = opsStatusbarItems(
      {
        focusedRunId: 'T-401',
        workingCount: null,
        needsYouCount: 1,
        todayTokens: { total: 14300, provenance: '/api/analytics/usage' },
        gateway: { health: 'ok', version: '0.9.0' },
        motionMode: 'full',
        dockOpen: false,
        problemsCount: null,
        branch: 'ops/P0.5-06',
        worktreeFocused: false
      },
      'judge',
      {}
    )

    expect(items.left.map(item => item.id)).toEqual(['ops-profile', 'ops-run', 'ops-needs-you', 'ops-tokens'])
    expect(items.left.find(item => item.id === 'ops-tokens')?.title).toBe('/api/analytics/usage')
    expect(items.left.some(item => item.id === 'ops-branch')).toBe(false)
    expect(items.right.map(item => item.id)).toEqual(['ops-gateway', 'ops-motion', 'ops-dock'])
    expect(JSON.stringify(items)).not.toContain('"0 working"')
  })

  it('shows a sourced zero, a worktree branch, and the same problems count the dock reads', () => {
    mount({
      sources: {
        workingCount: 0,
        problemsCount: 4,
        branch: 'ops/P0.5-06',
        worktreeFocused: true
      }
    })

    expect(statusIds('left')).toContain('ops-working')
    expect(statusIds('left')).toContain('ops-branch')
    expect(statusIds('right').filter(id => id.startsWith('ops-'))).toContain('ops-problems')
    expect($opsProblemsCount.get()).toBe(4)
    expect(registry.getArea('statusBar.left').filter(item => String(item.id).startsWith(`${OPS_STATUSBAR_GROUP}-`)).length).toBeGreaterThan(0)
    expect(registry.getArea('statusBar.right').filter(item => item.id === 'ops-problems' || String(item.id).startsWith('ops-'))).not.toHaveLength(0)
  })

  it('replaces the group on profile change and clears it on unmount without moving focus', () => {
    const keeper = document.createElement('button')
    keeper.textContent = 'keep'
    document.body.append(keeper)
    keeper.focus()

    const view = mount({ profile: 'judge', profileLabel: 'judge' })
    const before = statusIds('left').length
    view.rerender(
      <>
        <OpsChrome {...base} profile="sandhi" profileLabel="sandhi" sources={{ needsYouCount: 2 }} />
        <Slot area="titleBar.center" />
      </>
    )

    expect(document.activeElement).toBe(keeper)
    expect(statusIds('left').filter(id => id === 'ops-profile')).toHaveLength(1)
    expect(before).toBeGreaterThan(0)
    view.unmount()
    expect(statusIds('left').filter(id => id.startsWith('ops-'))).toEqual([])
    expect(statusIds('right').filter(id => id.startsWith('ops-'))).toEqual([])
    expect($opsProblemsCount.get()).toBeNull()
  })

  it('Esc closes the sheet, then full-screen, and never approves', () => {
    const onExitFullscreen = vi.fn()
    const deny = document.createElement('button')
    deny.dataset.approvalDeny = ''
    const onDeny = vi.fn()
    deny.addEventListener('click', onDeny)
    document.body.append(deny)

    mount({ fullscreen: true, onExitFullscreen })
    act(() => {
      opsHost()?.openShortcutSheet()
    })
    expect(screen.getByRole('dialog', { name: 'Ops shortcuts' })).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Ops shortcuts' })).toBeNull()
    expect(onExitFullscreen).not.toHaveBeenCalled()
    expect(onDeny).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExitFullscreen).toHaveBeenCalledOnce()
    expect(onDeny).not.toHaveBeenCalled()
  })
})
