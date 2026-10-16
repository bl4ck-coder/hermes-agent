import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { atom } from 'nanostores'
import { createRef } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as ConfigApi from '@/api/config'
import { $settingsRequestProfile } from '@/store/settings-scope'

import type { ConfigSettings as ConfigSettingsType } from './config-settings'

// Radix Select calls scrollIntoView / pointer-capture APIs jsdom lacks.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
})

// The vi.mock factory below replaces the computed (read-only) atom with a
// writable one; narrow the import back so tests can drive it.
const scopeProfileMock = $settingsRequestProfile as unknown as { set: (value: string) => void }

const getHermesConfigRecord = vi.fn()
const getHermesConfigSchema = vi.fn()
const saveHermesConfig = vi.fn()
const getElevenLabsVoices = vi.fn()

// Keep the real read-origin helpers (WeakMap peek/bind) live: the shared
// config hook reaches them through the barrel, and a bare mock would throw.
vi.mock('@/hermes', async () => ({
  ...(await vi.importActual<typeof ConfigApi>('@/api/config')),
  // use-config-record folds the scope into its cache key via the barrel; the
  // real one is a pure string fold, mirrored here for the string scopes this
  // suite passes.
  profileScopeKey: (scope?: unknown) => (typeof scope === 'string' && scope.trim()) || 'default',
  getHermesConfigRecord: (profile?: string) => getHermesConfigRecord(profile),
  getHermesConfigSchema: () => getHermesConfigSchema(),
  saveHermesConfig: (config: unknown, profile?: string) => saveHermesConfig(config, profile),
  getElevenLabsVoices: () => getElevenLabsVoices(),
  getGlobalModelOptions: () =>
    Promise.resolve({
      providers: [
        { name: 'GitHub Copilot', slug: 'copilot', models: ['gpt-5-mini'] },
        { name: 'OpenAI Codex', slug: 'openai-codex', models: ['gpt-5.4-mini'] }
      ]
    }),
  setApiRequestProfile: () => {}
}))

// The model controller above the fallback list is its own surface (and backend); not under test here.
vi.mock('./model-settings', () => ({ ModelSettings: () => null, ModelSettingsSkeleton: () => null }))

vi.mock('../hooks/use-on-profile-switch', () => ({
  useOnProfileSwitch: () => {}
}))

// The real stores pull in the gateway/profile stack, which needs a live
// backend connection. This page only reads the "applies to" scope override
// and the repo-discovery signature, neither of which this test touches. The
// scope chip it renders also reads the selected profile and the loud-note
// selector, so those are stubbed to the single-profile default shape.
vi.mock('@/store/settings-scope', () => ({
  // The real store derives this from the displayed $settingsScopeProfile
  // (never undefined for a real profile — settings-scope.test.ts pins that);
  // here it is a plain atom so the page's threading of it can be driven.
  $settingsRequestProfile: atom<string | undefined>('default'),
  $settingsScopeEditsNonDefault: atom(false),
  $settingsScopeOverride: atom<null | string>(null),
  $settingsScopeProfile: atom<string>('default')
}))

vi.mock('@/store/projects', () => ({
  $worktreeRefreshToken: atom(0),
  repoDiscoveryPolicyFromConfig: () => ({ enabled: true, roots: [], exclude_paths: [] }),
  repoDiscoveryPolicySignature: (policy: unknown) => JSON.stringify(policy),
  scanAndRecordRepos: vi.fn().mockResolvedValue(undefined)
}))

// The module graph behind ConfigSettings is large (1.5s cold here, >10s on a
// saturated CI runner); load it once under the hook timeout so the 15s test
// budget is spent on the autosave behaviour, not on transform + import.
let ConfigSettings: typeof ConfigSettingsType

beforeAll(async () => {
  ;({ ConfigSettings } = await import('./config-settings'))
}, 60_000)

