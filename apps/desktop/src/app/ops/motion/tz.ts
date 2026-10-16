/** SPEC v2.1 4a: the Ops timezone (Settings › Timezone), pure so Office can read it without importing Settings. */
const PREF = 'hermes.ops.prefs'

export function validTimezone(tz: unknown): string {
  if (typeof tz !== 'string' || !tz) {
    return ''
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })

    return tz
  } catch {
    return ''
  }
}

export function hostTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Pref when valid, else host local. */
export function opsTimezone(pref?: string): string {
  if (pref !== undefined) {
    return validTimezone(pref) || hostTimezone()
  }

  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(PREF) ?? '{}') as { timezone?: unknown }

    return validTimezone(v.timezone) || hostTimezone()
  } catch {
    return hostTimezone()
  }
}
