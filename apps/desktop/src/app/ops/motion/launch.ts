/**
 * R55 (P8 b6): host startup hook. Pure and dependency-free so main.tsx can call
 * it before React mounts without pulling the Ops bundle into the boot path.
 * It only replaces a cold-start hash (empty or "#/"); deep links, reloads on a
 * real route and every non-main window keep their own destination.
 */
export const OPS_PREFS_KEY = 'hermes.ops.prefs'

const TABS = new Set(['office', 'canvas', 'board'])

export function launchRouteFromPrefs(raw: string | null | undefined): string | null {
  if (!raw) {
    return null
  }

  try {
    const v = JSON.parse(raw) as { openOnLaunch?: unknown; defaultTab?: unknown }

    if (v?.openOnLaunch !== true) {
      return null
    }

    const tab = typeof v.defaultTab === 'string' && TABS.has(v.defaultTab) ? v.defaultTab : 'office'

    return `/ops/${tab}`
  } catch {
    return null
  }
}

export function isColdStartHash(hash: string): boolean {
  return hash === '' || hash === '#' || hash === '#/'
}

/** Returns the route applied, or null when Desktop keeps its own start page. */
export function applyOpsLaunchRoute(loc: Pick<Location, 'hash'> = window.location, storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): string | null {
  try {
    if (!isColdStartHash(loc.hash)) {
      return null
    }

    const route = launchRouteFromPrefs(storage?.getItem(OPS_PREFS_KEY))

    if (route) {
      loc.hash = `#${route}`
    }

    return route
  } catch {
    return null
  }
}