beforeEach(() => {
  scopeProfileMock.set('default')
  getElevenLabsVoices.mockResolvedValue({ available: false })
  getHermesConfigSchema.mockResolvedValue({ fields: {} })
  saveHermesConfig.mockResolvedValue({ ok: true })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderConfigSettings(activeSectionId = 'safety', subpage?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const importInputRef = createRef<HTMLInputElement>()

  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ConfigSettings activeSectionId={activeSectionId} importInputRef={importInputRef} subpage={subpage} />
      </QueryClientProvider>
    </MemoryRouter>
  )

  return { importInputRef }
}

const CHAIN = [
  { provider: 'copilot', model: 'gpt-5-mini' },
  { provider: 'openai-codex', model: 'gpt-5.4-mini' }
]

const fieldError = (key: string) => document.querySelector(`[data-settings-field-error="${key}"]`)
const fallbackRow = () => document.getElementById('setting-field-fallback_providers')!.querySelector('[data-settings-form-row]') as HTMLElement
const fallbackGroup = () => fallbackRow().querySelector('[role="group"]') as HTMLElement
const removeButtons = () => within(fallbackGroup()).queryAllByRole('button', { name: /^Remove \d/ })

describe('P26 fallback_providers: a refused save is announced and recovered on the composite field', () => {
  it('error with reason in the control column; every fallback control is invalid and described by it; Retry sends only fallback_providers; Revert sends nothing', async () => {
    getHermesConfigRecord.mockResolvedValue({ fallback_providers: CHAIN, model_context_length: 0 })
    saveHermesConfig.mockRejectedValue(new Error('disk is read-only'))
    vi.useFakeTimers({ shouldAdvanceTime: true })

    try {
      renderConfigSettings('model')
      await vi.waitFor(() => expect(removeButtons()).toHaveLength(2))

      // Edit 1: remove the second fallback. Edit 2: another field on the same page, also refused (stays pending).
      removeButtons()[1].click()
      await vi.advanceTimersByTimeAsync(700)
      await vi.waitFor(() => expect(fieldError('fallback_providers')).not.toBeNull())
      expect(saveHermesConfig.mock.calls[0][0]).toEqual({ fallback_providers: [CHAIN[0]] })
      const context = document.getElementById('setting-field-model_context_length')!.querySelector('input') as HTMLInputElement
      fireEvent.change(context, { target: { value: '8192' } })
      await vi.advanceTimersByTimeAsync(700)
      await vi.waitFor(() => expect(fieldError('model_context_length')).not.toBeNull())

      const row = fallbackRow()
      const body = row.querySelector('[data-sfr-body]')!
      const error = fieldError('fallback_providers')!
      const errorP = error.closest('[data-sfr-error]') as HTMLElement
      expect(error.textContent).toContain('disk is read-only')
      expect(errorP.getAttribute('role')).toBe('alert')
      expect(body.contains(error)).toBe(true)
      expect(row.querySelector('[data-sfr-label]')!.contains(error)).toBe(false)
      expect(fallbackGroup().compareDocumentPosition(errorP) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(fallbackGroup().getAttribute('aria-describedby')?.split(' ')).toContain(errorP.id)

      for (const combo of within(fallbackGroup()).getAllByRole('combobox')) {
        expect(combo.getAttribute('aria-invalid')).toBe('true')
        expect(combo.getAttribute('aria-describedby')?.split(' ')).toContain(errorP.id)
      }

      // The draft stays (one row) while refused.
      expect(removeButtons()).toHaveLength(1)

      // Retry: only this key is sent, with the draft value.
      const calls = saveHermesConfig.mock.calls.length
      saveHermesConfig.mockRejectedValue(new Error('disk is still read-only'))
      ;(row.querySelector('[data-settings-field-retry="fallback_providers"]') as HTMLButtonElement).click()
      await vi.advanceTimersByTimeAsync(700)
      await vi.waitFor(() => expect(saveHermesConfig).toHaveBeenCalledTimes(calls + 1))
      expect(saveHermesConfig.mock.calls[calls][0]).toEqual({ fallback_providers: [CHAIN[0]] })
      await vi.waitFor(() => expect(fieldError('fallback_providers')?.textContent).toContain('still read-only'))
      // The other refused field keeps its draft and its own error.
      expect(context.value).toBe('8192')
      expect(fieldError('model_context_length')).not.toBeNull()

      // Revert: nothing is sent; the saved chain is back in the editor; the error and invalid marks are gone.
      ;(row.querySelector('[data-settings-field-revert="fallback_providers"]') as HTMLButtonElement).click()
      await vi.advanceTimersByTimeAsync(700)
      await vi.waitFor(() => expect(fieldError('fallback_providers')).toBeNull())
      expect(saveHermesConfig).toHaveBeenCalledTimes(calls + 1)
      await vi.waitFor(() => expect(removeButtons()).toHaveLength(2))
      expect(fieldError('model_context_length')).not.toBeNull()

      for (const combo of within(fallbackGroup()).getAllByRole('combobox')) {
        expect(combo.getAttribute('aria-invalid')).toBeNull()
      }
    } finally {
      vi.useRealTimers()
    }
  })
})
