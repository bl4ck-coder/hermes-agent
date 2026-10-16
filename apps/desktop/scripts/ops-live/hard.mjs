// P19 hard-state pass: an isolated desktop instance with its OWN sandboxed HERMES_HOME (never the real gateway)
// plus a mock layer on the test instance's hermes:api IPC handler, to capture opened sections, filters, editing,
// rejected saves, errors, narrow panels and loaded lists. Writes state-matrix.json next to the screenshots.
// P25: fail-closed (any exception in a state, including its screenshot, fails it), every state declares what it
// proves, the unobstructed check probes every match, and OPS_HARD_SELFTEST=both writes selftest-matrix.json too.
// Exit code: 0 only when every row of every matrix written by the run is ok; 3 otherwise.
import { _electron } from '@playwright/test'
import { spawnSync as spawnStop } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const DESKTOP = resolve(process.argv[2] ?? '.')
const OUT = resolve(process.argv[3] ?? join(tmpdir(), 'ops-live'))
const STEPS = (process.argv[4] ?? 'all').split(',')
mkdirSync(OUT, { recursive: true })

// P26 (judge pass 20 #1): the evidence signature. Every matrix row carries the run id, the build stamp of the app under
// test (build/install-stamp.json) and its own timestamp, so rows consolidated from re-runs stay traceable.
const RUN_ID = `${(process.env.OPS_HARD_TAG ?? '').replace(/[^a-z0-9_-]/gi, '') || 'run'}-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${process.pid}`
const BUILD = (() => {
  try {
    const s = JSON.parse(readFileSync(join(DESKTOP, 'build', 'install-stamp.json'), 'utf8'))
    const m = existsSync(join(DESKTOP, 'build', 'install-stamp.json')) ? statSync(join(DESKTOP, 'build', 'install-stamp.json')).mtime.toISOString() : null
    return { commit: s.commit ?? null, branch: s.branch ?? null, builtAt: s.builtAt ?? null, dirty: s.dirty ?? null, stampWritten: m }
  } catch (e) { return { commit: null, error: `install-stamp.json unreadable: ${String(e?.message ?? e).slice(0, 160)}` } }
})()
// P26: the states module is loaded BEFORE anything is launched. A missing module, one that fails to import, or one with
// no default export fails the run (exit 3, a failing module-load row in state-matrix.json); it used to leave the summary
// empty and exit 0. OPS_HARD_STATES overrides the path (used by the selftest control that proves this).
const STATES_PATH = process.env.OPS_HARD_STATES ? resolve(process.env.OPS_HARD_STATES) : join(DESKTOP, 'scripts', 'ops-live', 'hard-states.mjs')
const loadStates = async path => {
  if (!existsSync(path)) throw new Error(`states module not found: ${path}`)
  const mod = await import('file://' + path.replace(/\\/g, '/'))
  if (typeof mod.default !== 'function') throw new Error(`states module has no default export function: ${path}`)
  return mod.default
}
/** 0 only when at least one matrix was written and every one of them has rows, all ok. */
const exitCodeFor = summary => (Object.keys(summary).length > 0 && Object.values(summary).every(s => s.total > 0 && s.ok === s.total) ? 0 : 3)
let statesFn
try { statesFn = await loadStates(STATES_PATH) } catch (e) {
  const note = `states module failed to load: ${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 300)}`
  const row = { screen: 'harness', state: 'module-load', proves: 'the hard-states module loaded', ok: false, note, errors: [note], checks: [], shots: [], shot: null, run: RUN_ID, build: BUILD.commit, at: new Date().toISOString() }
  writeFileSync(join(OUT, 'state-matrix.json'), JSON.stringify({ mode: 'states', run: RUN_ID, build: BUILD, generatedAt: new Date().toISOString(), ok: 0, total: 1, moduleError: note, matrix: [row] }, null, 2))
  const summary = { 'state-matrix.json': { ok: 0, total: 1, failed: [`harness-module-load: ${note}`] } }
  writeFileSync(join(OUT, 'run-summary.json'), JSON.stringify({ run: RUN_ID, build: BUILD, exit: exitCodeFor(summary), ...summary }, null, 2))
  console.log(`state-matrix.json: 0/1\n  FAIL harness-module-load: ${note}`)
  process.exit(exitCodeFor(summary))
}
const electronBin = join(DESKTOP, 'node_modules', 'electron', 'dist', 'electron.exe')
const log = { console: [], pageErrors: [], failed: [], http: [], sections: {}, fps: {} }
const sleep = ms => new Promise(r => setTimeout(r, ms))

