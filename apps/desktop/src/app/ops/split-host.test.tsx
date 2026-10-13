import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { type ReactNode, useEffect } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChatView } from '@/app/chat'
import { group, split } from '@/components/pane-shell/tree/model'
import { LayoutTreeRoot } from '@/components/pane-shell/tree/renderer'
import { $hiddenTreePanes, $layoutTree, $releaseMainFloor } from '@/components/pane-shell/tree/store'
import { registry } from '@/contrib/registry'
import { I18nProvider } from '@/i18n'
import { pushEscapeLayer } from '@/lib/escape-layers'
import { onPersistenceEvent } from '@/lib/storage'
import { $selectedStoredSessionId } from '@/store/session'
import { stubResizeObserver } from '@/test/jsdom'

import {
  $opsChatSessionId,
  $opsFullscreen,
  $opsLiveSession,
  $opsRail,
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
  type OpsScope,
  planOpsFit,
  readOpsLayout,
  resizeOpsSplit,
  resolveOpsPaneBox,
  writeOpsLayout,
} from './layout-store'
import {
  closeOpsSplit,
  ensureOpsSplitHost,
  enterOpsFullscreen,
  fitOpsFromStorage,
  focusExistingChat,
  handleOpsEscape,
  LiveSessionBadge,
  noteOpsBackgroundEvent,
  noteOpsScope,
  openOpsSplit,
  opsPaneRegistration,
  resetOpsScopeHydrationForTests,
  toggleOpsFullscreen,
  watchOpsLiveSession
} from './split-host'

import { OpsShell } from './index'

const localScope: OpsScope = { connectionId: 'local', profile: 'default', remote: false, label: 'local' }
const remoteScope: OpsScope = { connectionId: 'remote-1', profile: 'judge', remote: true, label: 'bench' }

let chatMounts = 0
let chatUnmounts = 0

function CountingChat({ children }: { children: ReactNode }) {
  useEffect(() => {
    chatMounts += 1

    return () => {
      chatUnmounts += 1
    }
  }, [])

  return children
}

afterEach(() => {
  cleanup()
  localStorage.removeItem(OPS_SPLIT_STORAGE_KEY)
  $opsFullscreen.set(false)
  $opsLiveSession.set(null)
  $opsView.set('office')
  $opsWidthPx.set(OPS_DEFAULT_WIDTH_PX)
  $opsRail.set('full')
  $opsScope.set(localScope)
  resetOpsScopeHydrationForTests()
  $hiddenTreePanes.set(new Set())
  $releaseMainFloor.set(false)
  $layoutTree.set(null)
})

