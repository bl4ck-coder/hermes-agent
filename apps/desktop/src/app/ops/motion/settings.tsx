/**
 * W9 Settings tab and Motion readout (ops-panel P5-03); the shortcut sheet is the shell's OpsShortcutSheet. Settings only shows values it
 * has a source for; theme opens Desktop settings (D5); approval mode reads approvals.mode from /api/config; the default model is edited
 * through the Canvas model node (P2 policy, A5/A6 backup); secret presence lists names and set/unset only until a backend reports them.
 */

import { useMemo, useState } from 'react'

import { createNodeClient } from '../canvas/node-editor'
import { NodeEditor } from '../canvas/node-editor-view'
import { approvalMode, createOpsActions, envPresenceList } from '../feed/ops-actions'
import { createOpsClient, type PolicyView } from '../feed/ops-client'
import { useOpsResource } from '../office/office-container'
import { ThresholdSettings } from '../office/thresholds'
import { OpsShortcutSheet } from '../shortcut-sheet'

import { cycleMotion, loadMotion, type MotionMode, saveMotion } from './motion'

const PREF = 'hermes.ops.prefs'

export interface OpsPrefs {
  defaultTab: 'office' | 'canvas' | 'board'
  dateFormat: 'relative' | 'iso' | 'local'
}

export function loadPrefs(): OpsPrefs {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(PREF) ?? '{}') as Partial<OpsPrefs>

    return {
      defaultTab: v.defaultTab === 'canvas' || v.defaultTab === 'board' ? v.defaultTab : 'office',
      dateFormat: v.dateFormat === 'iso' || v.dateFormat === 'local' ? v.dateFormat : 'relative'
    }
  } catch {
    return { defaultTab: 'office', dateFormat: 'relative' }
  }
}

export function savePrefs(p: OpsPrefs) {
  globalThis.localStorage?.setItem(PREF, JSON.stringify(p))
}

export function useMotionMode(): [MotionMode, (m: MotionMode) => void] {
  const [m, setM] = useState<MotionMode>(() => loadMotion())

  return [
    m,
    next => {
      saveMotion(next)
      setM(next)
    }
  ]
}

const LABEL: Record<MotionMode, string> = { full: 'Full', reduced: 'Reduced', system: 'System' }

export function MotionReadout({ mode, onChange }: { mode: MotionMode; onChange: (m: MotionMode) => void }) {
  return (
    <button aria-label={`Motion: ${LABEL[mode]}`} data-ops-motion={mode} onClick={() => onChange(cycleMotion(mode))} type="button">
      Motion: {LABEL[mode]}
    </button>
  )
}

export function SettingsView({
  policy,
  defaultModel,
  onOpenRoute,
  secrets = null,
  approval,
  profile,
  editModel
}: {
  /** O41: approvals.mode; undefined = not loaded, null = key absent. */
  approval?: string | null
  profile?: string
  /** O40: the default model is written through the Canvas model node (P2 policy + A5/A6 backup). */
  editModel?: boolean
  /** O42: names and set/unset only, never values. null = unknown. */
  secrets?: { name: string; set: boolean }[] | null
  policy: PolicyView | null
  defaultModel: { provider?: string | null; model?: string | null } | null
  onOpenRoute?: (r: string) => void
}) {
  const [motion, setMotion] = useMotionMode()
  const [prefs, setPrefs] = useState<OpsPrefs>(() => loadPrefs())
  const [sheet, setSheet] = useState(false)

  const set = (p: Partial<OpsPrefs>) => {
    const next = { ...prefs, ...p }
    savePrefs(next)
    setPrefs(next)
  }

  return (
    <section aria-label="Ops settings" data-ops-settings="">
      <ThresholdSettings />
      <dl>
        <dt>Theme</dt>
        <dd>
          <button data-ops-open-route="/settings" onClick={() => onOpenRoute?.('/settings')} type="button">
            Open Desktop settings
          </button>
        </dd>
        <dt>Motion</dt>
        <dd>
          <MotionReadout mode={motion} onChange={setMotion} />
        </dd>
        <dt>Default tab</dt>
        <dd>
          <select aria-label="default tab" onChange={e => set({ defaultTab: e.target.value as OpsPrefs['defaultTab'] })} value={prefs.defaultTab}>
            <option value="office">Office</option>
            <option value="canvas">Canvas</option>
            <option value="board">Board</option>
          </select>
        </dd>
        <dt>Date format</dt>
        <dd>
          <select aria-label="date format" onChange={e => set({ dateFormat: e.target.value as OpsPrefs['dateFormat'] })} value={prefs.dateFormat}>
            <option value="relative">Relative</option>
            <option value="iso">ISO</option>
            <option value="local">Local</option>
          </select>
        </dd>
        <dt>Default model (P2)</dt>
        <dd data-ops-field="default-model">
          {defaultModel ? `${defaultModel.provider ?? 'unknown'} / ${defaultModel.model ?? 'unknown'}` : 'unknown'}
          {policy ? <span data-ops-field="policy-source"> (policy: {policy.source}{policy.error ? `, error: ${policy.error}` : ''})</span> : null}
        </dd>
        <dt>Approval mode{profile ? ` (${profile})` : ''}</dt>
        <dd data-ops-field="approval-mode">{approval === undefined ? 'unknown' : approval === null ? 'default (approvals.mode not set)' : approval}</dd>
        {editModel && profile ? (
          <>
            <dt>Change default model</dt>
            <dd data-ops-field="model-editor">
              <ModelEditor policy={policy} profile={profile} />
            </dd>
          </>
        ) : null}
        <dt>Secret presence</dt>
        <dd data-ops-field="secrets">
          {secrets === null ? (
            'unknown'
          ) : (
            <ul aria-label="secret presence">
              {secrets.map(x => (
                <li data-ops-secret={x.name} data-ops-set={x.set ? 'yes' : 'no'} key={x.name}>
                  {x.name}: {x.set ? 'set' : 'not set'}
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt>Shortcuts</dt>
        <dd>
          <button onClick={() => setSheet(true)} type="button">
            Shortcut sheet
          </button>
        </dd>
      </dl>
      {sheet ? <OpsShortcutSheet onClose={() => setSheet(false)} /> : null}
    </section>
  )
}

function ModelEditor({ profile, policy }: { profile: string; policy: PolicyView | null }) {
  const client = useMemo(() => createNodeClient(), [])

  return <NodeEditor client={client} node="model" policy={policy} profile={profile} />
}

export function SettingsContainer({ profile, onOpenRoute }: { profile: string; onOpenRoute?: (r: string) => void }) {
  const client = useMemo(() => createOpsClient(), [])
  const policy = useOpsResource(() => client.policy(profile), [client, profile], 30_000)
  const model = useOpsResource(() => client.modelNode(profile), [client, profile], 30_000)
  const actions = useMemo(() => createOpsActions(), [])
  const env = useOpsResource(() => actions.envPresence(profile), [actions, profile], 30_000)
  const cfg = useOpsResource(() => actions.config(profile), [actions, profile], 30_000)

  return <SettingsView approval={cfg.value ? approvalMode(cfg.value) : undefined} defaultModel={model.value} editModel onOpenRoute={onOpenRoute}
      policy={policy.value}
      profile={profile}
      secrets={envPresenceList(env.value)}
    />
}
