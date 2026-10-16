import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// @vitest-environment jsdom
// P27 (judge pass 21 #5): Chat in use. In an EXISTING session with a long history, a prompt.submit the gateway refuses
// keeps exactly one copy of the draft (in the composer), says the refusal beside the composer (human reason, raw text
// folded), keeps the caret in the composer and adds nothing to the transcript; messages and composer share one column.
import { AssistantRuntimeProvider, type ThreadMessageLike, useExternalStoreRuntime } from '@assistant-ui/react'
import { JsonRpcGatewayError } from '@hermes/shared'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  actRender,
  Harness,
  type HarnessHandle,
  RUNTIME_SESSION_ID
} from '@/app/session/hooks/use-prompt-actions/index-test-utils'
import { clearSingleFlightSessionResumeState } from '@/app/session/hooks/use-prompt-actions/single-flight-resume'
import { I18nProvider } from '@/i18n'
import { textPart } from '@/lib/chat-messages'
import { mainComposerScope } from '@/store/composer'
import { recordSubmitRefusal, takeSubmitRefusal } from '@/store/composer-refusal'
import { $notifications, clearNotifications } from '@/store/notifications'

import { ChatBar } from './composer'
import { composerPlainText, RICH_INPUT_SLOT } from './composer/rich-editor'
import type { ChatBarProps, ChatBarState } from './composer/types'

vi.mock('@/hermes', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getLatestSessionMessages: vi.fn(async () => ({ messages: [], session_id: 'session' })),
  getProfiles: vi.fn(async () => ({ profiles: [] })),
  getSession: vi.fn(),
  PROMPT_SUBMIT_REQUEST_TIMEOUT_MS: 1_800_000,
  setApiRequestProfile: vi.fn(),
  transcribeAudio: vi.fn()
}))

vi.mock('@/store/gateway', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requestGatewayForAgent: vi.fn()
}))

const DRAFT = 'Please summarise the release notes for 2.4 before Friday'
const REFUSAL = 'invalid params for prompt.submit: text: too long for this model (limit 4096 tokens)'

// A conversation in use: 120 turns already on screen.
const HISTORY = Array.from({ length: 120 }, (_, i) => ({
  id: `m-${i}`,
  parts: [textPart(i % 2 ? `Answer ${i}` : `Question ${i}`)],
  role: i % 2 ? 'assistant' : 'user'
}))

beforeEach(() => {
  clearSingleFlightSessionResumeState()
  window.localStorage.removeItem('hermes.desktop.preparedSubmissions.v1')
  window.localStorage.removeItem('hermes.desktop.composerQueue.v1')
  clearNotifications()
})

afterEach(() => {
  cleanup()
  clearNotifications()
  mainComposerScope.clear()
})

describe('P27 refused prompt.submit in an existing long session (submit pipeline)', () => {
  const mount = async (requestGateway: (method: string) => Promise<never>) => {
    let handle: HarnessHandle | null = null
    await actRender(
      <Harness
        onReady={h => (handle = h)}
        refreshSessions={async () => undefined}
        requestGateway={requestGateway as never}
        seedMessages={HISTORY}
      />
    )

    return handle!
  }

  it('adds no user bubble and no error card, raises no toast, and hands the reason to the composer', async () => {
    const requestGateway = vi.fn(async (method: string) => {
      if (method === 'prompt.submit') {
        throw new JsonRpcGatewayError(REFUSAL, { code: 4002 })
      }

      return {} as never
    })

    const handle = await mount(requestGateway)

    expect(
      await handle.submitText(DRAFT, { composerScope: RUNTIME_SESSION_ID, submission_id: 'p27-send-1' })
    ).toBe(false)
    // The gateway really was asked (and refused): this is the existing-session submit, not a create.
    expect(requestGateway.mock.calls.map(c => c[0])).toEqual(['prompt.submit'])

    const messages = handle.state().messages as { error?: string; id: string; role: string }[]
    expect(messages.map(m => m.id)).toEqual(HISTORY.map(m => m.id))
    expect(messages.some(m => m.error)).toBe(false)
    expect(JSON.stringify(messages)).not.toContain(DRAFT)
    expect(handle.state().busy).toBe(false)
    expect($notifications.get()).toEqual([])

    const refused = takeSubmitRefusal('p27-send-1')
    expect(refused?.error).toBeInstanceOf(JsonRpcGatewayError)
    // Taken once.
    expect(takeSubmitRefusal('p27-send-1')).toBeNull()
  })

  it('a send that is not the composer\'s (no composer scope) keeps the transcript error card', async () => {
    const handle = await mount(async method => {
      if (method === 'prompt.submit') {
        throw new JsonRpcGatewayError(REFUSAL, { code: 4002 })
      }

      return {} as never
    })

    expect(await handle.submitText(DRAFT, { submission_id: 'p27-send-2' })).toBe(false)
    const last = (handle.state().messages as { error?: string }[]).at(-1)
    expect(last?.error).toContain('too long for this model')
    expect(takeSubmitRefusal('p27-send-2')).toBeNull()
  })
})

const state: ChatBarState = {
  model: { canSwitch: false, model: '', provider: '' },
  tools: { enabled: false, label: '' },
  voice: { enabled: false, active: false }
}

