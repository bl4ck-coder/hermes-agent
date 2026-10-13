/**
 * Ops split host. Pane in `$layoutTree`, width override in the scoped key,
 * full-screen hot-hides the chat on the keep-alive host. The chat is not added
 * to `$hiddenTreePanes` — TreeGroup drops that set and would remount the surface.
 *
 * The separator is the existing zone sash (`beginSashDrag` / pane `width`),
 * not a second splitter. Esc priority 5 restores the split. Model policy P2
 * is not exercised.
 */

import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { $connectionsRegistry } from '@/store/connection-registry-state'
import { $profiles } from '@/store/profile'

import { allPaneIds, findGroupOfPane, findParentSplit } from '@/components/pane-shell/tree/model'
import {
  $hiddenTreePanes,
  $layoutTree,
  $releaseMainFloor,
  persistTree,
  revealTreePane,
  setTreePaneHidden,
  setTreeSplitWeights
} from '@/components/pane-shell/tree/store'
import { registry } from '@/contrib/registry'
import { isTopEscapeLayer, pushEscapeLayer } from '@/lib/escape-layers'

import { OpsShell } from './index'
import { cycleRail, loadScope, setInspectorOpen, setRail } from './navigation-store'
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
  OPS_FULLSCREEN_ESCAPE_PRIORITY,
  OPS_MIN_WIDTH_PX,
  OPS_PANE_ID,
  CHAT_MIN_WIDTH_PX,
  type OpsScope,
  planOpsFit,
  readOpsLayout,
  resizeOpsSplit,
  resolveOpsPaneBox,
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
let scopeHydrated = false
let hostReady: Promise<void> = Promise.resolve()
let chatFocusRestore: HTMLElement | null = null

export function opsHostReady(): Promise<void> {
  return hostReady
}

export function bindOpsRoutes(fns: OpsRouteBinding): void {
  routeFns = fns
}

function renderOpsPane(): ReactNode {
  return <OpsPane />
}

function publishPane(widthPx: number, box?: { minWidthPx?: number; maxWidth?: string | null }): void {
  const minWidthPx = box?.minWidthPx ?? OPS_MIN_WIDTH_PX
  const maxWidth = box && 'maxWidth' in box ? box.maxWidth : '80vw'

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
      minWidth: `${Math.round(minWidthPx)}px`,
      ...(maxWidth ? { maxWidth } : {})
    }
  })
}

/** Full-bleed: no fixed px and no maxWidth, or the track stays ~480 beside a live main floor. */
function publishFullscreenPane(): void {
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
      width: '100%',
      minWidth: '0px'
    }
  })
}

let fitRailIds: string[] = []
let fitRailWidth = 0
let fitting = false

/** Chat pane id. Its body is keep-alive: full-screen hot-hides it, it does not leave the tree. */
const CHAT_PANE_ID = 'workspace'

/** Panes TreeGroup would unmount if they entered `$hiddenTreePanes`. Full-screen keeps them mounted. */
function retainedFullscreenPane(id: string): boolean {
  if (id === CHAT_PANE_ID || id.startsWith('session-tile:')) {
    return true
  }

  const data = registry.getArea('panes').find(pane => pane.id === id)?.data as
    | { lifecycleKeepAlive?: boolean; placement?: string }
    | undefined

  return data?.placement === 'main' && Boolean(data.lifecycleKeepAlive)
}

function rememberChatFocus(): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.querySelector('[data-session-anchor="workspace"]')
  const active = document.activeElement

  if (active instanceof HTMLElement && root?.contains(active)) {
    chatFocusRestore = active
  }
}

function restoreChatFocus(): void {
  const target = chatFocusRestore

  chatFocusRestore = null

  if (!target) {
    return
  }

  const apply = () => {
    if (target.isConnected) {
      target.focus()
    }
  }

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(apply))
  } else {
    queueMicrotask(apply)
  }
}

/**
 * The keep-alive host (`[data-ops-root]`) is an absolute sibling of the tree.
 * The empty slot inside the split is the only marker `closest` can walk.
 */