// P24: OPS_HARD_TAG gives a run its own userData dir and sandbox HERMES_HOME so parallel runs never collide
// (unset: the original ops-hard-userdata / ops-hard-home paths). OPS_HARD_SELFTEST=1 runs the negative controls only;
// P25: OPS_HARD_SELFTEST=both runs the states, then the negative controls, in the same output dir (state-matrix.json
// and selftest-matrix.json side by side, so the judge receives both).
const TAG = (process.env.OPS_HARD_TAG ?? '').replace(/[^a-z0-9_-]/gi, '')
const SELFTEST_MODE = (process.env.OPS_HARD_SELFTEST ?? '').trim().toLowerCase()
const RUN_STATES = SELFTEST_MODE !== '1' && SELFTEST_MODE !== 'true'
const RUN_NEG = SELFTEST_MODE === '1' || SELFTEST_MODE === 'true' || SELFTEST_MODE === 'both'
// The pass being run right now (false: states, true: negative controls).
let SELFTEST = !RUN_STATES
// Optional: OPS_HARD_ONLY=<regex on "screen-state"> runs a subset (e.g. "narrow").
const ONLY = process.env.OPS_HARD_ONLY ? new RegExp(process.env.OPS_HARD_ONLY) : null
const HOME = join(tmpdir(), TAG ? `ops-hard-home-${TAG}` : 'ops-hard-home')
const SANDBOX_PORT = TAG ? '18652' : '18642'
const env = {
  ...process.env,
  HERMES_DESKTOP_HERMES_ROOT: resolve(DESKTOP, '..', '..'),
  HERMES_DESKTOP_PYTHON: process.env.OPS_LIVE_PYTHON,
  HERMES_DESKTOP_ISOLATED_BACKEND: '1',
  // v0.22 needs a gateway. The sandbox home owns its own, on its own port, never 8642 (the user's): the lifecycle
  // guard (hermes_cli/gateway_lifecycle_guard.py) only blocks gateway actions on the real Hermes home.
  API_SERVER_PORT: SANDBOX_PORT,
  HERMES_DESKTOP_USER_DATA_DIR: join(tmpdir(), TAG ? `ops-hard-userdata-${TAG}` : 'ops-hard-userdata'),
  // P19: sandbox home only. Refuse to run if a real home is forced.
  HERMES_HOME: HOME,
  HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1'
}
delete env.HERMES_DESKTOP_DEV_SERVER
// P26: OPS_LIVE_PYTHON is a self-contained venv. An inherited PYTHONPATH/PYTHONHOME (e.g. another Hermes env's
// site-packages) makes it import foreign compiled modules and fail; the preflight, the Electron launch (its pooled
// backend) and the gateway stop all use this env, without them.
delete env.PYTHONPATH
delete env.PYTHONHOME
if (process.env.OPS_LIVE_HERMES_HOME) { console.error('hard.mjs never uses OPS_LIVE_HERMES_HOME'); process.exit(4) }
mkdirSync(HOME, { recursive: true })
// The sandbox has no provider, so the first-run setup dialog can cover the app mid-run (it depended on
// provider keys leaking in from the parent shell). A placeholder key keeps setup closed; nothing is ever sent.
{
  const envFile = join(HOME, '.env')
  let text = existsSync(envFile) ? readFileSync(envFile, 'utf8') : ''
  if (!/^ANTHROPIC_API_KEY=/m.test(text)) text += 'ANTHROPIC_API_KEY=ops-hard-placeholder-not-a-real-key\n'
  if (!/^API_SERVER_PORT=/m.test(text)) text += `API_SERVER_PORT=${SANDBOX_PORT}\n`
  writeFileSync(envFile, text)
}
if (resolve(HOME).toLowerCase().startsWith(resolve(process.env.LOCALAPPDATA ?? '~', 'hermes').toLowerCase())) { console.error('sandbox home is inside the real Hermes home'); process.exit(4) }


