import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { routeCloseTabChord } from '@/app/chat/close-tab'
import { Command, CommandInput, CommandList } from '@/components/ui/command'
import { I18nProvider } from '@/i18n'
import {
  $commandPaletteOpen,
  $commandPalettePage,
  closeCommandPalette,
  openCommandPalettePage
} from '@/store/command-palette'

import {
  claimOpsFocusedChord,
  claimOpsRootKey,
  focusNextApproval,
  G_LEADER_MS,
  opsFocusOwns,
  type OpsKeymapHost,
  type OpsTabClose,
  registerOpsKeymapHost,
  resetOpsKeymapForTests,
  setOpsKeymapClock
} from './keymap'
import {
  finishOpsPaletteCommand,
  OpsPalettePage,
  readRecentSearches,
  rememberOpsSearch,
  setOpsPaletteScope
} from './palette'

function key(target: EventTarget, init: KeyboardEventInit, combo: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(event, 'target', { value: target })

  return event
}

function host(partial: Partial<OpsKeymapHost> = {}): OpsKeymapHost {
  return {
    cycleTabs: vi.fn(),
    openSettings: vi.fn(),
    closeFocusedTab: vi.fn<() => OpsTabClose>(() => 'closed'),
    focusRailFilter: vi.fn(),
    go: vi.fn(),
    newTask: vi.fn(),
    openShortcutSheet: vi.fn(),
    editFocused: vi.fn(),
    toggleRail: vi.fn(),
    toggleInspector: vi.fn(),
    toggleDock: vi.fn(),
    moveSelection: vi.fn(),
    openFocused: vi.fn(),
    history: vi.fn(),
    focusNextApproval: vi.fn(),
    exitFullscreen: vi.fn(),
    ...partial
  }
}

function opsButton(): HTMLButtonElement {
  const root = document.createElement('div')
  root.dataset.opsRoot = ''
  const button = document.createElement('button')
  button.textContent = 'row'
  button.dataset.opsRow = ''
  root.append(button)
  document.body.append(root)
  button.focus()

  return button
}

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  setOpsPaletteScope({ connectionId: '', profile: '' })
  cleanup()
  closeCommandPalette()
  resetOpsKeymapForTests()
  localStorage.clear()
  document.body.replaceChildren()
})

describe('Ops keymap', () => {
  it('owns the focused pane, not a hovered one, and stands down for typing and IME', () => {
    const button = opsButton()
    const outside = document.createElement('button')
    document.body.append(outside)

    expect(opsFocusOwns(button)).toBe(true)
    expect(opsFocusOwns(outside)).toBe(false)

    const field = document.createElement('input')
    button.parentElement?.append(field)
    expect(opsFocusOwns(field)).toBe(false)

    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    button.parentElement?.append(editable)
    expect(opsFocusOwns(editable)).toBe(false)
    expect(opsFocusOwns(button, { isComposing: true, key: 'Process' })).toBe(false)

    const claimed = claimOpsRootKey(key(field, { key: 'g', code: 'KeyG' }, 'g'), 'g')
    expect(claimed).toBe(false)
  })

  it('implements G-chords, rail filter, history, and settings without claiming Ctrl+J', () => {
    const button = opsButton()
    let now = 1_000
    setOpsKeymapClock(() => now)
    const api = host()
    registerOpsKeymapHost(api)

    expect(claimOpsRootKey(key(button, { key: 'g' }, 'g'), 'g')).toBe(true)
    expect(api.go).not.toHaveBeenCalled()
    expect(claimOpsRootKey(key(button, { key: 'r' }, 'r'), 'r')).toBe(true)
    expect(api.go).toHaveBeenCalledWith('runs')
    now += G_LEADER_MS + 1
    expect(claimOpsRootKey(key(button, { key: '/' }, '/'), '/')).toBe(true)
    expect(api.focusRailFilter).toHaveBeenCalledOnce()
    expect(claimOpsRootKey(key(button, { key: 'ArrowLeft', altKey: true }, 'alt+left'), 'alt+left')).toBe(true)
    expect(api.history).toHaveBeenCalledWith(-1)
    expect(claimOpsFocusedChord(key(button, { key: ',', ctrlKey: true }, 'mod+,'), 'mod+,')).toBe(true)
    expect(api.openSettings).toHaveBeenCalledOnce()
    expect(claimOpsFocusedChord(key(button, { key: 'j', ctrlKey: true }, 'mod+j'), 'mod+j')).toBe(false)
    expect(api.toggleDock).not.toHaveBeenCalled()
  })

  it('cycles Ops tabs and opens the existing palette page', () => {
    const button = opsButton()
    const api = host()
    registerOpsKeymapHost(api)

    expect(claimOpsFocusedChord(key(button, { key: 'Tab', ctrlKey: true }, 'ctrl+tab'), 'ctrl+tab')).toBe(true)
    expect(api.cycleTabs).toHaveBeenCalledWith(1)
    expect(claimOpsFocusedChord(key(button, { key: 'k', ctrlKey: true }, 'mod+k'), 'mod+k')).toBe(true)
    expect($commandPalettePage.get()).toBe('ops')
  })

  it('Ctrl+W closes a non-pinned Ops tab and never the window', () => {
    const button = opsButton()
    const closeWindow = vi.spyOn(window, 'close').mockImplementation(() => undefined)
    const api = host({ closeFocusedTab: vi.fn<() => OpsTabClose>(() => 'closed') })
    registerOpsKeymapHost(api)

    expect(routeCloseTabChord('after-pty', undefined, button)).toBe('ops-closed')
    expect(api.closeFocusedTab).toHaveBeenCalledOnce()
    expect(closeWindow).not.toHaveBeenCalled()

    api.closeFocusedTab = vi.fn<() => OpsTabClose>(() => 'pinned')
    registerOpsKeymapHost(api)
    expect(routeCloseTabChord('after-pty', undefined, button)).toBe('ops-pinned-consumed')
    expect(closeWindow).not.toHaveBeenCalled()
    closeWindow.mockRestore()
  })

  it('Enter opens the focused row and no shortcut approves', () => {
    const button = opsButton()
    const run = document.createElement('button')
    run.dataset.approvalRun = ''
    const onRun = vi.fn()
    run.addEventListener('click', onRun)
    document.body.append(run)
    const next = document.createElement('button')
    next.dataset.opsNextApproval = ''
    next.tabIndex = 0
    button.parentElement?.append(next)
    const api = host()
    registerOpsKeymapHost(api)

    expect(claimOpsRootKey(key(button, { key: 'Enter' }, 'enter'), 'enter')).toBe(true)
    expect(api.openFocused).toHaveBeenCalledOnce()
    expect(onRun).not.toHaveBeenCalled()

    focusNextApproval()
    expect(document.activeElement).toBe(next)
    expect(onRun).not.toHaveBeenCalled()
  })
})

