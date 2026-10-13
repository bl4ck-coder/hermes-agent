import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { $hiddenTreePanes, $layoutTree } from '@/components/pane-shell/tree/store'
import { group, split } from '@/components/pane-shell/tree/model'
import { registry } from '@/contrib/registry'
import { pushEscapeLayer } from '@/lib/escape-layers'
import { onPersistenceEvent } from '@/lib/storage'

import { OpsShell } from './index'
import {
  $opsChatSessionId,
  $opsFullscreen,
  $opsLiveSession,
  $opsScope,
  $opsView,
  $opsWidthPx,
  CHAT_MIN_WIDTH_PX,
  clampOpsWidth,
  dropOpsSplitForProfile,
  loadOpsScope,
  migrateOpsSplitForProfile,
  narrowStrategy,
  OPS_DEFAULT_WIDTH_PX,
  OPS_GUTTER_PX,
  OPS_MIN_WIDTH_PX,
  OPS_SPLIT_STORAGE_KEY,
  readOpsLayout,
  resizeOpsSplit,
  type OpsScope
} from './layout-store'
import {
  activateLiveSessionBadge,
  ensureOpsSplitHost,
  enterOpsFullscreen,
  exitOpsFullscreen,
  focusExistingChat,
  handleOpsEscape,
  LiveSessionBadge,
  noteOpsBackgroundEvent,
  opsPaneRegistration,
  toggleOpsFullscreen
} from './split-host'

const localScope: OpsScope = { connectionId: 'local', profile: 'default', remote: false, label: 'local' }
const remoteScope: OpsScope = { connectionId: 'remote-1', profile: 'judge', remote: true, label: 'bench' }

afterEach(() => {
  cleanup()
  localStorage.removeItem(OPS_SPLIT_STORAGE_KEY)
  $opsFullscreen.set(false)
  $opsLiveSession.set(null)
  $opsView.set('office')
  $opsWidthPx.set(OPS_DEFAULT_WIDTH_PX)
  $opsScope.set(localScope)
  $hiddenTreePanes.set(new Set())
  $layoutTree.set(null)
})

describe('ops split layout store', () => {
  it('clamps so chat and Ops both stay usable', () => {
    expect(clampOpsWidth(900, 1000)).toBe(1000 - CHAT_MIN_WIDTH_PX)
    expect(clampOpsWidth(10, 1000)).toBe(OPS_MIN_WIDTH_PX)
    expect(clampOpsWidth(OPS_DEFAULT_WIDTH_PX, 1600)).toBe(OPS_DEFAULT_WIDTH_PX)
  })

  it('persists width per connection and profile and reloads it', () => {
    resizeOpsSplit(500, 1600, localScope)
    resizeOpsSplit(420, 1600, remoteScope)

    expect(readOpsLayout('local', 'default').widthPx).toBe(500)
    expect(readOpsLayout('remote-1', 'judge').widthPx).toBe(420)

    $opsWidthPx.set(1)
    loadOpsScope(remoteScope)
    expect($opsWidthPx.get()).toBe(420)
    loadOpsScope(localScope)
    expect($opsWidthPx.get()).toBe(500)
  })

  it('writes only the scoped ops key, not the global layout tree key', () => {
    const keys: string[] = []
    const stop = onPersistenceEvent(event => {
      if (event.op === 'write') {
        keys.push(event.key)
      }
    })

    resizeOpsSplit(510, 1600, localScope)
    stop()

    expect(keys).toEqual([OPS_SPLIT_STORAGE_KEY])
    expect(keys.some(key => key.includes('layoutTree') || key.includes('paneShare'))).toBe(false)
  })

  it('moves a local profile key and drops a deleted profile', () => {
    resizeOpsSplit(450, 1600, { ...localScope, profile: 'old' })
    migrateOpsSplitForProfile('old', 'new')

    expect(readOpsLayout('local', 'new').widthPx).toBe(450)
    expect(readOpsLayout('local', 'old').widthPx).toBe(OPS_DEFAULT_WIDTH_PX)

    dropOpsSplitForProfile('new')
    expect(readOpsLayout('local', 'new').widthPx).toBe(OPS_DEFAULT_WIDTH_PX)
  })

  it('applies the audited narrow-pane strategy on the pane width', () => {
    expect(narrowStrategy(1400).inspector).toBe('docked')
    expect(narrowStrategy(1400).rail).toBe('full')
    expect(narrowStrategy(1400).tabs).toBe('strip')
    expect(narrowStrategy(1100).inspector).toBe('overlay')
    expect(narrowStrategy(1100).rail).toBe('full')
    expect(narrowStrategy(900).rail).toBe('icons')
    expect(narrowStrategy(700).tabs).toBe('dropdown')
    expect(narrowStrategy(700, 'hidden').rail).toBe('hidden')
  })
})