function opsSlot(): Element | null {
  if (typeof document === 'undefined') {
    return null
  }

  return document.querySelector(`[data-pane-slot="${OPS_PANE_ID}"]`)
}

function opsSplitElement(): HTMLElement | null {
  const split = opsSlot()?.closest('[data-tree-split]')

  return split instanceof HTMLElement ? split : null
}

function outermostSplitWidth(): number {
  let node: Element | null = opsSplitElement()
  let outermost: HTMLElement | null = null

  while (node instanceof HTMLElement) {
    outermost = node
    node = node.parentElement?.closest('[data-tree-split]') ?? null
  }

  return outermost && outermost.clientWidth > 0 ? outermost.clientWidth : 0
}

function childHoldsSlot(child: Element, paneId: string): boolean {
  return Boolean(child.querySelector(`[data-pane-slot="${paneId}"]`))
}

function childIsChatOrOps(child: Element): boolean {
  if (childHoldsSlot(child, OPS_PANE_ID) || childHoldsSlot(child, CHAT_PANE_ID)) {
    return true
  }

  // Prefer the slot: keep-alive bodies (Ops, and the chat) live outside the
  // split. The anchor fallback covers an inline chat that has not opted in.
  return Boolean(child.querySelector('[data-session-anchor="workspace"]'))
}

function childHoldsHiddenPane(child: Element): boolean {
  for (const id of $hiddenTreePanes.get()) {
    if (id !== OPS_PANE_ID && id !== CHAT_PANE_ID && childHoldsSlot(child, id)) {
      return true
    }
  }

  return false
}

function measureSplitRoom(): number {
  if (typeof document === 'undefined') {
    return 0
  }

  const split = opsSplitElement()

  if (!split || split.clientWidth <= 0) {
    return 0
  }

  let reserved = 0

  for (const child of Array.from(split.children)) {
    if (!(child instanceof HTMLElement) || child.style.display === 'none') {
      continue
    }

    // Bodies are portaled out. Skip the slot tracks, sum rails and gutters.
    // A rail we already hid is about to leave the track; don't reserve it
    // again or the follow-up fit publishes a collapsed Ops over a freed room.
    if (childIsChatOrOps(child) || childHoldsHiddenPane(child)) {
      continue
    }

    reserved += child.getBoundingClientRect().width
  }

  return Math.max(0, Math.round(split.clientWidth - reserved))
}

function leftRailIds(): string[] {
  const tree = $layoutTree.get()

  if (!tree) {
    return []
  }

  const panes = registry.getArea('panes')

  return allPaneIds(tree).filter(id => {
    if (id === OPS_PANE_ID) {
      return false
    }

    const data = panes.find(pane => pane.id === id)?.data as { placement?: string; collapsible?: boolean } | undefined

    return data?.placement === 'left' && data.collapsible !== false
  })
}

function zoneWidth(paneId: string): number {
  const tree = $layoutTree.get()
  const group = tree ? findGroupOfPane(tree, paneId) : null

  if (!group) {
    return 0
  }

  // The keep-alive host also wears data-tree-group; its parent is the shell, not the rail.
  const node = document.querySelector(`[data-tree-group="${group.id}"]:not([data-pane-host])`)
  const width = node?.parentElement?.getBoundingClientRect().width ?? node?.getBoundingClientRect().width ?? 0

  return Number.isFinite(width) && width > 0 ? width : 0
}

function releaseFitRails(): void {
  if (fitRailIds.length === 0) {
    return
  }

  const next = new Set($hiddenTreePanes.get())

  for (const id of fitRailIds) {
    next.delete(id)
  }

  fitRailIds = []
  fitRailWidth = 0
  $hiddenTreePanes.set(next)
}

function hideFitRails(ids: string[]): void {
  fitRailWidth = ids.reduce((sum, id) => sum + zoneWidth(id), 0)
  fitRailIds = ids
  const next = new Set($hiddenTreePanes.get())

  for (const id of ids) {
    next.add(id)
  }

  $hiddenTreePanes.set(next)
}

