/** Canvas container (ops-panel P3-03, P5-02): profile data, the runs bridge and the writable node editors. */

import { useMemo } from 'react'

import { createOpsActions } from '../feed/ops-actions'
import { createOpsClient, type OpsClient } from '../feed/ops-client'
import { T } from '../main-i18n'
import { useOpsResource } from '../office/office-container'

import { CanvasView } from './canvas'
import { createNodeClient } from './node-editor'
import { NodeEditors } from './node-editor-view'

function runsBridge() {
  return (globalThis as { window?: { hermesDesktop?: { runs?: unknown } } }).window?.hermesDesktop?.runs ?? null
}

export function CanvasContainer({
  profile,
  readOnly,
  client: clientProp,
  onOpenRoute
}: {
  profile: string
  readOnly?: boolean
  client?: OpsClient
  onOpenRoute?: (route: string) => void
}) {
  const client = useMemo(() => clientProp ?? createOpsClient(), [clientProp])
  const slow = 30_000
  const model = useOpsResource(() => client.modelNode(profile), [client, profile], slow)
  const policy = useOpsResource(() => client.policy(profile), [client, profile], slow)
  const prompt = useOpsResource(() => client.promptNode(profile), [client, profile], slow)
  const cron = useOpsResource(() => client.cronJobs(profile), [client, profile], slow)
  const delegation = useOpsResource(() => client.delegation(profile), [client, profile], slow)
  const actions = useMemo(() => createOpsActions(), [])
  const rows = useOpsResource(() => actions.profiles(), [actions], slow)
  const roster = useOpsResource(() => actions.kanbanProfiles(), [actions], slow)
  const mem = useOpsResource(() => actions.memory(profile), [actions, profile], slow)
  const nodes = useMemo(() => createNodeClient(), [])
  // G86: the newest Prompt backup's change note (highest sequence).
  const history = useOpsResource(() => nodes.history(profile, 'prompt'), [nodes, profile], slow)
  const items = Array.isArray(history.value?.items) ? history.value.items : null
  const newest = items?.length ? [...items].sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0))[0] : null
  const promptNote = items ? (newest?.note ?? null) : undefined
  const kp = Array.isArray(roster.value?.profiles) ? roster.value.profiles.find(r => r.name === profile) : undefined
  const row = Array.isArray(rows.value?.profiles) ? rows.value.profiles.find(r => r.name === profile) : undefined

  return (
    <>
    <CanvasView
      data={{ model: model.value, policy: policy.value, prompt: prompt.value, cron: cron.value, delegation: delegation.value, skills: typeof row?.skill_count === 'number' ? row.skill_count : null,
        identity: kp ? { name: kp.name, description: kp.description ?? '' } : roster.value ? { name: profile, description: '' } : null,
        memory: mem.value && typeof mem.value === 'object' ? mem.value : null,
        promptNote
      }}
      onOpenRoute={onOpenRoute}
      profile={profile}
      readOnly={readOnly}
      runs={runsBridge() as never}
    />
    {/* P5: writable nodes; a remote connection is refused server-side (D11) and renders read-only. */}
    {/* P10: documents fold under the flow so they do not compete with the connections. */}
    <details data-ops-canvas-docs="">
      <summary>{T("Edit nodes")}</summary>
      <NodeEditors policy={policy.value} profile={profile} readOnly={readOnly} />
    </details>
    </>
  )
}
