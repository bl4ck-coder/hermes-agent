/**
 * Ops split width, scoped to connection + profile.
 *
 * SPEC D14 / P0-04 audit §3. The key is `hermes.desktop.opsSplit.v1`.
 * It is not `LAYOUT_KEYS` (pane shares, layout tree, pane states). A remote
 * connection must not inherit a local width. Model policy P2 is not exercised:
 * this module writes no model and no `ops-policy.yaml`.
 */

import { atom } from 'nanostores'

import { readKey, writeKey } from '@/lib/storage'

export const OPS_SPLIT_STORAGE_KEY = 'hermes.desktop.opsSplit.v1'
export const OPS_PANE_ID = 'ops'
export const OPS_GUTTER_PX = 24
export const OPS_FULLSCREEN_ESCAPE_PRIORITY = 5

/** R53, measured on the Ops pane container, not the window. */
export const OPS_INSPECTOR_OVERLAY_PX = 1280
export const OPS_RAIL_ICONS_PX = 1024
export const OPS_TABS_DROPDOWN_PX = 800

export const OPS_MIN_WIDTH_PX = 280
export const CHAT_MIN_WIDTH_PX = 320
export const OPS_DEFAULT_WIDTH_PX = 480
const OPS_HARD_FLOOR_PX = 160

export type OpsRailPreference = 'full' | 'icons' | 'hidden'

export interface OpsNarrow {
  inspector: 'docked' | 'overlay'
  rail: 'full' | 'icons' | 'hidden'
  tabs: 'strip' | 'dropdown'
}

export interface OpsScope {
  connectionId: string
  profile: string
  remote: boolean
  label: string
}

export interface OpsScopeLayout {
  widthPx: number
  rail: OpsRailPreference
}

interface OpsSplitFile {
  version: 1
  scopes: Record<string, OpsScopeLayout>
}

export const $opsScope = atom<OpsScope>({
  connectionId: 'local',
  profile: 'default',
  remote: false,
  label: 'local'
})

export const $opsWidthPx = atom(OPS_DEFAULT_WIDTH_PX)
export const $opsRail = atom<OpsRailPreference>('full')
export const $opsView = atom('office')
export const $opsViewId = atom<string | null>(null)
export const $opsOpen = atom(false)
export const $opsFullscreen = atom(false)
export const $opsInspectorOpen = atom(true)
export const $opsChatSessionId = atom<string | null>(null)

export interface OpsLiveSession {
  id: string
  title: string
  working: boolean
}

export const $opsLiveSession = atom<OpsLiveSession | null>(null)

export function opsScopeKey(connectionId: string | null | undefined, profile: string | null | undefined): string {
  const connection = (connectionId ?? '').trim() || 'local'
  const name = (profile ?? '').trim() || 'default'

  return `${connection}::${name}`
}

export function clampOpsWidth(requested: number, containerWidth: number): number {
  const container = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth : OPS_DEFAULT_WIDTH_PX + CHAT_MIN_WIDTH_PX
  const chatMin = Math.min(CHAT_MIN_WIDTH_PX, Math.floor(container / 2))
  const room = Math.max(OPS_HARD_FLOOR_PX, container - chatMin)
  const opsMin = Math.min(OPS_MIN_WIDTH_PX, room)
  const max = Math.max(opsMin, container - chatMin)
  const width = Number.isFinite(requested) ? requested : OPS_DEFAULT_WIDTH_PX

  return Math.round(Math.min(max, Math.max(opsMin, width)))
}

/** Effective rail: a hidden preference wins. Under 1024 a full rail becomes icons (R53). */
export function effectiveRail(preference: OpsRailPreference, paneWidth: number): 'full' | 'icons' | 'hidden' {
  if (preference === 'hidden') {
    return 'hidden'
  }

  if (paneWidth < OPS_RAIL_ICONS_PX) {
    return 'icons'
  }

  return preference
}

export function narrowStrategy(paneWidth: number, preference: OpsRailPreference = 'full'): OpsNarrow {
  return {
    inspector: paneWidth < OPS_INSPECTOR_OVERLAY_PX ? 'overlay' : 'docked',
    rail: effectiveRail(preference, paneWidth),
    tabs: paneWidth < OPS_TABS_DROPDOWN_PX ? 'dropdown' : 'strip'
  }
}

