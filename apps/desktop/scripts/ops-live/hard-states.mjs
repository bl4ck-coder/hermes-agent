// P19: hard states for every screen, on the isolated instance only (see hard.mjs). Mocks replace hermes:api responses
// of THIS test instance; nothing reaches the real gateway. Each state() call adds a row to state-matrix.json.
// P24 (judge pass 18 must-fix #1): every state declares labelled checks that need VISIBLE, specific evidence after its
// interaction (and that its mocks were actually served), plus a negative control (OPS_HARD_SELFTEST=1) that runs the
// same checks with the precondition removed and must see them fail.
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
const R_BOARD = '^/api/plugins/kanban/board'
const R_PENDING = '^/api/approvals/pending'
const base = [
  { path: R_BOARD, body: BOARD },
  { path: R_PENDING, body: PENDING }
]

// P21: populated Sessions / Artifacts fixtures (mocked hermes:api only).
const sess = (id, title, ago, n, extra = {}) => ({ id, title, started_at: now - ago - 600, last_active: now - ago, ended_at: null, message_count: n, source: 'desktop', model: 'mock-model', preview: `${title}: preview text`, profile: 'default', ...extra })
const SESSION_TITLES = [
  'Draft the launch announcement for the pricing page',
  'Investigate the flaky login test on CI with a deliberately long title that has to wrap or truncate',
  'Weekly metrics report',
  'Rotate the staging API keys'
]
const SESSIONS = {
  sessions: [sess('s1', SESSION_TITLES[0], 300, 24), sess('s2', SESSION_TITLES[1], 5400, 61), sess('s3', SESSION_TITLES[2], 90000, 12), sess('s4', SESSION_TITLES[3], 260000, 8)],
  total: 4, limit: 40, offset: 0
}
// P24: Sessions lists the batched /api/profiles/sessions/sidebar route, whose shape has slices. The P21 rule answered
// it with the per-slice shape, so recents stayed empty and Sessions showed "No sessions yet".
const SIDEBAR = { recents: { sessions: SESSIONS.sessions }, cron: { sessions: [] }, messaging: { sessions: [] } }
const MESSAGES = {
  messages: [
    { id: 1, role: 'user', content: 'Make the chart and the report.', timestamp: now - 400 },
    { id: 2, role: 'assistant', content: 'Done. ![Weekly chart](https://example.com/artifacts/weekly-chart.png)\nReport: https://example.com/artifacts/report.pdf\nSaved to C:\\work\\out\\report.md and C:\\other\\out\\report.md', timestamp: now - 380 }
  ],
  pagination: { limit: 50, offset: 0, total: 2, has_more: false }
}
const R_SIDEBAR = '^/api/profiles/sessions/sidebar\\?'
const R_SLICE = '^/api/(profiles/)?sessions\\?'
const R_MESSAGES = '^/api/sessions/[^/]+/messages'
const populated = [{ path: R_SIDEBAR, body: SIDEBAR }, { path: R_SLICE, body: SESSIONS }, { path: R_MESSAGES, body: MESSAGES }, ...base]