// B11 safety: never launch a test window whose backend cannot start (a wrong interpreter makes the
// isolated instance loop on 'Hermes couldn't start' in a visible window on the user's desktop).
{
  const { spawnSync } = await import('node:child_process')
  const py = process.env.OPS_LIVE_PYTHON
  const probe = py ? spawnSync(py, ['-c', 'import hermes_cli.web_server'], { cwd: resolve(DESKTOP, '..', '..'), env, encoding: 'utf8', timeout: 120_000 }) : null
  if (!probe || probe.status !== 0) {
    console.error('ops-live preflight failed: OPS_LIVE_PYTHON must import hermes_cli.web_server from this checkout.', probe?.stderr?.slice(-400) ?? 'unset')
    process.exit(2)
  }
}
const app = await _electron.launch({ executablePath: electronBin, args: [DESKTOP], env, cwd: DESKTOP, timeout: 120_000 })
// P21c: never leave this test instance behind (a leftover held the single-instance lock and broke h5/h6).
// The sandbox gateway (sandbox home only, port SANDBOX_PORT) is stopped when the run ends.
const stopSandboxGateway = () => {
  try {
    spawnStop(process.env.OPS_LIVE_PYTHON, ['-m', 'hermes_cli.main', 'gateway', 'stop'], { cwd: resolve(DESKTOP, '..', '..'), env, timeout: 60_000 })
  } catch {}
}
const killApp = () => { try { app.process().kill() } catch {} stopSandboxGateway() }
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
// P25 (judge pass 19 #1): fail-closed. A screenshot that cannot be taken, or that leaves no file, THROWS; the state
// that asked for it fails with the reason (it used to be logged and absorbed, so ok stayed true).
// P26: keepToasts (a state whose evidence IS a toast, e.g. a refused chat send) screenshots with its alerts in place.
const shot = async (name, o = {}) => {
  if (!o.keepToasts) { await dismissToasts(); await sleep(250); await dismissToasts() } else await sleep(250)
  const file = join(OUT, `${name}.png`)
  await page.screenshot({ path: file })
  if (!existsSync(file) || statSync(file).size === 0) throw new Error(`screenshot ${name}.png was not written`)
  return file
}
const save = () => writeFileSync(join(OUT, 'live.json'), JSON.stringify({ ...log, mainTail: typeof log.mainTail === 'function' ? log.mainTail() : '' }, null, 2))

