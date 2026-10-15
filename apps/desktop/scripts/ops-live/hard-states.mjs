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

// P21: populated Sessions / Artifacts fixtures (mocked hermes:api only).
const sess = (id, title, ago, n, extra = {}) => ({ id, title, started_at: now - ago - 600, last_active: now - ago, ended_at: null, message_count: n, source: 'desktop', model: 'mock-model', preview: `${title}: preview text`, profile: 'default', ...extra })
const SESSIONS = {
  sessions: [
    sess('s1', 'Draft the launch announcement for the pricing page', 300, 24),
    sess('s2', 'Investigate the flaky login test on CI with a deliberately long title that has to wrap or truncate', 5400, 61),
    sess('s3', 'Weekly metrics report', 90000, 12),
    sess('s4', 'Rotate the staging API keys', 260000, 8)
  ],
  total: 4, limit: 40, offset: 0
}
const MESSAGES = {
  messages: [
    { id: 1, role: 'user', content: 'Make the chart and the report.', timestamp: now - 400 },
    { id: 2, role: 'assistant', content: 'Done. ![Weekly chart](https://example.com/artifacts/weekly-chart.png)\nReport: https://example.com/artifacts/report.pdf\nSaved to C:\\work\\out\\report.md and C:\\other\\out\\report.md', timestamp: now - 380 }
  ],
  pagination: { limit: 50, offset: 0, total: 2, has_more: false }
}

export default async function ({ page, go, goApp, lens, state, mock, narrow, sleep, want, need, reload }) {
  if (!want('hard') && !want('all')) return
  // Office and Board are pinned routes, not rail lenses.
  const open = async id => { if (id === 'office' || id === 'board') { await go(`/ops/${id}`); await sleep(1500); return } await go('/ops'); await lens(id) }
  await mock(base)

  // Office
  await state('office', 'loaded-decisions', async () => { await open('office'); return need('[data-ops-approval]') })
  await state('office', 'more-actions-open', async () => { await open('office'); await click(page, '[data-ops-approval] [data-ops-row-more-slot] summary'); return need('[data-ops-approval] details[open]') })

  // Board
  await state('board', 'loaded', async () => { await open('board'); return need('[data-ops-root]') })
  await state('board', 'filtered', async () => { await open('board'); await fill(page, '[data-ops-root] input[placeholder="Filtrar"], [data-ops-root] input[placeholder="Filter"], [data-ops-root] input[type="search"]', 'web'); return 'filter=web' })
  await mock([{ path: '^/api/plugins/kanban/board', throw: '503: kanban plugin unavailable (mock)' }, { path: '^/api/approvals/pending', body: PENDING }])
  await state('board', 'refresh-failed', async () => { await open('board'); await sleep(6000); return need('[data-ops-board-stale]') })
  await mock(base)

  // Agents: Fleet / Teams
  await state('fleet', 'details-open', async () => { await open('agents'); await click(page, 'details:has([data-ops-fleet-details]) > summary'); return need('details[open] [data-ops-fleet-details]') })
  await state('teams', 'work-and-members-open', async () => {
    await open('agents')
    await click(page, '[data-ops-lens="agents"] [role="tablist"] button:nth-child(2), [data-ops-agents-tab="teams"]')
    await sleep(800)
    await click(page, '[data-ops-team] [data-ops-row-more-slot] summary')
    return need('[data-ops-team] details[open]')
  })

  // Skills
  await state('skills', 'filtered', async () => { await open('skills'); await fill(page, '[data-ops-skill-filters] input', 'git'); return 'filter=git' })
  await state('skills', 'details-open', async () => { await open('skills'); await click(page, '[data-ops-skill] [data-ops-row-more-slot] summary'); return need('[data-ops-skill] details[open]') })

  // Channels
  await state('channels', 'connected-filter', async () => { await open('channels'); await click(page, '[data-ops-app-filter="connected"]'); return 'connected' })
  await state('channels', 'category-filter', async () => { await open('channels'); await click(page, '[data-ops-app-cat="Tools (MCP)"]'); return 'Tools (MCP)' })
  await state('channels', 'filters-no-match', async () => { await open('channels'); await click(page, '[data-ops-app-filter="connected"]'); await click(page, '[data-ops-app-cat="Tools (MCP)"]'); return need('[data-ops-empty="apps"]') })
  await mock([...base, { path: '^/api/mcp/catalog', throw: '502: catalog unavailable (mock)' }])
  await state('channels', 'source-failed', async () => { await reload(); await open('channels'); await sleep(2000); return need('[data-ops-partial]') })
  await mock(base)

  // Ops Settings / Diagnostics
  await state('ops-settings', 'loaded', async () => { await open('settings'); return need('[data-ops-prefs-reset-row]') })
  await mock([...base, { path: '^/api/(status|version|capabilities|config/schema|model/info)', throw: '503: backend unavailable (mock)' }, { path: '^/api/plugins/kanban/board', throw: '503: kanban plugin unavailable (mock)' }])
  await state('diagnostics', 'probe-failed', async () => {
    await reload(); await open('settings'); await click(page, '#ops-settings-tab-diagnostics'); await sleep(1000)
    await click(page, '[data-ops-probe]'); await sleep(5000)
    return need('[data-ops-diag-next]', '[data-ops-error-groups], [data-ops-probe-failing]')
  })
  await mock(base)

  // App Settings: a save in flight, then a rejected save
  const field = '[data-tour*="context_length"] input, [data-tour*="context"] input[type="number"]'
  await mock([...base, { path: '^/api/config', method: 'PUT', delay: 8000, throw: '422: rejected by schema (mock)' }])
  await state('app-settings', 'save-pending', async () => {
    await goApp('/settings'); await fill(page, field, '180000'); await page.keyboard.press('Tab').catch(() => {}); await sleep(1500)
    return need('[data-settings-field-status]')
  })
  await sleep(8000)
  await mock([...base, { path: '^/api/config', method: 'PUT', throw: '422: rejected by schema (mock)' }])
  await state('app-settings', 'save-rejected', async () => {
    await goApp('/settings'); await fill(page, field, '200000'); await page.keyboard.press('Tab').catch(() => {}); await sleep(1800)
    return need('[data-settings-field-error]', '[data-settings-field-revert]')
  })
  await mock(base)

  // Artifacts and Sessions: empty (isolated home), then populated from fixtures
  await state('artifacts', 'empty', async () => { await goApp('/artifacts'); await sleep(4000); return need('[data-artifacts-empty-action]') })
  await state('sessions', 'empty', async () => { await goApp('/command-center'); await sleep(2000); return need('[data-sessions-empty-action]') })
  await mock([...base, { path: '^/api/(profiles/)?sessions\\?', body: SESSIONS }, { path: '^/api/sessions/[^/]+/messages', body: MESSAGES }])
  await state('sessions', 'populated', async () => { await reload(); await goApp('/command-center'); await sleep(2500); return need('[data-sessions-search]') })
  await state('artifacts', 'populated', async () => { await goApp('/artifacts'); await sleep(6000); return 'see shot' })
  await mock(base)

  // Narrow panel for the row screens
  await narrow(900)
  for (const id of ['office', 'board', 'agents', 'skills', 'channels', 'settings']) await state(id, 'narrow-900', async () => { await open(id) })
  await goApp('/settings'); await state('app-settings', 'narrow-900', async () => {})
  await narrow(1600)
}