describe('ops split host', () => {
  it('registers a native pane on the layout tree, not a plugin route', () => {
    ensureOpsSplitHost()
    const pane = opsPaneRegistration()
    const data = pane?.data as { dock?: { pane: string; pos: string }; width?: string; lifecycleKeepAlive?: boolean }

    expect(pane?.area).toBe('panes')
    expect(pane?.source).toBe('core')
    expect(data.dock).toEqual({ pane: 'workspace', pos: 'right' })
    expect(data.lifecycleKeepAlive).toBe(true)
    expect(data.width).toMatch(/px$/)
    expect(registry.getArea('routes').some(entry => entry.id === 'ops' || String((entry.data as { path?: string })?.path).startsWith('/ops'))).toBe(
      false
    )
    expect(registry.getArea('titleBar.center').some(entry => entry.id === 'ops-live-badge')).toBe(true)
  })

  it('round-trips full screen without changing the chat session or the split width', () => {
    $layoutTree.set(split('row', [group(['workspace']), group(['ops'])], [1, 1]))
    $opsChatSessionId.set('session-9')
    resizeOpsSplit(480, 1600, localScope)
    const before = document.createElement('textarea')
    document.body.append(before)
    before.focus()

    enterOpsFullscreen()
    expect($hiddenTreePanes.get().has('workspace')).toBe(true)
    expect($hiddenTreePanes.get().has('ops')).toBe(false)
    expect($opsFullscreen.get()).toBe(true)
    expect($opsChatSessionId.get()).toBe('session-9')
    expect(document.activeElement).toBe(before)

    exitOpsFullscreen()
    expect($hiddenTreePanes.get().has('workspace')).toBe(false)
    expect($opsFullscreen.get()).toBe(false)
    expect($opsWidthPx.get()).toBe(480)
    expect($opsChatSessionId.get()).toBe('session-9')
    expect(document.activeElement).toBe(before)
    before.remove()
  })

  it('restores on Esc only when full-screen is the top layer', () => {
    $layoutTree.set(split('row', [group(['workspace']), group(['ops'])]))
    enterOpsFullscreen()
    const ignored = { key: 'Escape', defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }

    const higher = pushEscapeLayer(15)
    expect(handleOpsEscape(ignored)).toBe(false)
    expect($opsFullscreen.get()).toBe(true)
    higher()

    const event = { key: 'Escape', defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
    expect(handleOpsEscape(event)).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect($opsFullscreen.get()).toBe(false)
  })

  it('shows the live-session badge only in full screen and focuses chat without a new session', () => {
    $opsLiveSession.set({ id: 'session-9', title: 'mirror thread', working: true })
    $opsChatSessionId.set('session-9')
    const { rerender } = render(<LiveSessionBadge />)

    expect(screen.queryByRole('button', { name: 'mirror thread' })).toBeNull()

    $opsFullscreen.set(true)
    rerender(<LiveSessionBadge />)
    const chat = document.createElement('div')
    chat.setAttribute('data-session-anchor', 'workspace')
    const composer = document.createElement('textarea')
    chat.append(composer)
    document.body.append(chat)

    fireEvent.click(screen.getByRole('button', { name: 'mirror thread' }))

    expect($opsFullscreen.get()).toBe(false)
    expect(document.activeElement).toBe(composer)
    expect($opsChatSessionId.get()).toBe('session-9')
    chat.remove()
  })

  it('ignores background events and context switches', () => {
    $opsView.set('canvas')
    const focused = document.createElement('button')
    document.body.append(focused)
    focused.focus()

    noteOpsBackgroundEvent()
    loadOpsScope(remoteScope)

    expect($opsView.get()).toBe('canvas')
    expect(document.activeElement).toBe(focused)
    expect($opsScope.get().connectionId).toBe('remote-1')
    focused.remove()
  })

  it('renders an honest unavailable view, one gutter, and no second chrome', () => {
    render(
      <OpsShell
        fullscreen={false}
        inspectorOpen
        narrow={narrowStrategy(700, 'full')}
        onBackToChats={() => undefined}
        onCopyLink={() => undefined}
        onInspector={() => undefined}
        onOpenChat={() => undefined}
        onRail={() => undefined}
        onToggleFullscreen={toggleOpsFullscreen}
        onView={() => undefined}
        paneWidth={700}
        railPreference="full"
        scope={remoteScope}
        view="office"
        viewId={null}
      />
    )

    const root = document.querySelector('[data-ops-root]')
    expect(root?.getAttribute('data-ops-gutter')).toBe(String(OPS_GUTTER_PX))
    expect(root?.getAttribute('data-ops-inspector')).toBe('overlay')
    expect(root?.getAttribute('data-ops-rail')).toBe('icons')
    expect(root?.getAttribute('data-ops-tabs')).toBe('dropdown')
    expect(root?.getAttribute('data-ops-sash')).toBe('layout-tree')
    expect(screen.getByText(/not available yet/)).toBeTruthy()
    expect(screen.getByText(/read-only/)).toBeTruthy()
    expect(root?.textContent).not.toMatch(/182k|3 working|mock/)
    expect(root?.querySelector('textarea, [data-composer], [data-model-chip]')).toBeNull()
    expect(root?.querySelector('[data-titlebar], [data-statusbar]')).toBeNull()
  })

  it('focusExistingChat does not clear the session id', () => {
    $opsChatSessionId.set('keep-me')
    focusExistingChat()
    expect($opsChatSessionId.get()).toBe('keep-me')
  })
})
