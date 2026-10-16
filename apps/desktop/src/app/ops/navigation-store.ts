/**
 * Ops navigation, scoped to connection + profile.
 *
 * Pins, history, tab dots, the selected tab, and rail / inspector / dock
 * chrome persist under `hermes.desktop.opsNav.v1`. Local keys use the same
 * bare profile key as session tiles. Remote keys use `conn:<id>::<profile>`
 * so a same-named remote profile cannot inherit local pins.
 *
 * `migrateTilesForProfile` / `dropTilesForProfile` call the siblings below.
 * This module does not import the session store (that import would cycle).
 */

import { backendScopeKey, LOCAL_CONNECTION_ID } from '@hermes/shared'

import { readJson, writeJson } from '@/lib/storage'

export const OPS_NAV_STORAGE_KEY = 'hermes.desktop.opsNav.v1'

/** R53, measured on the Ops pane container, not the window. */
export const OPS_INSPECTOR_OVERLAY_PX = 1280
export const OPS_RAIL_ICONS_PX = 1024
export const OPS_TABS_DROPDOWN_PX = 800

export const FLEET_ROW_PX = 28
export const FLEET_VIEW_PX = 280

export type RailState = 'full' | 'icons' | 'hidden'
export type InspectorSlot = 'fleet' | 'context' | 'task' | 'node' | 'history' | 'events' | 'row'
export type DockSlot = 'log' | 'events' | 'problems'
export type TabKind = 'office' | 'canvas' | 'board' | 'lens' | 'task' | 'profile' | 'run'
export type TabDot = 'unsaved' | 'unread'
export type PresenceState = 'working' | 'needs_you' | 'blocked' | 'idle' | 'offline' | 'unknown' | 'stale'
export type FeedStatus = 'ready' | 'missing'

/**
 * Lens destinations that already exist. Paths match `app/routes.ts`.
 * `pane:files` and `pane:review` are the pane ids in `contrib/controller.tsx`
 * (`files`, alias `file-browser`, and `review`). Templates and Projects have
 * no Desktop route — they stay unavailable instead of growing a fake page.
 * Task tabs use the kanban plugin route `/kanban`. Run tabs use the SPEC
 * route model `/ops/run/:id` because Desktop has no run page.
 */
export const LENS_CATALOG = [
  { id: 'runs', label: 'Runs', route: '/command-center', hint: 'G R', more: false, unavailable: false },
  { id: 'review', label: 'Review', route: 'pane:review', hint: '', more: false, unavailable: false },
  { id: 'templates', label: 'Templates', route: 'ops:templates', hint: '', more: false, unavailable: false },
  { id: 'projects', label: 'Projects', route: 'ops:projects', hint: '', more: false, unavailable: false },
  { id: 'files', label: 'Files', route: 'pane:files', hint: '', more: false, unavailable: false },
  { id: 'conversations', label: 'Conversations', route: '/', hint: '', more: true, unavailable: false },
  { id: 'skills', label: 'Skills', route: '/capabilities', hint: 'G S', more: true, unavailable: false },
  { id: 'channels', label: 'Channels & MCP', route: '/messaging', hint: '', more: true, unavailable: false },
  { id: 'activity', label: 'Activity', route: '/command-center', hint: '', more: true, unavailable: false },
  { id: 'triggers', label: 'Triggers', route: '/webhooks', hint: '', more: true, unavailable: false },
  { id: 'schedule', label: 'Schedule', route: '/cron', hint: '', more: true, unavailable: false },
  { id: 'memory', label: 'Memory', route: '/starmap', hint: '', more: true, unavailable: false },
  { id: 'profiles', label: 'Profiles', route: '/profiles', hint: '', more: true, unavailable: false },
  { id: 'agents', label: 'Agents', route: '/agents', hint: '', more: true, unavailable: false },
  { id: 'settings', label: 'Ops settings', route: 'ops:settings', hint: '', more: true, unavailable: false }
] as const

export type LensId = (typeof LENS_CATALOG)[number]['id']

export const PINNED_VIEWS = [
  { id: 'office', label: 'Office', route: '/ops/office', hint: 'G O' },
  { id: 'canvas', label: 'Canvas', route: '/ops/canvas', hint: 'G C' },
  { id: 'board', label: 'Board', route: '/ops/board', hint: 'G B' }
] as const

