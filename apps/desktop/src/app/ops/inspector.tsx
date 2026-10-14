/**
 * Inspector slots follow the selected tab. The focused-run footer is absent
 * when nothing is focused. Unknown token counts stay unknown — never 0.
 * An overlay covers the view slot only. It does not cover the rail, tabs, or
 * the Inspector toggle.
 */

import { useI18n } from '@/i18n'

import { detailKindForSlot, type InspectorDetail, useInspectorDetail } from './inspector-detail'
import { useOpsEscapeLayer } from './keymap'
import { opsNavLabel } from './locales'
import {
  activeInspectorSlot,
  type FleetFeed,
  type FocusedRun,
  type InspectorSlot,
  type OpsTab,
  runFooter,
  type ScopeNav,
  slotsForKind
} from './navigation-store'
import { WhyFooter } from './primitives/why-footer'
import { FleetList } from './rail'

export interface InspectorProps {
  scope: ScopeNav
  overlay: boolean
  fleet: FleetFeed
  focusedRun: FocusedRun | null
  onSlot: (slot: InspectorSlot) => void
  onClose?: () => void
}

export function Inspector({ fleet, focusedRun, onClose, onSlot, overlay, scope }: InspectorProps) {
  const copy = useI18n().t.ops
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
      aria-label={copy.inspector.label}
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
            {copy.inspector.slots[slot]}
          </button>
        ))}
        {onClose ? (
          <button aria-label={copy.inspector.close} data-ops-inspector-close="" onClick={onClose} type="button">
            ×
          </button>
        ) : null}
      </div>
      {active === 'unknown' ? (
        <p data-ops-unknown-slot="">{copy.unknown}</p>
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
  const copy = useI18n().t.ops
  const want = detailKindForSlot(active)
  const detail = useInspectorDetail(want)

  if (active === 'fleet') {
    return <FleetList feed={fleet} filter="" />
  }

  if (detail && want && detail.kind === want) {
    return <InspectorDetailView detail={detail} history={active === 'history'} />
  }

  if (active === 'context' || active === 'history' || active === 'row' || active === 'node' || active === 'task') {
    return (
      <section data-ops-inspector-body={active}>
        <p data-ops-unavailable="">
          {copy.inspector.detailUnavailable(tab ? opsNavLabel(copy, tab.id, tab.label) : copy.inspector.selection)}
        </p>
      </section>
    )
  }

  return (
    <section data-ops-inspector-body="events">
      <p data-ops-unavailable="">{copy.inspector.runEventsEmpty}</p>
    </section>
  )
}

function InspectorDetailView({ detail, history }: { detail: InspectorDetail; history: boolean }) {
  return (
    <section data-ops-inspector-body={history ? 'history' : detail.kind} data-ops-inspector-detail={detail.kind}>
      <header data-ops-inspector-head="">
        <h3 data-ops-inspector-title="" title={detail.title}>
          {detail.title}
        </h3>
        {detail.badge ? <span data-ops-inspector-badge="">{detail.badge}</span> : null}
      </header>
      {history ? (
        detail.history && detail.history.length > 0 ? (
          <ol data-ops-inspector-history="">
            {detail.history.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        ) : (
          <p data-ops-inspector-empty="">{detail.historyEmpty ?? ''}</p>
        )
      ) : (
        <>
          {detail.rows.length > 0 ? (
            <dl data-ops-inspector-rows="">
              {detail.rows.map(([k, v]) => (
                <div data-ops-inspector-row="" key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {detail.body ? <p data-ops-inspector-text="">{detail.body}</p> : null}
        </>
      )}
      {detail.hint ? <p data-ops-inspector-hint="">{detail.hint}</p> : null}
      <WhyFooter observedAt={null} purpose={null} source={detail.source} why={detail.why} />
    </section>
  )
}