export default async function ({ page, go, goApp, lens, state, mock, narrow, sleep, want, reload, see, none, served, tap, type, visible }) {
  if (!want('hard') && !want('all')) return
  // Office and Board are pinned routes, not rail lenses.
  const open = async id => { if (id === 'office' || id === 'board') { await go(`/ops/${id}`); await sleep(1500); return } await go('/ops'); await lens(id) }
  // The Board's own filter. The side rail also has one (input[data-ops-filter]); P21 typed there by mistake.
  const boardFilter = '[data-ops-board-toolbar] > input'
  const openBody = row => `${row} [data-ops-row-more-slot] details[open] > summary ~ *`

  // Office
  await state('office', 'loaded-decisions', {
    mocks: base, open: () => open('office'), act: () => open('office'),
    checks: {
      'decision-row': ms => see('[data-ops-approval]', { text: 'Run a shell command in the builder workspace', ms }),
      'approvals-mock': ms => served(R_PENDING, { ms })
    },
    neg: { mocks: [{ path: R_BOARD, body: BOARD }] }
  })
  await state('office', 'more-actions-open', {
    mocks: base, open: () => open('office'),
    act: async () => { await open('office'); await tap('[data-ops-approval] [data-ops-row-more-slot] summary') },
    checks: { 'disclosure-body': ms => see(openBody('[data-ops-approval]'), { ms }) }
  })

  // Board
  await state('board', 'loaded', {
    mocks: base, open: () => open('board'), act: () => open('board'),
    checks: {
      'fixture-card': ms => see('[data-ops-card="t1"]', { text: 'Decide the pricing page copy', ms }),
      'cards': ms => see('[data-ops-card]', { min: 5, ms }),
      'board-mock': ms => served(R_BOARD, { ms })
    },
    neg: { mocks: [{ path: R_PENDING, body: PENDING }] }
  })
  const clearFilters = async () => { for (const sel of ['input[data-ops-filter]', boardFilter]) { const l = visible(sel); for (let i = await l.count(); i--;) await l.nth(i).fill('').catch(() => {}) } }
  await state('board', 'filtered', {
    mocks: base, open: () => open('board'),
    act: async () => { await open('board'); await type(boardFilter, 'pricing') },
    checks: {
      'board-filter-value': ms => see(boardFilter, { value: 'pricing', ms }),
      'match-shown': ms => see('[data-ops-card="t1"]', { text: 'pricing', ms }),
      'others-hidden': ms => none('[data-ops-card="t2"], [data-ops-card="t3"], [data-ops-card="t5"]', { ms })
    },
    // The P21 bug as the negative: the same text typed into the side rail filter must not pass.
    neg: { act: async () => { await open('board'); await type('input[data-ops-filter]', 'pricing') } },
    after: clearFilters
  })
  await state('board', 'refresh-failed', {
    mocks: base, open: () => open('board'),
    act: async () => {
      await open('board'); await see('[data-ops-card="t1"]')
      await mock([{ path: R_BOARD, throw: '503: kanban plugin unavailable (mock)' }, { path: R_PENDING, body: PENDING }])
      await sleep(7000)
    },
    checks: {
      'stale-notice': ms => see('[data-ops-board-stale]', { text: 'kanban plugin unavailable (mock)', ms }),
      'last-board-kept': ms => see('[data-ops-card="t1"]', { ms }),
      'failing-mock': ms => served(R_BOARD, { ms })
    },
    // Negative: the refresh keeps succeeding (base fixture), so no stale notice may appear.
    neg: { act: async () => { await open('board'); await see('[data-ops-card="t1"]'); await sleep(7000) }, fails: ['stale-notice'] }
  })

  // Agents: Fleet / Teams
  await state('fleet', 'details-open', {
    mocks: base, open: () => open('agents'),
    act: async () => { await open('agents'); await tap('[data-ops-fleet-row] [data-ops-row-more-slot] summary') },
    checks: { 'details-body': ms => see('[data-ops-fleet-row] details[open] [data-ops-fleet-details]', { ms }) }
  })
  const teamsTab = async () => { await open('agents'); await tap('[data-ops-agents-tab="teams"]'); await sleep(800) }
  await state('teams', 'work-and-members-open', {
    mocks: base, open: teamsTab,
    act: async () => { await teamsTab(); await tap('[data-ops-team] [data-ops-row-more-slot] summary') },
    checks: {
      'teams-tab': ms => see('[data-ops-agents-tab="teams"]', { attr: { 'aria-selected': 'true' }, ms }),
      'disclosure-body': ms => see(openBody('[data-ops-team]'), { ms })
    },
    neg: { fails: ['disclosure-body'] }
  })

  // Skills
  const allRowsMatch = (sel, needle) => ms => see(sel, { ms }).then(async () => {
    const texts = await visible(sel).allInnerTexts()
    const off = texts.filter(t => !t.toLowerCase().includes(needle))
    if (off.length) throw new Error(`${off.length}/${texts.length} visible rows lack "${needle}": ${off[0].slice(0, 60)}`)
    return `${texts.length} visible rows all contain "${needle}"`
  })
  await state('skills', 'filtered', {
    mocks: base, open: () => open('skills'),
    act: async () => { await open('skills'); await type('[data-ops-skill-filters] input', 'git') },
    checks: {
      'filter-value': ms => see('[data-ops-skill-filters] input', { value: 'git', ms }),
      'rows-match': allRowsMatch('[data-ops-skill]', 'git'),
      'clear-offered': ms => see('[data-ops-skill-clear]', { ms })
    }
  })
  await state('skills', 'details-open', {
    mocks: base, open: () => open('skills'),
    act: async () => { await open('skills'); await tap('[data-ops-skill] [data-ops-row-more-slot] summary') },
    checks: { 'disclosure-body': ms => see(openBody('[data-ops-skill]'), { ms }) }
  })

  // Channels
  const lensC = '[data-ops-lens="channels"]'
  await state('channels', 'connected-filter', {
    mocks: base, open: () => open('channels'),
    act: async () => { await open('channels'); await tap('[data-ops-app-filter="connected"]') },
    checks: {
      'tab-selected': ms => see('[data-ops-app-filter="connected"]', { attr: { 'aria-selected': 'true' }, ms }),
      'no-unconnected-rows': ms => none(`${lensC} [data-ops-row]:not([data-ops-app-connected])`, { ms }),
      'result-shown': ms => see(`${lensC} [data-ops-app-connected], ${lensC} [data-ops-empty="apps"]`, { ms })
    },
    neg: { fails: ['tab-selected', 'no-unconnected-rows'] }
  })
  const others = `${lensC} [data-ops-app-section]:not([data-ops-app-section="Tools (MCP)"]):not([data-ops-app-section="warn"]):not([data-ops-app-section="connected"])`
  await state('channels', 'category-filter', {
    mocks: base, open: () => open('channels'),
    act: async () => { await open('channels'); await tap('[data-ops-app-cat="Tools (MCP)"]') },
    checks: {
      'category-pressed': ms => see('[data-ops-app-cat="Tools (MCP)"]', { attr: { 'aria-pressed': 'true' }, ms }),
      'other-categories-hidden': ms => none(others, { ms }),
      'result-shown': ms => see(`${lensC} [data-ops-app-section="Tools (MCP)"] [data-ops-row], ${lensC} [data-ops-app-connected], ${lensC} [data-ops-empty="apps"]`, { ms })
    },
    neg: { fails: ['category-pressed', 'other-categories-hidden'] }
  })
  await state('channels', 'filters-no-match', {
    mocks: base, open: () => open('channels'),
    act: async () => { await open('channels'); await tap('[data-ops-app-filter="connected"]'); await tap('[data-ops-app-cat="Tools (MCP)"]') },
    checks: {
      'empty-state': ms => see(`${lensC} [data-ops-empty="apps"]`, { ms }),
      'reset-offered': ms => see(`${lensC} [data-ops-empty-reset]`, { ms }),
      'no-rows': ms => none(`${lensC} [data-ops-row]`, { ms })
    }
  })
  const R_CATALOG = '^/api/mcp/catalog'
  const channelsFresh = async () => { await reload(); await open('channels') }
  await state('channels', 'source-failed', {
    mocks: [{ path: R_CATALOG, throw: '502: catalog unavailable (mock)' }, ...base],
    open: channelsFresh, act: channelsFresh,
    checks: {
      'partial-notice': ms => see(`${lensC} [data-ops-partial]`, { ms }),
      'rest-still-shown': ms => see(`${lensC} [data-ops-row]`, { ms }),
      'failing-mock': ms => served(R_CATALOG, { ms })
    },
    neg: { mocks: base, fails: ['partial-notice', 'failing-mock'] }
  })

  // Ops Settings / Diagnostics
  await state('ops-settings', 'loaded', {
    mocks: base, open: () => open('office'), act: () => open('settings'),
    checks: {
      'settings-tab': ms => see('#ops-settings-tab-settings', { attr: { 'aria-selected': 'true' }, ms }),
      'prefs-form': ms => see('[data-ops-prefs-reset-row]', { ms })
    }
  })
  // P24: failing rules first. P21 listed base first, so the board fixture answered the probe and nothing failed.
  const R_FLEET = '^/api/ops/fleet'
  const diagMocks = [
    { path: R_BOARD, throw: '503: kanban plugin unavailable (mock)' },
    { path: R_FLEET, throw: '503: fleet feed unavailable (mock)' },
    { path: '^/api/(status|version|capabilities|config/schema|model/info)', throw: '503: backend unavailable (mock)' },
    ...base
  ]
  const diagTab = async () => { await reload(); await open('settings'); await tap('#ops-settings-tab-diagnostics'); await sleep(800) }
  await state('diagnostics', 'probe-failed', {
    mocks: diagMocks, open: diagTab,
    act: async () => {
      await diagTab(); await tap('[data-ops-probe]')
      // Wait for the probe to FINISH (hero leaves idle and the button is enabled again), not merely to start.
      await see('[data-ops-diag-hero]:not([data-ops-diag-hero="idle"])', { ms: 20000 }); await see('[data-ops-probe]:not([disabled])', { ms: 20000 })
    },
    checks: {
      'probe-finished': ms => none('[data-ops-diag-hero="idle"]', { ms }).then(() => see('[data-ops-diag-hero="warn"]', { ms })),
      'failed-results': ms => see('[data-ops-probe-failing] [data-ops-probe-fail]', { min: 2, text: ['kanban plugin unavailable (mock)', 'fleet feed unavailable (mock)'], ms }),
      'probe-idle-again': ms => see('[data-ops-probe]:not([disabled])', { ms }),
      'failing-mocks': ms => served(R_BOARD, { ms }).then(a => served(R_FLEET, { ms }).then(b => `${a}; ${b}`))
    },
    neg: { fails: ['probe-finished', 'failed-results'] }
  })

  // App Settings: a save in flight, then a rejected save
  const field = '[data-tour*="context_length"] input, [data-tour*="context"] input[type="number"]'
  const R_PUT = '^/api/config'
  await state('app-settings', 'save-pending', {
    mocks: [{ path: R_PUT, method: 'PUT', delay: 8000, throw: '422: rejected by schema (mock)' }, ...base],
    open: () => goApp('/settings'),
    act: async () => { await goApp('/settings'); await type(field, '180000'); await page.keyboard.press('Tab').catch(() => {}); await sleep(1500) },
    checks: {
      'saving-status': ms => see('[data-settings-field-status]', { ms: Math.min(ms, 5000) }),
      'put-mock': ms => served(R_PUT, { method: 'PUT', ms })
    },
    after: () => sleep(8000)
  })
  const settingsFresh = async () => { await reload(); await goApp('/settings') }
  await state('app-settings', 'save-rejected', {
    mocks: [{ path: R_PUT, method: 'PUT', throw: '422: rejected by schema (mock)' }, ...base],
    open: settingsFresh,
    act: async () => { await settingsFresh(); await type(field, '200000'); await page.keyboard.press('Tab').catch(() => {}); await sleep(1800) },
    checks: {
      'field-error': ms => see('[data-settings-field-error]', { text: 'rejected by schema (mock)', ms }),
      'revert-offered': ms => see('[data-settings-field-revert]', { ms }),
      'draft-kept': ms => see(field, { value: '200000', ms }),
      'put-mock': ms => served(R_PUT, { method: 'PUT', ms })
    }
  })

  // Artifacts and Sessions: empty (isolated home), then populated from fixtures
  const artifactRows = 'tbody tr.group\\/artifact'
  const artifactsOpen = async () => { await reload(); await goApp('/artifacts'); await sleep(6000) }
  const sessionsOpen = async () => { await reload(); await goApp('/command-center'); await sleep(2500) }
  await state('artifacts', 'empty', {
    mocks: base, open: artifactsOpen, act: artifactsOpen,
    checks: { 'empty-action': ms => see('[data-artifacts-empty-action]', { ms }), 'no-rows': ms => none(artifactRows, { ms }) },
    neg: { mocks: populated }
  })
  await state('sessions', 'empty', {
    mocks: base, open: sessionsOpen, act: sessionsOpen,
    checks: { 'empty-action': ms => see('[data-sessions-empty-action]', { ms }), 'no-rows': ms => none('[data-session-row]', { ms }) },
    neg: { mocks: populated }
  })
  await state('sessions', 'populated', {
    mocks: populated, open: sessionsOpen, act: sessionsOpen,
    checks: {
      'four-rows': ms => see('[data-session-row]', { count: 4, ms }),
      'fixture-titles': ms => Promise.all(SESSION_TITLES.map(t => see('[data-session-row]', { text: t.slice(0, 30), ms }))).then(() => 'all 4 fixture titles visible'),
      'not-empty': ms => none('[data-sessions-empty-action]', { ms }),
      'sidebar-mock': ms => served(R_SIDEBAR, { ms })
    },
    neg: { mocks: base }
  })
  await state('artifacts', 'populated', {
    mocks: populated, open: artifactsOpen, act: artifactsOpen,
    checks: {
      'file-rows': ms => see(artifactRows, { min: 2, text: 'report.md', ms }),
      'recent-cards': ms => see('[data-artifact-cards] > *', { min: 1, ms }),
      'not-empty': ms => none('[data-artifacts-empty-action]', { ms }),
      'messages-mock': ms => served(R_MESSAGES, { ms })
    },
    neg: { mocks: base }
  })

  // Narrow panel for the row screens: the WORK must be readable, so the inspector is closed and nothing covers it.
  const setInspector = async open => {
    const cur = await visible('[data-ops-root]').first().getAttribute('data-ops-inspector-open')
    if ((cur === 'true') !== open) { await tap('[data-ops-inspector-toggle]'); await sleep(800) }
  }
  const WORK = { office: '[data-ops-approval]', board: '[data-ops-card="t1"]', agents: '[data-ops-fleet-row]', skills: '[data-ops-skill]', channels: '[data-ops-app]', settings: '[data-ops-prefs-reset-row]' }
  for (const id of Object.keys(WORK)) {
    await state(id, 'narrow-900', {
      mocks: base,
      open: async () => { await narrow(900); await open(id); await setInspector(true) },
      act: async () => { await narrow(900); await open(id); await setInspector(false) },
      checks: {
        'inspector-closed': ms => see('[data-ops-root]', { attr: { 'data-ops-inspector-open': 'false' }, ms }),
        'no-inspector-shown': ms => none('aside[data-ops-inspector]', { ms }),
        'work-unobstructed': ms => see(WORK[id], { clear: true, ms })
      },
      // Negative: the inspector left open (the P21 capture). On Office and Board it must then cover the work.
      neg: { fails: id === 'office' || id === 'board' ? ['inspector-closed', 'no-inspector-shown', 'work-unobstructed'] : ['inspector-closed'] },
      after: () => setInspector(false)
    })
  }
  await state('app-settings', 'narrow-900', {
    mocks: base,
    open: async () => { await narrow(900); await open('office') },
    act: async () => { await narrow(900); await goApp('/settings') },
    checks: { 'form-field-unobstructed': ms => see(field, { clear: true, ms }) }
  })
  await narrow(1600)
}
