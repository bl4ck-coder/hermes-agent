/**
 * W9 Settings tab and Motion readout (ops-panel P5-03); the shortcut sheet is the shell's OpsShortcutSheet. Settings only shows values it
 * has a source for; theme opens Desktop settings (D5); approval mode and secret presence say
 * "not available yet" until a backend reports them.
 */

import { useMemo, useState } from 'react'

import { createOpsClient, type PolicyView } from '../feed/ops-client'
import { useOpsResource } from '../office/office-container'
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
  onOpenRoute
}: {
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
        <dt>Approval mode per profile</dt>
        <dd data-ops-unavailable="">Not available yet</dd>
        <dt>Secret presence</dt>
        <dd data-ops-unavailable="">Not available yet</dd>
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

export function SettingsContainer({ profile, onOpenRoute }: { profile: string; onOpenRoute?: (r: string) => void }) {
  const client = useMemo(() => createOpsClient(), [])
  const policy = useOpsResource(() => client.policy(profile), [client, profile], 30_000)
  const model = useOpsResource(() => client.modelNode(profile), [client, profile], 30_000)

  return <SettingsView defaultModel={model.value} onOpenRoute={onOpenRoute} policy={policy.value} />
}
