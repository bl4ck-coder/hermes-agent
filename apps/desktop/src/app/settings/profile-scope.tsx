import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $activeGatewayProfile, $profiles, normalizeProfileKey, profileLabel, refreshProfiles } from '@/store/profile'
import {
  $settingsScopeEditsNonDefault,
  $settingsScopeOverride,
  $settingsScopeProfile,
  setSettingsScope
} from '@/store/settings-scope'
import type { ProfileInfo } from '@/types/hermes'

// Settings-chip label: the Bot Mode title the Bots roster shows when set
// (ui_meta['hermes-bots'].title), else the app-wide profileLabel
// (display_name → slug). Scoped to this selector on purpose — the profile
// rail and Profiles page keep naming profiles by display_name.
export function settingsScopeLabel(profile: Pick<ProfileInfo, 'bot_title' | 'display_name' | 'name'>): string {
  return (profile.bot_title ?? '').trim() || profileLabel(profile)
}

// The same chip affordance the Gateway page uses for its per-profile
// connection overrides (gateway-settings ScopeChip). That one stays local to
// gateway-settings — its `null` chip means "all profiles", while here every
// chip is a concrete profile whose config the page edits.
export function ScopeChip({ active, label, onSelect }: { active: boolean; label: string; onSelect: () => void }) {
  return (
    <button
      className={cn(
        'rounded-full border px-3 py-1 text-[length:var(--conversation-caption-font-size)] transition',
        active
          ? 'border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary) text-(--ui-text-primary)'
          : 'border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover)'
      )}
      onClick={onSelect}
      type="button"
    >
      {label}
    </button>
  )
}

/** Shared "Applies to" profile selector for the config-backed settings pages
 *  (Model, Workspace, Safety, Memory & Context, Voice, Tools & Keys), Custom
 *  Endpoints, and the Messaging overlay. Backed by one nanostore
 *  ($settingsScopeOverride) so the selection persists across pages. Hidden with
 *  fewer than two profiles, so single-profile users never see it and every
 *  request keeps its unscoped default shape. */
const COLLAPSE_AT = 8

export function SettingsProfileScope({ className }: { className?: string }) {
  const { t } = useI18n()
  const scope = t.settings.profileScope
  const override = useStore($settingsScopeOverride)
  const selected = useStore($settingsScopeProfile)
  const editingNonDefault = useStore($settingsScopeEditsNonDefault)
  const profiles = useStore($profiles)
  // The note names the edit target with the same presentation label as its
  // chip (Bot title → display_name → slug); the slug alone can name a bot the
  // user has never seen called that.
  const selectedLabel = profiles.find(profile => normalizeProfileKey(profile.name) === selected)
  const selectedName = selectedLabel ? settingsScopeLabel(selectedLabel) : selected

  // Refresh lazily so a profile created elsewhere shows up; the cached list
  // paints immediately. Best-effort — a failure keeps the cached roster.
  useEffect(() => {
    void refreshProfiles().catch(() => undefined)
  }, [])

  if (profiles.length < 2) {
    return null
  }

  return (
    <div className={cn('grid gap-2', className)}>
      {/* IA: with many profiles the chip wall pushed the page's real controls below the fold.
          Past COLLAPSE_AT it folds into a disclosure whose summary names the current target. */}
      {profiles.length > COLLAPSE_AT ? (
        <details data-scope-collapsible="">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-[length:var(--conversation-caption-font-size)] font-medium text-(--ui-text-secondary)">
            {scope.appliesTo}
            <span
              className="rounded-full border border-(--ui-stroke-secondary) bg-(--ui-bg-tertiary) px-3 py-1 text-(--ui-text-primary)"
              data-scope-current=""
            >
              {selectedName}
            </span>
            <span className="text-(--ui-text-tertiary)" data-scope-count="">
              {profiles.length} ▾
            </span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profiles.map(profile => (
              <ScopeChip
                active={normalizeProfileKey(profile.name) === selected}
                key={profile.name}
                label={settingsScopeLabel(profile)}
                onSelect={() => setSettingsScope(profile.name)}
              />
            ))}
          </div>
        </details>
      ) : (
        <>
          <div className="text-[length:var(--conversation-caption-font-size)] font-medium text-(--ui-text-secondary)">
            {scope.appliesTo}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profiles.map(profile => (
              <ScopeChip
                active={normalizeProfileKey(profile.name) === selected}
                key={profile.name}
                label={settingsScopeLabel(profile)}
                onSelect={() => setSettingsScope(profile.name)}
              />
            ))}
          </div>
        </>
      )}
      {/* Note truth table (override × non-default target, per the store's
          $settingsScopeEditsNonDefault): non-default target → loud accented
          note whether or not an override is set (the bot-active misdirect);
          explicit override onto the default → quiet tertiary note; following
          the active DEFAULT profile → no note. */}
      {override !== null || editingNonDefault ? (
        <p
          className={cn(
            'text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height)',
            editingNonDefault ? 'font-medium text-(--ui-accent)' : 'text-(--ui-text-tertiary)'
          )}
          data-scope-loud={editingNonDefault ? 'true' : undefined}
          role="status"
        >
          {scope.editsProfile(selectedName)}
        </p>
      ) : null}
    </div>
  )
}

/** Read-only note for Providers pages whose requests carry no settings-scope
 *  override and so always edit the app's ACTIVE profile (Local Models — the
 *  managed llama.cpp runtime is machine-scoped). Same string as the selector's
 *  note above; hidden with fewer than two profiles like the selector itself. */
export function ActiveProfileNote({ className }: { className?: string }) {
  const { t } = useI18n()
  const active = useStore($activeGatewayProfile)
  const profiles = useStore($profiles)

  if (profiles.length < 2) {
    return null
  }

  const key = normalizeProfileKey(active)
  const profile = profiles.find(candidate => normalizeProfileKey(candidate.name) === key)

  return (
    <p
      className={cn(
        'text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)',
        className
      )}
      role="status"
    >
      {t.settings.profileScope.editsProfile(profile ? settingsScopeLabel(profile) : key)}
    </p>
  )
}