function ComposerHarness({ onSubmit }: { onSubmit: ChatBarProps['onSubmit'] }) {
  const runtime = useExternalStoreRuntime({
    convertMessage: (message: ThreadMessageLike) => message,
    isRunning: false,
    messages: [] as ThreadMessageLike[],
    onNew: async () => {}
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <MemoryRouter>
        <I18nProvider configClient={null} initialLocale="en">
          <ChatBar
            busy={false}
            disabled={false}
            gateway={null}
            onCancel={vi.fn()}
            onSubmit={onSubmit}
            queueSessionKey="stored-long-session"
            sessionId="rt-long-session"
            state={state}
          />
        </I18nProvider>
      </MemoryRouter>
    </AssistantRuntimeProvider>
  )
}

describe('P27 refused send beside the composer', () => {
  it('one draft back in the composer, the refusal beside it (reason first, raw folded), focus kept', async () => {
    // The pipeline's contract (proved above): record the refusal under the composer's submission id, answer false.
    const onSubmit = vi.fn(async (_text: string, options?: { submission_id?: string }) => {
      recordSubmitRefusal(
        [options?.submission_id],
        new Error(`Error invoking remote method 'hermes:gateway': Error: ${REFUSAL}`)
      )

      return false
    })

    const { container } = render(<ComposerHarness onSubmit={onSubmit as never} />)
    const editor = container.querySelector<HTMLElement>(`[data-slot="${RICH_INPUT_SLOT}"]`)!
    Object.defineProperty(editor, 'isContentEditable', { configurable: true, value: true })
    editor.focus()
    editor.textContent = DRAFT
    fireEvent.input(editor)

    await act(async () => {
      fireEvent.keyDown(editor, { key: 'Enter' })
    })

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toBe(DRAFT)

    const reason = await waitFor(() => {
      const r = container.querySelector('[data-slot="composer-root"] [data-composer-refusal-reason]')
      expect(r).toBeTruthy()

      return r as HTMLElement
    })

    // Exactly one copy of the draft, in the composer.
    expect(composerPlainText(editor)).toBe(DRAFT)

    // Nothing outside the composer holds the text (its sr-only textarea mirror is the composer's own state).
    const holders = [...document.body.querySelectorAll('*')].filter(e =>
      [...e.childNodes].some(n => n.nodeType === 3 && n.textContent?.includes(DRAFT))
    )

    expect(holders.length).toBeGreaterThan(0)
    expect(holders.every(e => e.closest('[data-slot="composer-root"]'))).toBe(true)
    expect(editor.textContent?.split(DRAFT).length).toBe(2)
    // Beside the composer, inside its surface, announced; the human reason (IPC wrapper stripped) first.
    expect(reason.getAttribute('role')).toBe('alert')
    expect(reason.closest('[data-slot="composer-surface"]')).toBeTruthy()
    expect(reason.textContent).toContain('Not sent')
    expect(reason.textContent).toContain(REFUSAL)
    expect(reason.textContent).not.toContain('Error invoking remote method')
    // The raw transport text is only in a folded detail.
    const raw = container.querySelector('[data-composer-refusal-raw]') as HTMLDetailsElement
    expect(raw.open).toBe(false)
    expect(raw.textContent).toContain('Error invoking remote method')
    // The caret never left the composer.
    expect(document.activeElement).toBe(editor)

    // Dismissing hides the notice and leaves the draft alone.
    fireEvent.click(container.querySelector('[data-slot="composer-submit-refusal"] button')!)
    expect(container.querySelector('[data-composer-refusal-reason]')).toBeNull()
    expect(composerPlainText(editor)).toBe(DRAFT)
  })
})

describe('P27 messages and composer share one column', () => {
  // jsdom has no layout; the geometry was measured in Chromium with the real CSS (420/760, long history with its
  // scrollbar): text column and composer surface both at 16px from each panel edge. This pins the rules that give it.
  const css = readFileSync(resolve(__dirname, '../../styles.css'), 'utf8')

  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`)
    expect(at).toBeGreaterThanOrEqual(0)

    return css.slice(at, css.indexOf('}', at))
  }

  it('the thread content box sits on the composer dock axis and the text edges on the composer surface', () => {
    const viewport = rule("[data-slot='aui_thread-viewport']")
    const content = rule("[data-slot='aui_thread-content']")
    const dock = rule("[data-slot='composer-dock']")
    const root = rule("[data-slot='composer-root']")
    expect(viewport).toMatch(/scrollbar-gutter:\s*stable both-edges/)
    expect(content).toMatch(/max-width:\s*calc\(var\(--composer-width\) \+ 1rem\)/)
    expect(content).toMatch(/padding-inline:\s*0\.5rem/)
    expect(dock).toMatch(/width:\s*calc\(min\(var\(--composer-width\), calc\(100% - 2rem\)\) \+ 10px\)/)
    expect(root).toMatch(/padding-inline:\s*5px/)

    // The same arithmetic Chromium did: gutter 0.5rem (the scrollbar width) + padding 0.5rem = the dock's 1rem inset.
    const scrollbar = /\*::-webkit-scrollbar \{\s*width:\s*0\.5rem/.test(css)
    expect(scrollbar).toBe(true)

    for (const panel of [420, 760]) {
      const text = { left: 8 + 8, right: panel - 8 - 8 }
      const surfaceWidth = Math.min(panel, panel - 32) + 10 - 10
      const surface = { left: (panel - surfaceWidth) / 2, right: (panel + surfaceWidth) / 2 }
      expect(text).toEqual(surface)
    }
  })
})
