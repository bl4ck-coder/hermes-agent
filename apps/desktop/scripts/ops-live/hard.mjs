// P19 hard-state pass: an isolated desktop instance with its OWN sandboxed HERMES_HOME (never the real gateway)
// plus a mock layer on the test instance's hermes:api IPC handler, to capture opened sections, filters, editing,
// rejected saves, errors, narrow panels and loaded lists. Writes state-matrix.json next to the screenshots.
import { _electron } from '@playwright/test'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const DESKTOP = resolve(process.argv[2] ?? '.')
const OUT = resolve(process.argv[3] ?? join(tmpdir(), 'ops-live'))
const STEPS = (process.argv[4] ?? 'all').split(',')
mkdirSync(OUT, { recursive: true })
const electronBin = join(DESKTOP, 'node_modules', 'electron', 'dist', 'electron.exe')
const log = { console: [], pageErrors: [], failed: [], http: [], sections: {}, fps: {} }
const sleep = ms => new Promise(r => setTimeout(r, ms))

// P24: OPS_HARD_TAG gives a run its own userData dir and sandbox HERMES_HOME so parallel runs never collide
// (unset: the original ops-hard-userdata / ops-hard-home paths). OPS_HARD_SELFTEST=1 runs the negative controls.
const TAG = (process.env.OPS_HARD_TAG ?? '').replace(/[^a-z0-9_-]/gi, '')
const SELFTEST = process.env.OPS_HARD_SELFTEST === '1'
// Optional: OPS_HARD_ONLY=<regex on "screen-state"> runs a subset (e.g. "narrow").
const ONLY = process.env.OPS_HARD_ONLY ? new RegExp(process.env.OPS_HARD_ONLY) : null
const HOME = join(tmpdir(), TAG ? `ops-hard-home-${TAG}` : 'ops-hard-home')
const env = {
  ...process.env,
  HERMES_DESKTOP_HERMES_ROOT: resolve(DESKTOP, '..', '..'),
  HERMES_DESKTOP_PYTHON: process.env.OPS_LIVE_PYTHON,
  HERMES_DESKTOP_ISOLATED_BACKEND: '1',
  HERMES_DESKTOP_USER_DATA_DIR: join(tmpdir(), TAG ? `ops-hard-userdata-${TAG}` : 'ops-hard-userdata'),
  // P19: sandbox home only. Refuse to run if a real home is forced.
  HERMES_HOME: HOME,
  HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1'
}
delete env.HERMES_DESKTOP_DEV_SERVER
if (process.env.OPS_LIVE_HERMES_HOME) { console.error('hard.mjs never uses OPS_LIVE_HERMES_HOME'); process.exit(4) }
mkdirSync(HOME, { recursive: true })
// The sandbox has no provider, so the first-run setup dialog can cover the app mid-run (it depended on
// provider keys leaking in from the parent shell). A placeholder key keeps setup closed; nothing is ever sent.
{
  const envFile = join(HOME, '.env')
  if (!existsSync(envFile)) writeFileSync(envFile, 'ANTHROPIC_API_KEY=ops-hard-placeholder-not-a-real-key\n')
}