export interface OpsTab {
  id: string
  kind: TabKind
  label: string
  route: string
  pinned: boolean
  closable: boolean
  unavailable?: boolean
}

export interface NavSnapshot {
  scrollTop: number
  focusId: string | null
  selectionId: string | null
  filter: string
}

export interface HistoryEntry {
  tabId: string
  snapshot: NavSnapshot
}

export interface ScopeNav {
  rail: RailState
  inspectorOpen: boolean
  inspectorSlot: InspectorSlot
  dockOpen: boolean
  dockSlot: DockSlot
  selectedTabId: string
  tabs: OpsTab[]
  pins: string[]
  history: HistoryEntry[]
  historyIndex: number
  dots: Record<string, TabDot>
  lastSeen: Record<string, number>
  snapshots: Record<string, NavSnapshot>
  filter: string
}

export interface FleetMember {
  id: string
  label: string
  presence: PresenceState | null
  /** Authoritative freshness from A1. Missing A1 must not infer this. */
  fresh: boolean
}

export interface FleetFeed {
  a1: FeedStatus
  a3: FeedStatus
  rows: FleetMember[]
}

export interface FleetGroup {
  id: PresenceState
  label: string
  rows: FleetMember[]
  folded: boolean
}

export interface FleetArrangement {
  onlineLabel: string
  needsYouLabel: string
  groups: FleetGroup[]
}

export type FleetFlatRow =
  | { kind: 'header'; id: string; label: string }
  /** B11: honest explanation under the unknown group (presence not observable from this backend). */
  | { kind: 'hint'; id: string; label: string }
  | { kind: 'folded'; id: string; label: string; count: number; presence: 'idle' }
  | { kind: 'member'; id: string; member: FleetMember }

export interface FocusedRun {
  id: string
  elapsed: string | null
  tokens: number | null
}

export interface RunFooterModel {
  id: string
  elapsed: string
  tokens: string
}

interface NavFile {
  version: 1
  scopes: Record<string, ScopeNav>
}

const EMPTY_SNAPSHOT: NavSnapshot = { scrollTop: 0, focusId: null, selectionId: null, filter: '' }

const FLEET_ORDER: PresenceState[] = ['needs_you', 'working', 'blocked', 'idle', 'offline', 'unknown', 'stale']

const SLOT_BY_KIND: Record<TabKind, InspectorSlot[]> = {
  office: ['fleet', 'context'],
  board: ['task'],
  canvas: ['node', 'history'],
  run: ['events'],
  task: ['task'],
  lens: ['row'],
  profile: ['row']
}

let memory: NavFile | null = null
const listeners = new Set<() => void>()

