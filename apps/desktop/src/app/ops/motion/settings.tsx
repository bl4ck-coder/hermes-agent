/**
 * W9 Settings tab and Motion readout (ops-panel P5-03); the shortcut sheet is the shell's OpsShortcutSheet. Settings only shows values it
 * has a source for; theme opens Desktop settings (D5); approval mode reads approvals.mode from /api/config; the default model is edited
 * through the Canvas model node (P2 policy, A5/A6 backup); secret presence lists names and set/unset only until a backend reports them.
 */

import { type ReactNode, useMemo, useState } from 'react'

import { forgetDrafts } from '../canvas/drafts'
import { createNodeClient } from '../canvas/node-editor'
import { NodeEditor } from '../canvas/node-editor-view'
import { approvalMode, createOpsActions, envPresenceList } from '../feed/ops-actions'
import { createOpsClient, type PolicyView } from '../feed/ops-client'
import { usePublishInspectorDetail } from '../inspector-detail'
import { useOpsResource } from '../office/office-container'
import { ThresholdSettings } from '../office/thresholds'
import { OpsShortcutSheet } from '../shortcut-sheet'

import { DiagnosticsPanel } from './diagnostics'
import { cycleMotion, loadMotion, type MotionMode, saveMotion } from './motion'
import { hostTimezone, opsTimezone as tzOf, validTimezone } from './tz'

const PREF = 'hermes.ops.prefs'

export type OpsTheme = 'gold-night' | 'light' | 'dark' | 'system'

export interface OpsPrefs {
  defaultTab: 'office' | 'canvas' | 'board'
  dateFormat: 'relative' | 'iso' | 'local'
  /** R75: Gold Night is the Ops default; Light/Dark/System follow the named scheme inside the panel. */
  theme: OpsTheme
  /** R55: open the Ops panel when Desktop starts (on the default tab). */
  openOnLaunch: boolean
  /** R54: opt-in OS notifications. */
  notifyApprovals: boolean
  notifyBlocked: boolean
  /** SPEC v2.1 4a: Ops timezone for "today" / "this week"; '' = host local. */
  timezone: string
}

export const DEFAULT_PREFS: OpsPrefs = {
  defaultTab: 'office',
  dateFormat: 'relative',
  theme: 'gold-night',
  openOnLaunch: false,
  notifyApprovals: false,
  notifyBlocked: false,
  timezone: ''
}

/** The effective Ops timezone (pref, else host). */
export function opsTimezone(p: OpsPrefs = loadPrefs()): string {
  return tzOf(p.timezone)
}

const TZ_CHOICES = ['America/Buenos_Aires', 'UTC', 'America/New_York', 'Europe/Madrid', 'Asia/Tokyo']

