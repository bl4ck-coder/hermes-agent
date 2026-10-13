/**
 * Inspector slots follow the selected tab. The focused-run footer is absent
 * when nothing is focused. Unknown token counts stay unknown — never 0.
 */

import { WhyFooter } from './primitives/why-footer'
import { FleetList } from './rail'

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

export function Inspector({ fleet, focusedRun, onSlot, overlay, scope }: InspectorProps) {
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
      style={overlay ? { position: 'absolute', inset: 0, zIndex: 2 } : undefined}
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
      </div>
      {active === 'unknown' ? <p data-ops-unknown-slot="">unknown</p> : <InspectorBody active={active} fleet={fleet} tab={tab} />}
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

function InspectorBody({
  active,
  fleet,
  tab
}: {
  active: InspectorSlot
  fleet: FleetFeed
  tab: OpsTab | null
}) {
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
