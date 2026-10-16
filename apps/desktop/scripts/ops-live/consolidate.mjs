// P27 (judge pass 21 #1, lines 39-47, 147-149): consolidate the evidence of several hard.mjs runs into ONE signed package.
//
//   node scripts/ops-live/consolidate.mjs <out-dir> <run-dir> [<run-dir> ...]
//
// For each matrix (state-matrix.json, selftest-matrix.json) the rows of every run dir are merged in the order given:
// a later row replaces an earlier one with the same screen+state (a re-run). Each kept row keeps its own signature
// (run / build / at) and is tagged with the dir it came from. The screenshots each kept row names are copied from that
// row's own run dir, so no shot of a replaced row survives. Then <out-dir> gets:
//   state-matrix.json / selftest-matrix.json  consolidated matrices (headers say consolidated, list the runs, count ok/total)
//   manifest.json                             every run (id, build, at, dir, rows contributed), every replaced row
//                                             (which run's row replaced which), the final ok/total per matrix, missing shots
//   run-summary.json                          the same verdict in the shape hard.mjs writes, so no stale summary remains
// Exit code: 0 only when every consolidated row of every matrix is ok and every referenced shot was copied; 3 otherwise
// (2 on bad arguments). Nothing in the run dirs is modified.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [outArg, ...runArgs] = process.argv.slice(2)
if (!outArg || !runArgs.length) {
  console.error('usage: node consolidate.mjs <out-dir> <run-dir> [<run-dir> ...]')
  process.exit(2)
}
const OUT = resolve(outArg)
const RUNS = runArgs.map(d => resolve(d))
for (const d of RUNS) if (!existsSync(d)) { console.error(`run dir not found: ${d}`); process.exit(2) }
mkdirSync(OUT, { recursive: true })

const MATRICES = ['state-matrix.json', 'selftest-matrix.json']
const readJson = f => { try { return JSON.parse(readFileSync(f, 'utf8')) } catch (e) { return { __error: String(e?.message ?? e) } } }
const key = r => `${r.screen}::${r.state}`

const runs = []
const merged = Object.fromEntries(MATRICES.map(m => [m, new Map()]))
const replaced = []
const problems = []

for (const [i, dir] of RUNS.entries()) {
  const entry = { order: i + 1, dir, matrices: {} }
  for (const m of MATRICES) {
    const file = join(dir, m)
    if (!existsSync(file)) continue
    const data = readJson(file)
    if (data.__error || !Array.isArray(data.matrix)) { problems.push(`${file}: unreadable (${data.__error ?? 'no matrix array'})`); continue }
    if (data.running) problems.push(`${file}: written by a run that had not finished (running=true)`)
    entry.id = entry.id ?? data.run ?? null
    entry.build = entry.build ?? data.build ?? null
    entry.at = entry.at ?? data.generatedAt ?? null
    entry.tag = entry.tag ?? data.tag ?? null
    entry.matrices[m] = { ok: data.matrix.filter(r => r.ok).length, total: data.matrix.length, rows: data.matrix.map(key) }
    const map = merged[m]
    for (const row of data.matrix) {
      const k = key(row)
      const prev = map.get(k)
      if (prev) replaced.push({ matrix: m, screen: row.screen, state: row.state, old: { run: prev.row.run ?? null, at: prev.row.at ?? null, ok: prev.row.ok, dir: prev.dir }, new: { run: row.run ?? null, at: row.at ?? null, ok: row.ok, dir } })
      map.set(k, { row, dir })
    }
  }
  if (!Object.keys(entry.matrices).length) problems.push(`${dir}: no state-matrix.json or selftest-matrix.json`)
  runs.push(entry)
}

// Copy the shots of the kept rows from their own run dirs.
const missingShots = []
let copied = 0
for (const m of MATRICES) {
  for (const { row, dir } of merged[m].values()) {
    for (const s of new Set([...(row.shots ?? []), ...(row.shot ? [row.shot] : [])])) {
      const from = join(dir, s), to = join(OUT, s)
      if (!existsSync(from)) { missingShots.push(`${m} ${key(row)}: ${s} not in ${dir}`); continue }
      if (resolve(from) !== resolve(to)) copyFileSync(from, to)
      copied++
    }
  }
}

const generatedAt = new Date().toISOString()
const runList = runs.map(r => ({ order: r.order, id: r.id ?? null, build: r.build ?? null, at: r.at ?? null, tag: r.tag ?? null, dir: r.dir, matrices: Object.fromEntries(Object.entries(r.matrices).map(([k, v]) => [k, { ok: v.ok, total: v.total }])) }))
const summary = {}
for (const m of MATRICES) {
  const rows = [...merged[m].values()].map(({ row, dir }) => ({ ...row, sourceDir: dir }))
  if (!rows.length) continue
  const ok = rows.filter(r => r.ok).length
  const contributing = [...new Set(rows.map(r => r.run ?? null))]
  writeFileSync(join(OUT, m), JSON.stringify({
    mode: m.startsWith('selftest') ? 'selftest' : 'states', consolidated: true, generatedAt,
    runs: runList.filter(r => r.matrices[m]).map(r => ({ id: r.id, build: r.build, at: r.at, dir: r.dir })),
    contributingRuns: contributing, replacedRows: replaced.filter(x => x.matrix === m).length,
    ok, total: rows.length, matrix: rows
  }, null, 2))
  summary[m] = { ok, total: rows.length, failed: rows.filter(r => !r.ok).map(r => `${r.screen}-${r.state}: ${r.note ?? ''}`.slice(0, 300)) }
}
const builds = [...new Set(runList.map(r => (r.build && typeof r.build === 'object' ? r.build.commit : r.build) ?? null))]
const allOk = Object.keys(summary).length > 0 && Object.values(summary).every(s => s.total > 0 && s.ok === s.total)
const exit = allOk && !missingShots.length && !problems.length ? 0 : 3
const manifest = {
  kind: 'ops-hard consolidated evidence', generatedAt, out: OUT,
  runs: runList, builds, sameBuild: builds.length === 1,
  replaced, missingShots, problems, shotsCopied: copied,
  final: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { ok: v.ok, total: v.total }])),
  exit
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
writeFileSync(join(OUT, 'run-summary.json'), JSON.stringify({ consolidated: true, generatedAt, runs: runList.map(r => ({ id: r.id, build: r.build, at: r.at })), replacedRows: replaced.length, exit, ...summary, ...(missingShots.length ? { missingShots } : {}), ...(problems.length ? { problems } : {}) }, null, 2))

console.log(`consolidated ${runs.length} run(s) into ${OUT}: ${replaced.length} row(s) replaced, ${copied} shot(s) copied${builds.length > 1 ? `, builds ${builds.join(', ')}` : ''}`)
for (const r of runList) console.log(`  run ${r.order}: ${r.id} build=${(r.build && typeof r.build === 'object' ? r.build.commit : r.build) ?? '?'} at=${r.at} ${Object.entries(r.matrices).map(([k, v]) => `${k} ${v.ok}/${v.total}`).join(', ')}`)
for (const x of replaced) console.log(`  replaced ${x.matrix} ${x.screen}-${x.state}: ${x.old.run} (ok=${x.old.ok}) -> ${x.new.run} (ok=${x.new.ok})`)
for (const [k, v] of Object.entries(summary)) { console.log(`${k}: ${v.ok}/${v.total}`); for (const f of v.failed) console.log(`  FAIL ${f}`) }
for (const m of missingShots) console.log(`  MISSING SHOT ${m}`)
for (const p of problems) console.log(`  PROBLEM ${p}`)
console.log(`exit ${exit}`)
process.exit(exit)
