import type { Translations } from './types'

// Ops W10 recovery states (section and node wrappers), spread into en.ts.
export const enOpsStates = {
  opsStates: {
    empty: {
      title: 'Nothing here yet',
      explanation: 'The source answered and has no items for this view.',
      action: 'Refresh'
    },
    loading: {
      title: 'Loading',
      explanation: 'Fetching this view from its own source. Other views keep working.',
      action: 'Retry now'
    },
    reconnecting: {
      title: 'Reconnecting',
      explanation: 'The source stopped answering. Retrying automatically; any last snapshot stays visible.',
      action: 'Reconnect now'
    },
    stale: {
      title: 'Showing the last snapshot',
      explanation: 'This data is older than its freshness budget. It is kept readable until a refresh succeeds.',
      action: 'Refresh'
    },
    exhausted: {
      title: 'Retries stopped',
      explanation: 'Automatic retries reached their limit. Nothing retries again until you ask.',
      action: 'Try again'
    },
    auth: {
      title: 'Authentication failed',
      explanation: 'The source rejected the credentials (401/403). Retrying will not help until you sign in again.',
      action: 'Sign in again'
    },
    capability: {
      title: 'Not available on this connection',
      explanation: 'This backend does not expose the capability this view needs. This is not a temporary failure.',
      action: 'View requirements'
    },
    crashed: {
      title: 'This view failed to render',
      explanation: 'Only this view stopped. The rest of the page keeps working.',
      action: 'Reload view'
    },
    source: source => `Source: ${source}`,
    sourceUnknown: 'Source: not recorded',
    updated: time => `Updated ${time}`,
    neverUpdated: 'Never updated',
    attempt: (attempt, max) => `Attempt ${attempt} of ${max}`,
    capabilityName: capability => `Needs: ${capability}`,
    writesDisabled: 'Changes are disabled until this view is current.'
  }
} satisfies Pick<Translations, 'opsStates'>