describe('Ops palette page', () => {
  it('existing palette Dialog: ArrowDown selects an Ops cmdk item and closes before navigation/focus', async () => {
    const { CommandPalette } = await import('@/app/command-palette')
    setOpsPaletteScope({ connectionId: 'local', profile: 'judge' })

    const go = vi.fn(() => {
      expect($commandPaletteOpen.get()).toBe(false)
    })

    registerOpsKeymapHost(host({ go }))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <CommandPalette />
          </I18nProvider>
        </QueryClientProvider>
      </MemoryRouter>
    )
    act(() => {
      openCommandPalettePage('ops')
    })
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' })
    await waitFor(() => {
      const id = input.getAttribute('aria-activedescendant')
      expect(id).toBeTruthy()
      expect(document.getElementById(id!)?.hasAttribute('data-ops-command')).toBe(true)
    })
    fireEvent.click(screen.getByRole('option', { name: 'Go to Runs' }))
    expect($commandPaletteOpen.get()).toBe(false)
    expect(go).not.toHaveBeenCalled()
    await waitFor(() => expect(go).toHaveBeenCalledWith('runs'))
    expect(document.querySelector('[cmdk-root]')).toBeNull()
    const next = opsButton()
    next.dataset.opsNextApproval = ''
    const approve = vi.fn()
    next.addEventListener('click', approve)
    registerOpsKeymapHost(host({ focusNextApproval }))
    act(() => {
      openCommandPalettePage('ops')
    })
    fireEvent.click(screen.getByRole('option', { name: 'Go to next approval' }))
    await waitFor(() => expect(document.activeElement).toBe(next))
    expect(approve).not.toHaveBeenCalled()
    act(() => {
      openCommandPalettePage('ops', 'theme')
    })
    fireEvent.click(screen.getByRole('option', { name: 'Switch theme' }))
    await waitFor(() => {
      expect($commandPaletteOpen.get()).toBe(true)
      expect(document.querySelector('[data-ops-palette-page]')).toBeNull()
      expect(document.querySelectorAll('[cmdk-root]')).toHaveLength(1)
    })
    queryClient.clear()
  }, 60_000)

  it('malformed scoped recent-search arrays are repaired and scope changes cancel queued actions', async () => {
    setOpsPaletteScope({ connectionId: 'local', profile: 'judge' })
    localStorage.setItem('hermes.desktop.opsRecentSearch.v1', JSON.stringify({ ['local\0judge']: 7 }))
    rememberOpsSearch('office')
    expect(readRecentSearches()).toEqual(['office'])
    const go = vi.fn()
    registerOpsKeymapHost(host({ go }))
    render(
      <Command shouldFilter={false}>
        <CommandList>
          <OpsPalettePage search="runs" />
        </CommandList>
      </Command>
    )
    fireEvent.click(screen.getByRole('option', { name: 'Go to Runs' }))
    setOpsPaletteScope({ connectionId: 'remote', profile: 'judge' })
    finishOpsPaletteCommand(new Event('closeAutoFocus', { cancelable: true }))
    await act(async () => {})
    expect(go).not.toHaveBeenCalled()
  })
  it('keeps future mutations disabled and scopes recent searches', () => {
    setOpsPaletteScope({ connectionId: 'local', profile: 'judge' })
    rememberOpsSearch('office', { connectionId: 'local', profile: 'judge' })
    rememberOpsSearch('secret', { connectionId: 'remote', profile: 'other' })

    render(
      <Command shouldFilter={false}>
        <CommandInput />
        <CommandList>
          <OpsPalettePage search="" />
        </CommandList>
      </Command>
    )

    expect(screen.getByRole('option', { name: /Create task/ }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('option', { name: /Create task/ }).getAttribute('data-ops-disabled-reason')).toMatch(
      /A5\/A6/
    )
    expect(screen.getByRole('option', { name: /Set model/ }).getAttribute('title')).toMatch(/A5\/A6/)
    expect(screen.getByText('office')).toBeTruthy()
    expect(screen.queryByText('secret')).toBeNull()
    expect(readRecentSearches({ connectionId: 'remote', profile: 'other' })).toEqual(['secret'])

    const go = vi.fn()
    registerOpsKeymapHost(host({ go }))
    fireEvent.click(screen.getByRole('option', { name: 'Go to Runs' }))
    expect(go).not.toHaveBeenCalled()

    const run = document.createElement('button')
    run.dataset.approvalRun = ''
    const onRun = vi.fn()
    run.addEventListener('click', onRun)
    document.body.append(run)
    fireEvent.click(screen.getByRole('option', { name: 'Go to next approval' }))
    expect(onRun).not.toHaveBeenCalled()
  })
})