async function section(name, fn) {
  const before = { c: log.console.filter(x => x.type === 'error').length, p: log.pageErrors.length, h: log.http.length, f: log.failed.length }
  let ok = true, note = ''
  try { note = (await fn()) ?? '' } catch (e) { ok = false; note = String(e).slice(0, 300) }
  await sleep(1500)
  try { await shot(name) } catch (e) { ok = false; note = `${note} screenshot: ${String(e).slice(0, 200)}`.trim() }
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
await shot('00-boot').catch(e => { log.bootShotError = String(e).slice(0, 300) })

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
  // P25: every request (method, path, JSON body, sequence number), so a state can prove what was SENT (e.g. a Retry
  // PUT body holds one key only) and what was NOT sent (a Revert writes nothing, a refused note sends no approve).
  globalThis.__opsReqs = []
  globalThis.__opsSeq = 0
  if (!orig) { globalThis.__opsMockErr = 'no _invokeHandlers'; return }
  m.set('hermes:api', async (e, req) => {
    const path = String(req?.path ?? ''), method = String(req?.method ?? 'GET').toUpperCase()
    const seq = ++globalThis.__opsSeq
    let body = null
    try { const s = req?.body === undefined ? 'null' : JSON.stringify(req.body); body = s.length > 20000 ? { truncated: s.length } : JSON.parse(s) } catch { body = { unserializable: true } }
    globalThis.__opsSeen.push(`${method} ${path}`)
    globalThis.__opsReqs.push({ seq, method, path, body, at: Date.now() })
    if (globalThis.__opsReqs.length > 6000) globalThis.__opsReqs.splice(0, 1000)
    for (const r of globalThis.__opsMocks) {
      if (new RegExp(r.path).test(path) && (!r.method || r.method === method)) {
        globalThis.__opsHits.push({ rule: r.path, method, path, seq, body, at: Date.now() })
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
/** P25: the sequence number of the last request seen; requests(since) returns every request after it. */
const reqSeq = () => app.evaluate(() => globalThis.__opsSeq ?? 0)
const requests = (since = 0) => app.evaluate((_, s) => (globalThis.__opsReqs ?? []).filter(r => r.seq > s), since)

// ---------------------------------------------------------------- gateway (WebSocket) layer (P26)
// Chat sends and subagent events travel over the gateway WebSocket, not hermes:api. gateway.install() routes every
// WebSocket of THIS test page through Playwright (connectToServer: the sandbox gateway still answers everything), then
// reloads so the app reconnects through the route. Rules [{ method: regex, error?: msg, result?: json }] answer a
// client JSON-RPC request in place of the server (it never reaches the sandbox gateway); push(frame) delivers a
// server frame (e.g. a subagent.* event) to the page. Every client request is recorded (method, params, socket).
const gateway = {
  installed: false, rules: [], sent: [], hits: [], sockets: new Set(),
  async install() {
    if (this.installed) return 'already routed'
    await page.routeWebSocket(() => true, ws => {
      const server = ws.connectToServer()
      const entry = { ws, url: ws.url(), rpc: false }
      this.sockets.add(entry)
      ws.onMessage(m => {
        let f = null
        if (typeof m === 'string') { try { f = JSON.parse(m) } catch {} }
        if (f && typeof f.method === 'string') {
          entry.rpc = true
          this.sent.push({ method: f.method, id: f.id ?? null, params: f.params ?? null, at: Date.now(), url: entry.url.slice(0, 120) })
          if (this.sent.length > 4000) this.sent.splice(0, 1000)
          const rule = f.id !== undefined && this.rules.find(r => new RegExp(r.method).test(f.method))
          if (rule) {
            this.hits.push({ method: f.method, id: f.id, params: f.params ?? null, at: Date.now() })
            ws.send(JSON.stringify(rule.error ? { id: f.id, jsonrpc: '2.0', error: { code: rule.code ?? -32000, message: rule.error } } : { id: f.id, jsonrpc: '2.0', result: rule.result ?? null }))
            return
          }
        }
        server.send(m)
      })
      server.onMessage(m => { if (typeof m === 'string' && /"jsonrpc"/.test(m)) entry.rpc = true; ws.send(m) })
      ws.onClose((code, reason) => { this.sockets.delete(entry); server.close({ code, reason }) })
      server.onClose((code, reason) => { this.sockets.delete(entry); ws.close({ code, reason }) })
    })
    this.installed = true
    await page.reload()
    await page.waitForFunction(() => { const t = document.body?.innerText ?? ''; return t.length > 0 && !/Starting Hermes|Waiting for Hermes backend/.test(t) }, null, { timeout: 120_000 })
    await sleep(4000)
    return 'gateway WebSocket routed through the harness'
  },
  setRules(rules) { this.rules = rules; this.hits = [] },
  /** Deliver a server frame to every JSON-RPC socket of the page; returns how many sockets got it. */
  push(frame) { let n = 0; for (const e of this.sockets) if (e.rpc) { e.ws.send(JSON.stringify(frame)); n++ } return n },
  rpcSockets() { return [...this.sockets].filter(e => e.rpc).length }
}

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
/**
 * P25 (judge pass 19 #7): unobstructed means EVERY visible match, not the first one. Each match is scrolled into view
 * and probed with document.elementFromPoint at its centre and 4 points just inside its corners (inset past the
 * border radius); each point must hit the match itself or a descendant. Scroll positions are restored afterwards so
 * the screenshot shows the state as the user left it.
 */
const unobstructed = loc => loc.evaluateAll(els => {
  const saved = new Map()
  const remember = el => { for (let p = el.parentElement; p; p = p.parentElement) if (!saved.has(p) && (p.scrollHeight > p.clientHeight || p.scrollWidth > p.clientWidth)) saved.set(p, [p.scrollTop, p.scrollLeft]) }
  const root = document.scrollingElement
  if (root) saved.set(root, [root.scrollTop, root.scrollLeft])
  const bad = []
  let points = 0
  els.forEach((el, i) => {
    remember(el)
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    const rad = Math.max(...['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].map(k => parseFloat(s[k]) || 0))
    const inset = Math.max(0.5, Math.min(Math.max(3, Math.ceil(rad * 0.3) + 1), r.width / 2 - 0.5, r.height / 2 - 0.5))
    const pts = [['centre', r.left + r.width / 2, r.top + r.height / 2], ['top-left', r.left + inset, r.top + inset], ['top-right', r.right - inset, r.top + inset], ['bottom-left', r.left + inset, r.bottom - inset], ['bottom-right', r.right - inset, r.bottom - inset]]
    for (const [label, x, y] of pts) {
      points++
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) { bad.push(`#${i + 1} ${label} outside the window at ${Math.round(x)},${Math.round(y)}`); continue }
      const hit = document.elementFromPoint(x, y)
      if (!(hit && (hit === el || el.contains(hit)))) bad.push(`#${i + 1} ${label} covered by <${hit?.tagName.toLowerCase()} ${[...(hit?.attributes ?? [])].map(a => a.name).join(' ').slice(0, 100)}>`)
    }
  })
  for (const [p, [t, l]] of saved) { p.scrollTop = t; p.scrollLeft = l }
  return { n: els.length, points, bad }
})
/** see(sel, { count, min, max, text, attr, value, clear }): visible matches, with optional specifics (clear: on EVERY match). */
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
  let clearNote = ''
  if (o.clear) {
    const r = await unobstructed(loc)
    if (r.n !== n) throw new Error(`${sel}: ${n} visible but ${r.n} probed`)
    if (r.bad.length) throw new Error(`${sel}: ${r.bad.length}/${r.points} points obstructed: ${r.bad.slice(0, 4).join('; ')}`)
    clearNote = ` unobstructed (all ${r.n} matches, ${r.points} points: centre + 4 corners)`
  }
  return `${sel} x${n} visible${o.text ? ` with ${JSON.stringify(o.text)}` : ''}${o.attr ? ` ${JSON.stringify(o.attr)}` : ''}${o.value !== undefined ? ` value=${JSON.stringify(o.value)}` : ''}${clearNote}`
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
/** Fails when a modal dialog or the boot-failure overlay is shown; returns the dialog's heading otherwise. */
const noBlockingModal = async () => {
  const hit = await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    const d = [...document.querySelectorAll('[role="alertdialog"], [role="dialog"][aria-modal="true"], dialog[open]')].find(vis)
    return d ? (d.querySelector('h1,h2,h3,[id$="title"]')?.textContent || d.textContent || '').trim().slice(0, 80) : null
  })
  if (hit !== null) throw new Error(`blocking modal: ${hit}`)
  return 'no modal over the app'
}
const matrixFile = () => (SELFTEST ? 'selftest-matrix.json' : 'state-matrix.json')
const writeMatrix = (extra = {}) => writeFileSync(join(OUT, matrixFile()), JSON.stringify({ mode: SELFTEST ? 'selftest' : 'states', run: RUN_ID, selftestMode: SELFTEST_MODE || 'states', tag: TAG || null, build: BUILD, mockErr, generatedAt: new Date().toISOString(), ok: matrix.filter(x => x.ok).length, total: matrix.length, ...extra, matrix }, null, 2))
const within = (pr, ms, what) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(`watchdog: ${what} > ${ms} ms`)), ms))])
const msg = e => String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 300)
/** Run labelled checks; every check runs (no short-circuit) so a negative control shows exactly which ones failed.
 *  P26: a check that hangs past its own budget (watchdog) is marked infra: it is not a rejection of the state. */