// B11 safety: never launch a test window whose backend cannot start (a wrong interpreter makes the
// isolated instance loop on 'Hermes couldn't start' in a visible window on the user's desktop).
{
  const { spawnSync } = await import('node:child_process')
  const py = process.env.OPS_LIVE_PYTHON
  const probe = py ? spawnSync(py, ['-c', 'import hermes_cli.web_server'], { cwd: resolve(DESKTOP, '..', '..'), encoding: 'utf8', timeout: 120_000 }) : null
  if (!probe || probe.status !== 0) {
    console.error('ops-live preflight failed: OPS_LIVE_PYTHON must import hermes_cli.web_server from this checkout.', probe?.stderr?.slice(-400) ?? 'unset')
    process.exit(2)
  }
}
const app = await _electron.launch({ executablePath: electronBin, args: [DESKTOP], env, cwd: DESKTOP, timeout: 120_000 })
// P21c: never leave this test instance behind (a leftover held the single-instance lock and broke h5/h6).
const killApp = () => { try { app.process().kill() } catch {} }
process.on('exit', killApp)
for (const sig of ['SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection']) process.on(sig, e => { if (e instanceof Error) console.error(e); killApp(); process.exit(1) })
const page = await app.firstWindow()
// B11: keep the test window off the user's screen and taskbar (screenshots still render via CDP).
const offscreen = () => app.evaluate(({ BrowserWindow }) => { for (const w of BrowserWindow.getAllWindows()) { w.setSkipTaskbar(true); w.setSize(1600, 1000); w.setPosition(-20000, -20000); w.blur() } }).catch(() => {})
await offscreen()
page.on('console', m => (m.type() === 'error' || m.type() === 'warning') && log.console.push({ type: m.type(), text: m.text().slice(0, 400), at: page.url() }))
page.on('pageerror', e => log.pageErrors.push({ text: String(e).slice(0, 400), at: page.url() }))
page.on('requestfailed', r => log.failed.push({ url: r.url().slice(0, 200), err: r.failure()?.errorText }))
page.on('response', r => r.status() >= 400 && log.http.push({ status: r.status(), url: r.url().slice(0, 200) }))

// B11: dismiss status toasts (warnings/info, e.g. the test-instance shared-profile notice) in any
// locale before a screenshot; error alerts stay visible as evidence.
const dismissToasts = async () => {
  const texts = await page.evaluate(() => {
    const out = []
    // Glass p3: alerts too (warnings render as role=alert), full text with the details expanded.
    for (const n of document.querySelectorAll('[role="region"] [role="status"], [role="region"] [role="alert"]')) {
      if (!n.getClientRects().length) continue
      // Only the close control: never the toast's own actions (e.g. Copy detail writes the clipboard).
      const b = [...n.querySelectorAll('button[aria-label]')].find(x => /close|cerrar|dismiss|descartar|fermer|schlie/i.test(x.getAttribute('aria-label') || ''))
      if (b) { out.push((n.textContent || '').trim().slice(0, 600)); b.click() }
    }
    return out
  }).catch(() => [])
  if (texts.length) { log.toastDismissed.push(...texts); await sleep(350) }
}
const shot = async name => { await dismissToasts(); await sleep(250); await dismissToasts(); return page.screenshot({ path: join(OUT, `${name}.png`) }).catch(e => log.console.push({ type: 'shot', text: String(e) })) }
const save = () => writeFileSync(join(OUT, 'live.json'), JSON.stringify({ ...log, mainTail: typeof log.mainTail === 'function' ? log.mainTail() : '' }, null, 2))

async function section(name, fn) {
  const before = { c: log.console.filter(x => x.type === 'error').length, p: log.pageErrors.length, h: log.http.length, f: log.failed.length }
  let ok = true, note = ''
  try { note = (await fn()) ?? '' } catch (e) { ok = false; note = String(e).slice(0, 300) }
  await sleep(1500)
  await shot(name)
  const stray = await page.evaluate(() => {
    const out = []
    const root = document.querySelector('[data-ops-root]')
    if (!root) return out
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.textContent.trim()
      const p = n.parentElement
      if (!/^(0|undefined|null|NaN|false|true|\[object Object\])$/.test(t) || !p) continue
      if (n.previousSibling || n.nextSibling) {
        // a bare literal next to sibling elements (typical `{n && <x/>}` leak)
        const tag = p.tagName.toLowerCase()
        if (!/^(span|strong|b|td|dd|small|kbd|output)$/.test(tag) && ![...p.attributes].some(a => /count|value|stat/.test(a.name))) out.push(`${t} in <${tag} ${[...p.attributes].map(a => a.name + '=' + a.value).join(' ').slice(0, 160)}> :: ${p.outerHTML.slice(0, 200)}`)
      }
    }
    return out.slice(0, 10)
  }).catch(e => [String(e)])
  log.sections[name] = {
    ok, note,
    consoleErrors: log.console.filter(x => x.type === 'error').length - before.c,
    pageErrors: log.pageErrors.length - before.p,
    http4xx5xx: log.http.slice(before.h).map(x => `${x.status} ${x.url}`),
    failed: log.failed.slice(before.f).map(x => `${x.err} ${x.url}`),
    stray
  }
  save()
}