describe('ops split layout store', () => {
  it('clamps so chat and Ops both stay usable', () => {
    expect(clampOpsWidth(900, 1000)).toBe(1000 - CHAT_MIN_WIDTH_PX)
    expect(clampOpsWidth(10, 1000)).toBe(OPS_MIN_WIDTH_PX)
    expect(clampOpsWidth(OPS_DEFAULT_WIDTH_PX, 1600)).toBe(OPS_DEFAULT_WIDTH_PX)
    expect(clampOpsWidth(480, 640)).toBe(320)
    expect(clampOpsWidth(510, 403)).toBe(83)
    expect(clampOpsWidth(480, 640) + CHAT_MIN_WIDTH_PX).toBeLessThanOrEqual(640)
    expect(clampOpsWidth(510, 403) + CHAT_MIN_WIDTH_PX).toBeLessThanOrEqual(403)
  })

  it('frees a docked rail at a 640 viewport so both floors fit, and does not overflow a tighter room', () => {
    const freed = planOpsFit({ room: 403, railWidth: 237, railsDocked: true })

    expect(freed).toEqual({ hideRails: true, room: 640 })
    expect(resolveOpsPaneBox(480, freed.room)).toEqual({ widthPx: 320, minWidthPx: OPS_MIN_WIDTH_PX, maxWidth: '80vw' })
    expect(resolveOpsPaneBox(480, 403)).toEqual({ widthPx: 83, minWidthPx: 83, maxWidth: '83px' })
    expect(resolveOpsPaneBox(510, 0).widthPx).toBe(510)
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

  it('keeps the real chat surface mounted across full-screen', async () => {
    stubResizeObserver()
    vi.stubGlobal('CSS', { ...globalThis.CSS, escape: (value: string) => value })
    const frames: FrameRequestCallback[] = []
    const realFrame = window.requestAnimationFrame.bind(window)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)

      return frames.length
    })

    const flushFrames = () => {
      for (let pass = 0; pass < 4 && frames.length > 0; pass += 1) {
        const pending = frames.splice(0)

        for (const cb of pending) {
          cb(0)
        }
      }
    }

    chatMounts = 0
    chatUnmounts = 0
    const noop = () => undefined

    const disposeChat = registry.register({
      area: 'panes',
      data: { lifecycleKeepAlive: true, placement: 'main', uncloseable: true },
      id: 'workspace',
      render: () => (
        <CountingChat>
          <ChatView
            gateway={null}
            onAddContextRef={noop}
            onAddUrl={noop}
            onAttachDroppedItems={noop}
            onAttachImageBlob={noop}
            onCancel={noop}
            onDeleteSelectedSession={noop}
            onEdit={async () => undefined}
            onPasteClipboardImage={noop}
            onPickFiles={noop}
            onPickFolders={noop}
            onPickImages={noop}
            onReload={async () => undefined}
            onRemoveAttachment={noop}
            onRetryResume={noop}
            onSteer={() => true}
            onSubmit={() => true}
            onThreadMessagesChange={noop}
            onToggleSelectedPin={noop}
          />
        </CountingChat>
      ),
      source: 'core',
      title: 'Chat'
    })

    writeOpsLayout('local', 'default', { widthPx: 510, rail: 'hidden' })
    $opsWidthPx.set(510)
    $selectedStoredSessionId.set('session-9')
    $opsChatSessionId.set('session-9')
    ensureOpsSplitHost()
    act(() => {
      $layoutTree.set(split('row', [group(['workspace'], { id: 'grp-main' }), group(['ops'], { id: 'grp-ops' })]))
    })

    try {
      render(
        <MemoryRouter>
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <I18nProvider configClient={null} initialLocale="en">
              <LayoutTreeRoot />
            </I18nProvider>
          </QueryClientProvider>
        </MemoryRouter>
      )

      const anchor = await waitFor(() => {
        const node = document.querySelector<HTMLElement>('[data-session-anchor="workspace"]')
        expect(node?.isConnected).toBe(true)

        return node!
      })

      const composer = await waitFor(() => {
        const node = anchor.querySelector<HTMLElement>('[data-slot="composer-rich-input"]')
        expect(node).toBeTruthy()

        return node!
      })

      const viewport = anchor.querySelector<HTMLElement>('[data-slot="aui_thread-viewport"]')

      composer.textContent = 'draft-survives'
      fireEvent.input(composer)
      composer.focus()

      if (viewport) {
        viewport.scrollTop = 144
      }

      expect(document.activeElement).toBe(composer)
      expect(chatMounts).toBe(1)
      expect(chatUnmounts).toBe(0)

      act(() => {
        enterOpsFullscreen()
      })
      flushFrames()

      expect($hiddenTreePanes.get().has('workspace')).toBe(false)
      expect($hiddenTreePanes.get().has('ops')).toBe(false)
      expect($opsFullscreen.get()).toBe(true)
      expect($releaseMainFloor.get()).toBe(true)
      expect(anchor.isConnected).toBe(true)
      expect(document.querySelector('[data-session-anchor="workspace"]')).toBe(anchor)
      expect(composer.isConnected).toBe(true)
      expect(composer.textContent).toBe('draft-survives')
      expect(anchor.contains(composer)).toBe(true)

      if (viewport) {
        expect(viewport.isConnected).toBe(true)
        expect(viewport.scrollTop).toBe(144)
      }

      expect(chatUnmounts).toBe(0)
      expect(anchor.closest('[data-pane-host="workspace"]')).toBeTruthy()
      expect((opsPaneRegistration()?.data as { width?: string; maxWidth?: string }).width).toBe('100%')
      expect((opsPaneRegistration()?.data as { maxWidth?: string }).maxWidth).toBeUndefined()
      const mainWrap = document.querySelector('[data-tree-group="grp-main"]')?.parentElement
      expect(mainWrap?.style.display).toBe('none')

      const event = { key: 'Escape', defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
      act(() => {
        expect(handleOpsEscape(event)).toBe(true)
      })
      flushFrames()

      expect($opsFullscreen.get()).toBe(false)
      expect($releaseMainFloor.get()).toBe(false)
      expect($hiddenTreePanes.get().has('workspace')).toBe(false)
      expect($opsWidthPx.get()).toBe(510)
      expect((opsPaneRegistration()?.data as { width?: string }).width).toBe('510px')
      expect($opsChatSessionId.get()).toBe('session-9')
      expect(anchor.isConnected).toBe(true)
      expect(document.querySelector('[data-session-anchor="workspace"]')).toBe(anchor)
      expect(composer.isConnected).toBe(true)
      expect(composer.textContent).toBe('draft-survives')
      expect(chatUnmounts).toBe(0)
      expect(document.activeElement).toBe(composer)

      if (viewport) {
        expect(viewport.scrollTop).toBe(144)
      }
    } finally {
      disposeChat()
      $selectedStoredSessionId.set(null)
      window.requestAnimationFrame = realFrame
    }
  }, 60_000)

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

  it('shows the badge when the real session dot goes idle to working, without seeding the live atom', async () => {
    const { createClientSessionState } = await import('@/lib/chat-runtime')
    const session = await import('@/store/session')
    const states = await import('@/store/session-states')
    const dots = await import('@/store/session-dot-state')

    const stop = watchOpsLiveSession(session, dots)
    $opsFullscreen.set(true)
    session.$sessions.set([{ id: 'judge-synthetic', title: 'Badge probe', ended_at: null, input_tokens: 0, is_active: true } as never])
    session.$selectedStoredSessionId.set('judge-synthetic')
    states.$sessionStates.set({
      rt: { ...createClientSessionState('judge-synthetic'), busy: false }
    })

    const { rerender } = render(<LiveSessionBadge />)

    expect(screen.queryByRole('button', { name: 'Badge probe' })).toBeNull()
    expect($opsLiveSession.get()?.working).not.toBe(true)

    states.$sessionStates.set({
      rt: { ...createClientSessionState('judge-synthetic'), busy: true }
    })

    await waitFor(() => expect($opsLiveSession.get()?.working).toBe(true))
    rerender(<LiveSessionBadge />)
    expect(screen.getByRole('button', { name: 'Badge probe' })).toBeTruthy()
    expect(session.$busy.get()).toBe(false)
    expect(session.$selectedStoredSessionId.get()).toBe('judge-synthetic')
    stop()
    session.$sessions.set([])
    session.$selectedStoredSessionId.set(null)
    states.$sessionStates.set({})
  }, 60_000)

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
    expect(root?.querySelector('[data-ops-panel="office"]:not([hidden])')?.textContent).toMatch(/not available yet/)
    expect(screen.getAllByText(/not available yet/).length).toBeGreaterThan(0)
    expect(screen.getByText(/read-only/)).toBeTruthy()
    expect(root?.textContent).not.toMatch(/182k|3 working|mock/)
    expect(root?.querySelector('textarea, [data-composer], [data-model-chip]')).toBeNull()
    expect(root?.querySelector('[data-titlebar], [data-statusbar]')).toBeNull()
  })

  it('applies a non-default stored width and rail on boot even when the scope matches the default atom', () => {
    writeOpsLayout('local', 'default', { widthPx: 510, rail: 'hidden' })
    $opsWidthPx.set(OPS_DEFAULT_WIDTH_PX)
    $opsRail.set('full')
    $opsScope.set(localScope)
    resetOpsScopeHydrationForTests()

    noteOpsScope(localScope)

    expect($opsWidthPx.get()).toBe(510)
    expect($opsRail.get()).toBe('hidden')
    expect((opsPaneRegistration()?.data as { width?: string }).width).toBe('510px')
    expect(readOpsLayout('local', 'default')).toEqual({ widthPx: 510, rail: 'hidden' })
  })

  it('open applies stored layout instead of the in-memory default', () => {
    writeOpsLayout('local', 'default', { widthPx: 510, rail: 'hidden' })
    $opsWidthPx.set(OPS_DEFAULT_WIDTH_PX)
    $opsRail.set('full')

    openOpsSplit()

    expect($opsWidthPx.get()).toBe(510)
    expect($opsRail.get()).toBe('hidden')
  })

  it('focusExistingChat does not clear the session id', () => {
    $opsChatSessionId.set('keep-me')
    focusExistingChat()
    expect($opsChatSessionId.get()).toBe('keep-me')
  })
})

