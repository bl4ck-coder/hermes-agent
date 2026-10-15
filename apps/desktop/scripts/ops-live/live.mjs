// Ops live pass: launch an isolated desktop instance (own userData, own pooled backend from this checkout,
// real HERMES_HOME so it sees the real gateway), visit every Ops section with safe reads only,
// collect console errors, page errors, failed requests and HTTP >= 400, and screenshot each section.
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
  HERMES_DESKTOP_USER_DATA_DIR: join(tmpdir(), 'ops-live-userdata'),
  // The real Hermes home (and so the real gateway). An explicit HERMES_HOME wins over the userData sandbox.
  ...(process.env.OPS_LIVE_HERMES_HOME ? { HERMES_HOME: process.env.OPS_LIVE_HERMES_HOME } : {}),
  HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1'
}
delete env.HERMES_DESKTOP_DEV_SERVER

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

log.boardBefore = await page.evaluate(async () => { const b = await window.hermesDesktop.api({ path: '/api/plugins/kanban/board' }); return b.columns.map(c => `${c.name}:${c.tasks.map(t => t.id).sort().join(',')}`).join('|') }).catch(e => 'ERR ' + e)
if (want('probe')) {
  log.api = await page.evaluate(async () => {
    const out = {}
    for (const path of ['/api/status', '/api/ops/fleet', '/api/ops/policy', '/api/plugins/kanban/boards', '/api/plugins/kanban/board']) {
      try { const r = await window.hermesDesktop.api({ path }); out[path] = JSON.stringify(r).slice(0, 1500) } catch (e) { out[path] = 'ERR ' + String(e).slice(0, 300) }
    }
    return out
  })
  save()
}
if (want('office')) await section('01-office', async () => { await go('/ops/office'); await page.waitForSelector('[data-ops-writes-gate]', { timeout: 20000 }); if ((await page.getAttribute('[data-ops-fullscreen]', 'data-ops-fullscreen')) !== 'true') { await page.click('[data-ops-fullscreen-toggle]').catch(() => {}); await sleep(1500) } return await page.evaluate(() => document.querySelector('[data-ops-writes-gate]')?.getAttribute('data-ops-writes-gate') ?? 'no-gate-attr') })
if (want('fps')) await sampleFps('office-motion', async () => {}, 6000)
if (want('board')) await section('02-board', async () => {
  await go('/ops/board')
  log.boardZeros = await page.evaluate(() => {
    const out = []
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.textContent.trim() !== '0') continue
      const p = n.parentElement
      const r = p.getBoundingClientRect()
      if (r.width === 0) continue
      out.push(`@${Math.round(r.x)},${Math.round(r.y)} <${p.tagName.toLowerCase()}> parent=${p.parentElement?.outerHTML.slice(0, 260)}`)
    }
    return out
  })
  return `cards=${await page.locator('[data-ops-open-task]').count()}`
})
if (want('fps')) await sampleFps('board-scroll', async end => {
  const el = page.locator('[data-ops-board], [data-ops-column]').first()
  const box = await el.boundingBox().catch(() => null)
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + Math.min(300, box.height / 2))
  while (Date.now() < end - 200) { await page.mouse.wheel(0, 240); await sleep(40); await page.mouse.wheel(0, -240); await sleep(40) }
})
if (want('fps')) await sampleFps('board-drag', async end => {
  // B13: real HTML5 drag events over other columns, then dragend WITHOUT drop: no move is ever sent.
  await page.evaluate(async until => {
    const card = document.querySelector('[data-ops-card][draggable="true"]')
    const cols = [...document.querySelectorAll('[data-ops-columns] > [data-ops-column]')]
    if (!card || cols.length < 2) return
    const dt = new DataTransfer()
    card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    let i = 0
    while (Date.now() < until) {
      const col = cols[i++ % cols.length]
      const r = col.getBoundingClientRect()
      col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + 20, clientY: r.y + 60 }))
      await new Promise(f => requestAnimationFrame(() => f()))
    }
    card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }))
  }, end - 300)
})
if (want('drag')) await section('02c-board-drag-over', async () => {
  // Screenshot the drop highlight mid-drag; ends with dragend (no drop).
  await go('/ops/board')
  const r = await page.evaluate(() => {
    const card = document.querySelector('[data-ops-card][draggable="true"]')
    const col = [...document.querySelectorAll('[data-ops-columns] > [data-ops-column]')].find(c => !c.contains(card) && c.getAttribute('data-ops-column') !== 'running')
    if (!card || !col) return 'no-card'
    window.__opsDt = new DataTransfer()
    card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: window.__opsDt }))
    col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__opsDt }))
    return `${card.getAttribute('data-ops-card')} over ${col.getAttribute('data-ops-column')}`
  })
  await sleep(400); await shot('02c-board-drag-over-live')
  const lit = await page.locator('[data-ops-drop="over"]').count()
  await page.evaluate(() => document.querySelector('[data-ops-card][data-ops-dragging]')?.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: window.__opsDt })))
  return `${r}; highlighted=${lit}`
})
if (want('canvas')) await section('03-canvas', async () => { await go('/ops/canvas'); return `nodes=${await page.locator('[data-ops-node-title]').count()}` })
if (want('fps')) await sampleFps('canvas-pan-zoom', async end => {
  const c = page.locator('[data-ops-canvas], svg').first()
  const b = await c.boundingBox().catch(() => null)
  if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  let i = 0
  while (Date.now() < end - 200) {
    i++
    if (i % 4 === 0) { await page.keyboard.down('Control'); await page.mouse.wheel(0, i % 8 ? -100 : 100); await page.keyboard.up('Control') }
    else await page.mouse.wheel(i % 2 ? 80 : -80, i % 3 ? 60 : -60)
    await sleep(30)
  }
})
if (want('card')) await section('02b-board-card', async () => {
  // Read-only: one single click opens the card drawer (double-click would rename, so never double-click).
  await go('/ops/board')
  const open = page.locator('[data-ops-open-task]').first()
  try {
    await open.click({ timeout: 5000 })
  } catch (e) {
    // Keyboard path (also proves the card title is reachable): focus it and press Enter once.
    log.cardClickError = String(e).slice(0, 1500)
    await open.focus()
    await page.keyboard.press('Enter')
  }
  await sleep(1200)
  return `inspector=${await page.locator('[data-ops-inspector-detail]').getAttribute('data-ops-inspector-detail').catch(() => 'none')}`
})
if (want('node')) await section('03c-canvas-node', async () => {
  await go('/ops/canvas')
  const t = page.locator('[data-ops-node-title]').nth(1)
  await t.click({ timeout: 8000 })
  await sleep(1000)
  return `inspector=${await page.locator('[data-ops-inspector-detail]').getAttribute('data-ops-inspector-detail').catch(() => 'none')}`
})
if (want('focus')) await section('10-focus', async () => {
  await go('/ops/office')
  await page.locator('[data-ops-root]').first().click({ position: { x: 5, y: 5 } }).catch(() => {})
  const seen = []
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    await sleep(120)
    seen.push(await page.evaluate(() => { const e = document.activeElement; if (!e) return 'none'; const cs = getComputedStyle(e); return `${e.tagName.toLowerCase()}:${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 18)}|ring=${cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px' ? cs.outlineWidth : cs.boxShadow !== 'none' ? 'shadow' : 'NONE'}` }))
  }
  return seen.join(' ; ')
})
if (want('settings-inspector')) await section('08b-settings-inspector', async () => {
  await page.locator('[data-ops-rail-list] [data-ops-more]').first().click({ timeout: 3000 }).catch(() => {})
  await page.locator('[data-ops-rail-list] button[data-ops-lens=settings]').first().click({ timeout: 8000 })
  await sleep(1500)
  return `inspector=${await page.locator('[data-ops-inspector-detail]').getAttribute('data-ops-inspector-detail').catch(() => 'none')}`
})
if (want('compose')) await section('03d-canvas-compose', async () => {
  // B13: propose only, screenshot, then Discard. Never Accept, never Save.
  await go('/ops/canvas')
  const ta = page.locator('[data-ops-compose] textarea').first()
  await ta.fill('use model openrouter/deepseek-chat\nalways answer in Spanish\nconnect tools to skills', { timeout: 8000 })
  await page.locator('[data-ops-compose] button[type=submit]').click({ timeout: 5000 })
  await sleep(500); await shot('03d-canvas-compose-proposal')
  const items = await page.locator('[data-ops-proposal-item]').count()
  await page.locator('[data-ops-proposal-discard]').click({ timeout: 5000 })
  const staged = await page.locator('[data-ops-dirty]').count()
  return `items=${items}; discarded; dirty=${staged}`
})
if (want('draft')) await section('03b-canvas-draft', async () => {
  // One reversible draft edit: open the prompt editor, type, then Discard. Never Review & save.
  await go('/ops/canvas')
  await page.locator('[data-ops-node-title]').first().click({ timeout: 8000 })
  await sleep(1000)
  const ta = page.locator('[data-ops-node-editor] textarea').first()
  await ta.click({ timeout: 8000 }); await page.keyboard.press('End'); await page.keyboard.type(' (ops live check)')
  await sleep(500); await shot('03b-canvas-draft-dirty')
  await page.locator('[data-ops-node-discard]').first().click({ timeout: 8000 })
  return 'typed then discarded'
})
for (const [n, id, tab] of [['04-fleet', 'agents', 'fleet'], ['05-teams', 'agents', 'teams'], ['06-skills', 'skills'], ['07-channels', 'channels'], ['08-settings', 'settings']]) {
  if (!want(n.slice(3))) continue
  await section(n, async () => { await go('/ops/office'); await lens(id); if (tab) await page.locator(`[data-ops-agents-tab="${tab}"]`).first().click({ timeout: 8000 }); return page.url() })
}
if (want('settings')) await section('08c-settings-top', async () => {
  await page.evaluate(() => document.querySelector('[data-ops-settings-group]')?.scrollIntoView({ block: 'start' }))
  await sleep(400)
  return 'scrolled to top'
})
if (want('diagnostics')) await section('09-diagnostics', async () => {
  const d = page.locator('[data-ops-diagnostics]').first(); await d.scrollIntoViewIfNeeded({ timeout: 8000 })
  await page.locator('[data-ops-probe]').first().click({ timeout: 8000 }); await sleep(4000); await d.scrollIntoViewIfNeeded()
  return await page.evaluate(() => { const e = document.querySelector('[data-ops-diag-connection]'); return `${e?.getAttribute('data-ops-diag-connection')} writes=${e?.getAttribute('data-ops-writes')}` })
})
// B33: roster views. Switch to Cards, capture, switch back so the stored choice is unchanged.
for (const [n, id, tab] of [['04b-fleet-cards', 'agents', 'fleet'], ['06b-skills-cards', 'skills']]) {
  if (!want(n.slice(4)) && !want(n.slice(4, -6))) continue
  await section(n, async () => { await go('/ops/office'); await lens(id); if (tab) await page.locator(`[data-ops-agents-tab="${tab}"]`).first().click({ timeout: 8000 }); const tg = page.locator(`[data-ops-lens="${id}"] [data-ops-view-toggle] button`).nth(1); await tg.scrollIntoViewIfNeeded({ timeout: 8000 }); await tg.click({ timeout: 8000, force: true }); await sleep(600); return await page.evaluate(() => document.querySelectorAll('[data-ops-roster] > li').length + ' cards') })
  await page.locator(`[data-ops-lens="${id}"] [data-ops-view-toggle] button`).first().click({ timeout: 4000 }).catch(() => {})
}
// Glass/IA pass: the main Hermes screens outside Ops (read-only visits; Escape closes overlays).
for (const [n, route] of [['20-app-chat', '/'], ['21-app-settings', '/settings'], ['22-app-profiles', '/profiles'], ['23-app-capabilities', '/capabilities'], ['24-app-messaging', '/messaging'], ['25-app-artifacts', '/artifacts'], ['26-app-cron', '/cron'], ['27-app-command-center', '/command-center'], ['28-app-agents', '/agents']]) {
  if (!want('app') && !want(n)) continue
  await section(n, async () => { await goApp(route); if (route === '/artifacts') await page.waitForSelector('[data-artifact-card], [data-artifacts-empty], table tbody tr, img', { timeout: 15000 }).catch(() => {}); if (route === '/artifacts' || route === '/capabilities') log['stack' + route.replace('/', '-')] = await page.evaluate(() => document.elementsFromPoint(innerWidth * 0.4, innerHeight * 0.5).slice(0, 12).map(e => { const c = getComputedStyle(e); return e.tagName.toLowerCase() + ' bg=' + c.backgroundColor + ' img=' + c.backgroundImage.slice(0, 30) + ' attrs=' + [...e.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name).join(',') + ' cls=' + String(e.className).slice(0, 100) })).catch(e => String(e)); if (route === '/') { await page.locator('button:has-text("Chats")').first().click({ timeout: 4000 }).catch(() => {}); await sleep(1500); log.chatStack = await page.evaluate(() => document.elementsFromPoint(innerWidth * 0.3, innerHeight * 0.3).slice(0, 14).map(e => { const c = getComputedStyle(e); return `${e.tagName.toLowerCase()}${e.getAttribute('data-slot') ? '[slot=' + e.getAttribute('data-slot') + ']' : ''}${e.hasAttribute('data-chat-surface') ? '[chat-surface]' : ''} bg=${c.backgroundColor} img=${c.backgroundImage.slice(0, 40)} cls=${(e.className && e.className.baseVal === undefined ? e.className : '').slice(0, 90)}` })).catch(e => String(e)) } return page.url() })
  if (n === '22-app-profiles') log.soulProbe = await page.evaluate(() => { const q = s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { cls: String(e.className).slice(0, 120), color: c.color, bg: c.backgroundColor, outline: `  `, border: ` `, shadow: c.boxShadow.slice(0, 80), ws: c.whiteSpace, rect: [r.x, r.y, r.width, r.height].map(Math.round) } }; return { wrap: q('[data-profile-soul-editor]'), editor: q('[data-profile-soul-editor] .cm-editor'), scroller: q('[data-profile-soul-editor] .cm-scroller'), content: q('[data-profile-soul-editor] .cm-content'), line: q('[data-profile-soul-editor] .cm-line'), active: q('[data-profile-soul-editor] .cm-activeLine'), sel: q('[data-profile-soul-editor] .cm-selectionBackground') } }).catch(e => String(e))
  await page.keyboard.press('Escape').catch(() => {}); await sleep(300)
}
log.themeProbe = await page.evaluate(() => { const h = document.documentElement; const cs = el => { const e = document.querySelector(el); if (!e) return null; const c = getComputedStyle(e); return { bg: c.backgroundColor, img: c.backgroundImage.slice(0, 120) } }; return { attrs: [...h.attributes].map(a => `${a.name}=${a.value}`.slice(0, 80)), chat: cs('[data-chat-surface]'), bounds: cs("[data-slot='composer-bounds']"), sidebar: cs("[data-slot='sidebar-inner']"), ops: cs('[data-ops-root]') } }).catch(e => String(e))
// Glass p3: why do artifact loads fail? Read-only GETs mirroring app/artifacts refreshArtifacts.
if (want('app') || want('artifacts-probe')) {
  log.artifactsProbe = await page.evaluate(async () => {
    const api = window.hermesDesktop.api
    const out = []
    try {
      const list = await api({ path: '/api/profiles/sessions?limit=30&offset=0&min_messages=1&archived=exclude&order=recent&profile=all' })
      for (const s of list.sessions || []) {
        const q = new URLSearchParams({ limit: '50', offset: '0', order: 'oldest', include_compacted: 'true' })
        if (s.profile) q.set('profile', s.profile)
        try { const r = await api({ path: `/api/sessions/${encodeURIComponent(s.id)}/messages?${q}`, profile: s.profile }); out.push({ id: s.id, profile: s.profile, ok: true, n: (r.messages || []).length }) }
        catch (e) { out.push({ id: s.id, profile: s.profile, ok: false, err: String(e && (e.message || e)).slice(0, 300) }) }
      }
    } catch (e) { out.push({ listErr: String(e && (e.message || e)).slice(0, 300) }) }
    return out
  }).catch(e => [{ evalErr: String(e) }])
}
const boardSig = () => page.evaluate(async () => { const b = await window.hermesDesktop.api({ path: '/api/plugins/kanban/board' }); return b.columns.map(c => `${c.name}:${c.tasks.map(t => t.id).sort().join(',')}`).join('|') })
log.boardAfter = await boardSig().catch(e => 'ERR ' + e)
log.boardUnchanged = log.boardBefore === log.boardAfter
save()
await app.close().catch(() => {})
console.log(JSON.stringify({ boardUnchanged: log.boardUnchanged, sections: log.sections, fps: log.fps, bootMs: log.bootMs, console: log.console.length, pageErrors: log.pageErrors.length }, null, 1))