/** requestAnimationFrame sampler: frame deltas while `act` runs. */
async function sampleFps(name, act, ms = 5000) {
  await page.evaluate(() => {
    const w = window
    w.__opsFrames = []
    let last = performance.now()
    w.__opsFpsOn = true
    w.__opsLong = []; w.__opsT0 = performance.now()
    try { w.__opsObs?.disconnect(); w.__opsObs = new PerformanceObserver(l => { for (const e of l.getEntries()) w.__opsLong.push([Math.round(e.startTime - w.__opsT0), Math.round(e.duration), e.entryType, `block=${Math.round(e.blockingDuration || 0)} render=${Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0)} layout=${Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0)}`, (e.scripts || []).slice(0, 3).map(s => (s.invoker || '') + ' ' + (s.sourceFunctionName || '') + ' ' + (s.sourceURL || '').split('/').pop() + ':' + (s.sourceCharPosition ?? '') + ' ' + Math.round(s.duration)).join(' | ')]) }); w.__opsObs.observe({ type: 'long-animation-frame', buffered: false }) } catch { try { w.__opsObs.observe({ type: 'longtask' }) } catch {} }
    const tick = t => { w.__opsFrames.push(t - last); last = t; if (w.__opsFpsOn) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  const end = Date.now() + ms
  await act(end)
  while (Date.now() < end) await sleep(100)
  const d = await page.evaluate(() => { window.__opsFpsOn = false; return window.__opsFrames.slice(2) })
  const s = [...d].sort((a, b) => a - b)
  const q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))]
  log.fps[name] = { frames: d.length, p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +s[s.length - 1].toFixed(2), over16_7: d.filter(x => x > 16.7).length, over33: d.filter(x => x > 33.4).length }
  // B11: when each long frame happened (ms from sample start), to tell pickup from release.
  let acc = 0
  log.fps[name].spikes = d.map(x => { acc += x; return [Math.round(acc), +x.toFixed(1)] }).filter(([, x]) => x > 33.4)
  log.fps[name].long = await page.evaluate(() => window.__opsLong || []).catch(() => [])
  save()
}

const ensureFull = async () => { const v = await page.getAttribute('[data-ops-fullscreen]', 'data-ops-fullscreen').catch(() => null); if (v !== null && v !== 'true') { await page.click('[data-ops-fullscreen-toggle]').catch(() => {}); await sleep(1200) } }
// App screens: no Ops fullscreen toggle (ensureFull promoted Ops over /artifacts, /capabilities, /messaging).
const goApp = async route => { const v = await page.getAttribute('[data-ops-fullscreen]', 'data-ops-fullscreen').catch(() => null); if (v === 'true') { await page.click('[data-ops-fullscreen-toggle]').catch(() => {}); await sleep(800) } await page.evaluate(r => { location.hash = r }, `#${route}`); await sleep(2500) }
const go = async route => { await page.evaluate(r => { location.hash = r }, `#${route}`); await sleep(2500); await ensureFull() }
const lens = async id => {
  const btn = page.locator(`[data-ops-rail-list] button[data-ops-lens="${id}"]`).first()
  if (!(await btn.count())) { await page.locator('[data-ops-rail-list] [data-ops-more]').first().click().catch(() => {}); await sleep(400) }
  await page.locator(`[data-ops-rail-list] button[data-ops-lens="${id}"]`).first().click({ timeout: 8000 })
  await sleep(2500)
}
const want = s => STEPS.includes('all') || STEPS.includes(s)
// B11: toasts are dismissed before every screenshot (see shot()), in any locale.
log.toastDismissed = []

