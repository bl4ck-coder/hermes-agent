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

const env = {
  ...process.env,
  HERMES_DESKTOP_HERMES_ROOT: resolve(DESKTOP, '..', '..'),
  HERMES_DESKTOP_PYTHON: process.env.OPS_LIVE_PYTHON,
  HERMES_DESKTOP_ISOLATED_BACKEND: '1',
  HERMES_DESKTOP_USER_DATA_DIR: join(tmpdir(), 'ops-hard-userdata'),
  // P19: sandbox home only. Refuse to run if a real home is forced.
  HERMES_HOME: join(tmpdir(), 'ops-hard-home'),
  HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1'
}
delete env.HERMES_DESKTOP_DEV_SERVER
if (process.env.OPS_LIVE_HERMES_HOME) { console.error('hard.mjs never uses OPS_LIVE_HERMES_HOME'); process.exit(4) }
mkdirSync(join(tmpdir(), 'ops-hard-home'), { recursive: true })


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
  if (!orig) { globalThis.__opsMockErr = 'no _invokeHandlers'; return }
  m.set('hermes:api', async (e, req) => {
    const path = String(req?.path ?? ''), method = String(req?.method ?? 'GET').toUpperCase()
    globalThis.__opsSeen.push(`${method} ${path}`)
    for (const r of globalThis.__opsMocks) {
      if (new RegExp(r.path).test(path) && (!r.method || r.method === method)) {
        if (r.delay) await new Promise(res => setTimeout(res, r.delay))
        if (r.throw) throw new Error(r.throw)
        if (!('body' in r)) return orig(e, req)
        return JSON.parse(JSON.stringify(r.body))
      }
    }
    return orig(e, req)
  })
})
const mock = rules => app.evaluate((_, r) => { globalThis.__opsMocks = r }, rules)
const seen = () => app.evaluate(() => [...new Set(globalThis.__opsSeen)].sort())
const mockErr = await app.evaluate(() => globalThis.__opsMockErr ?? null)
const matrix = []
const state = async (screen, st, fn) => {
  const name = `h-${screen}-${st}`.replace(/[^a-z0-9-]/gi, '_')
  let ok = true, note = ''
  // P21: a state that hangs is recorded as failed and the run moves on (h4/h5 froze mid-run).
  const within = (pr, ms, what) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(`watchdog: ${what} > ${ms} ms`)), ms))])
  try { note = (await within(Promise.resolve().then(fn), 45000, 'state')) ?? '' } catch (e) { ok = false; note = String(e).slice(0, 200) }
  await sleep(1200); await within(shot(name), 20000, 'shot').catch(e => { ok = false; note += ` ${e}` })
  matrix.push({ screen, state: st, shot: `${name}.png`, ok, note })
  writeFileSync(join(OUT, 'state-matrix.json'), JSON.stringify({ mockErr, matrix }, null, 2))
}
// P21: semantic checks. A state counts as reached only when its evidence is on screen.
const need = async (...sels) => { for (const sel of sels) if (!(await page.locator(sel).count())) throw new Error(`not shown: ${sel}`); return `verified: ${sels.join(' + ')}` }
const reload = async () => { await page.reload(); await sleep(3000) }
const narrow = w => app.evaluate(({ BrowserWindow }, w) => { for (const x of BrowserWindow.getAllWindows()) x.setSize(w, 1000) }, w)

if (want('discover')) {
  for (const id of ['office', 'board', 'agents', 'skills', 'channels', 'settings']) { await go('/ops'); await lens(id).catch(() => {}); await sleep(1500) }
  for (const r of ['/artifacts', '/settings', '/capabilities', '/command-center', '/cron', '/profiles']) await goApp(r)
  writeFileSync(join(OUT, 'seen.json'), JSON.stringify({ mockErr, seen: await seen() }, null, 2))
}

if (existsSync(join(DESKTOP, 'scripts', 'ops-live', 'hard-states.mjs'))) {
  const mod = await import('file://' + join(DESKTOP, 'scripts', 'ops-live', 'hard-states.mjs').replace(/\\/g, '/'))
  await mod.default({ page, app, go, goApp, lens, state, mock, narrow, sleep, shot, want, offscreen, need, reload })
}
save()
await app.close().catch(() => {})
process.exit(0)
