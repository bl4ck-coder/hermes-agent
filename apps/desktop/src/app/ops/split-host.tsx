/**
 * Ops split host. Pane in `$layoutTree`, width override in the scoped key,
 * full-screen via `$hiddenTreePanes` (keep-alive, never parked).
 *
 * The separator is the existing zone sash (`beginSashDrag` / pane `width`),
 * not a second splitter. Esc priority 5 restores the split. Model policy P2
 * is not exercised.
 */

import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { allPaneIds, findGroupOfPane, findParentSplit } from '@/components/pane-shell/tree/model'
import {
  $hiddenTreePanes,
  $layoutTree,
  persistTree,
  revealTreePane,
  setTreePaneHidden,
  setTreeSplitWeights
} from '@/components/pane-shell/tree/store'
import { registry } from '@/contrib/registry'
import { isTopEscapeLayer, pushEscapeLayer } from '@/lib/escape-layers'

import { OpsShell } from './index'
import {
  $opsChatSessionId,
  $opsFullscreen,
  $opsInspectorOpen,
  $opsLiveSession,
  $opsOpen,
  $opsRail,
  $opsScope,
  $opsView,
  $opsViewId,
  $opsWidthPx,
  loadOpsScope,
  narrowStrategy,
  OPS_FULLSCREEN_ESCAPE_PRIORITY,
  OPS_MIN_WIDTH_PX,
  OPS_PANE_ID,
  type OpsScope,
  readOpsLayout,
  resizeOpsSplit,
  setOpsRail
} from './layout-store'

export interface OpsRouteBinding {
  isOpsRoute: (path: string) => boolean
  parseOpsRoute: (path: string) => { view: string; id: string | null } | null
  opsRoute: (view: string, id?: string | null) => string
}

let routeFns: OpsRouteBinding | null = null
let installed = false
let hiddenSnapshot: ReadonlySet<string> | null = null
let baselineWeights: { splitId: string; weights: number[] } | null = null
let escapeDispose: (() => void) | null = null
let storesWired = false

export function bindOpsRoutes(fns: OpsRouteBinding): void {
  routeFns = fns
}

function renderOpsPane(): ReactNode {
  return <OpsPane />
}

function publishPane(widthPx: number): void {
  registry.register({
    id: OPS_PANE_ID,
    area: 'panes',
    source: 'core',
    title: 'Ops',
    render: renderOpsPane,
    data: {
      placement: 'right',
      dock: { pane: 'workspace', pos: 'right' },
      lifecycleKeepAlive: true,
      hideOnly: true,
      width: `${Math.round(widthPx)}px`,
      minWidth: `${OPS_MIN_WIDTH_PX}px`,
      maxWidth: '80vw'
    }
  })
}

function rememberBaseline(): void {
  const tree = $layoutTree.get()

  if (!tree) {
    return
  }

  const group = findGroupOfPane(tree, OPS_PANE_ID)
  const split = group ? findParentSplit(tree, group.id) : null

  if (!split) {
    return
  }

  baselineWeights = { splitId: split.id, weights: [...split.weights] }
}

function restoreBaselineWeights(): void {
  if (!baselineWeights) {
    return
  }

  const tree = $layoutTree.get()

  if (!tree) {
    return
  }

  setTreeSplitWeights(baselineWeights.splitId, baselineWeights.weights)
  persistTree()
}

export function enterOpsFullscreen(): void {
  if ($opsFullscreen.get()) {
    return
  }

  const tree = $layoutTree.get()
  const ids = tree ? allPaneIds(tree) : []

  hiddenSnapshot = new Set($hiddenTreePanes.get())
  const next = new Set(hiddenSnapshot)

  for (const id of ids) {
    if (id !== OPS_PANE_ID) {
      next.add(id)
    }
  }

  next.delete(OPS_PANE_ID)
  $hiddenTreePanes.set(next)
  $opsFullscreen.set(true)
  escapeDispose?.()
  escapeDispose = pushEscapeLayer(OPS_FULLSCREEN_ESCAPE_PRIORITY)
}

export function exitOpsFullscreen(): void {
  if (!$opsFullscreen.get() && !hiddenSnapshot) {
    return
  }

  if (hiddenSnapshot) {
    $hiddenTreePanes.set(new Set(hiddenSnapshot))
  }

  hiddenSnapshot = null
  $opsFullscreen.set(false)
  escapeDispose?.()
  escapeDispose = null
}