/** Apply the stored preference to the measured split room. Does not write storage. */
export function fitOpsFromStorage(): number {
  if (fitting || $opsFullscreen.get()) {
    return $opsWidthPx.get()
  }

  fitting = true

  try {
    const scope = $opsScope.get()
    const stored = readOpsLayout(scope.connectionId, scope.profile)
    let room = measureSplitRoom()
    const hidden = $hiddenTreePanes.get()
    const docked = leftRailIds().filter(id => !hidden.has(id) && !fitRailIds.includes(id))
    const railWidth = docked.reduce((sum, id) => sum + zoneWidth(id), 0)
    const plan = planOpsFit({ room, railWidth, railsDocked: docked.length > 0 })

    if (plan.hideRails) {
      hideFitRails(docked)
      room = plan.room
      const cap = outermostSplitWidth()

      if (cap > 0) {
        room = Math.min(room, cap)
      }
    } else if (fitRailIds.length > 0 && room >= CHAT_MIN_WIDTH_PX + OPS_MIN_WIDTH_PX + fitRailWidth) {
      releaseFitRails()
      room = measureSplitRoom()
    }

    $opsRail.set(stored.rail)

    if ($opsFullscreen.get()) {
      publishFullscreenPane()

      return $opsWidthPx.get()
    }

    const box = resolveOpsPaneBox(stored.widthPx, room)

    $opsWidthPx.set(box.widthPx)
    publishPane(box.widthPx, { minWidthPx: box.minWidthPx, maxWidth: box.maxWidth })

    return box.widthPx
  } finally {
    fitting = false
  }
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

  rememberChatFocus()

  const tree = $layoutTree.get()
  const ids = tree ? allPaneIds(tree) : []

  hiddenSnapshot = new Set($hiddenTreePanes.get())
  const next = new Set(hiddenSnapshot)

  for (const id of ids) {
    if (id !== OPS_PANE_ID && !retainedFullscreenPane(id)) {
      next.add(id)
    }
  }

  next.delete(OPS_PANE_ID)

  for (const id of [...next]) {
    if (retainedFullscreenPane(id)) {
      next.delete(id)
    }
  }

  // Flag first so the hide render collapses the main floor instead of reserving it.
  // The chat is not in this set: TreeGroup drops hidden panes, and that remounts the surface.
  $releaseMainFloor.set(true)
  $hiddenTreePanes.set(next)
  publishFullscreenPane()
  $opsFullscreen.set(true)
  escapeDispose?.()
  escapeDispose = pushEscapeLayer(OPS_FULLSCREEN_ESCAPE_PRIORITY)
}

export function exitOpsFullscreen(): void {
  if (!$opsFullscreen.get() && !hiddenSnapshot && !$releaseMainFloor.get()) {
    return
  }

  if (hiddenSnapshot) {
    $hiddenTreePanes.set(new Set(hiddenSnapshot))
  }

  hiddenSnapshot = null
  $releaseMainFloor.set(false)
  $opsFullscreen.set(false)
  escapeDispose?.()
  escapeDispose = null
  fitOpsFromStorage()
  restoreChatFocus()
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
  hydrateOpsSplit($opsScope.get())
  $opsOpen.set(true)
  setTreePaneHidden(OPS_PANE_ID, false)
  revealTreePane(OPS_PANE_ID)
  rememberBaseline()
}

export function closeOpsSplit(): void {
  if ($opsFullscreen.get()) {
    exitOpsFullscreen()
  }

  $opsOpen.set(false)
  releaseFitRails()
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

  if (event.defaultPrevented) {
    return
  }

  if (event.key === '[') {
    event.preventDefault()
    const scope = $opsScope.get()
    const next = cycleRail(loadScope(scope.connectionId, scope.profile).rail)

    setRail(scope.connectionId, scope.profile, next)
    setOpsRail(next)
  } else if (event.key === ']') {
    event.preventDefault()
    const scope = $opsScope.get()
    const next = !loadScope(scope.connectionId, scope.profile).inspectorOpen

    setInspectorOpen(scope.connectionId, scope.profile, next)
    $opsInspectorOpen.set(next)
  }
}

