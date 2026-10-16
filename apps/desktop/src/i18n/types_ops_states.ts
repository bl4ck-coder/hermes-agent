// Ops W10 recovery-state copy (section and node wrappers); `Translations`
// spreads this in. Translations for other locales land in P0.5-08.
export interface OpsStateCopy {
  title: string
  explanation: string
  action: string
}

export interface OpsStatesTranslations {
  opsStates: {
    empty: OpsStateCopy
    loading: OpsStateCopy
    reconnecting: OpsStateCopy
    stale: OpsStateCopy
    exhausted: OpsStateCopy
    auth: OpsStateCopy
    capability: OpsStateCopy
    crashed: OpsStateCopy
    source: (source: string) => string
    sourceUnknown: string
    updated: (time: string) => string
    neverUpdated: string
    attempt: (attempt: number, max: number) => string
    capabilityName: (capability: string) => string
    writesDisabled: string
  }
}
