import { expect, test } from '@playwright/test'

import { setupMockBackend, waitForAppReady } from './fixtures'

// Bug 33: a finished reply painted in full, then vanished on its own while a
// background delegate_task kept running in the same session. Real Electron,
// backend, SQLite, stream and a real background subagent (mock provider).
const SECOND_REPLY = 'Va por la mitad: el constructor sigue trabajando en segundo plano.'
const CHILD_SLEEP_S = 45

test('a completed reply stays on screen while a background subagent keeps working', async () => {
  test.setTimeout(240_000)
  const fixture = await setupMockBackend({
    mockServer: {
      replyForPrompt: prompt => (prompt.includes('como viene la construccion') ? SECOND_REPLY : 'Listo.')
    }
  })
  const { page } = fixture
  const events: { t: number; type: string; sid?: string }[] = []
  page.on('websocket', socket => {
    socket.on('framereceived', frame => {
      try {
        const message = JSON.parse(String(frame.payload))

        if (message.method === 'event') {
          events.push({ t: Date.now(), type: message.params?.type, sid: message.params?.session_id })
        }
      } catch {
        /* Non-JSON transport frames carry no turn event. */
      }
    })
  })

  try {
    await waitForAppReady(fixture)

    const composer = page
      .locator('[data-slot="composer-root"] [contenteditable="true"]')
      .filter({ visible: true })
      .first()

    // The child's scripted sleep rides in `context`: the dispatch receipt
    // echoes only the goal, so the token never re-enters the parent's turn.
    const childContext = `E2E_CALL(terminal)[{"command":"sleep ${CHILD_SLEEP_S}"}]`
    await composer.fill(`E2E_CALL(delegate_task)[${JSON.stringify({ goal: 'slow child', context: childContext })}]`)
    await composer.press('Enter')
    await expect(page.locator('[data-slot="aui_assistant-message-content"]').filter({ hasText: 'E2E_CALL_RESULT' })).toHaveCount(1, {
      timeout: 60_000
    })
    await expect.poll(() => events.filter(e => e.type === 'message.complete').length, { timeout: 30_000 }).toBeGreaterThan(0)
    await page.waitForTimeout(3000)

    await composer.fill('como viene la construccion?')
    await composer.press('Enter')
    const answers = page.locator('[data-slot="aui_assistant-message-content"]').filter({ hasText: SECOND_REPLY })
    await expect(answers).toHaveCount(1, { timeout: 60_000 })
    const shownAt = Date.now()

    // Watch the answer while the child keeps running and finishes.
    const samples: { t: number; n: number }[] = []

    while (Date.now() - shownAt < (CHILD_SLEEP_S + 20) * 1000) {
      samples.push({ t: Date.now() - shownAt, n: await answers.count() })
      await page.waitForTimeout(250)
    }

    const vanished = samples.filter(sample => sample.n === 0)
    console.log(
      JSON.stringify({
        vanishedAtMs: vanished.slice(0, 3).map(s => s.t),
        vanishedSamples: vanished.length,
        samples: samples.length,
        eventsAfter: events
          .filter(e => e.t >= shownAt - 2000)
          .map(e => `${e.t - shownAt}:${e.type}:${e.sid?.slice(0, 8)}`)
          .slice(0, 200)
      })
    )
    expect(vanished).toEqual([])
  } finally {
    if (process.env.BUG33_KEEP_LOGS) {
      const fs = await import('node:fs')
      fs.cpSync(`${fixture.sandbox.hermesHome}/logs`, process.env.BUG33_KEEP_LOGS, { recursive: true, force: true })
    }

    await fixture.cleanup()
  }
})