const runChecks = async (checks, ms, ctx) => {
  const out = []
  for (const [label, fn] of Object.entries(checks)) {
    try { out.push({ label, pass: true, detail: await within(Promise.resolve().then(() => fn(ms, ctx)), ms + 5000, label) }) } catch (e) { const d = msg(e).slice(0, 240); out.push({ label, pass: false, detail: d, ...(/^watchdog: /.test(d) ? { infra: true } : {}) }) }
  }
  return out
}
/**
 * evalState(name, spec, neg, opts) runs one state and returns { ok, note, errors, checks, shots }.
 *   spec.proves: the behaviour the state proves (required: a state without it fails); spec.checks: { label: (ms, ctx) =>
 *   Promise } named checks; spec.mocks: rules installed before act; spec.act(ctx): the interaction (it may record
 *   evidence in ctx for the checks, and take extra screenshots with ctx.shot(label)); spec.neg: { mocks?, act?, fails? }
 *   the negative control (default: same mocks, act = spec.open; fails = every check). spec.after(ctx): cleanup.
 *   neg=false: ok = no exception anywhere (mock, act, screenshot, re-check, after) AND every check passes after act
 *   AND again right after the screenshot. neg=true: ok = no exception AND every label in neg.fails FAILS.
 *   opts.shot replaces the screenshot function (used by the forced screenshot-failure control).
 */