export function toggleOpsFullscreen(): void {
  if ($opsFullscreen.get()) {
    exitOpsFullscreen()
  } else {
    enterOpsFullscreen()
  }
}

/** Background events never navigate and never steal focus (attention policy). */
export function noteOpsBackgroundEvent(): void {
  return
}

export function focusExistingChat(): void {
  revealTreePane('workspace')
  setTreePaneHidden('workspace', false)

  const root = document.querySelector<HTMLElement>('[data-session-anchor="workspace"]')
  const composer = root?.querySelector<HTMLElement>('textarea, [contenteditable="true"]')

  ;(composer ?? root)?.focus()
}

export function activateLiveSessionBadge(): void {
  exitOpsFullscreen()
  focusExistingChat()
}

export function openOpsSplit(): void {
  $opsOpen.set(true)
  setTreePaneHidden(OPS_PANE_ID, false)
  revealTreePane(OPS_PANE_ID)
  publishPane($opsWidthPx.get())
  rememberBaseline()
}

export function closeOpsSplit(): void {
  if ($opsFullscreen.get()) {
    exitOpsFullscreen()
  }

  $opsOpen.set(false)
  setTreePaneHidden(OPS_PANE_ID, true)
}

export function toggleOpsSplit(): void {
  if ($opsOpen.get()) {
    closeOpsSplit()
  } else {
    openOpsSplit()
  }
}

export function applyOpsLocation(pathname: string): void {
  const parsed = routeFns?.parseOpsRoute(pathname)

  if (!parsed) {
    return
  }

  $opsView.set(parsed.view)
  $opsViewId.set(parsed.id)
  openOpsSplit()
}

export function handleOpsEscape(event: { key: string; defaultPrevented: boolean; preventDefault: () => void }): boolean {
  if (event.key !== 'Escape' || !$opsFullscreen.get() || event.defaultPrevented) {
    return false
  }

  if (!isTopEscapeLayer(OPS_FULLSCREEN_ESCAPE_PRIORITY)) {
    return false
  }

  event.preventDefault()
  exitOpsFullscreen()

  return true
}

function onOpsKey(event: KeyboardEvent): void {
  if (handleOpsEscape(event)) {
    return
  }

  const target = event.target

  if (!(target instanceof Element) || !target.closest('[data-ops-root]')) {
    return
  }

  if (target.closest('input, textarea, select, [contenteditable="true"]')) {
    return
  }

  if (event.key === '[') {
    event.preventDefault()
    const rail = $opsRail.get()
    setOpsRail(rail === 'full' ? 'icons' : rail === 'icons' ? 'hidden' : 'full')
  } else if (event.key === ']') {
    event.preventDefault()
    $opsInspectorOpen.set(!$opsInspectorOpen.get())
  }
}

async function wireStores(): Promise<void> {
  if (storesWired) {
    return
  }

  storesWired = true

  const [profileMod, sessionMod, connectionsMod, panesMod] = await Promise.all([
    import('@/store/profile'),
    import('@/store/session'),
    import('@/store/connections'),
    import('@/store/panes')
  ])

  const pullScope = () => {
    const connection = sessionMod.$connection.get()
    const connectionId = connectionsMod.$activeConnectionId.get() || connection?.connectionId || 'local'
    const profile = profileMod.$activeProfile.get() || connection?.profile || 'default'
    const remote = connection?.mode === 'remote'
    const next: OpsScope = {
      connectionId,
      profile,
      remote,
      label: connection?.remoteHost || connectionId
    }
    const previous = $opsScope.get()

    if (previous.connectionId === next.connectionId && previous.profile === next.profile && previous.remote === next.remote) {
      return
    }

    loadOpsScope(next)
    publishPane($opsWidthPx.get())
  }

  profileMod.$activeProfile.subscribe(pullScope)
  sessionMod.$connection.subscribe(pullScope)
  connectionsMod.$activeConnectionId.subscribe(pullScope)
  pullScope()

  sessionMod.$selectedStoredSessionId.subscribe(id => {
    $opsChatSessionId.set(id)
  })
  $opsChatSessionId.set(sessionMod.$selectedStoredSessionId.get())

  const pullLive = async () => {
    const dots = await import('@/store/session-dot-state')
    const id = sessionMod.$selectedStoredSessionId.get() || sessionMod.$activeSessionId.get()

    if (!id) {
      $opsLiveSession.set(null)

      return
    }

    const row = sessionMod.$sessions.get().find(session => session.id === id)
    const title = row?.title?.trim() || id
    const state = dots.$sessionDotStateById.get()[id]
    const active = sessionMod.$activeSessionId.get()
    const working =
      state === 'working' ||
      state === 'stalled' ||
      (sessionMod.$busy.get() && (active === id || sessionMod.$selectedStoredSessionId.get() === id))

    $opsLiveSession.set({ id, title, working })
  }

  sessionMod.$busy.subscribe(() => void pullLive())
  sessionMod.$selectedStoredSessionId.subscribe(() => void pullLive())
  sessionMod.$sessions.subscribe(() => void pullLive())
  void pullLive()

  panesMod.$paneStates.subscribe(states => {
    const override = states[OPS_PANE_ID]?.widthOverride

    if (typeof override !== 'number') {
      return
    }

    const container = typeof window === 'undefined' ? override + 640 : window.innerWidth
    const width = resizeOpsSplit(override, container)

    panesMod.setPaneWidthOverride(OPS_PANE_ID, undefined)
    publishPane(width)
    queueMicrotask(() => restoreBaselineWeights())
  })
}