function stubBox(el: HTMLElement, width: number, left = 0) {
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => width })
  el.getBoundingClientRect = () =>
    ({
      x: left,
      y: 0,
      left,
      top: 0,
      right: left + width,
      bottom: 80,
      width,
      height: 80,
      toJSON() {
        return {}
      }
    }) as DOMRect
}

/**
 * Real keep-alive topology: Ops and chat bodies sit in absolute hosts OUTSIDE
 * [data-tree-split]. Only the empty slot divs live inside the split.
 */
function mountKeepAliveSplit(viewport: number, railWidth: number) {
  const shell = document.createElement('div')
  const opsHost = document.createElement('div')
  opsHost.setAttribute('data-pane-host', 'ops')
  opsHost.setAttribute('data-ops-root', '')
  opsHost.style.position = 'absolute'
  const chatHost = document.createElement('div')
  chatHost.setAttribute('data-pane-host', 'workspace')
  chatHost.setAttribute('data-session-anchor', 'workspace')
  chatHost.style.position = 'absolute'
  shell.append(opsHost, chatHost)

  const split = document.createElement('div')
  split.setAttribute('data-tree-split', 'spl-root')

  const rail = document.createElement('div')
  const railSlot = document.createElement('div')
  railSlot.setAttribute('data-pane-slot', 'sessions')
  const railGroup = document.createElement('div')
  railGroup.setAttribute('data-tree-group', 'g-sessions')
  rail.append(railSlot, railGroup)

  const gutter = document.createElement('div')
  gutter.setAttribute('data-ops-gutter-track', '')

  const main = document.createElement('div')
  const mainSlot = document.createElement('div')
  mainSlot.setAttribute('data-pane-slot', 'workspace')
  main.append(mainSlot)

  const ops = document.createElement('div')
  const opsSlot = document.createElement('div')
  opsSlot.setAttribute('data-pane-slot', 'ops')
  ops.append(opsSlot)

  split.append(rail, gutter, main, ops)

  const tree = document.createElement('div')
  tree.append(split)
  const root = document.createElement('div')
  root.append(tree, shell)
  document.body.append(root)

  stubBox(split, viewport)
  stubBox(rail, railWidth, 0)
  stubBox(railGroup, railWidth, 0)
  stubBox(gutter, 0, railWidth)
  stubBox(main, Math.max(0, viewport - railWidth - 280), railWidth)
  stubBox(ops, 280, viewport - 280)
  stubBox(opsHost, 280, viewport - 280)

  return { split, opsHost, chatHost, rail }
}

