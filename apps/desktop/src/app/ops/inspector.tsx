/**
 * Inspector slots follow the selected tab. The focused-run footer is absent
 * when nothing is focused. Unknown token counts stay unknown — never 0.
 * An overlay covers the view slot only. It does not cover the rail, tabs, or
 * the Inspector toggle.
 */

import { useI18n } from '@/i18n'

import { detailKindForSlot, type InspectorDetail, useInspectorDetail } from './inspector-detail'
import { localizeInspector } from './inspector-i18n'
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
  const want = detailKindForSlot(active)
  const detail = useInspectorDetail(want)
  const owner = want ? DETAIL_TAB[want] : null
  const ownsTab = !tab || !owner || tab.id === owner || tab.id === `lens:${owner}`
  // P6: an inspector with nothing to show collapses to its tab strip instead of holding 280px.
  const empty = !footer && active !== 'fleet' && !(detail && want && detail.kind === want && ownsTab)

  return (
    <aside
      aria-label={copy.inspector.label}
      data-ops-inspector={overlay ? 'overlay' : 'docked'}
      data-ops-inspector-slot={active}
      data-ops-inspector-state={empty ? 'empty' : 'filled'}
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
          : empty
            ? { boxSizing: 'border-box', flex: '0 0 auto', maxWidth: 'var(--width-inspector, 320px)', minWidth: 0, width: 'auto' }
            : {
                boxSizing: 'border-box',
                flex: '0 0 var(--width-inspector, 320px)',
                maxWidth: 'var(--width-inspector, 320px)',
                minWidth: 'var(--width-inspector, 320px)',
                width: 'var(--width-inspector, 320px)'
              }
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

const DETAIL_TAB: Record<string, string> = { task: 'board', node: 'canvas', settings: 'settings' }

function InspectorBody({ active, fleet, tab }: { active: InspectorSlot; fleet: FleetFeed; tab: OpsTab | null }) {
  const copy = useI18n().t.ops
  const want = detailKindForSlot(active)
  const detail = useInspectorDetail(want)

  if (active === 'fleet') {
    return <FleetList feed={fleet} filter="" />
  }

  // B11: a detail belongs to the tab that published it; kept-alive tabs must not leak into others
  // (Settings detail showed on Agents under the row slot).
  const owner = want ? DETAIL_TAB[want] : null
  // Lens tabs are lens:<id> (Settings is lens:settings).
  const ownsTab = !tab || !owner || tab.id === owner || tab.id === `lens:${owner}`

  if (detail && want && detail.kind === want && ownsTab) {
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
  // B11: field labels, values and footers follow the Ops locale.
  const fields = useI18n().t.ops.inspector.fields
  const L = (s: string | null | undefined) => localizeInspector(s, fields)

  return (
    <section data-ops-inspector-body={history ? 'history' : detail.kind} data-ops-inspector-detail={detail.kind}>
      <header data-ops-inspector-head="">
        <h3 data-ops-inspector-title="" title={L(detail.title)}>
          {L(detail.title)}
        </h3>
        {detail.badge ? <span data-ops-inspector-badge="">{L(detail.badge)}</span> : null}
      </header>
      {history ? (
        detail.history && detail.history.length > 0 ? (
          <ol data-ops-inspector-history="">
            {detail.history.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        ) : (
          <p data-ops-inspector-empty="">{L(detail.historyEmpty)}</p>
        )
      ) : (
        <>
          {detail.rows.length > 0 ? (
            <dl data-ops-inspector-rows="">
              {detail.rows.map(([k, v]) => (
                <div data-ops-inspector-row="" key={k}>
                  <dt>{L(k)}</dt>
                  <dd>{L(v)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {detail.body ? <p data-ops-inspector-text="">{detail.body}</p> : null}
        </>
      )}
      {detail.hint ? <p data-ops-inspector-hint="">{L(detail.hint)}</p> : null}
      <WhyFooter observedAt={null} purpose={null} source={L(detail.source)} why={L(detail.why)} />
    </section>
  )
}
