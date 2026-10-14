/** Canvas container (ops-panel P3-03, P5-02): profile data, the runs bridge and the writable node editors. */

import { useMemo } from 'react'

import { createOpsActions } from '../feed/ops-actions'
import { createOpsClient, type OpsClient } from '../feed/ops-client'
import { useOpsResource } from '../office/office-container'

import { CanvasView } from './canvas'
import { NodeEditors } from './node-editor-view'

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
  const actions = useMemo(() => createOpsActions(), [])
  const rows = useOpsResource(() => actions.profiles(), [actions], slow)
  const row = Array.isArray(rows.value?.profiles) ? rows.value.profiles.find(r => r.name === profile) : undefined

  return (
    <>
    <CanvasView
      data={{ model: model.value, policy: policy.value, prompt: prompt.value, cron: cron.value, delegation: delegation.value, skills: typeof row?.skill_count === 'number' ? row.skill_count : null }}
      profile={profile}
      readOnly={readOnly}
      runs={runsBridge() as never}
    />
    {/* P5: writable nodes; a remote connection is refused server-side (D11) and renders read-only. */}
    <NodeEditors policy={policy.value} profile={profile} readOnly={readOnly} />
    </>
  )
}
