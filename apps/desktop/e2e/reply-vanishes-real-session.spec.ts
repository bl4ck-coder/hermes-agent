import * as fs from 'node:fs'
import * as path from 'node:path'

import { expect, test } from '@playwright/test'

import { writeEnvFile, writeMockProviderConfig } from '../../../tests-js/scripts/mock-provider-config'
import { startMockServer } from '../../../tests-js/scripts/mock-server'

import { buildAppEnv, createSandbox, launchDesktop, waitForAppReady } from './fixtures'

// Bug 33 with the REAL long, tool-heavy session (read-only copy, cut before
// the question): the reply painted in full, then vanished on its own while a
// background subagent kept running.
const SEED_DB = process.env.BUG33_SEED_DB ?? ''
const SESSION_ID = 'local-5f6b5e142c3ccf9740988f7d41f592a4ace1ac296bff7d3e2698fa7d5f250b16'
const SECOND_REPLY = 'Va por la mitad: el constructor sigue trabajando en segundo plano.'
const CHILD_SLEEP_S = 45

test.skip(!SEED_DB, 'needs BUG33_SEED_DB')

test('real long session: the reply stays while a background subagent works', async () => {
  test.setTimeout(600_000)
  const mock = await startMockServer({
    replyForPrompt: prompt => (prompt.includes('como viene la construccion') ? SECOND_REPLY : 'Listo.')
  })
  const sandbox = createSandbox('bug33')
  writeMockProviderConfig(sandbox.hermesHome, mock.url, undefined, undefined, 4_000_000)
  writeEnvFile(sandbox.hermesHome)
  fs.copyFileSync(SEED_DB, path.join(sandbox.hermesHome, 'state.db'))
  // Seeded policies can still name a hosted provider: keep every non-local
  // request off the network so a misrouted turn fails instead of billing.
  const { app, page } = await launchDesktop(
    buildAppEnv(sandbox, {
      HTTPS_PROXY: 'http://127.0.0.1:9',
      HTTP_PROXY: 'http://127.0.0.1:9',
      NO_PROXY: '127.0.0.1,localhost',
      ANTHROPIC_API_KEY: '',
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:9'
    })
  )
  const fixture = { app, page, mock, mockUrl: mock.url, sandbox, cleanup: async () => undefined }
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
    await waitForAppReady(fixture, 240_000)
    await page.evaluate(id => {
      window.location.hash = `#/${id}`
    }, SESSION_ID)
    await expect(page.locator('[data-slot="aui_assistant-message-content"]').first()).toBeVisible({ timeout: 60_000 })

    const composer = page
      .locator('[data-slot="composer-root"] [contenteditable="true"]')
      .filter({ visible: true })
      .first()

    const childContext = `E2E_CALL(terminal)[{"command":"sleep ${CHILD_SLEEP_S}"}]`
    await composer.fill(`E2E_CALL(delegate_task)[${JSON.stringify({ goal: 'slow child', context: childContext })}]`)
    await composer.press('Enter')
    await expect(page.locator('[data-slot="aui_assistant-message-content"]').filter({ hasText: 'E2E_CALL_RESULT' })).toHaveCount(1, {
      timeout: 90_000
    })
    await expect.poll(() => events.filter(e => e.type === 'message.complete').length, { timeout: 30_000 }).toBeGreaterThan(0)
    await page.waitForTimeout(3000)

    await composer.fill('como viene la construccion?')
    await composer.press('Enter')
    const answers = page.locator('[data-slot="aui_assistant-message-content"]').filter({ hasText: SECOND_REPLY })
    await expect(answers).toHaveCount(1, { timeout: 90_000 })
    const shownAt = Date.now()
    const samples: { t: number; n: number; visible: boolean }[] = []

    while (Date.now() - shownAt < (CHILD_SLEEP_S + 20) * 1000) {
      const n = await answers.count()
      const visible = n > 0 && (await answers.first().isVisible().catch(() => false))
      samples.push({ t: Date.now() - shownAt, n, visible })
      await page.waitForTimeout(250)
    }

    const vanished = samples.filter(sample => sample.n === 0 || !sample.visible)
    await page.screenshot({ path: path.join(process.env.BUG33_KEEP_LOGS ?? sandbox.root, 'final.png') })
    console.log(
      JSON.stringify({
        vanishedAtMs: vanished.slice(0, 5).map(s => `${s.t}:${s.n}:${s.visible}`),
        vanishedSamples: vanished.length,
        samples: samples.length,
        eventsAfter: events
          .filter(e => e.t >= shownAt - 2000 && !['message.delta', 'thinking.delta'].includes(e.type))
          .map(e => `${e.t - shownAt}:${e.type}:${e.sid?.slice(0, 8)}`)
          .slice(0, 120)
      })
    )
    expect(vanished).toEqual([])
  } finally {
    if (process.env.BUG33_KEEP_LOGS) {
      fs.cpSync(`${sandbox.hermesHome}/logs`, process.env.BUG33_KEEP_LOGS, { recursive: true, force: true })
    }

    await app.close().catch(() => undefined)
    await mock.close()
    sandbox.cleanup()
  }
})
