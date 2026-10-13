/** Canvas container (ops-panel P3-03): read-only data for one profile + the runs bridge. */

import { useMemo } from 'react'

import { createOpsClient, type OpsClient } from '../feed/ops-client'
import { useOpsResource } from '../office/office-container'

import { CanvasView } from './canvas'

function runsBridge() {
  return (globalThis as { window?: { hermesDesktop?: { runs?: unknown } } }).window?.hermesDesktop?.runs ?? null
}

export function CanvasContainer({ profile, readOnly, client: clientProp }: { profile: string; readOnly?: boolean; client?: OpsClient }) {
  const client = useMemo(() => clientProp ?? createOpsClient(), [clientProp])
  const slow = 30_000
  const model = useOpsResource(() => client.modelNode(profile), [client, profile], slow)
  const policy = useOpsResource(() => client.policy(profile), [client, profile], slow)
  const prompt = useOpsResource(() => client.promptNode(profile), [client, profile], slow)
  const cron = useOpsResource(() => client.cronJobs(profile), [client, profile], slow)
  const delegation = useOpsResource(() => client.delegation(profile), [client, profile], slow)

  return (
    <CanvasView
      data={{ model: model.value, policy: policy.value, prompt: prompt.value, cron: cron.value, delegation: delegation.value }}
      profile={profile}
      readOnly={readOnly}
      runs={runsBridge() as never}
    />
  )
}
