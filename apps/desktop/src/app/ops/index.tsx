/**
 * Ops shell. Native area, not a desktop-plugin.
 *
 * Feature views (Office, Canvas, Board, lenses, task, run) are not built in
 * this slice. They render an honest unavailable state. No mock fleet, tokens,
 * or runs. No second titlebar, sidebar, palette, model chip, status bar, or
 * composer. One gutter: 24px (`--gutter`).
 */

import type { ReactNode } from 'react'

import {
  type OpsNarrow,
  type OpsRailPreference,
  type OpsScope,
  OPS_GUTTER_PX
} from './layout-store'

export const OPS_PINNED_VIEWS = ['office', 'canvas', 'board'] as const

export function opsViewLabel(view: string): string {
  if (!view) {
    return 'Office'
  }

  return view.slice(0, 1).toUpperCase() + view.slice(1)
}

export interface OpsShellProps {
  scope: OpsScope
  view: string
  viewId: string | null
  paneWidth: number
  narrow: OpsNarrow
  railPreference: OpsRailPreference
  fullscreen: boolean
  inspectorOpen: boolean
  onToggleFullscreen: () => void
  onRail: (rail: OpsRailPreference) => void
  onInspector: (open: boolean) => void
  onView: (view: string) => void
  onCopyLink: () => void
  onOpenChat: () => void
  onBackToChats: () => void
}

function cycleRail(current: OpsRailPreference): OpsRailPreference {
  if (current === 'full') {
    return 'icons'
  }

  if (current === 'icons') {
    return 'hidden'
  }

  return 'full'
}

export function OpsShell({
  scope,
  view,
  viewId,
  paneWidth,
  narrow,
  railPreference,
  fullscreen,
  inspectorOpen,
  onToggleFullscreen,
  onRail,
  onInspector,
  onView,
  onCopyLink,
  onOpenChat,
  onBackToChats
}: OpsShellProps): ReactNode {
  const label = opsViewLabel(view)
  const tabsAreDropdown = narrow.tabs === 'dropdown'

  return (
    <div
      data-ops-root=""
      data-ops-native="route"
      data-ops-sash="layout-tree"
      data-ops-gutter={String(OPS_GUTTER_PX)}
      data-ops-fullscreen={fullscreen ? 'true' : 'false'}
      data-ops-inspector={narrow.inspector}
      data-ops-inspector-open={inspectorOpen ? 'true' : 'false'}
      data-ops-rail={narrow.rail}
      data-ops-tabs={narrow.tabs}
      data-ops-pane-width={String(paneWidth)}
      style={{ ['--gutter' as string]: `${OPS_GUTTER_PX}px`, padding: OPS_GUTTER_PX, minWidth: 0 }}
    >
      <div data-ops-breadcrumb="">
        <span>Ops</span>
        <span aria-hidden="true"> ▸ </span>
        <span data-ops-connection="">{scope.label || scope.connectionId}</span>
        {scope.remote ? <span data-ops-readonly=""> read-only</span> : null}
        <span aria-hidden="true"> ▸ </span>
        <span data-ops-profile="">{scope.profile}</span>
        <span aria-hidden="true"> ▸ </span>
        <span data-ops-view-name="">{label}</span>
        {viewId ? <span data-ops-view-id=""> {viewId}</span> : null}
      </div>

      <div data-ops-toolbar="">
        <button type="button" data-ops-back="" onClick={onBackToChats}>
          ← Chats
        </button>
        <button
          type="button"
          data-ops-rail-toggle=""
          aria-keyshortcuts="["
          aria-pressed={narrow.rail !== 'hidden'}
          onClick={() => onRail(cycleRail(railPreference))}
        >
          Rail
        </button>
        <button
          type="button"
          data-ops-inspector-toggle=""
          aria-keyshortcuts="]"
          aria-pressed={inspectorOpen}
          onClick={() => onInspector(!inspectorOpen)}
        >
          Inspector
        </button>
        <button type="button" data-ops-copy-link="" onClick={onCopyLink}>
          Copy link
        </button>
        <button
          type="button"
          data-ops-fullscreen-toggle=""
          aria-pressed={fullscreen}
          aria-label={fullscreen ? 'Restore split' : 'Full screen Ops'}
          onClick={onToggleFullscreen}
        >
          ⤢
        </button>
      </div>

      {narrow.rail === 'hidden' ? null : (
        <nav data-ops-rail-list="" aria-label="Ops views">
          {OPS_PINNED_VIEWS.map(id => (
            <button
              key={id}
              type="button"
              data-ops-rail-item={id}
              aria-current={id === view ? 'page' : undefined}
              onClick={() => onView(id)}
            >
              {narrow.rail === 'icons' ? opsViewLabel(id).slice(0, 1) : opsViewLabel(id)}
            </button>
          ))}
        </nav>
      )}

      {tabsAreDropdown ? (
        <label data-ops-tab-dropdown="">
          Tabs
          <select
            aria-label="Ops tabs"
            value={view}
            onChange={event => onView(event.target.value)}
          >
            {OPS_PINNED_VIEWS.map(id => (
              <option key={id} value={id}>
                {opsViewLabel(id)}
              </option>
            ))}
            {OPS_PINNED_VIEWS.includes(view as (typeof OPS_PINNED_VIEWS)[number]) ? null : (
              <option value={view}>{label}</option>
            )}
          </select>
        </label>
      ) : (
        <div data-ops-tab-strip="" role="tablist">
          {OPS_PINNED_VIEWS.map(id => (
            <button key={id} type="button" role="tab" aria-selected={id === view} onClick={() => onView(id)}>
              {opsViewLabel(id)}
            </button>
          ))}
        </div>
      )}

      <section data-ops-view="" aria-label={label}>
        <p data-ops-unavailable="">
          {label} is not available yet. This shell does not invent fleet, tokens, runs, or approvals.
        </p>
        <button type="button" data-ops-open-chat="" onClick={onOpenChat}>
          Open the existing chat
        </button>
      </section>
    </div>
  )
}
