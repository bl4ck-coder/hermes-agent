import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

describe('P20 hard-state fixes', () => {
  it('Board badge reports a failed refresh instead of Live', () => {
    const b = src('./board/board.tsx')
    expect(b).toContain("data-ops-push={props.error ? 'stale' : props.pushMode}")
    expect(b).toContain("T('Connected, board not updated')")
  })
})

describe('P20c Diagnostics', () => {
  it('groups errors per endpoint and puts the next step before the log', async () => {
    const { groupOpsErrors } = await import('./motion/diagnostics')
    const g = groupOpsErrors([
      { at: 1, message: 'a', method: 'GET', path: '/board' },
      { at: 2, message: 'b', method: 'GET', path: '/board' },
      { at: 3, message: 'c', method: 'POST', path: '/x' }
    ])
    expect(g).toEqual([{ count: 2, key: 'GET /board', message: 'b' }, { count: 1, key: 'POST /x', message: 'c' }])
    const d = src('./motion/diagnostics.tsx')
    expect(d.indexOf('data-ops-diag-next')).toBeLessThan(d.indexOf('data-ops-diag-evidence="errors"'))
  })
})
