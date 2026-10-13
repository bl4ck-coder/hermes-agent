import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Slot } from '@/contrib/react/slot'
import { registry } from '@/contrib/registry'
import type { HermesApiRequest } from '@/global'
import { I18nProvider } from '@/i18n'
import { en } from '@/i18n/en'
import { $commandPaletteOpen, $commandPalettePage, closeCommandPalette } from '@/store/command-palette'

import { $opsProblemsCount, OPS_STATUSBAR_GROUP, OpsChrome, type OpsChromeProps, opsStatusbarItems } from './chrome'
import { opsHost, resetOpsKeymapForTests } from './keymap'
import { $opsFullscreen, $opsOpen, $opsScope } from './layout-store'
import { loadScope, resetOpsNavigationForTests, setDock, setInspectorOpen } from './navigation-store'
import { readOpsPaletteScope } from './palette'
import { OpsPane } from './split-host'

import { OpsShell } from './index'

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
    <I18nProvider>
      <OpsChrome {...base} {...props} />
      <Slot area="titleBar.center" />
    </I18nProvider>
  )
}

function statusIds(side: 'left' | 'right'): string[] {
  return registry.getArea(`statusBar.${side}`).map(item => String((item.data as { id?: string }).id ?? item.id))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  closeCommandPalette()
  resetOpsKeymapForTests()
  $opsProblemsCount.set(null)
  $opsOpen.set(false)
  $opsFullscreen.set(false)
  resetOpsNavigationForTests()
  document.body.replaceChildren()
})

