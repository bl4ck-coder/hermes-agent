import { describe, expect, it } from 'vitest'

import { groupIdenticalRuns } from './index'

describe('groupIdenticalRuns', () => {
  it('folds only consecutive runs with the same label', () => {
    const runs = ['ok', 'ok', 'ok', 'failed', 'ok'].map((t, i) => ({ id: String(i), t }))
    const groups = groupIdenticalRuns(runs, r => r.t)

    expect(groups.map(g => g.map(r => r.id))).toEqual([['0', '1', '2'], ['3'], ['4']])
  })
})