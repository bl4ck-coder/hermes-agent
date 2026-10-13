// Ops chrome on the existing titlebar, palette, and status bar. No second bar.

import { useStore } from '@nanostores/react'
import { atom } from 'nanostores'
import { useEffect, useRef, useState } from 'react'

import { hermesApi } from '@/api/client'
import { setStatusbarItemGroup, setTitlebarToolGroup } from '@/app/contrib/bar-groups'
import type { StatusbarItem } from '@/app/shell/statusbar-controls'
import type { TitlebarTool } from '@/app/shell/titlebar-controls'
import { ReadonlyModelPill } from '@/components/model-pill-control'
import { Button } from '@/components/ui/button'
import { Contribute } from '@/contrib/react/contribute'
import { useI18n } from '@/i18n'
import { PanelBottom, PanelLeftIcon, SearchIcon } from '@/lib/icons'
import { TITLEBAR_AREAS } from '@/sdk/areas'
import { openCommandPalettePage } from '@/store/command-palette'
import type { AnalyticsResponse, ModelInfoResponse, StatusResponse } from '@/types/hermes'

import {
  OPS_PALETTE_PAGE,
  type OpsKeymapHost,
  type OpsTabClose,
  registerOpsKeymapHost
} from './keymap'
import type { OpsCopy } from './locales'
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

  onCycleMotion?: () => void
  onToggleDock?: () => void

  host?: Partial<OpsKeymapHost>
}

function sourcedNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** Existing REST contracts, pinned to one owner. Late replies never cross scopes. */
export function useOpsBackendSources(connectionId: string, profile: string, enabled: boolean) {
  const identity = `${connectionId}\0${profile}`

  const [snapshot, setSnapshot] = useState<{
    identity: string
    gateway: OpsGatewaySource | null
    todayTokens: OpsTokenSource | null
    modelLabel: string | null
  } | null>(null)

  useEffect(() => {
    if (!enabled || typeof window.hermesDesktop?.api !== 'function') {
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const read = async () => {
      const owner = { connectionId, profile }

      const results = await Promise.allSettled([
        hermesApi<StatusResponse>({ ...owner, path: '/api/status' }),
        hermesApi<AnalyticsResponse>({ ...owner, path: '/api/analytics/usage?days=1' }),
        hermesApi<ModelInfoResponse>({ ...owner, path: '/api/model/info', timeoutMs: 5000 })
      ])

      if (cancelled) {
        return
      }

      const status = results[0].status === 'fulfilled' ? results[0].value : null
      const usage = results[1].status === 'fulfilled' ? results[1].value : null
      const model = results[2].status === 'fulfilled' ? results[2].value : null
      // Existing analytics groups session starts by backend LOCAL calendar day.
      // Remote timezone is not in this contract: never call a guessed bucket today.
      const now = new Date()
      const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const row = usage?.daily?.find(item => item.day === day)

      const total =
        connectionId === 'local' && row && sourcedNumber(row.input_tokens) && sourcedNumber(row.output_tokens)
          ? row.input_tokens + row.output_tokens
          : null

      setSnapshot({
        identity,
        gateway:
          status?.version && typeof status.gateway_running === 'boolean'
            ? {
                health: status.gateway_heartbeat_stale_s
                  ? 'stale'
                  : status.gateway_running
                    ? status.gateway_state || 'running'
                    : 'stopped',
                version: status.version
              }
            : null,
        todayTokens:
          total === null
            ? null
            : {
                total,
                provenance: `/api/analytics/usage · backend local ${day} · recorded session-start totals, input + output (A2 unavailable) · ${connectionId}/${profile}`
              },
        modelLabel: model?.provider && model.model ? `${profile} · ${model.provider} / ${model.model}` : null
      })
      timer = setTimeout(() => void read(), 60_000)
    }

    void read()

    return () => {
      cancelled = true

      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [connectionId, enabled, identity, profile])

  return enabled && snapshot?.identity === identity ? snapshot : null
}

function textItem(id: string, label: string, title?: string): StatusbarItem {
  return { id, label, title, variant: 'text' }
}

export function opsStatusbarItems(
  sources: OpsStatusSources,
  profileLabel: string | null | undefined,
  actions: { onCycleMotion?: () => void; onToggleDock?: () => void },
  copy: OpsCopy
): { left: StatusbarItem[]; right: StatusbarItem[] } {
  const left: StatusbarItem[] = []
  const right: StatusbarItem[] = []

  if (profileLabel) {
    left.push(textItem('ops-profile', profileLabel))
  }

  if (sources.focusedRunId) {
    left.push(textItem('ops-run', copy.chrome.focusedRun(sources.focusedRunId)))
  }

  if (sourcedNumber(sources.workingCount)) {
    left.push(textItem('ops-working', copy.chrome.working(sources.workingCount), copy.chrome.workingSource))
  }

  if (sourcedNumber(sources.needsYouCount)) {
    left.push(textItem('ops-needs-you', copy.chrome.needsYou(sources.needsYouCount), copy.chrome.needsYouSource))
  }

  if (sources.todayTokens && sources.todayTokens.provenance && sourcedNumber(sources.todayTokens.total)) {
    left.push(textItem('ops-tokens', copy.chrome.tokens(sources.todayTokens.total), sources.todayTokens.provenance))
  }

  if (sources.worktreeFocused && sources.branch) {
    left.push(textItem('ops-branch', sources.branch))
  }

  if (sources.gateway?.health && sources.gateway.version) {
    right.push(
      textItem(
        'ops-gateway',
        `${sources.gateway.health} ${sources.gateway.version}`,
        copy.chrome.gatewaySource
      )
    )
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
      label: sources.dockOpen ? copy.chrome.dockOpen : copy.chrome.dock,
      onSelect: actions.onToggleDock,
      variant: 'action'
    })
  }

  if (sourcedNumber(sources.problemsCount)) {
    right.push({
      id: 'ops-problems',
      label: copy.chrome.problems(sources.problemsCount),
      render: () => <span data-ops-problems={sources.problemsCount}>{sources.problemsCount}</span>,
      variant: 'text'
    })
  }

  return { left, right }
}

function tool(id: string, label: string, icon: TitlebarTool['icon'], onSelect: () => void): TitlebarTool {
  return { icon, id, label, onSelect }
}

export function OpsChrome({
  chatHotHidden = false,
  connectionId,
  connectionLabel,
  host,
  modelLabel,
  onCycleMotion,
  onToggleDock,
  profile,
  profileLabel,
  sources,
  viewLabel
}: OpsChromeProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const copy = useI18n().t.ops
  const problemsCount = useStore($opsProblemsCount)
  const hostRef = useRef(host)
  hostRef.current = host

  useEffect(() => {
    setOpsPaletteScope({ connectionId, profile })

    return () => setOpsPaletteScope({ connectionId: '', profile: '' })
  }, [connectionId, profile, viewLabel])

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
        setSheetOpen(true)
      },
      editFocused: () => hostRef.current?.editFocused?.(),
      toggleRail: () => hostRef.current?.toggleRail?.(),
      toggleInspector: () => hostRef.current?.toggleInspector?.(),
      toggleDock: () => {
        hostRef.current?.toggleDock?.()
      },
      moveSelection: delta => hostRef.current?.moveSelection?.(delta),
      openFocused: () => hostRef.current?.openFocused?.(),
      history: direction => hostRef.current?.history?.(direction),
      focusNextApproval: () => hostRef.current?.focusNextApproval?.(),
      exitFullscreen: () => {
        hostRef.current?.exitFullscreen?.()
      }
    })

    return release
  }, [connectionId, profile, viewLabel])

  useEffect(() => {
    $opsProblemsCount.set(sourcedNumber(sources.problemsCount) ? sources.problemsCount : null)

    return () => {
      $opsProblemsCount.set(null)
    }
  }, [connectionId, profile, sources.problemsCount])

  useEffect(() => {
    const items = opsStatusbarItems({ ...sources, problemsCount }, profileLabel, { onCycleMotion, onToggleDock }, copy)
    setStatusbarItemGroup(OPS_STATUSBAR_GROUP, items.left, 'left')
    setStatusbarItemGroup(OPS_STATUSBAR_GROUP, items.right, 'right')
    setTitlebarToolGroup(
      'ops-rail',
      [tool('ops-rail', copy.chrome.toggleRail, <PanelLeftIcon className="size-4" />, () => hostRef.current?.toggleRail?.())],
      'left'
    )
    setTitlebarToolGroup(
      'ops-dock',
      [tool('ops-dock', copy.chrome.toggleDock, <PanelBottom className="size-4" />, () => hostRef.current?.toggleDock?.())],
      'right'
    )
    setTitlebarToolGroup(
      'ops-inspector',
      [
        tool('ops-inspector', copy.chrome.toggleInspector, <PanelLeftIcon className="size-4 rotate-180" />, () =>
          hostRef.current?.toggleInspector?.()
        )
      ],
      'right'
    )

    return () => {
      setStatusbarItemGroup(OPS_STATUSBAR_GROUP, [], 'left')
      setStatusbarItemGroup(OPS_STATUSBAR_GROUP, [], 'right')
      setTitlebarToolGroup('ops-rail', [], 'left')
      setTitlebarToolGroup('ops-inspector', [], 'right')
      setTitlebarToolGroup('ops-dock', [], 'right')
    }
  }, [connectionId, copy, profile, onCycleMotion, onToggleDock, profileLabel, problemsCount, sources])

  // Escape belongs to the actual sheet, dock, inspector and split host.
  useEffect(() => {
    setSheetOpen(false)
  }, [connectionId, profile, viewLabel])

  const crumb = [connectionLabel, profileLabel, viewLabel].filter(Boolean).join(' / ')
  const showChip = chatHotHidden && Boolean(modelLabel)

  return (
    <div className="contents" data-ops-chrome="">
      <Contribute area={TITLEBAR_AREAS.center} id="ops-chrome">
        <div className="flex min-w-0 items-center gap-2" data-ops-titlebar="">
          {crumb ? (
            <nav aria-label={copy.chrome.breadcrumb} data-ops-breadcrumb="">
              {crumb}
            </nav>
          ) : null}
          <Button
            data-ops-search-trigger=""
            onClick={() => openCommandPalettePage(OPS_PALETTE_PAGE)}
            size="sm"
            variant="ghost"
          >
            <SearchIcon className="size-4" /> {copy.chrome.searchOps}
          </Button>
          {showChip ? (
            <ReadonlyModelPill
              connectionId={connectionId}
              label={modelLabel!}
              profile={profile}
              reason={copy.reasons.modelEdit}
            />
          ) : null}
        </div>
      </Contribute>
      {sheetOpen ? <OpsShortcutSheet onClose={() => setSheetOpen(false)} /> : null}
    </div>
  )
}
