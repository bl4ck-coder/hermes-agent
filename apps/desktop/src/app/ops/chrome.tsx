// Ops chrome on the existing titlebar, palette, and status bar. No second bar.

import { atom } from 'nanostores'
import { useEffect, useRef, useState } from 'react'

import { setStatusbarItemGroup, setTitlebarToolGroup } from '@/app/contrib/panes'
import type { TitlebarTool } from '@/app/shell/titlebar-controls'
import type { StatusbarItem } from '@/app/shell/statusbar-controls'
import { Contribute } from '@/contrib/react/contribute'
import { TITLEBAR_AREAS } from '@/sdk/areas'
import { openCommandPalettePage } from '@/store/command-palette'
import { pushEscapeLayer, type EscapeLayerHandle } from '@/lib/escape-layers'

import {
  MODEL_EDIT_UNAVAILABLE,
  OPS_FULLSCREEN_PRIORITY,
  OPS_LAYER_PRIORITY,
  OPS_PALETTE_PAGE,
  registerOpsKeymapHost,
  type OpsKeymapHost,
  type OpsTabClose
} from './keymap'
import { setOpsPaletteScope } from './palette'
import { OpsShortcutSheet } from './shortcut-sheet'

export const OPS_STATUSBAR_GROUP = 'ops'

/** Same number the dock must show. Unknown stays null, never a fabricated 0. */
export const $opsProblemsCount = atom<number | null>(null)

export interface OpsGatewaySource {
  health: string
  version: string
}

export interface OpsTokenSource {
  total: number
  provenance: string
}

export interface OpsStatusSources {
  focusedRunId?: string | null
  workingCount?: number | null
  needsYouCount?: number | null
  todayTokens?: OpsTokenSource | null
  gateway?: OpsGatewaySource | null
  motionMode?: 'full' | 'reduced' | 'system' | null
  dockOpen?: boolean | null
  problemsCount?: number | null
  branch?: string | null
  worktreeFocused?: boolean
}

export interface OpsChromeProps {
  connectionId: string
  connectionLabel?: string | null
  profile: string
  profileLabel?: string | null
  viewLabel?: string | null
  chatHotHidden?: boolean
  modelLabel?: string | null
  sources: OpsStatusSources
  fullscreen?: boolean
  dockOverlay?: boolean
  inspectorPopover?: boolean
  onCycleMotion?: () => void
  onToggleDock?: () => void
  onExitFullscreen?: () => void
  onCloseDockOverlay?: () => void
  onCloseInspector?: () => void
  host?: Partial<OpsKeymapHost>
}

function sourcedNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function textItem(id: string, label: string, title?: string): StatusbarItem {
  return { id, label, title, variant: 'text' }
}

export function opsStatusbarItems(
  sources: OpsStatusSources,
  profileLabel: string | null | undefined,
  actions: { onCycleMotion?: () => void; onToggleDock?: () => void }
): { left: StatusbarItem[]; right: StatusbarItem[] } {
  const left: StatusbarItem[] = []
  const right: StatusbarItem[] = []

  if (profileLabel) {
    left.push(textItem('ops-profile', profileLabel))
  }

  if (sources.focusedRunId) {
    left.push(textItem('ops-run', `run #${sources.focusedRunId}`))
  }

  if (sourcedNumber(sources.workingCount)) {
    left.push(textItem('ops-working', `${sources.workingCount} working`))
  }

  if (sourcedNumber(sources.needsYouCount)) {
    left.push(textItem('ops-needs-you', `${sources.needsYouCount} needs you`))
  }

  if (sources.todayTokens && sources.todayTokens.provenance) {
    left.push(textItem('ops-tokens', `${sources.todayTokens.total} tok`, sources.todayTokens.provenance))
  }

  if (sources.worktreeFocused && sources.branch) {
    left.push(textItem('ops-branch', sources.branch))
  }

  if (sources.gateway?.health && sources.gateway.version) {
    right.push(textItem('ops-gateway', `${sources.gateway.health} ${sources.gateway.version}`))
  }

  if (sources.motionMode) {
    right.push({
      id: 'ops-motion',
      label: sources.motionMode,
      onSelect: actions.onCycleMotion,
      variant: 'action'
    })
  }

  if (typeof sources.dockOpen === 'boolean') {
    right.push({
      id: 'ops-dock',
      label: sources.dockOpen ? 'Dock open' : 'Dock',
      onSelect: actions.onToggleDock,
      variant: 'action'
    })
  }

  if (sourcedNumber(sources.problemsCount)) {
    right.push({
      id: 'ops-problems',
      label: `Problems ${sources.problemsCount}`,
      render: () => <span data-ops-problems={sources.problemsCount}>{sources.problemsCount}</span>,
      variant: 'text'
    })
  }

  return { left, right }
}

function tool(id: string, label: string, onSelect: () => void): TitlebarTool {
  return { icon: <span aria-hidden="true" />, id, label, onSelect }
}