type LiveSessionSource = {
  $busy: { get: () => boolean; subscribe: (fn: () => void) => () => void }
  $selectedStoredSessionId: { get: () => string | null; subscribe: (fn: () => void) => () => void }
  $activeSessionId: { get: () => string | null; subscribe: (fn: () => void) => () => void }
  $sessions: { get: () => { id: string; title?: string | null }[]; subscribe: (fn: () => void) => () => void }
}

type DotSource = {
  $sessionDotStateById: { get: () => Record<string, string | undefined>; subscribe: (fn: () => void) => () => void }
}

/** Subscribe the badge to the real dot / active-id sources. Sync, so a later
 *  idle→working edge cannot be overwritten by an older async read. */
export function watchOpsLiveSession(sessionMod: LiveSessionSource, dots: DotSource): () => void {
  let liveToken = 0

  const pullLive = () => {
    const token = ++liveToken
    const selected = sessionMod.$selectedStoredSessionId.get()
    const active = sessionMod.$activeSessionId.get()
    const id = selected || active

    if (!id) {
      if (token === liveToken) {
        $opsLiveSession.set(null)
      }

      return
    }

    const row = sessionMod.$sessions.get().find(session => session.id === id)
    const title = row?.title?.trim() || id
    const state = dots.$sessionDotStateById.get()[id]
    const working =
      state === 'working' ||
      state === 'stalled' ||
      state === 'background' ||
      (sessionMod.$busy.get() && (active === id || selected === id))

    if (token !== liveToken) {
      return
    }

    $opsLiveSession.set({ id, title, working })
  }

  const stops = [
    sessionMod.$busy.subscribe(pullLive),
    sessionMod.$selectedStoredSessionId.subscribe(pullLive),
    sessionMod.$activeSessionId.subscribe(pullLive),
    sessionMod.$sessions.subscribe(pullLive),
    dots.$sessionDotStateById.subscribe(pullLive)
  ]

  pullLive()

  return () => {
    for (const stop of stops) {
      stop()
    }
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

    noteOpsScope(next)
  }

  profileMod.$activeProfile.subscribe(pullScope)
  sessionMod.$connection.subscribe(pullScope)
  connectionsMod.$activeConnectionId.subscribe(pullScope)
  pullScope()

  sessionMod.$selectedStoredSessionId.subscribe(id => {
    $opsChatSessionId.set(id)
  })
  $opsChatSessionId.set(sessionMod.$selectedStoredSessionId.get())

  const dots = await import('@/store/session-dot-state')

  watchOpsLiveSession(sessionMod, dots)

  panesMod.$paneStates.subscribe(states => {
    const override = states[OPS_PANE_ID]?.widthOverride

    if ($opsFullscreen.get() || typeof override !== 'number') {
      return
    }

    const room = measureSplitRoom()
    const container = room > 0 ? room : override + CHAT_MIN_WIDTH_PX
    const width = resizeOpsSplit(override, container)
    const box = resolveOpsPaneBox(width, container)

    panesMod.setPaneWidthOverride(OPS_PANE_ID, undefined)
    publishPane(box.widthPx, { minWidthPx: box.minWidthPx, maxWidth: box.maxWidth })
    queueMicrotask(() => restoreBaselineWeights())
  })
}

export function hydrateOpsSplit(scope: OpsScope = $opsScope.get()): void {
  $opsScope.set(scope)
  scopeHydrated = true

  if ($opsFullscreen.get()) {
    $opsRail.set(readOpsLayout(scope.connectionId, scope.profile).rail)
    publishFullscreenPane()

    return
  }

  fitOpsFromStorage()
}

/** Boot and scope changes. The first call always applies storage, even when the
 *  scope identity already matches the default atom (local/default 510/hidden). */
export function noteOpsScope(next: OpsScope): void {
  const previous = $opsScope.get()
  const same =
    previous.connectionId === next.connectionId && previous.profile === next.profile && previous.remote === next.remote

  if (same && scopeHydrated) {
    return
  }

  hydrateOpsSplit(next)
}

