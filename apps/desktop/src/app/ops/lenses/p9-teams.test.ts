import { describe, expect, it } from 'vitest'

import type { BoardTask } from '../office/control-room'

import { teams } from './b4-model'

describe('P9 Teams focus status is per task', () => {
  it('two tasks with the same title keep their own blocked state', () => {
    const tasks = [
      { id: 't_a', title: 'Deploy', status: 'blocked', tenant: 'ops', assignee: 'x' },
      { id: 't_b', title: 'Deploy', status: 'running', tenant: 'ops', assignee: 'x' }
    ] as unknown as BoardTask[]
    const lane = teams(tasks).find(t => t.lane === 'ops')!
    expect(lane.focus.map(f => [f.id, f.blocked])).toEqual([
      ['t_a', true],
      ['t_b', false]
    ])
  })
})