export function OpsChrome({
  chatHotHidden = false,
  connectionId,
  connectionLabel,
  dockOverlay = false,
  fullscreen = false,
  host,
  inspectorPopover = false,
  modelLabel,
  onCloseDockOverlay,
  onCloseInspector,
  onCycleMotion,
  onExitFullscreen,
  onToggleDock,
  profile,
  profileLabel,
  sources,
  viewLabel
}: OpsChromeProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const hostRef = useRef(host)
  hostRef.current = host
  const sheetRelease = useRef<EscapeLayerHandle | null>(null)
  const dockRelease = useRef<EscapeLayerHandle | null>(null)
  const inspectorRelease = useRef<EscapeLayerHandle | null>(null)
  const fullRelease = useRef<EscapeLayerHandle | null>(null)

  useEffect(() => {
    setOpsPaletteScope({ connectionId, profile })
  }, [connectionId, profile])

  useEffect(() => {
    const closeFocusedTab = (): OpsTabClose => hostRef.current?.closeFocusedTab?.() ?? 'pinned'
    const release = registerOpsKeymapHost({
      cycleTabs: direction => hostRef.current?.cycleTabs?.(direction),
      openSettings: () => hostRef.current?.openSettings?.(),
      closeFocusedTab,
      focusRailFilter: () => hostRef.current?.focusRailFilter?.(),
      go: view => hostRef.current?.go?.(view),
      newTask: () => hostRef.current?.newTask?.(),
      openShortcutSheet: () => {
        hostRef.current?.openShortcutSheet?.()
        setSheetOpen(true)
      },
      editFocused: () => hostRef.current?.editFocused?.(),
      toggleRail: () => hostRef.current?.toggleRail?.(),
      toggleInspector: () => hostRef.current?.toggleInspector?.(),
      toggleDock: () => {
        hostRef.current?.toggleDock?.()
        onToggleDock?.()
      },
      moveSelection: delta => hostRef.current?.moveSelection?.(delta),
      openFocused: () => hostRef.current?.openFocused?.(),
      history: direction => hostRef.current?.history?.(direction),
      focusNextApproval: () => hostRef.current?.focusNextApproval?.(),
      exitFullscreen: () => {
        hostRef.current?.exitFullscreen?.()
        onExitFullscreen?.()
      }
    })

    return release
  }, [onExitFullscreen, onToggleDock])

  useEffect(() => {
    $opsProblemsCount.set(sourcedNumber(sources.problemsCount) ? sources.problemsCount : null)
    const items = opsStatusbarItems(sources, profileLabel, { onCycleMotion, onToggleDock })
    setStatusbarItemGroup(OPS_STATUSBAR_GROUP, items.left, 'left')
    setStatusbarItemGroup(OPS_STATUSBAR_GROUP, items.right, 'right')
    setTitlebarToolGroup('ops-rail', [tool('ops-rail', 'Toggle rail', () => hostRef.current?.toggleRail?.())], 'left')
    setTitlebarToolGroup(
      'ops-inspector',
      [tool('ops-inspector', 'Toggle inspector', () => hostRef.current?.toggleInspector?.())],
      'right'
    )

    return () => {
      setStatusbarItemGroup(OPS_STATUSBAR_GROUP, [], 'left')
      setStatusbarItemGroup(OPS_STATUSBAR_GROUP, [], 'right')
      setTitlebarToolGroup('ops-rail', [], 'left')
      setTitlebarToolGroup('ops-inspector', [], 'right')
      $opsProblemsCount.set(null)
    }
  }, [onCycleMotion, onToggleDock, profileLabel, sources])

  useEffect(() => {
    sheetRelease.current = sheetOpen ? pushEscapeLayer(OPS_LAYER_PRIORITY) : null
    dockRelease.current = dockOverlay ? pushEscapeLayer(OPS_LAYER_PRIORITY) : null
    inspectorRelease.current = inspectorPopover ? pushEscapeLayer(OPS_LAYER_PRIORITY) : null
    fullRelease.current = fullscreen ? pushEscapeLayer(OPS_FULLSCREEN_PRIORITY) : null
    const sheet = sheetRelease.current
    const dock = dockRelease.current
    const inspector = inspectorRelease.current
    const full = fullRelease.current

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) {
        return
      }

      if (sheet?.isTop()) {
        event.preventDefault()
        setSheetOpen(false)

        return
      }

      if (dock?.isTop()) {
        event.preventDefault()
        onCloseDockOverlay?.()

        return
      }

      if (inspector?.isTop()) {
        event.preventDefault()
        onCloseInspector?.()

        return
      }

      if (full?.isTop()) {
        event.preventDefault()
        onExitFullscreen?.()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      sheet?.()
      dock?.()
      inspector?.()
      full?.()
    }
  }, [dockOverlay, fullscreen, inspectorPopover, onCloseDockOverlay, onCloseInspector, onExitFullscreen, sheetOpen])

  const crumb = [connectionLabel, profileLabel, viewLabel].filter(Boolean).join(' / ')
  const showChip = chatHotHidden && Boolean(modelLabel)

  return (
    <div className="contents" data-ops-chrome="" data-ops-root="">
      <Contribute area={TITLEBAR_AREAS.center} id="ops-chrome">
        <div data-ops-titlebar="">
          {crumb ? (
            <nav aria-label="Ops breadcrumb" data-ops-breadcrumb="">
              {crumb}
            </nav>
          ) : null}
          <button data-ops-search-trigger="" onClick={() => openCommandPalettePage(OPS_PALETTE_PAGE)} type="button">
            Search Ops
          </button>
          {showChip ? (
            <button
              aria-disabled="true"
              data-ops-model-chip=""
              disabled
              onClick={event => event.preventDefault()}
              title={MODEL_EDIT_UNAVAILABLE}
              type="button"
            >
              {modelLabel}
            </button>
          ) : null}
        </div>
      </Contribute>
      {sheetOpen ? <OpsShortcutSheet onClose={() => setSheetOpen(false)} /> : null}
    </div>
  )
}
