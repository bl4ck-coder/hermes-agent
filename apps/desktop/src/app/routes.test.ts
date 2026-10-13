import { describe, expect, it } from 'vitest'

import { NEW_CHAT_ROUTE, primaryRouteSelectedSessionId, sessionRoute, SETTINGS_ROUTE } from './routes'

const SESS_A = 'sess-a'
const SESS_B = 'sess-b'

describe('primaryRouteSelectedSessionId', () => {
  it('prefers the routed session id over a stale/different store selection (#59305)', () => {
    // The route already committed to B while the store selection hasn't
    // caught up yet (still reads A) — the route wins.
    expect(primaryRouteSelectedSessionId(sessionRoute(SESS_B), SESS_A)).toBe(SESS_B)
  })

  it('returns null on the new-chat route even with a leftover selection from the previous chat', () => {
    expect(primaryRouteSelectedSessionId(NEW_CHAT_ROUTE, SESS_A)).toBeNull()
  })

  it('falls back to the store selection on a non-chat route (settings, overlays)', () => {
    expect(primaryRouteSelectedSessionId(SETTINGS_ROUTE, SESS_A)).toBe(SESS_A)
  })
})

describe('native /ops/:view/:id? registration', () => {
  it('parses the route and does not treat it as a session or a plugin page', async () => {
    const { registry } = await import('@/contrib/registry')
    const {
      appViewForPath,
      hidesFixedTitlebarClusters,
      isOpsRoute,
      isOverlayView,
      isWorkspacePageRoute,
      opsRoute,
      parseOpsRoute,
      routeSessionId,
      ROUTES_AREA
    } = await import('./routes')

    expect(parseOpsRoute('/ops')).toEqual({ view: 'office', id: null })
    expect(parseOpsRoute('/ops/canvas/builder')).toEqual({ view: 'canvas', id: 'builder' })
    expect(parseOpsRoute('/ops/task/412?x=1')).toEqual({ view: 'task', id: '412' })
    expect(parseOpsRoute('/ops/run/1866')).toEqual({ view: 'run', id: '1866' })
    expect(parseOpsRoute('/ops/nope/a/b')).toBeNull()
    expect(opsRoute('canvas', 'builder')).toBe('/ops/canvas/builder')

    expect(isOpsRoute('/ops/office')).toBe(true)
    expect(routeSessionId('/ops')).toBeNull()
    expect(routeSessionId('/ops/board')).toBeNull()
    expect(appViewForPath('/ops/office')).toBe('ops')
    expect(appViewForPath('/capabilities')).toBe('capabilities')
    expect(isWorkspacePageRoute('/ops/canvas/builder')).toBe(false)
    expect(isOverlayView('ops')).toBe(false)
    expect(hidesFixedTitlebarClusters('ops')).toBe(false)
    expect(registry.getArea(ROUTES_AREA).some(entry => (entry.data as { path?: string } | undefined)?.path === '/ops')).toBe(
      false
    )
  })
})
