// P19: hard states for every screen, on the isolated instance only (see hard.mjs). Mocks replace hermes:api responses
// of THIS test instance; nothing reaches the real gateway. Each state() call adds a row to state-matrix.json.
const now = Math.floor(Date.now() / 1000)
const task = (id, title, status, tenant, assignee, extra = {}) => ({ id, title, status, tenant, assignee, project_id: tenant === 'web' ? 'brand' : null, created_at: now - 3600 * Number(id.slice(1)), ...extra })
const BOARD = {
  columns: [
    { name: 'triage', tasks: [task('t1', 'Decide the pricing page copy for the launch', 'triage', 'web', 'writer')] },
    { name: 'ready', tasks: [task('t2', 'Migrate the image pipeline to the new CDN', 'ready', 'web', 'builder'), task('t3', 'Rotate the staging API keys', 'ready', 'infra', 'ops')] },
    { name: 'running', tasks: [task('t4', 'Nightly evals for the summarizer with a deliberately long title that has to wrap inside a narrow panel', 'running', 'research', 'judge', { current_run_started_at: now - 900 })] },
    { name: 'blocked', tasks: [task('t5', 'Ship the onboarding emails', 'blocked', 'web', 'writer', { consecutive_failures: 3 })] },
    { name: 'review', tasks: [task('t6', 'Review the RFC for agent memory', 'review', null, 'builder')] },
    { name: 'done', tasks: [task('t7', 'Fix flaky login test', 'done', 'web', 'builder', { completed_at: now - 7200 })] }
  ],
  tenants: ['web', 'infra', 'research'],
  assignees: ['writer', 'builder', 'ops', 'judge'],
  now
}
const item = (origin, id, what, profile, age, extra = {}) => ({ origin, id, profile, session_id: null, run_id: null, tenant: null, exact_request: null, why: '', what_for: what, status: 'pending', expires_at: null, age_s: age, actions: ['approve', 'deny'], ...extra })
const PENDING = {
  items: [
    item('jsonrpc', 'a1', 'Run a shell command in the builder workspace', 'builder', 5400, { exact_request: { command: 'git push --force-with-lease origin feature/very-long-branch-name-to-test-wrapping && npm run release -- --tag next', pattern_keys: ['git push'] } }),
    item('kanban_review', 't6', 'Review the RFC for agent memory', 'builder', 86400),
    item('kanban_blocked', 't5', 'Ship the onboarding emails', 'writer', 172800, { why: 'SMTP credentials missing' })
  ],
  observed_at: { jsonrpc: now, kanban: now }
}
const base = [
  { path: '^/api/plugins/kanban/board', body: BOARD },
  { path: '^/api/approvals/pending', body: PENDING }
]
const click = async (page, sel) => { const l = page.locator(sel).first(); if (await l.count()) { await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 4000 }); return true } return false }
const fill = async (page, sel, v) => { const l = page.locator(sel).first(); if (await l.count()) { await l.fill(v); return true } return false }