const evalState = async (name, spec, neg, opts = {}) => {
  const errors = []
  const fail = (where, e) => errors.push(`${where}: ${msg(e)}`)
  const takeShot = opts.shot ?? (n2 => shot(n2, { keepToasts: Boolean(spec.keepToasts) }))
  const n = spec.neg ?? {}
  const shots = []
  const ctx = { neg, shot: async label => { const f = await within(Promise.resolve().then(() => takeShot(`${name}-${label}`)), 20000, `screenshot ${label}`); shots.push(`${name}-${label}.png`); return f } }
  let checks = []
  try {
    if (!spec.proves || typeof spec.proves !== 'string') fail('matrix', 'state declares no "proves" behaviour')
    if (!spec.checks || !Object.keys(spec.checks).length) fail('matrix', 'state declares no named checks')
    const mocks = neg && 'mocks' in n ? n.mocks : spec.mocks ?? []
    const act = neg ? n.act ?? spec.open : spec.act
    if (typeof act !== 'function') fail('matrix', `no ${neg ? 'negative (neg.act / open)' : 'act'} interaction`)
    // A modal over the app (boot failure, any open dialog) makes every visibility check meaningless: Playwright's
    // visible() ignores occlusion. It is a check of every state, so a covered screen can never be 'verified'.
    const allChecks = { ...spec.checks, 'no-blocking-modal': noBlockingModal }
    let mocked = false
    try { await mock(mocks); mocked = true } catch (e) { fail('mock', e) }
    if (mocked && typeof act === 'function') { try { await within(Promise.resolve().then(() => act(ctx)), opts.actMs ?? spec.actMs ?? 90000, 'act') } catch (e) { fail('act', e) } }
    checks = await runChecks(allChecks, CHECK_MS, ctx)
    await sleep(600)
    try { await within(Promise.resolve().then(() => takeShot(name)), 20000, 'screenshot'); shots.unshift(`${name}.png`) } catch (e) { fail('screenshot', e) }
    if (!neg) {
      // The screenshot must show the asserted state: re-check right after it, briefly.
      const again = await runChecks(allChecks, 1500, ctx)
      for (const [i, c] of again.entries()) if (!c.pass && checks[i].pass) checks[i] = { ...c, detail: `changed before the shot: ${c.detail}` }
    }
  } catch (e) { fail('harness', e) }
  if (spec.after) { try { await within(Promise.resolve().then(() => spec.after(ctx)), 60000, 'after') } catch (e) { fail('after', e) } }
  let ok, note
  if (neg) {
    // P26 (judge pass 20 #1): a negative control holds only on the EXPECTED rejection: every must-fail check fails by its
    // own assertion (not by a watchdog), no-blocking-modal still passes (a modal or the boot-failure overlay would make
    // every visibility check fail for the wrong reason) and nothing threw (mock, act, screenshot, after). Any of those is
    // infrastructure, never 'held'.
    const must = n.fails ?? Object.keys(spec.checks ?? {})
    const missing = must.filter(l => !checks.some(c => c.label === l))
    const held = checks.filter(c => must.includes(c.label) && !c.pass && !c.infra).map(c => c.label)
    const infraChecks = checks.filter(c => must.includes(c.label) && !c.pass && c.infra).map(c => c.label)
    const leaked = must.filter(l => !held.includes(l) && !missing.includes(l) && !infraChecks.includes(l))
    const modal = checks.find(c => c.label === 'no-blocking-modal')
    const infra = [...errors.map(e => `infrastructure: ${e}`), ...(modal && !modal.pass ? [`infrastructure: ${modal.detail}`] : []), ...infraChecks.map(l => `infrastructure: check ${l} hung (watchdog)`)]
    ok = infra.length === 0 && checks.length > 0 && must.length > 0 && leaked.length === 0 && missing.length === 0
    note = [infra.length ? `NOT HELD (infrastructure, not the expected rejection): ${infra.join(' | ')}` : '', missing.length ? `negative control names unknown checks: ${missing.join(', ')}` : '', leaked.length ? `FALSE POSITIVE: passed without precondition: ${leaked.join(', ')}` : '', ok ? `negative control held: ${held.join(', ')} failed; no-blocking-modal passed; act ran without exception` : ''].filter(Boolean).join(' | ')
  } else {
    const failed = checks.filter(c => !c.pass).map(c => c.label)
    ok = errors.length === 0 && checks.length > 0 && failed.length === 0
    note = [errors.join(' | '), failed.length ? `failed: ${failed.join(', ')}` : '', ok ? 'verified' : ''].filter(Boolean).join(' | ')
  }
  return { ok, note, errors, checks, shots, ctx }
}
/** P26: the evidence signature of one row: which run, which build, when. */
const stamp = () => ({ run: RUN_ID, build: BUILD.commit, at: new Date().toISOString() })
const state = async (screen, st, spec) => {
  if (ONLY && !ONLY.test(`${screen}-${st}`)) return
  const name = `${SELFTEST ? 's' : 'h'}-${screen}-${st}`.replace(/[^a-z0-9-]/gi, '_')
  let row
  if (typeof spec === 'function') {
    // Legacy form: no declared behaviour or named checks, so it can never be 'verified' (fail-closed).
    row = { ok: false, note: 'legacy state without "proves" and named checks', errors: [], checks: [], shots: [] }
  } else {
    row = await evalState(name, spec, SELFTEST)
  }
  matrix.push({ screen, state: st, proves: spec?.proves ?? null, shot: row.shots[0] ?? null, shots: row.shots, ok: row.ok, note: row.note, errors: row.errors, ...(SELFTEST ? { mustFail: spec?.neg?.fails ?? Object.keys(spec?.checks ?? {}) } : {}), checks: row.checks, ...stamp() })
  writeMatrix()
}
/**
 * control(screen, st, { proves, run }): a harness-level negative control (selftest pass only). run() returns
 * { held, detail, checks? }; the row is ok only when held is true and run() threw nothing.
 */