export function ensureOpsSplitHost(): void {
  if (installed) {
    return
  }

  installed = true
  publishPane(readOpsLayout($opsScope.get().connectionId, $opsScope.get().profile).widthPx)

  registry.register({
    id: 'ops-open',
    area: 'titleBar.tools.right',
    source: 'core',
    order: 40,
    data: {
      id: 'ops',
      label: 'Ops',
      title: 'Ops',
      icon: <span aria-hidden="true">Ops</span>,
      onSelect: () => toggleOpsSplit()
    }
  })

  registry.register({
    id: 'ops-live-badge',
    area: 'titleBar.center',
    source: 'core',
    order: 10,
    render: () => <LiveSessionBadge />
  })

  $layoutTree.subscribe(() => {
    if (!$opsOpen.get() && !$opsFullscreen.get()) {
      setTreePaneHidden(OPS_PANE_ID, true)
    }
  })

  if (!$opsOpen.get()) {
    setTreePaneHidden(OPS_PANE_ID, true)
  }

  window.addEventListener('keydown', onOpsKey)
  void wireStores().catch(() => {
    storesWired = false
  })
}

export function LiveSessionBadge(): ReactNode {
  const fullscreen = useStore($opsFullscreen)
  const live = useStore($opsLiveSession)

  if (!fullscreen || !live?.working) {
    return null
  }

  return (
    <button type="button" data-ops-live-badge="" onClick={activateLiveSessionBadge}>
      {live.title}
    </button>
  )
}

export function OpsPane(): ReactNode {
  const scope = useStore($opsScope)
  const view = useStore($opsView)
  const viewId = useStore($opsViewId)
  const paneWidth = useStore($opsWidthPx)
  const rail = useStore($opsRail)
  const fullscreen = useStore($opsFullscreen)
  const inspectorOpen = useStore($opsInspectorOpen)
  const [measured, setMeasured] = useState(0)
  const rootWidth = measured > 0 ? measured : paneWidth
  const narrow = narrowStrategy(rootWidth, rail)

  useEffect(() => {
    const node = document.querySelector<HTMLElement>('[data-ops-root]')

    if (!node || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0

      if (width > 0) {
        setMeasured(width)
      }
    })

    observer.observe(node)

    return () => observer.disconnect()
  }, [paneWidth])

  return (
    <OpsShell
      fullscreen={fullscreen}
      inspectorOpen={inspectorOpen}
      narrow={narrow}
      onBackToChats={() => {
        if (fullscreen) {
          exitOpsFullscreen()
        }

        focusExistingChat()
      }}
      onCopyLink={() => {
        const path = routeFns?.opsRoute(view, viewId) ?? `/ops/${view}`

        void navigator.clipboard?.writeText(path)
      }}
      onInspector={open => $opsInspectorOpen.set(open)}
      onOpenChat={focusExistingChat}
      onRail={setOpsRail}
      onToggleFullscreen={toggleOpsFullscreen}
      onView={next => {
        $opsView.set(next)
        $opsViewId.set(null)
      }}
      paneWidth={rootWidth}
      railPreference={rail}
      scope={scope}
      view={view}
      viewId={viewId}
    />
  )
}

export function opsPaneRegistration() {
  return registry.getArea('panes').find(entry => entry.id === OPS_PANE_ID)
}