// Boot: wait for the shell, past the boot overlay.
await page.waitForLoadState('domcontentloaded')
const t0 = Date.now()
const mainOut = []
app.process().stdout?.on('data', d => mainOut.push(String(d)))
app.process().stderr?.on('data', d => mainOut.push(String(d)))
log.bootReady = await page.waitForFunction(() => { const t = document.body?.innerText ?? ''; return t.length > 0 && !/Starting Hermes|Waiting for Hermes backend|Let's get you setup/.test(t) }, null, { timeout: 240_000 }).then(() => true, () => false)
log.mainTail = () => mainOut.join('').slice(-6000)
await offscreen()
await sleep(5000)
log.bootMs = Date.now() - t0
await shot('00-boot')

// ---------------------------------------------------------------- mock layer
// Wrap the test instance's own hermes:api handler (main process of THIS isolated Electron only). Every request path is
// recorded; rules [{ path: regex, method?, throw?: msg, body?: json }] replace the response.
await app.evaluate(({ ipcMain }) => {
  const m = ipcMain._invokeHandlers
  const orig = m && m.get('hermes:api')
  globalThis.__opsSeen = []
  globalThis.__opsMocks = []
  // P24: every served rule is recorded, so a state that depends on a mock can prove the mock answered.
  globalThis.__opsHits = []
  if (!orig) { globalThis.__opsMockErr = 'no _invokeHandlers'; return }
  m.set('hermes:api', async (e, req) => {
    const path = String(req?.path ?? ''), method = String(req?.method ?? 'GET').toUpperCase()
    globalThis.__opsSeen.push(`${method} ${path}`)
    for (const r of globalThis.__opsMocks) {
      if (new RegExp(r.path).test(path) && (!r.method || r.method === method)) {
        globalThis.__opsHits.push({ rule: r.path, method, path, at: Date.now() })
        if (r.delay) await new Promise(res => setTimeout(res, r.delay))
        if (r.throw) throw new Error(r.throw)
        if (!('body' in r)) return orig(e, req)
        return JSON.parse(JSON.stringify(r.body))
      }
    }
    return orig(e, req)
  })
})
// First matching rule wins: specific rules must come before the base fixtures. Installing rules resets the hit log.
const mock = rules => app.evaluate((_, r) => { globalThis.__opsMocks = r; globalThis.__opsHits = [] }, rules)
const seen = () => app.evaluate(() => [...new Set(globalThis.__opsSeen)].sort())
const mockErr = await app.evaluate(() => globalThis.__opsMockErr ?? null)

// ---------------------------------------------------------------- assertions (P24)
// A state is ok only when VISIBLE, specific evidence is on screen after the interaction: Playwright visibility
// (non-empty box, not display:none / visibility:hidden), plus text / attribute / value checks. Node counts never pass.
const visible = sel => page.locator(sel).filter({ visible: true })
const poll = async (fn, ms) => {
  const end = Date.now() + ms
  for (;;) {
    try { return await fn() } catch (e) { if (Date.now() > end) throw e }
    await sleep(250)
  }
}
const CHECK_MS = 10_000
/** see(sel, { count, min, max, text, attr, value, clear }): visible matches, with optional specifics on the first match. */
const see = (sel, o = {}) => poll(async () => {
  const loc = visible(sel)
  const n = await loc.count()
  if (o.count !== undefined && n !== o.count) throw new Error(`${sel}: ${n} visible, want ${o.count}`)
  if (n < (o.min ?? 1)) throw new Error(`${sel}: ${n} visible, want >= ${o.min ?? 1}`)
  if (o.max !== undefined && n > o.max) throw new Error(`${sel}: ${n} visible, want <= ${o.max}`)
  for (const t of [].concat(o.text ?? [])) if (!(await loc.filter({ hasText: t }).count())) throw new Error(`${sel}: no visible match contains "${t}"`)
  for (const [k, v] of Object.entries(o.attr ?? {})) {
    const got = await loc.first().getAttribute(k)
    if (v instanceof RegExp ? !v.test(got ?? '') : got !== v) throw new Error(`${sel}: ${k}=${JSON.stringify(got)}, want ${v}`)
  }
  if (o.value !== undefined) { const got = await loc.first().inputValue(); if (got !== o.value) throw new Error(`${sel}: value ${JSON.stringify(got)}, want ${JSON.stringify(o.value)}`) }
  if (o.clear) {
    // Unobstructed: the point a user would click on the first match hits the match itself, not an overlay.
    const why = await loc.first().evaluate(el => {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const r = el.getBoundingClientRect()
      const x = r.left + Math.min(r.width / 2, 48), y = r.top + Math.min(r.height / 2, 16)
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return `outside the window at ${Math.round(x)},${Math.round(y)}`
      const hit = document.elementFromPoint(x, y)
      return hit && (hit === el || el.contains(hit)) ? '' : `covered by <${hit?.tagName.toLowerCase()} ${[...(hit?.attributes ?? [])].map(a => a.name).join(' ').slice(0, 120)}>`
    })
    if (why) throw new Error(`${sel}: ${why}`)
  }
  return `${sel} x${n} visible${o.text ? ` with ${JSON.stringify(o.text)}` : ''}${o.attr ? ` ${JSON.stringify(o.attr)}` : ''}${o.value !== undefined ? ` value=${JSON.stringify(o.value)}` : ''}${o.clear ? ' unobstructed' : ''}`
}, o.ms ?? CHECK_MS)
/** none(sel): no visible match (hidden or absent). */
const none = (sel, o = {}) => poll(async () => {
  const loc = visible(sel), n = await loc.count()
  if (n) {
    // Say where the stray match is, so a failure can be traced to a surface.
    const at = await loc.first().evaluate(el => { const r = el.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} in ${el.closest('[data-ops-root]') ? 'the active Ops root' : el.closest('[data-ops-native]') ? 'an inactive Ops instance' : 'the app'}` }).catch(() => '?')
    throw new Error(`${sel}: ${n} visible, want 0 (first at ${at})`)
  }
  return `no visible ${sel}`
}, o.ms ?? CHECK_MS)
/** served(rule): the named mock rule answered at least once since it was installed. */
const served = (rule, o = {}) => poll(async () => {
  const hits = await app.evaluate((_, p) => (globalThis.__opsHits ?? []).filter(h => h.rule === p.rule && (!p.method || h.method === p.method)).length, { rule, method: o.method ?? null })
  if (!hits) throw new Error(`mock ${o.method ?? ''} ${rule} never served`)
  return `mock ${o.method ?? ''} ${rule} served x${hits}`
}, o.ms ?? CHECK_MS)
/** Click the first VISIBLE match; throws when there is none (an interaction that cannot happen is a failure). */
const tap = async (sel, ms = 8000) => { const l = visible(sel).first(); await l.waitFor({ state: 'visible', timeout: ms }); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 4000 }) }
const type = async (sel, v, ms = 8000) => { const l = visible(sel).first(); await l.waitFor({ state: 'visible', timeout: ms }); await l.fill(v) }

const matrix = []
const MATRIX = SELFTEST ? 'selftest-matrix.json' : 'state-matrix.json'
const within = (pr, ms, what) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(`watchdog: ${what} > ${ms} ms`)), ms))])
/** Run labelled checks; every check runs (no short-circuit) so a negative control shows exactly which ones failed. */
const runChecks = async (checks, ms) => {
  const out = []
  for (const [label, fn] of Object.entries(checks)) {
    try { out.push({ label, pass: true, detail: await within(fn(ms), ms + 5000, label) }) } catch (e) { out.push({ label, pass: false, detail: String(e?.message ?? e).slice(0, 240) }) }
  }
  return out
}
/**
 * state(screen, st, spec)
 *   spec.mocks: rules installed before act (default: none); spec.act(): the interaction; spec.checks: { label: ms => Promise };
 *   spec.neg: { mocks?, act?, fails?: [labels] } the same checks with the precondition removed (default: same mocks, act
 *   = spec.open only). Normal run: ok = every check passes after act AND again after the screenshot.
 *   OPS_HARD_SELFTEST=1: ok = every label in neg.fails (default: all) FAILS. spec.after(): cleanup in both modes.
 * Legacy form state(screen, st, fn) is kept: fn's return is the note (it should throw when its state is not shown).
 */
const state = async (screen, st, spec) => {
  if (ONLY && !ONLY.test(`${screen}-${st}`)) return
  const name = `${SELFTEST ? 's' : 'h'}-${screen}-${st}`.replace(/[^a-z0-9-]/gi, '_')
  let ok = true, note = '', checks = []
  if (typeof spec === 'function') {
    if (SELFTEST) return
    try { note = (await within(Promise.resolve().then(spec), 45000, 'state')) ?? '' } catch (e) { ok = false; note = String(e).slice(0, 200) }
    await sleep(1200); await within(shot(name), 20000, 'shot').catch(e => { ok = false; note += ` ${e}` })
  } else {
    const neg = spec.neg ?? {}
    const mocks = SELFTEST && 'mocks' in neg ? neg.mocks : spec.mocks ?? []
    const act = SELFTEST ? neg.act ?? spec.open : spec.act
    try {
      await mock(mocks)
      await within(Promise.resolve().then(act), 60000, 'act')
      checks = await runChecks(spec.checks, CHECK_MS)
      await sleep(600)
      await within(shot(name), 20000, 'shot').catch(e => { note += ` ${e}` })
      if (!SELFTEST) {
        // The screenshot must show the asserted state: re-check right after it, briefly.
        const again = await runChecks(spec.checks, 1500)
        for (const [i, c] of again.entries()) if (!c.pass && checks[i].pass) checks[i] = { ...c, detail: `changed before the shot: ${c.detail}` }
      }
    } catch (e) { note += ` act failed: ${String(e?.message ?? e).slice(0, 200)}`; ok = false }
    if (SELFTEST) {
      const must = neg.fails ?? Object.keys(spec.checks)
      const held = checks.filter(c => must.includes(c.label) && !c.pass).map(c => c.label)
      const leaked = must.filter(l => !held.includes(l))
      if (ok) ok = checks.length > 0 && leaked.length === 0
      note = (note + (leaked.length ? ` FALSE POSITIVE: passed without precondition: ${leaked.join(', ')}` : ` negative control held: ${held.join(', ')} failed`)).trim()
    } else if (ok) {
      ok = checks.length > 0 && checks.every(c => c.pass)
      note = (note + ' ' + (ok ? 'verified' : `failed: ${checks.filter(c => !c.pass).map(c => c.label).join(', ')}`)).trim()
    }
    await Promise.resolve().then(spec.after).catch(() => {})
  }
  matrix.push({ screen, state: st, shot: `${name}.png`, ok, note, checks })
  writeFileSync(join(OUT, MATRIX), JSON.stringify({ mode: SELFTEST ? 'selftest' : 'states', tag: TAG || null, mockErr, ok: matrix.filter(x => x.ok).length, total: matrix.length, matrix }, null, 2))
}
// Legacy helper (kept): now visibility-based, never a node count.
const need = async (...sels) => { for (const sel of sels) await see(sel); return `verified: ${sels.join(' + ')}` }
const reload = async () => { await page.reload(); await sleep(3000) }
const narrow = w => app.evaluate(({ BrowserWindow }, w) => { for (const x of BrowserWindow.getAllWindows()) x.setSize(w, 1000) }, w)

if (want('discover')) {
  for (const id of ['office', 'board', 'agents', 'skills', 'channels', 'settings']) { await go('/ops'); await lens(id).catch(() => {}); await sleep(1500) }
  for (const r of ['/artifacts', '/settings', '/capabilities', '/command-center', '/cron', '/profiles']) await goApp(r)
  writeFileSync(join(OUT, 'seen.json'), JSON.stringify({ mockErr, seen: await seen() }, null, 2))
}

if (existsSync(join(DESKTOP, 'scripts', 'ops-live', 'hard-states.mjs'))) {
  const mod = await import('file://' + join(DESKTOP, 'scripts', 'ops-live', 'hard-states.mjs').replace(/\\/g, '/'))
  await mod.default({ page, app, go, goApp, lens, state, mock, narrow, sleep, shot, want, offscreen, need, reload, see, none, served, tap, type, visible, selftest: SELFTEST })
}
save()
await app.close().catch(() => {})
process.exit(0)
