/**
 * Inspector slots follow the selected tab. The focused-run footer is absent
 * when nothing is focused. Unknown token counts stay unknown — never 0.
 * An overlay covers the view slot only. It does not cover the rail, tabs, or
 * the Inspector toggle.
 */

import { WhyFooter } from './primitives/why-footer'
import { FleetList } from './rail'
import { useOpsEscapeLayer } from './keymap'

import {
  type FleetFeed,
  type FocusedRun,
  type InspectorSlot,
  type OpsTab,
  activeInspectorSlot,
  runFooter,
  slotsForKind,
  type ScopeNav
} from './navigation-store'

export interface InspectorProps {
  scope: ScopeNav
  overlay: boolean
  fleet: FleetFeed
  focusedRun: FocusedRun | null
  onSlot: (slot: InspectorSlot) => void
  onClose?: () => void
}

const SLOT_LABEL: Record<InspectorSlot, string> = {
  fleet: 'Fleet',
  context: 'Context',
  task: 'Task',
  node: 'Node',
  history: 'History',
  events: 'Events',
  row: 'Row'
}

export function Inspector({ fleet, focusedRun, onClose, onSlot, overlay, scope }: InspectorProps) {
  useOpsEscapeLayer(scope.inspectorOpen && overlay && Boolean(onClose), onClose)
  if (!scope.inspectorOpen) {
    return null
  }

  const tab = scope.tabs.find(item => item.id === scope.selectedTabId) ?? null
  const slots = tab ? slotsForKind(tab.kind) : []
  const active = activeInspectorSlot(scope)
  const footer = runFooter(focusedRun)

  return (
    <aside
      aria-label="Inspector"
      data-ops-inspector={overlay ? 'overlay' : 'docked'}
      data-ops-inspector-slot={active}
      style={
        overlay
          ? {
              background: 'var(--surface, #161616)',
              bottom: 0,
              boxSizing: 'border-box',
              left: 0,
              overflow: 'auto',
              position: 'absolute',
              right: 0,
              top: 0,
              width: '100%',
              zIndex: 1
            }
          : { boxSizing: 'border-box', flex: '0 0 280px', maxWidth: 280, minWidth: 280, width: 280 }
      }
    >
      <div role="tablist">
        {slots.map(slot => (
          <button
            aria-selected={slot === active}
            data-ops-inspector-choice={slot}
            key={slot}
            onClick={() => onSlot(slot)}
            role="tab"
            type="button"
          >
            {SLOT_LABEL[slot]}
          </button>
        ))}
        {onClose ? (
          <button aria-label="Close inspector" data-ops-inspector-close="" onClick={onClose} type="button">
            ×
          </button>
        ) : null}
      </div>
      {active === 'unknown' ? (
        <p data-ops-unknown-slot="">unknown</p>
      ) : (
        <InspectorBody active={active} fleet={fleet} tab={tab} />
      )}
      {footer ? (
        <footer data-ops-run-footer="">
          <span data-ops-run-id="">{footer.id}</span>
          <span data-ops-elapsed="">{footer.elapsed}</span>
          <span data-ops-tokens="">{footer.tokens}</span>
        </footer>
      ) : null}
    </aside>
  )
}

function InspectorBody({ active, fleet, tab }: { active: InspectorSlot; fleet: FleetFeed; tab: OpsTab | null }) {
  if (active === 'fleet') {
    return <FleetList feed={fleet} filter="" />
  }

  if (active === 'context' || active === 'history' || active === 'row' || active === 'node' || active === 'task') {
    return (
      <section data-ops-inspector-body={active}>
        <p data-ops-unavailable="">
          {tab ? tab.label : 'Selection'} detail is not built in this shell. No Office, Canvas, or Board business view.
        </p>
        <WhyFooter observedAt={null} purpose={null} source={null} why={null} />
      </section>
    )
  }

  return (
    <section data-ops-inspector-body="events">
      <p data-ops-unavailable="">Run events stay empty until a focused run supplies them.</p>
    </section>
  )
}