export function subscribeOpsNavigation(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

function pinnedTab(view: (typeof PINNED_VIEWS)[number]): OpsTab {
  return {
    id: view.id,
    kind: view.id,
    label: view.label,
    route: view.route,
    pinned: true,
    closable: false
  }
}

export function emptySnapshot(): NavSnapshot {
  return { ...EMPTY_SNAPSHOT }
}

export function defaultScope(): ScopeNav {
  const tabs = PINNED_VIEWS.map(pinnedTab)
  const snapshots: Record<string, NavSnapshot> = {}

  for (const tab of tabs) {
    snapshots[tab.id] = emptySnapshot()
  }

  return {
    rail: 'full',
    inspectorOpen: true,
    inspectorSlot: 'fleet',
    dockOpen: false,
    dockSlot: 'log',
    selectedTabId: 'office',
    tabs,
    pins: [],
    history: [{ tabId: 'office', snapshot: emptySnapshot() }],
    historyIndex: 0,
    dots: {},
    lastSeen: {},
    snapshots,
    filter: ''
  }
}

export function opsScopeKey(connectionId: string | null | undefined, profile: string | null | undefined): string {
  return backendScopeKey(connectionId, profile)
}

export function isPinnedView(id: string): boolean {
  return PINNED_VIEWS.some(view => view.id === id)
}

export function lensById(id: string) {
  return LENS_CATALOG.find(lens => lens.id === id) ?? null
}

export function slotsForKind(kind: TabKind): InspectorSlot[] {
  return SLOT_BY_KIND[kind]
}

export function effectiveRail(preference: RailState, paneWidth: number): RailState {
  if (preference === 'hidden') {
    return 'hidden'
  }

  if (paneWidth < OPS_RAIL_ICONS_PX) {
    return 'icons'
  }

  return preference
}

export interface OpsNarrow {
  inspector: 'docked' | 'overlay'
  rail: RailState
  tabs: 'strip' | 'dropdown'
}

/** Pane-container widths. Equal to the threshold stays on the wider side. */
export function narrowFromPane(paneWidth: number, preference: RailState = 'full'): OpsNarrow {
  return {
    inspector: paneWidth < OPS_INSPECTOR_OVERLAY_PX ? 'overlay' : 'docked',
    rail: effectiveRail(preference, paneWidth),
    tabs: paneWidth < OPS_TABS_DROPDOWN_PX ? 'dropdown' : 'strip'
  }
}

function isSnapshot(value: unknown): value is NavSnapshot {
  if (!value || typeof value !== 'object') {
    return false
  }

  const row = value as NavSnapshot

  return typeof row.scrollTop === 'number' && typeof row.filter === 'string'
}

function isTab(value: unknown): value is OpsTab {
  if (!value || typeof value !== 'object') {
    return false
  }

  const row = value as OpsTab

  return typeof row.id === 'string' && typeof row.route === 'string' && typeof row.kind === 'string'
}

function sanitizeScope(value: unknown): ScopeNav {
  const base = defaultScope()

  if (!value || typeof value !== 'object') {
    return base
  }

  const row = value as Partial<ScopeNav>
  const tabs = Array.isArray(row.tabs) ? row.tabs.filter(isTab) : []
  const pinned = PINNED_VIEWS.map(pinnedTab)
  const closable = tabs.filter(tab => !isPinnedView(tab.id))
  const snapshots = { ...base.snapshots }

  if (row.snapshots && typeof row.snapshots === 'object') {
    for (const [id, snapshot] of Object.entries(row.snapshots)) {
      if (isSnapshot(snapshot)) {
        snapshots[id] = {
          scrollTop: snapshot.scrollTop,
          focusId: snapshot.focusId ?? null,
          selectionId: snapshot.selectionId ?? null,
          filter: snapshot.filter
        }
      }
    }
  }

  const selected = typeof row.selectedTabId === 'string' ? row.selectedTabId : base.selectedTabId
  const nextTabs = [...pinned, ...closable]

  return {
    rail: row.rail === 'icons' || row.rail === 'hidden' || row.rail === 'full' ? row.rail : base.rail,
    inspectorOpen: typeof row.inspectorOpen === 'boolean' ? row.inspectorOpen : base.inspectorOpen,
    inspectorSlot: isSlot(row.inspectorSlot) ? row.inspectorSlot : base.inspectorSlot,
    dockOpen: typeof row.dockOpen === 'boolean' ? row.dockOpen : base.dockOpen,
    dockSlot: row.dockSlot === 'log' || row.dockSlot === 'events' || row.dockSlot === 'problems' ? row.dockSlot : base.dockSlot,
    selectedTabId: nextTabs.some(tab => tab.id === selected) ? selected : 'office',
    tabs: nextTabs,
    pins: Array.isArray(row.pins) ? row.pins.filter(id => typeof id === 'string') : [],
    history: Array.isArray(row.history) ? row.history.filter(entry => entry && typeof entry.tabId === 'string') : base.history,
    historyIndex: typeof row.historyIndex === 'number' ? row.historyIndex : 0,
    dots: row.dots && typeof row.dots === 'object' ? { ...row.dots } : {},
    lastSeen: row.lastSeen && typeof row.lastSeen === 'object' ? { ...row.lastSeen } : {},
    snapshots,
    filter: typeof row.filter === 'string' ? row.filter : ''
  }
}

function isSlot(value: unknown): value is InspectorSlot {
  return (
    value === 'fleet' ||
    value === 'context' ||
    value === 'task' ||
    value === 'node' ||
    value === 'history' ||
    value === 'events' ||
    value === 'row'
  )
}

function readFile(): NavFile {
  if (memory) {
    return memory
  }

  const parsed = readJson<Partial<NavFile>>(OPS_NAV_STORAGE_KEY)

  if (!parsed || parsed.version !== 1 || !parsed.scopes || typeof parsed.scopes !== 'object') {
    memory = { version: 1, scopes: {} }

    return memory
  }

  const scopes: Record<string, ScopeNav> = {}

  for (const [key, value] of Object.entries(parsed.scopes)) {
    scopes[key] = sanitizeScope(value)
  }

  memory = { version: 1, scopes }

  return memory
}

function writeFile(file: NavFile): void {
  memory = file
  writeJson(OPS_NAV_STORAGE_KEY, Object.keys(file.scopes).length === 0 ? null : file)
  notify()
}

function commit(key: string, scope: ScopeNav): ScopeNav {
  const file = readFile()

  file.scopes[key] = scope
  writeFile(file)

  return scope
}

export function resetOpsNavigationForTests(): void {
  memory = null
  writeJson(OPS_NAV_STORAGE_KEY, null)
}

export function loadScope(connectionId: string | null | undefined, profile: string | null | undefined): ScopeNav {
  const key = opsScopeKey(connectionId, profile)
  const file = readFile()

  return file.scopes[key] ? sanitizeScope(file.scopes[key]) : defaultScope()
}

export function saveScope(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  scope: ScopeNav
): ScopeNav {
  return commit(opsScopeKey(connectionId, profile), scope)
}

export function cycleRail(current: RailState): RailState {
  if (current === 'full') {
    return 'icons'
  }

  if (current === 'icons') {
    return 'hidden'
  }

  return 'full'
}

export function setRail(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  rail: RailState
): ScopeNav {
  return saveScope(connectionId, profile, { ...loadScope(connectionId, profile), rail })
}

export function setInspectorOpen(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  inspectorOpen: boolean
): ScopeNav {
  return saveScope(connectionId, profile, { ...loadScope(connectionId, profile), inspectorOpen })
}

export function setInspectorSlot(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  inspectorSlot: InspectorSlot
): ScopeNav {
  const scope = loadScope(connectionId, profile)
  const tab = scope.tabs.find(item => item.id === scope.selectedTabId)
  const allowed = tab ? slotsForKind(tab.kind) : []

  return saveScope(connectionId, profile, {
    ...scope,
    inspectorSlot: allowed.includes(inspectorSlot) ? inspectorSlot : scope.inspectorSlot
  })
}

export function setDock(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  patch: { dockOpen?: boolean; dockSlot?: DockSlot }
): ScopeNav {
  return saveScope(connectionId, profile, { ...loadScope(connectionId, profile), ...patch })
}

export function setFilter(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  filter: string
): ScopeNav {
  const scope = loadScope(connectionId, profile)
  const current = scope.snapshots[scope.selectedTabId] ?? emptySnapshot()

  return saveScope(connectionId, profile, {
    ...scope,
    filter,
    snapshots: {
      ...scope.snapshots,
      [scope.selectedTabId]: { ...current, filter }
    }
  })
}

function remember(scope: ScopeNav, tabId: string, snapshot: NavSnapshot): ScopeNav {
  const history = scope.history.slice(0, scope.historyIndex + 1)
  history.push({ tabId, snapshot })

  return {
    ...scope,
    history,
    historyIndex: history.length - 1,
    snapshots: { ...scope.snapshots, [tabId]: snapshot }
  }
}

export function selectTab(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  tabId: string,
  leaving?: NavSnapshot
): ScopeNav {
  const scope = loadScope(connectionId, profile)
  const tab = scope.tabs.find(item => item.id === tabId)

  if (!tab) {
    return scope
  }

  const previous = leaving ?? scope.snapshots[scope.selectedTabId] ?? emptySnapshot()

  const withLeave = {
    ...scope,
    snapshots: { ...scope.snapshots, [scope.selectedTabId]: previous }
  }

  const arriving = withLeave.snapshots[tabId] ?? emptySnapshot()
  const next = remember(withLeave, tabId, arriving)
  const slots = slotsForKind(tab.kind)

  return saveScope(connectionId, profile, {
    ...next,
    selectedTabId: tabId,
    inspectorSlot: slots.includes(next.inspectorSlot) ? next.inspectorSlot : slots[0],
    filter: arriving.filter,
    dots: Object.fromEntries(Object.entries(next.dots).filter(([id]) => id !== tabId))
  })
}

export function closeTab(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  tabId: string
): ScopeNav {
  const scope = loadScope(connectionId, profile)
  const tab = scope.tabs.find(item => item.id === tabId)

  if (!tab || tab.pinned || !tab.closable || isPinnedView(tabId)) {
    return scope
  }

  const tabs = scope.tabs.filter(item => item.id !== tabId)
  const selectedTabId = scope.selectedTabId === tabId ? 'office' : scope.selectedTabId
  const snapshots = { ...scope.snapshots }
  const dots = { ...scope.dots }
  const lastSeen = { ...scope.lastSeen }

  delete snapshots[tabId]
  delete dots[tabId]
  delete lastSeen[tabId]

  const filteredHistory = scope.history.filter(entry => entry.tabId !== tabId)
  const selected = tabs.find(item => item.id === selectedTabId)
  const slots = selected ? slotsForKind(selected.kind) : slotsForKind('office')
  const arriving = snapshots[selectedTabId] ?? emptySnapshot()
  // The remaining selected tab is the history cursor. A clamped index can
  // point at a different tab than the one the shell is showing.
  let history = filteredHistory.length > 0 ? filteredHistory : [{ tabId: selectedTabId, snapshot: arriving }]
  let historyIndex = -1

  for (let i = 0; i < history.length; i += 1) {
    if (history[i].tabId === selectedTabId) {
      historyIndex = i
    }
  }

  if (historyIndex < 0) {
    history = [...history, { tabId: selectedTabId, snapshot: arriving }]
    historyIndex = history.length - 1
  }

  return saveScope(connectionId, profile, {
    ...scope,
    tabs,
    selectedTabId,
    snapshots,
    dots,
    lastSeen,
    history,
    historyIndex,
    inspectorSlot: slots.includes(scope.inspectorSlot) ? scope.inspectorSlot : slots[0],
    filter: arriving.filter
  })
}

export function openLens(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  lensId: string
): ScopeNav {
  const lens = lensById(lensId)
  const scope = loadScope(connectionId, profile)

  if (!lens) {
    return scope
  }

  const id = `lens:${lens.id}`
  const existing = scope.tabs.find(tab => tab.id === id)

  const tab: OpsTab = existing ?? {
    id,
    kind: 'lens',
    label: lens.label,
    route: lens.route,
    pinned: false,
    closable: true,
    unavailable: lens.unavailable
  }

  const tabs = existing ? scope.tabs : [...scope.tabs, tab]

  saveScope(connectionId, profile, { ...scope, tabs })

  return selectTab(connectionId, profile, id)
}

export function openTaskTab(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  taskId: string,
  label: string
): ScopeNav {
  const id = `task:${taskId}`
  const scope = loadScope(connectionId, profile)

  const tab: OpsTab = {
    id,
    kind: 'task',
    label,
    route: `/kanban?task=${encodeURIComponent(taskId)}`,
    pinned: false,
    closable: true
  }

  const tabs = scope.tabs.some(item => item.id === id) ? scope.tabs : [...scope.tabs, tab]

  saveScope(connectionId, profile, { ...scope, tabs })

  return selectTab(connectionId, profile, id)
}

export function openRunTab(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  runId: string
): ScopeNav {
  const id = `run:${runId}`
  const scope = loadScope(connectionId, profile)

  const tab: OpsTab = {
    id,
    kind: 'run',
    label: `run ${runId}`,
    route: `/ops/run/${encodeURIComponent(runId)}`,
    pinned: false,
    closable: true
  }

  const tabs = scope.tabs.some(item => item.id === id) ? scope.tabs : [...scope.tabs, tab]

  saveScope(connectionId, profile, { ...scope, tabs })

  return selectTab(connectionId, profile, id)
}

export function openProfileTab(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  name: string
): ScopeNav {
  const id = `profile:${name}`
  const scope = loadScope(connectionId, profile)

  const tab: OpsTab = {
    id,
    kind: 'profile',
    label: name,
    route: `/profiles?profile=${encodeURIComponent(name)}`,
    pinned: false,
    closable: true
  }

  const tabs = scope.tabs.some(item => item.id === id) ? scope.tabs : [...scope.tabs, tab]

  saveScope(connectionId, profile, { ...scope, tabs })

  return selectTab(connectionId, profile, id)
}

export interface HostDocument {
  view: string
  id: string | null
}

/** Route identity for a tab. Office/Canvas/Board stay view-only; task/run/profile keep the id. */
export function hostIdentityFromTab(tab: OpsTab): HostDocument {
  if (tab.kind === 'task') {
    return { view: 'task', id: tab.id.startsWith('task:') ? tab.id.slice(5) : tab.id }
  }

  if (tab.kind === 'run') {
    return { view: 'run', id: tab.id.startsWith('run:') ? tab.id.slice(4) : tab.id }
  }

  if (tab.kind === 'profile') {
    return { view: 'profile', id: tab.id.startsWith('profile:') ? tab.id.slice(8) : tab.id }
  }

  if (tab.kind === 'lens') {
    return { view: tab.id.startsWith('lens:') ? tab.id.slice(5) : tab.id, id: null }
  }

  return { view: tab.kind, id: null }
}

/** Tab id a host view/viewId must show. Unknown views return null — no invented document. */
export function hostDocumentId(view: string, viewId: string | null | undefined): string | null {
  if (view === 'office' || view === 'canvas' || view === 'board') {
    return view
  }

  if (view === 'task' && viewId) {
    return `task:${viewId}`
  }

  if (view === 'run' && viewId) {
    return `run:${viewId}`
  }

  if (view === 'profile' && viewId) {
    return `profile:${viewId}`
  }

  if (lensById(view)) {
    return `lens:${view}`
  }

  return null
}

/**
 * Make the scoped selected tab match the host route. Idempotent when already there.
 * Unknown views leave the scope alone.
 */
export function applyHostDocument(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  view: string,
  viewId: string | null | undefined
): ScopeNav {
  const target = hostDocumentId(view, viewId)
  const scope = loadScope(connectionId, profile)

  if (!target || (scope.selectedTabId === target && scope.tabs.some(tab => tab.id === target))) {
    return scope
  }

  if (view === 'task' && viewId) {
    return openTaskTab(connectionId, profile, viewId, viewId)
  }

  if (view === 'run' && viewId) {
    return openRunTab(connectionId, profile, viewId)
  }

  if (view === 'profile' && viewId) {
    return openProfileTab(connectionId, profile, viewId)
  }

  if (lensById(view)) {
    return openLens(connectionId, profile, view)
  }

  if (view === 'office' || view === 'canvas' || view === 'board') {
    return selectTab(connectionId, profile, view)
  }

  return scope
}

/** Open a pin. Unpin is a separate control — this never removes the pin. */
export function openPin(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  pinId: string
): ScopeNav {
  if (pinId.startsWith('lens:')) {
    return openLens(connectionId, profile, pinId.slice(5))
  }

  if (pinId.startsWith('task:')) {
    const taskId = pinId.slice(5)

    return openTaskTab(connectionId, profile, taskId, taskId)
  }

  if (pinId.startsWith('run:')) {
    return openRunTab(connectionId, profile, pinId.slice(4))
  }

  if (pinId.startsWith('profile:')) {
    return openProfileTab(connectionId, profile, pinId.slice(8))
  }

  return selectTab(connectionId, profile, pinId)
}

export function togglePin(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  pinId: string
): ScopeNav {
  const scope = loadScope(connectionId, profile)
  const pins = scope.pins.includes(pinId) ? scope.pins.filter(id => id !== pinId) : [...scope.pins, pinId]

  return saveScope(connectionId, profile, { ...scope, pins })
}

export function captureSnapshot(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  tabId: string,
  snapshot: NavSnapshot
): ScopeNav {
  const scope = loadScope(connectionId, profile)

  return saveScope(connectionId, profile, {
    ...scope,
    snapshots: { ...scope.snapshots, [tabId]: snapshot },
    filter: tabId === scope.selectedTabId ? snapshot.filter : scope.filter
  })
}

export function goHistory(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  direction: -1 | 1
): ScopeNav {
  const scope = loadScope(connectionId, profile)
  const index = scope.historyIndex + direction
  const entry = scope.history[index]

  if (!entry || !scope.tabs.some(tab => tab.id === entry.tabId)) {
    return scope
  }

  return saveScope(connectionId, profile, {
    ...scope,
    historyIndex: index,
    selectedTabId: entry.tabId,
    filter: entry.snapshot.filter,
    snapshots: { ...scope.snapshots, [entry.tabId]: entry.snapshot }
  })
}

/**
 * A background event may mark a dot. It must not change the selected tab,
 * history, scroll snapshot, or focus. The caller must not focus either.
 */
export function noteBackgroundEvent(
  connectionId: string | null | undefined,
  profile: string | null | undefined,
  tabId: string,
  dot: TabDot,
  eventId?: number
): ScopeNav {
  const scope = loadScope(connectionId, profile)

  if (scope.selectedTabId === tabId) {
    return saveScope(connectionId, profile, {
      ...scope,
      lastSeen: eventId == null ? scope.lastSeen : { ...scope.lastSeen, [tabId]: eventId }
    })
  }

  return saveScope(connectionId, profile, {
    ...scope,
    dots: { ...scope.dots, [tabId]: dot },
    lastSeen: eventId == null ? scope.lastSeen : { ...scope.lastSeen, [tabId]: scope.lastSeen[tabId] ?? eventId }
  })
}

export function visibleTabs(tabs: OpsTab[], activeId: string, maxVisible: number) {
  const pinned = tabs.filter(tab => tab.pinned)
  const closable = tabs.filter(tab => !tab.pinned)
  const room = Math.max(0, maxVisible - pinned.length)
  let shown = closable.slice(0, room)
  let overflow = closable.slice(room)
  const activeOverflow = overflow.find(tab => tab.id === activeId)

  if (activeOverflow && shown.length > 0) {
    const displaced = shown[shown.length - 1]
    shown = [...shown.slice(0, -1), activeOverflow]
    overflow = [displaced, ...overflow.filter(tab => tab.id !== activeId)]
  }

  return { overflow, visible: [...pinned, ...shown] }
}

const ONLINE: ReadonlySet<PresenceState> = new Set(['working', 'needs_you', 'blocked', 'idle'])

export function arrangeFleet(feed: FleetFeed): FleetArrangement {
  const groups: FleetGroup[] = []

  for (const presence of FLEET_ORDER) {
    const rows = feed.rows.filter(row => row.presence === presence)

    if (rows.length === 0) {
      continue
    }

    groups.push({
      id: presence,
      label: presence === 'needs_you' ? 'needs-you' : presence,
      rows,
      folded: presence === 'idle'
    })
  }

  const unclassified = feed.rows.filter(row => row.presence == null)

  if (unclassified.length > 0) {
    groups.push({
      id: 'unknown',
      label: 'unknown',
      rows: unclassified.map(row => ({ ...row, presence: 'unknown' })),
      folded: false
    })
  }

  return {
    onlineLabel: feed.a1 === 'missing' ? 'unavailable' : String(feed.rows.filter(row => row.fresh && row.presence && ONLINE.has(row.presence)).length),
    needsYouLabel: feed.a3 === 'missing' ? 'unavailable' : String(feed.rows.filter(row => row.presence === 'needs_you').length),
    groups
  }
}

export function flattenFleet(groups: FleetGroup[], idleExpanded: boolean): FleetFlatRow[] {
  const flat: FleetFlatRow[] = []

  for (const group of groups) {
    flat.push({ kind: 'header', id: `group:${group.id}`, label: group.label })

    if (group.id === 'unknown' && group.rows.length > 0) {
      flat.push({ kind: 'hint', id: `hint:${group.id}`, label: group.label })
    }

    if (group.folded && !idleExpanded) {
      flat.push({
        kind: 'folded',
        id: `folded:${group.id}`,
        label: `${group.rows.length} idle`,
        count: group.rows.length,
        presence: 'idle'
      })

      continue
    }

    for (const member of group.rows) {
      flat.push({ kind: 'member', id: member.id, member })
    }
  }

  return flat
}

export function fleetWindow<T>(rows: T[], scrollTop: number, viewport = FLEET_VIEW_PX, rowHeight = FLEET_ROW_PX) {
  const start = Math.max(0, Math.floor(Math.max(0, scrollTop) / rowHeight) - 2)
  const count = Math.ceil(viewport / rowHeight) + 4
  const end = Math.min(rows.length, start + count)

  return {
    start,
    end,
    slice: rows.slice(start, end),
    paddingTop: start * rowHeight,
    paddingBottom: Math.max(0, rows.length - end) * rowHeight,
    total: rows.length
  }
}

export function runFooter(run: FocusedRun | null | undefined): RunFooterModel | null {
  if (!run || !run.id) {
    return null
  }

  const raw = run.tokens
  const shown = raw == null || Number.isNaN(raw) ? 'unknown' : String(raw)

  return {
    id: run.id,
    elapsed: run.elapsed && run.elapsed.trim() ? run.elapsed : 'unknown',
    tokens: shown
  }
}

export function activeInspectorSlot(scope: ScopeNav): InspectorSlot | 'unknown' {
  const tab = scope.tabs.find(item => item.id === scope.selectedTabId)

  if (!tab) {
    return 'unknown'
  }

  return slotsForKind(tab.kind).includes(scope.inspectorSlot) ? scope.inspectorSlot : 'unknown'
}

function rewriteProfileKey(value: string, from: string, to: string): string {
  return value === `profile:${from}` ? `profile:${to}` : value
}

function rewriteRecord<T>(record: Record<string, T>, from: string, to: string): Record<string, T> {
  const next: Record<string, T> = {}

  for (const [key, value] of Object.entries(record)) {
    next[rewriteProfileKey(key, from, to)] = value
  }

  return next
}

/** Every profile-keyed reference moves. Scroll, filter, and chrome stay with the scope. */
function rewriteProfileRefs(scope: ScopeNav, from: string, to: string): ScopeNav {
  const rewrite = (value: string) => rewriteProfileKey(value, from, to)
  const snapshots = rewriteRecord(scope.snapshots, from, to)
  const selectedTabId = rewrite(scope.selectedTabId)
  const selected = snapshots[selectedTabId]

  return {
    ...scope,
    pins: scope.pins.map(rewrite),
    tabs: scope.tabs.map(tab =>
      tab.id === `profile:${from}`
        ? { ...tab, id: `profile:${to}`, label: to, route: `/profiles?profile=${encodeURIComponent(to)}` }
        : tab
    ),
    selectedTabId,
    history: scope.history.map(entry => ({ ...entry, tabId: rewrite(entry.tabId) })),
    snapshots,
    dots: rewriteRecord(scope.dots, from, to),
    lastSeen: rewriteRecord(scope.lastSeen, from, to),
    filter: selected?.filter ?? scope.filter
  }
}

function mergeMovedScope(existing: ScopeNav, incoming: ScopeNav): ScopeNav {
  const tabs = [...existing.tabs]

  for (const tab of incoming.tabs) {
    if (!tabs.some(item => item.id === tab.id)) {
      tabs.push(tab)
    }
  }

  const history = [...existing.history]

  for (const entry of incoming.history) {
    if (!history.some(item => item.tabId === entry.tabId)) {
      history.push(entry)
    }
  }

  return {
    ...existing,
    tabs,
    pins: [...existing.pins, ...incoming.pins.filter(id => !existing.pins.includes(id))],
    history,
    snapshots: { ...incoming.snapshots, ...existing.snapshots },
    dots: { ...incoming.dots, ...existing.dots },
    lastSeen: { ...incoming.lastSeen, ...existing.lastSeen }
  }
}

/** Local rename only. A remote profile with the same name stays on its key. */
export function migrateOpsNavigationForProfile(oldProfile: string, newProfile: string): void {
  const from = oldProfile.trim()
  const to = newProfile.trim()

  if (!from || !to || from === to) {
    return
  }

  const file = readFile()
  const sourceKey = backendScopeKey(LOCAL_CONNECTION_ID, from)
  const targetKey = backendScopeKey(LOCAL_CONNECTION_ID, to)
  const moved = file.scopes[sourceKey]

  if (!moved) {
    return
  }

  delete file.scopes[sourceKey]
  const rewritten = rewriteProfileRefs(sanitizeScope(moved), from, to)
  const existing = file.scopes[targetKey]

  file.scopes[targetKey] = existing ? mergeMovedScope(sanitizeScope(existing), rewritten) : rewritten
  writeFile(file)
}

export function dropOpsNavigationForProfile(
  profile: string,
  route?: { connectionId?: string; profile?: string }
): void {
  const name = (route?.profile ?? profile).trim() || 'default'
  const connection = String(route?.connectionId ?? '').trim()
  const file = readFile()

  for (const key of Object.keys(file.scopes)) {
    if (connection) {
      if (key === backendScopeKey(connection, name)) {
        delete file.scopes[key]
      }

      continue
    }

    if (route) {
      if (key === name || key.endsWith(`::${name}`)) {
        delete file.scopes[key]
      }

      continue
    }

    if (key === backendScopeKey(LOCAL_CONNECTION_ID, name)) {
      delete file.scopes[key]
    }
  }

  writeFile(file)
}