export function loadPrefs(): OpsPrefs {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(PREF) ?? '{}') as Partial<OpsPrefs>

    return {
      defaultTab: v.defaultTab === 'canvas' || v.defaultTab === 'board' ? v.defaultTab : 'office',
      dateFormat: v.dateFormat === 'iso' || v.dateFormat === 'local' ? v.dateFormat : 'relative',
      theme: v.theme === 'light' || v.theme === 'dark' || v.theme === 'system' ? v.theme : 'gold-night',
      openOnLaunch: v.openOnLaunch === true,
      notifyApprovals: v.notifyApprovals === true,
      notifyBlocked: v.notifyBlocked === true,
      timezone: validTimezone(v.timezone)
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

/** R55: the route Desktop should open at startup, or null to keep its own default. */
export function opsLaunchRoute(p: OpsPrefs = loadPrefs()): string | null {
  return p.openOnLaunch ? `/ops/${p.defaultTab}` : null
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

/** R75: one titled group per concern. Module-level so inputs keep focus across renders. */
function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-label={title} data-ops-settings-group={id}>
      <h3>{title}</h3>
      {children}
    </section>
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
  const [draftNote, setDraftNote] = useState<string | null>(null)
  usePublishInspectorDetail({
    kind: 'settings',
    id: `settings:${profile ?? 'default'}`,
    title: 'Settings',
    badge: profile ?? 'default',
    rows: [
      ['Time zone', opsTimezone(prefs)],
      ['Motion', String(motion)],
      ['Policy', policy ? (policy.fail_closed ? `${policy.source} (invalid, writes blocked)` : policy.source) : 'loading'],
      ['Default model', defaultModel ? `${defaultModel.provider || 'unset'} / ${defaultModel.model || 'unset'}` : 'loading'],
      ['Approvals', approval === undefined ? 'loading' : (approval ?? 'not set')],
      ['Secrets set', secrets ? `${secrets.filter(s => s.set).length} of ${secrets.length}` : 'unknown'],
      ['Legacy write routes', 'active (retire flag off)']
    ],
    source: 'Ops settings',
    why: 'this profile’s Ops settings'
  })

  const set = (p: Partial<OpsPrefs>) => {
    const next = { ...prefs, ...p }
    savePrefs(next)
    setPrefs(next)
  }

  return (
    <section aria-label="Ops settings" data-ops-settings="" data-ops-theme={prefs.theme}>
      <Group id="general" title="General">
        <dl>
          <dt>Theme</dt>
          <dd>
            <select aria-label="theme" onChange={e => set({ theme: e.target.value as OpsTheme })} value={prefs.theme}>
              <option value="gold-night">Gold Night (default)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
            <button data-ops-open-route="/settings" onClick={() => onOpenRoute?.('/settings')} type="button">
              Desktop appearance
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
          <dt>Open Ops on launch</dt>
          <dd>
            <input aria-label="open ops on launch" checked={prefs.openOnLaunch} onChange={e => set({ openOnLaunch: e.target.checked })} type="checkbox" />
            <small data-ops-launch-route="">{opsLaunchRoute(prefs) ?? 'Desktop opens its own start page.'}</small>
          </dd>
          <dt>Timezone</dt>
          <dd>
            <select aria-label="timezone" data-ops-timezone={opsTimezone(prefs)} onChange={e => set({ timezone: validTimezone(e.target.value) })} value={prefs.timezone}>
              <option value="">Host local ({hostTimezone()})</option>
              {[...new Set([...TZ_CHOICES, ...(prefs.timezone ? [prefs.timezone] : [])])].map(z => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <small>"Today" and "this week" in Office use this zone.</small>
          </dd>
          <dt>Date format</dt>
          <dd>
            <select aria-label="date format" onChange={e => set({ dateFormat: e.target.value as OpsPrefs['dateFormat'] })} value={prefs.dateFormat}>
              <option value="relative">Relative</option>
              <option value="iso">ISO</option>
              <option value="local">Local</option>
            </select>
          </dd>
        </dl>
        <button data-ops-prefs-reset="" disabled={JSON.stringify(prefs) === JSON.stringify(DEFAULT_PREFS)} onClick={() => set({ ...DEFAULT_PREFS })} type="button">
          Reset to defaults
        </button>
      </Group>
      <Group id="ops" title="Ops">
        {policy?.fail_closed ? (
          <p data-ops-policy-invalid="" role="alert">
            ops-policy.yaml is invalid, so every governed save is blocked until it is fixed: {policy.error ?? 'reason not recorded'}
          </p>
        ) : null}
        <ThresholdSettings />
        <dl>
          <dt>Default model (P2)</dt>
          <dd data-ops-field="default-model">
            {defaultModel ? `${defaultModel.provider ?? 'unknown'} / ${defaultModel.model ?? 'unknown'}` : 'unknown'}
            {policy ? <span data-ops-field="policy-source"> (policy: {policy.source}{policy.error ? `, error: ${policy.error}` : ''})</span> : null}
          </dd>
          <dt>Approval mode{profile ? ` (${profile})` : ''}</dt>
          <dd data-ops-field="approval-mode">
            {approval === undefined ? 'unknown' : approval === null ? 'default (approvals.mode not set)' : approval}
          </dd>
          <dd>
            {/* O41: the mode is written by Desktop's own config editor; Ops reads it per profile. */}
            <button data-ops-approval-edit="" disabled={!onOpenRoute} onClick={() => onOpenRoute?.(`/settings?section=approvals${profile ? `&profile=${encodeURIComponent(profile)}` : ''}`)} type="button">
              Change
            </button>
          </dd>
          {editModel && profile ? (
            <>
              <dt>Change default model</dt>
              <dd data-ops-field="model-editor">
                <ModelEditor policy={policy} profile={profile} />
              </dd>
            </>
          ) : null}
        </dl>
      </Group>
      <Group id="notifications" title="Notifications">
        <label>
          <input aria-label="notify approvals" checked={prefs.notifyApprovals} onChange={e => (set({ notifyApprovals: e.target.checked }), e.target.checked && requestNotify())} type="checkbox" />
          New approval waiting
        </label>
        <label>
          <input aria-label="notify blocked" checked={prefs.notifyBlocked} onChange={e => (set({ notifyBlocked: e.target.checked }), e.target.checked && requestNotify())} type="checkbox" />
          A task becomes blocked
        </label>
        <p>Silent OS notifications; Desktop never takes focus.</p>
      </Group>
      <Group id="shortcuts" title="Shortcuts">
        <button onClick={() => setSheet(true)} type="button">
          Shortcut sheet
        </button>
      </Group>
      <Group id="diagnostics" title="Diagnostics">
        <DiagnosticsPanel policySource={policy ? (policy.error ? `${policy.source} (${policy.error})` : policy.source) : null} />
      </Group>
      <Group id="security" title="Security">
        <dl>
          <dt>Secret presence</dt>
          <dd data-ops-field="secrets">
            {secrets === null ? (
              'unknown'
            ) : (
              <div data-ops-secrets="">
                <p data-ops-secret-summary="">
                  {secrets.filter(x => x.set).length} set · {secrets.filter(x => !x.set).length} not set
                </p>
                <ul aria-label="secret presence" data-ops-secret-list="set">
                  {secrets
                    .filter(x => x.set)
                    .map(x => (
                      <li data-ops-secret={x.name} data-ops-set="yes" key={x.name}>
                        {x.name}: set
                      </li>
                    ))}
                </ul>
                {secrets.some(x => !x.set) ? (
                  <details data-ops-secret-unset="">
                    <summary>Show {secrets.filter(x => !x.set).length} not set</summary>
                    <ul aria-label="secrets not set" data-ops-secret-list="unset">
                      {secrets
                        .filter(x => !x.set)
                        .map(x => (
                          <li data-ops-secret={x.name} data-ops-set="no" key={x.name}>
                            {x.name}: not set
                          </li>
                        ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            )}
          </dd>
        </dl>
        <p>Values are never shown here, in Diagnostics, or in a copied report.</p>
        <button data-ops-forget-drafts="" onClick={() => setDraftNote(`Forgot ${forgetDrafts()} kept draft(s).`)} type="button">
          Forget kept Canvas drafts
        </button>
        {draftNote ? <span role="status">{draftNote}</span> : null}
        <dl data-ops-security-boundary="">
          <dt>Config writes</dt>
          <dd>Through A5 transactions with the A6 policy check and a backup; remote connections are read-only.</dd>
          <dt>Cross-site requests</dt>
          <dd>Hermes refuses Ops, Board and approval writes from a foreign Origin (separate from the Host check).</dd>
          <dt>Legacy write routes</dt>
          <dd data-ops-legacy-routes="flag">
            Older Hermes routes (profile soul/model/description, raw config, skills toggle, toolsets) bypass A5/A6. Ops never calls them. Set HERMES_RETIRE_LEGACY_WRITES=1 in the backend environment to retire them (410); off by default because the classic Settings still uses them.
          </dd>
        </dl>
      </Group>
      {sheet ? <OpsShortcutSheet onClose={() => setSheet(false)} /> : null}
    </section>
  )
}

function requestNotify() {
  const N = (globalThis as { Notification?: { permission: string; requestPermission?: () => Promise<string> } }).Notification

  if (N && N.permission === 'default') {
    void N.requestPermission?.()
  }
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