export function resetOpsScopeHydrationForTests(): void {
  scopeHydrated = false
}

export function ensureOpsSplitHost(): void {
  if (installed) {
    return
  }

  installed = true
  hydrateOpsSplit($opsScope.get())

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
  window.addEventListener('resize', () => {
    if (!$opsFullscreen.get()) {
      fitOpsFromStorage()
    }
  })

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      if (!$opsFullscreen.get()) {
        fitOpsFromStorage()
      }
    })
    let observed: Element | null = null
    const attach = () => {
      const split = opsSplitElement()

      if (split === observed) {
        return
      }

      if (observed) {
        observer.unobserve(observed)
      }

      observed = split

      if (!split) {
        return
      }

      observer.observe(split)

      if (!$opsFullscreen.get()) {
        fitOpsFromStorage()
      }
    }
    const scheduleAttach = () => {
      attach()
      queueMicrotask(attach)

      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(attach)
      }
    }

    $layoutTree.subscribe(scheduleAttach)
    scheduleAttach()
  }

  hostReady = wireStores().catch(() => {
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

export function openDesktopRoute(route: string): 'opened' | 'unavailable' {
  if (!route) {
    return 'unavailable'
  }

  if (route.startsWith('pane:')) {
    const id = route.slice('pane:'.length)

    if (!id) {
      return 'unavailable'
    }

    revealTreePane(id)
    setTreePaneHidden(id, false)

    return 'opened'
  }

  if (route.startsWith('/')) {
    window.location.hash = `#${route}`

    return 'opened'
  }

  return 'unavailable'
}

export function OpsPane(): ReactNode {
  const scope = useStore($opsScope)
  const view = useStore($opsView)
  const viewId = useStore($opsViewId)
  const paneWidth = useStore($opsWidthPx)
  const fullscreen = useStore($opsFullscreen)
  const registry = useStore($connectionsRegistry)
  const profileRows = useStore($profiles)
  const [measured, setMeasured] = useState(0)
  const rootWidth = measured > 0 ? measured : paneWidth
  const connections = registry?.connections.map(item => ({
    id: item.id,
    label: item.label,
    remote: item.kind !== 'local'
  }))
  const profiles = profileRows.map(item => ({ name: item.name }))

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
      connections={connections && connections.length > 0 ? connections : undefined}
      profiles={profiles.length > 0 ? profiles : undefined}
      onBackToChats={() => {
        if (fullscreen) {
          exitOpsFullscreen()
        }

        focusExistingChat()
      }}
      onConnect={() => {
        window.location.hash = '#/settings?tab=gateway'
      }}
      onCopyLink={() => {
        const path = routeFns?.opsRoute(view, viewId) ?? `/ops/${view}`

        void navigator.clipboard?.writeText(path)
      }}
      onInspector={open => {
        setInspectorOpen(scope.connectionId, scope.profile, open)
        $opsInspectorOpen.set(open)
      }}
      onOpenChat={focusExistingChat}
      onOpenPalette={() => {
        void import('@/store/command-palette').then(mod => mod.openCommandPalette())
      }}
      onOpenRoute={openDesktopRoute}
      onOpenSettings={() => {
        window.location.hash = '#/settings'
      }}
      onRail={next => {
        setRail(scope.connectionId, scope.profile, next)
        setOpsRail(next)
      }}
      onSelectConnection={id => {
        void import('@/store/connections').then(mod => mod.selectConnection(id))
      }}
      onSelectProfile={name => {
        void import('@/store/profile').then(mod => mod.selectProfile(name))
      }}
      onToggleFullscreen={toggleOpsFullscreen}
      onView={(next, id) => {
        $opsView.set(next)
        $opsViewId.set(id ?? null)
      }}
      paneWidth={rootWidth}
      scope={scope}
      view={view}
      viewId={viewId}
    />
  )
}

export function opsPaneRegistration() {
  return registry.getArea('panes').find(entry => entry.id === OPS_PANE_ID)
}
