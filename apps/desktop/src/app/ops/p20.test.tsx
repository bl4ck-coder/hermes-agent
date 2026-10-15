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