function readFile(): OpsSplitFile {
  const raw = readKey(OPS_SPLIT_STORAGE_KEY)

  if (!raw) {
    return { version: 1, scopes: {} }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OpsSplitFile>

    if (!parsed || parsed.version !== 1 || !parsed.scopes || typeof parsed.scopes !== 'object') {
      return { version: 1, scopes: {} }
    }

    return { version: 1, scopes: { ...parsed.scopes } }
  } catch {
    return { version: 1, scopes: {} }
  }
}

function writeFile(file: OpsSplitFile): void {
  writeKey(OPS_SPLIT_STORAGE_KEY, JSON.stringify(file))
}

function isLayout(value: unknown): value is OpsScopeLayout {
  if (!value || typeof value !== 'object') {
    return false
  }

  const row = value as OpsScopeLayout

  return (
    typeof row.widthPx === 'number' &&
    Number.isFinite(row.widthPx) &&
    (row.rail === 'full' || row.rail === 'icons' || row.rail === 'hidden')
  )
}

export function readOpsLayout(connectionId: string, profile: string): OpsScopeLayout {
  const row = readFile().scopes[opsScopeKey(connectionId, profile)]

  if (!isLayout(row)) {
    return { widthPx: OPS_DEFAULT_WIDTH_PX, rail: 'full' }
  }

  return { widthPx: row.widthPx, rail: row.rail }
}

export function writeOpsLayout(connectionId: string, profile: string, layout: OpsScopeLayout): void {
  const file = readFile()
  file.scopes[opsScopeKey(connectionId, profile)] = {
    widthPx: layout.widthPx,
    rail: layout.rail
  }
  writeFile(file)
}

export function resizeOpsSplit(requested: number, containerWidth: number, scope: OpsScope = $opsScope.get()): number {
  const widthPx = clampOpsWidth(requested, containerWidth)
  const current = readOpsLayout(scope.connectionId, scope.profile)

  writeOpsLayout(scope.connectionId, scope.profile, { ...current, widthPx })
  $opsWidthPx.set(widthPx)

  return widthPx
}

export function setOpsRail(rail: OpsRailPreference, scope: OpsScope = $opsScope.get()): void {
  const current = readOpsLayout(scope.connectionId, scope.profile)

  writeOpsLayout(scope.connectionId, scope.profile, { ...current, rail })
  $opsRail.set(rail)
}

export function loadOpsScope(scope: OpsScope): void {
  const layout = readOpsLayout(scope.connectionId, scope.profile)

  $opsScope.set(scope)
  $opsWidthPx.set(layout.widthPx)
  $opsRail.set(layout.rail)
}

/**
 * Local-connection counterpart of `migrateTilesForProfile`. Remote keys stay.
 * Callers outside this slice (rename dialog) should call this too; the dialog
 * is not in this hop's file list, so the function is the hook.
 */
export function migrateOpsSplitForProfile(oldProfile: string, newProfile: string): void {
  const from = (oldProfile ?? '').trim()
  const to = (newProfile ?? '').trim()

  if (!from || !to || from === to) {
    return
  }

  const file = readFile()
  const source = opsScopeKey('local', from)
  const target = opsScopeKey('local', to)
  const row = file.scopes[source]

  if (!row) {
    return
  }

  delete file.scopes[source]
  file.scopes[target] = row
  writeFile(file)
}

export function dropOpsSplitForProfile(profile: string, connectionId?: string): void {
  const name = (profile ?? '').trim()

  if (!name) {
    return
  }

  const file = readFile()
  const suffix = `::${name}`

  for (const key of Object.keys(file.scopes)) {
    if (connectionId) {
      if (key === opsScopeKey(connectionId, name)) {
        delete file.scopes[key]
      }
    } else if (key.endsWith(suffix)) {
      delete file.scopes[key]
    }
  }

  writeFile(file)
}

export function opsSplitStorageKeys(): string[] {
  return [OPS_SPLIT_STORAGE_KEY]
}