export default async function ({ page, go, goApp, lens, state, mock, narrow, sleep, want }) {
  if (!want('hard') && !want('all')) return
  // Office and Board are pinned routes, not rail lenses.
  const open = async id => { if (id === 'office' || id === 'board') { await go(`/ops/${id}`); await sleep(1500); return } await go('/ops'); await lens(id) }
  await mock(base)

  // Office
  await state('office', 'loaded-decisions', async () => { await open('office') })
  await state('office', 'more-actions-open', async () => { await open('office'); return String(await click(page, '[data-ops-approval] [data-ops-row-more-slot] summary')) })
  await mock([...base, { path: '^/api/plugins/kanban/tasks/', method: 'POST', throw: '409: comment refused (mock)' }, { path: '^/api/plugins/kanban/tasks/.*/comments', throw: '409: comment refused (mock)' }])
  await state('office', 'comment-rejected', async () => {
    await open('office')
    const row = page.locator('[data-ops-approval]', { hasText: 'Review the RFC' }).first()
    await row.locator('[data-ops-row-more-slot] summary').first().click({ timeout: 4000 })
    await sleep(300)
    await row.locator('input').first().fill('Please split section 3', { timeout: 4000 })
    await row.locator('[data-ops-comment]').first().click({ timeout: 4000 })
    await sleep(800)
    return 'sent'
  })
  await mock(base)

  // Board
  await state('board', 'loaded', async () => { await open('board') })
  await state('board', 'filtered', async () => { await open('board'); return String(await fill(page, '[data-ops-root] input[placeholder="Filtrar"], [data-ops-root] input[placeholder="Filter"], [data-ops-root] input[type="search"]', 'web')) })
  await mock([{ path: '^/api/plugins/kanban/board', throw: '503: kanban plugin unavailable (mock)' }, { path: '^/api/approvals/pending', body: PENDING }])
  await state('board', 'error', async () => { await open('board') })
  await mock(base)

  // Agents: Fleet / Teams
  await state('fleet', 'details-open', async () => { await open('agents'); return String(await click(page, 'details:has([data-ops-fleet-details]) > summary')) })
  await state('teams', 'work-and-members-open', async () => {
    await open('agents')
    await click(page, '[data-ops-lens="agents"] [role="tablist"] button:nth-child(2), [data-ops-agents-tab="teams"]')
    await sleep(800)
    return String(await click(page, '[data-ops-team] [data-ops-row-more-slot] summary'))
  })

  // Skills
  await state('skills', 'filtered', async () => { await open('skills'); return String(await fill(page, '[data-ops-skill-filters] input', 'git')) })
  await state('skills', 'details-open', async () => { await open('skills'); return String(await click(page, '[data-ops-skill] [data-ops-row-more-slot] summary')) })

  // Channels
  await state('channels', 'connected-filter', async () => { await open('channels'); return String(await click(page, '[data-ops-app-filter="connected"]')) })
  await state('channels', 'category-filter', async () => { await open('channels'); return String(await click(page, '[data-ops-app-cat="Tools (MCP)"]')) })
  await mock([...base, { path: '^/api/mcp/catalog', throw: '502: catalog unavailable (mock)' }])
  await state('channels', 'partial-source', async () => { await open('channels') })
  await mock(base)

  // Ops Settings / Diagnostics
  await state('ops-settings', 'loaded', async () => { await open('settings') })
  await mock([...base, { path: '^/api/status', throw: '503: backend status unavailable (mock)' }])
  await state('diagnostics', 'error', async () => { await open('settings'); await click(page, '#ops-settings-tab-diagnostics'); await sleep(2500) })
  await mock(base)

  // App Settings: editing and rejected save
  await state('app-settings', 'editing-pending', async () => {
    await goApp('/settings')
    return String(await click(page, '#settings-main-provider'))
  })
  await page.keyboard.press('Escape').catch(() => {})
  await mock([...base, { path: '^/api/config', method: 'PUT', throw: '422: rejected by schema (mock)' }, { path: '^/api/config', method: 'PATCH', throw: '422: rejected by schema (mock)' }, { path: '^/api/config', method: 'POST', throw: '422: rejected by schema (mock)' }])
  await state('app-settings', 'save-rejected', async () => {
    await goApp('/settings')
    const ok = await fill(page, '[data-tour*="context_length"] input, [data-tour*="context"] input[type="number"]', '200000')
    await page.keyboard.press('Tab').catch(() => {})
    await sleep(1500)
    return String(ok)
  })
  await mock(base)

  // Artifacts and other app screens, resolved (isolated home)
  await state('artifacts', 'loaded', async () => { await goApp('/artifacts'); await sleep(4000) })
  await state('sessions', 'loaded', async () => { await goApp('/command-center'); await sleep(2000) })

  // Narrow panel for the row screens
  await narrow(900)
  for (const id of ['office', 'board', 'agents', 'skills', 'channels', 'settings']) await state(id, 'narrow-900', async () => { await open(id) })
  await goApp('/settings'); await state('app-settings', 'narrow-900', async () => {})
  await narrow(1600)
}