function publishedOpsBox() {
  return opsPaneRegistration()?.data as { width?: string; minWidth?: string; maxWidth?: string }
}

describe('ops split room follows the keep-alive slot', () => {
  let disposeRail: (() => void) | null = null

  afterEach(() => {
    disposeRail?.()
    disposeRail = null
    closeOpsSplit()
    document.body.replaceChildren()
  })

  function installRail() {
    disposeRail = registry.register({
      id: 'sessions',
      area: 'panes',
      source: 'core',
      title: 'Sessions',
      data: { placement: 'left', collapsible: true }
    })
    $layoutTree.set(
      split('row', [group(['sessions'], { id: 'g-sessions' }), group(['workspace'], { id: 'g-main' }), group(['ops'], { id: 'g-ops' })], undefined, 'spl-root')
    )
  }

  it('clamps a 640px viewport when the Ops body is outside the split', async () => {
    writeOpsLayout('local', 'default', { widthPx: 510, rail: 'hidden' })
    installRail()
    const { split, opsHost } = mountKeepAliveSplit(640, 237)

    expect(opsHost.closest('[data-tree-split]')).toBeNull()
    expect(document.querySelector('[data-pane-slot="ops"]')?.closest('[data-tree-split]')).toBe(split)

    fitOpsFromStorage()
    await Promise.resolve()

    const box = publishedOpsBox()
    const published = Number.parseInt(box.width ?? '', 10)
    const railHidden = $hiddenTreePanes.get().has('sessions')
    const rail = railHidden ? 0 : 237
    const chat = 640 - rail - published
    const opsRight = rail + chat + published

    expect(published).not.toBe(510)
    expect(chat).toBeGreaterThanOrEqual(CHAT_MIN_WIDTH_PX)
    expect(opsRight).toBeLessThanOrEqual(640)
    expect(railHidden || chat >= CHAT_MIN_WIDTH_PX).toBe(true)
    expect(box.minWidth).toBe(railHidden ? `${OPS_MIN_WIDTH_PX}px` : box.width)
  })

  it('clamps a nested 640px split the same way, with hosts outside the inner split', () => {
    writeOpsLayout('local', 'default', { widthPx: 510, rail: 'hidden' })
    installRail()

    const shell = document.createElement('div')
    const opsHost = document.createElement('div')
    opsHost.setAttribute('data-pane-host', 'ops')
    opsHost.setAttribute('data-ops-root', '')
    opsHost.style.position = 'absolute'
    shell.append(opsHost)

    const outer = document.createElement('div')
    outer.setAttribute('data-tree-split', 'spl-root')
    const rail = document.createElement('div')
    const railSlot = document.createElement('div')
    railSlot.setAttribute('data-pane-slot', 'sessions')
    const railGroup = document.createElement('div')
    railGroup.setAttribute('data-tree-group', 'g-sessions')
    rail.append(railSlot, railGroup)
    const inner = document.createElement('div')
    inner.setAttribute('data-tree-split', 'spl-main')
    const main = document.createElement('div')
    const mainSlot = document.createElement('div')
    mainSlot.setAttribute('data-pane-slot', 'workspace')
    main.append(mainSlot)
    const ops = document.createElement('div')
    const opsSlot = document.createElement('div')
    opsSlot.setAttribute('data-pane-slot', 'ops')
    ops.append(opsSlot)
    inner.append(main, ops)
    outer.append(rail, inner)
    document.body.append(outer, shell)

    stubBox(outer, 640)
    stubBox(rail, 237)
    stubBox(railGroup, 237)
    stubBox(inner, 403)
    stubBox(main, 141)
    stubBox(ops, 280)

    expect(opsHost.closest('[data-tree-split]')).toBeNull()
    expect(document.querySelector('[data-pane-slot="ops"]')?.closest('[data-tree-split]')).toBe(inner)

    const applied = fitOpsFromStorage()
    const railHidden = $hiddenTreePanes.get().has('sessions')
    const railPx = railHidden ? 0 : 237
    const chat = 640 - railPx - applied
    const opsRight = railPx + chat + applied

    expect(applied).toBe(320)
    expect(railHidden).toBe(true)
    expect(chat).toBeGreaterThanOrEqual(CHAT_MIN_WIDTH_PX)
    expect(opsRight).toBeLessThanOrEqual(640)
  })

  it('does not reserve the in-split chat when workspace has no keep-alive slot', () => {
    writeOpsLayout('local', 'default', { widthPx: 510, rail: 'hidden' })
    installRail()

    const splitEl = document.createElement('div')
    splitEl.setAttribute('data-tree-split', 'spl-root')
    const rail = document.createElement('div')
    const railGroup = document.createElement('div')
    railGroup.setAttribute('data-tree-group', 'g-sessions')
    rail.append(railGroup)
    const main = document.createElement('div')
    const chat = document.createElement('div')
    chat.setAttribute('data-session-anchor', 'workspace')
    main.append(chat)
    const ops = document.createElement('div')
    const opsSlot = document.createElement('div')
    opsSlot.setAttribute('data-pane-slot', 'ops')
    ops.append(opsSlot)
    const host = document.createElement('div')
    host.setAttribute('data-pane-host', 'ops')
    host.setAttribute('data-ops-root', '')
    host.style.position = 'absolute'
    splitEl.append(rail, main, ops)
    document.body.append(splitEl, host)
    stubBox(splitEl, 640)
    stubBox(rail, 260)
    stubBox(railGroup, 260)
    stubBox(main, 141, 260)
    stubBox(chat, 141, 260)
    stubBox(ops, 280, 401)
    stubBox(host, 280, 401)

    expect(host.closest('[data-tree-split]')).toBeNull()
    expect(chat.closest('[data-tree-split]')).toBe(splitEl)
    expect(document.querySelector('[data-pane-slot="workspace"]')).toBeNull()

    const applied = fitOpsFromStorage()
    const railHidden = $hiddenTreePanes.get().has('sessions')
    const railPx = railHidden ? 0 : 260
    const chatWidth = 640 - railPx - applied
    const opsRight = railPx + chatWidth + applied

    expect(applied).toBe(320)
    expect(railHidden).toBe(true)
    expect(chatWidth).toBeGreaterThanOrEqual(CHAT_MIN_WIDTH_PX)
    expect(opsRight).toBeLessThanOrEqual(640)
  })

  it('keeps stored 510 at 1280px and does not hide the desktop rail', () => {
    writeOpsLayout('local', 'default', { widthPx: 510, rail: 'hidden' })
    installRail()
    mountKeepAliveSplit(1280, 237)

    const applied = fitOpsFromStorage()

    expect(applied).toBe(510)
    expect(publishedOpsBox().width).toBe('510px')
    expect($opsRail.get()).toBe('hidden')
    expect($hiddenTreePanes.get().has('sessions')).toBe(false)
    expect(readOpsLayout('local', 'default')).toEqual({ widthPx: 510, rail: 'hidden' })
  })

  it('publishes min=max when the measured room cannot hold both floors', () => {
    writeOpsLayout('local', 'default', { widthPx: 510, rail: 'full' })
    const split = document.createElement('div')
    split.setAttribute('data-tree-split', 'spl-tight')
    const main = document.createElement('div')
    const mainSlot = document.createElement('div')
    mainSlot.setAttribute('data-pane-slot', 'workspace')
    main.append(mainSlot)
    const ops = document.createElement('div')
    const opsSlot = document.createElement('div')
    opsSlot.setAttribute('data-pane-slot', 'ops')
    ops.append(opsSlot)
    const host = document.createElement('div')
    host.setAttribute('data-ops-root', '')
    host.style.position = 'absolute'
    split.append(main, ops)
    document.body.append(split, host)
    stubBox(split, 500)
    stubBox(main, 320)
    stubBox(ops, 180)

    const applied = fitOpsFromStorage()
    const box = publishedOpsBox()

    expect(host.closest('[data-tree-split]')).toBeNull()
    expect(applied).toBe(180)
    expect(box).toMatchObject({ width: '180px', minWidth: '180px', maxWidth: '180px' })
    expect(applied + CHAT_MIN_WIDTH_PX).toBeLessThanOrEqual(500)
  })
})