const control = async (screen, st, spec) => {
  if (!SELFTEST) return
  if (ONLY && !ONLY.test(`${screen}-${st}`)) return
  let ok = false, note = '', checks = [], shots = []
  try {
    if (!spec.proves) throw new Error('control declares no "proves" behaviour')
    const r = await within(Promise.resolve().then(spec.run), 180000, 'control')
    ok = r.held === true
    note = `${ok ? 'negative control held' : 'NOT HELD'}: ${r.detail ?? ''}`.trim()
    checks = r.checks ?? []
    shots = r.shots ?? []
  } catch (e) { ok = false; note = `control failed: ${msg(e)}` }
  matrix.push({ screen, state: st, proves: spec.proves ?? null, shot: shots[0] ?? null, shots, ok, note, errors: [], checks, ...stamp() })
  writeMatrix()
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

const summary = {}
{
  const api = { page, app, go, goApp, lens, state, control, evalState, mock, narrow, sleep, shot, want, offscreen, need, reload, see, none, served, tap, type, visible, reqSeq, requests, unobstructed, gateway, noBlockingModal, harness: { DESKTOP, OUT, TAG, RUN_ID, BUILD, exitCodeFor, hardScript: join(DESKTOP, 'scripts', 'ops-live', 'hard.mjs') }, isSelftest: () => SELFTEST, selftest: SELFTEST }
  const passes = [...(RUN_STATES ? [false] : []), ...(RUN_NEG ? [true] : [])]
  for (const neg of passes) {
    SELFTEST = neg
    matrix.length = 0
    writeMatrix({ running: true })
    try {
      await statesFn({ ...api, selftest: neg })
      writeMatrix()
    } catch (e) {
      // A pass that crashes is recorded as such (never a silent partial matrix).
      matrix.push({ screen: 'harness', state: 'pass-crashed', proves: 'the pass ran to the end', shot: null, shots: [], ok: false, note: `pass crashed: ${msg(e)}`, errors: [msg(e)], checks: [], ...stamp() })
      writeMatrix({ crashed: msg(e) })
    }
    // P26: a pass that wrote no row at all (STEPS without 'hard'/'all', an ONLY filter matching nothing) is a failure too.
    if (!matrix.length) { matrix.push({ screen: 'harness', state: 'empty-pass', proves: 'the pass ran at least one state', shot: null, shots: [], ok: false, note: `no state ran (steps=${STEPS.join(',')}, only=${ONLY ?? 'none'})`, errors: [], checks: [], ...stamp() }); writeMatrix() }
    summary[matrixFile()] = { ok: matrix.filter(x => x.ok).length, total: matrix.length, failed: matrix.filter(x => !x.ok).map(x => `${x.screen}-${x.state}: ${x.note}`.slice(0, 300)) }
    await narrow(1600).catch(() => {})
  }
}
save()
const exitCode = exitCodeFor(summary)
writeFileSync(join(OUT, 'run-summary.json'), JSON.stringify({ run: RUN_ID, build: BUILD, exit: exitCode, ...summary }, null, 2))
for (const [file, s] of Object.entries(summary)) {
  console.log(`${file}: ${s.ok}/${s.total}`)
  for (const f of s.failed) console.log(`  FAIL ${f}`)
}
// P26: a bounded close; then the process is killed and the sandbox gateway stopped (process 'exit' handler).
await within(app.close(), 20000, 'app.close').catch(() => {})
process.exit(exitCode)