describe('Ops chrome', () => {
  it('productive compact rail: slash focuses the visible filter and Escape dismisses only that popover', async () => {
    const props = { connectionId: 'local', profile: 'judge', paneWidth: 600 }

    const view = render(
      <I18nProvider>
        <OpsShell {...props} />
      </I18nProvider>
    )

    const trigger = view.container.querySelector<HTMLButtonElement>('[data-ops-dock-toggle]')!
    trigger.focus()
    fireEvent.keyDown(trigger, { key: '/', code: 'Slash' })
    await waitFor(() => expect(document.activeElement?.closest('[data-ops-filter-overlay]')).toBeTruthy())
    const before = loadScope('local', 'judge').inspectorOpen
    fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' })
    expect(document.querySelector('[data-ops-filter-overlay]')).toBeNull()
    expect(loadScope('local', 'judge').inspectorOpen).toBe(before)
    expect(document.activeElement).toBe(view.container.querySelector('[data-ops-filter-toggle]'))
    fireEvent.click(view.container.querySelector('[data-ops-filter-toggle]')!)
    expect(document.querySelector('[data-ops-filter-overlay]')).not.toBeNull()
    view.rerender(
      <I18nProvider>
        <OpsShell {...props} active={false} />
      </I18nProvider>
    )
    expect(document.querySelector('[data-ops-filter-overlay]')).toBeNull()
  })
  it('productive shell: dock and statusbar consume the same Problems observation, including unavailable', () => {
    setDock('local', 'judge', { dockOpen: true, dockSlot: 'problems' })
    const props = { connectionId: 'local', profile: 'judge', paneWidth: 1300 }

    const view = render(
      <I18nProvider>
        <OpsShell
          {...props}
          problems={[
            { id: 'one', summary: 'one' },
            { id: 'two', summary: 'two' }
          ]}
        />
      </I18nProvider>
    )

    expect(view.container.querySelector('[data-problems-count]')?.textContent).toBe('2')
    expect($opsProblemsCount.get()).toBe(2)
    const group = registry.getArea('statusBar.right').find(item => (item.data as { id?: string }).id === 'ops-problems')
    expect((group?.data as { label: string }).label).toBe('Problems 2')
    view.rerender(
      <I18nProvider>
        <OpsShell {...props} />
      </I18nProvider>
    )
    expect(view.container.querySelector('[data-problems-count]')?.textContent).toBe('unavailable')
    expect($opsProblemsCount.get()).toBeNull()
    expect(statusIds('right')).not.toContain('ops-problems')
  })

  it('productive shell: reverse layer opening order closes dock before inspector', () => {
    setInspectorOpen('local', 'judge', true)

    const view = render(
      <I18nProvider>
        <OpsShell connectionId="local" paneWidth={600} profile="judge" />
      </I18nProvider>
    )

    act(() => {
      setDock('local', 'judge', { dockOpen: true })
    })
    const target = view.container.querySelector<HTMLButtonElement>('[data-ops-dock-toggle]')!
    fireEvent.keyDown(target, { key: 'Escape' })
    expect(loadScope('local', 'judge').dockOpen).toBe(false)
    expect(loadScope('local', 'judge').inspectorOpen).toBe(true)
    fireEvent.keyDown(target, { key: 'Escape' })
    expect(loadScope('local', 'judge').inspectorOpen).toBe(false)
  })

  it('productive shell: focus-owned G-chords, tabs, filter, and scoped disposal without background focus', async () => {
    setInspectorOpen('local', 'judge', false)
    const props = { connectionId: 'local', profile: 'judge', paneWidth: 1300 }

    const view = render(
      <I18nProvider>
        <OpsShell {...props} />
      </I18nProvider>
    )

    const target = view.container.querySelector<HTMLButtonElement>('[data-ops-dock-toggle]')!
    target.focus()
    fireEvent.keyDown(target, { key: 'g', code: 'KeyG' })
    fireEvent.keyDown(target, { key: 'b', code: 'KeyB' })
    expect(loadScope('local', 'judge').selectedTabId).toBe('board')
    fireEvent.keyDown(target, { key: 'Tab', code: 'Tab', ctrlKey: true })
    expect(loadScope('local', 'judge').selectedTabId).toBe('office')
    fireEvent.keyDown(target, { key: '/', code: 'Slash' })
    await waitFor(() => expect(document.activeElement?.getAttribute('data-ops-filter')).toBe(''))
    const field = document.activeElement!
    fireEvent.keyDown(field, { key: 'g', code: 'KeyG' })
    fireEvent.keyDown(field, { key: 'c', code: 'KeyC' })
    expect(loadScope('local', 'judge').selectedTabId).toBe('office')
    target.focus()
    fireEvent.keyDown(target, { key: ']', code: 'BracketRight', isComposing: true })
    expect(loadScope('local', 'judge').inspectorOpen).toBe(false)
    view.rerender(
      <I18nProvider>
        <OpsShell {...props} problems={[{ id: 'p', summary: 'p' }]} />
      </I18nProvider>
    )
    expect(document.activeElement).toBe(target)
    expect(readOpsPaletteScope()).toEqual({ connectionId: 'local', profile: 'judge' })
    view.rerender(
      <I18nProvider>
        <OpsShell {...props} connectionId="remote" profile="sandhi" />
      </I18nProvider>
    )
    expect(readOpsPaletteScope()).toEqual({ connectionId: 'remote', profile: 'sandhi' })
    view.rerender(
      <I18nProvider>
        <OpsShell {...props} active={false} />
      </I18nProvider>
    )
    expect(readOpsPaletteScope()).toEqual({ connectionId: '', profile: '' })
    expect(opsHost()).toBeNull()
    expect(statusIds('left').filter(id => id.startsWith('ops-'))).toEqual([])
  })

  it('productive OpsPane reads pinned backend observations and never publishes a late old-profile response', async () => {
    const pending: { request: HermesApiRequest; resolve: (value: unknown) => void }[] = []
    vi.stubGlobal('hermesDesktop', {
      api: vi.fn(
        (request: HermesApiRequest) =>
          new Promise(resolve => {
            pending.push({ request, resolve })
          })
      )
    })
    $opsScope.set({ connectionId: 'local', profile: 'judge', remote: false, label: 'Local' })
    $opsOpen.set(true)
    $opsFullscreen.set(true)

    const view = render(
      <I18nProvider>
        <OpsPane />
        <Slot area="titleBar.center" />
      </I18nProvider>
    )

    expect(pending.filter(item => item.request.path === '/api/status').map(item => item.request)).toEqual([
      { connectionId: 'local', profile: 'judge', path: '/api/status' }
    ])
    const old = pending.slice()
    act(() => {
      $opsScope.set({ connectionId: 'remote', profile: 'sandhi', remote: true, label: 'Remote' })
    })
    const current = pending.filter(item => item.request.profile === 'sandhi')
    await act(async () => {
      for (const item of old) {
        item.resolve({ version: 'OLD', gateway_running: true, provider: 'xai', model: 'OLD', daily: [] } as never)
      }

      for (const item of current) {
        item.resolve({
          version: '0.21.5',
          gateway_running: true,
          gateway_state: 'running',
          provider: 'xai',
          model: 'grok-4.7',
          daily: []
        } as never)
      }
    })
    await waitFor(() => expect(view.container.querySelector('[data-ops-model-chip]')?.textContent).toContain('sandhi'))
    expect(view.container.querySelector('[data-ops-model-chip]')?.textContent).not.toContain('OLD')
    expect(statusIds('left')).not.toContain('ops-working')
    expect(statusIds('left')).not.toContain('ops-tokens')
    expect(statusIds('right')).toContain('ops-gateway')
    expect(view.container.querySelector('[data-ops-model-chip]')?.getAttribute('data-model-connection')).toBe('remote')
    act(() => {
      $opsOpen.set(false)
    })
    expect(view.container.querySelector('[data-ops-model-chip]')).toBeNull()
    expect(opsHost()).toBeNull()
  })
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
    expect(chip.getAttribute('aria-description')).toMatch(/A5\/A6/)
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
      {},
      en.ops
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
    expect(
      registry.getArea('statusBar.left').filter(item => String(item.id).startsWith(`${OPS_STATUSBAR_GROUP}-`)).length
    ).toBeGreaterThan(0)
    expect(
      registry
        .getArea('statusBar.right')
        .filter(item => item.id === 'ops-problems' || String(item.id).startsWith('ops-'))
    ).not.toHaveLength(0)
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

  it('productive shell: Esc closes sheet, inspector, then dock in opening order', async () => {
    const onExitFullscreen = vi.fn()
    const deny = document.createElement('button')
    deny.dataset.approvalDeny = ''
    const onDeny = vi.fn()
    deny.addEventListener('click', onDeny)
    document.body.append(deny)

    resetOpsNavigationForTests()
    setInspectorOpen('local', 'judge', false)

    const view = render(
      <I18nProvider>
        <OpsShell
          connectionId="local"
          fullscreen
          onToggleFullscreen={onExitFullscreen}
          paneWidth={600}
          profile="judge"
        />
        <Slot area="titleBar.center" />
      </I18nProvider>
    )

    act(() => {
      setDock('local', 'judge', { dockOpen: true })
    })
    act(() => {
      setInspectorOpen('local', 'judge', true)
    })
    const trigger = view.container.querySelector<HTMLButtonElement>('[data-ops-inspector-toggle]')!
    trigger.focus()
    act(() => {
      opsHost()?.openShortcutSheet()
    })
    expect(screen.getByRole('dialog', { name: 'Ops shortcuts' })).toBeTruthy()

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Ops shortcuts' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Ops shortcuts' })).toBeNull()
    expect(onExitFullscreen).not.toHaveBeenCalled()
    expect(onDeny).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(loadScope('local', 'judge').inspectorOpen).toBe(false)
    expect(loadScope('local', 'judge').dockOpen).toBe(true)
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(loadScope('local', 'judge').dockOpen).toBe(false)
    expect(onExitFullscreen).not.toHaveBeenCalled()
    expect(onDeny).not.toHaveBeenCalled()
  })
})
