import { describe, expect, it } from 'vitest'

import { linkifyTaskIds, opsTaskHref, opsTaskIdFromHref, remarkOpsTaskLinks } from './ops-task-links'

describe('O67 task-id links in the chat transcript', () => {
  it('splits text around task ids', () => {
    const parts = linkifyTaskIds('see t_ab12cd34 and t_00ff11 now')!

    expect(parts.map(p => p.type)).toEqual(['text', 'link', 'text', 'link', 'text'])
    expect(parts[1].url).toBe('#/ops/task/t_ab12cd34')
    expect(linkifyTaskIds('no ids, t_xyz, at_abcdef12')).toBeNull()
  })

  it('round-trips the href and rejects anything else', () => {
    expect(opsTaskIdFromHref(opsTaskHref('t_abcdef12'))).toBe('t_abcdef12')
    expect(opsTaskIdFromHref('https://x/#/ops/task/t_abcdef12')).toBeNull()
    expect(opsTaskIdFromHref(undefined)).toBeNull()
  })

  it('never rewrites code or existing links', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: 'task t_abcdef12' }, { type: 'inlineCode', value: 't_abcdef12' }] },
        { type: 'code', value: 't_abcdef12' },
        { type: 'paragraph', children: [{ type: 'link', url: 'https://x', children: [{ type: 'text', value: 't_abcdef12' }] }] }
      ]
    }

    remarkOpsTaskLinks()(tree as never)
    const p0 = tree.children[0].children!

    expect(p0.map(n => n.type)).toEqual(['text', 'link', 'inlineCode'])
    expect((tree.children[2].children![0] as { children?: unknown }).children).toEqual([{ type: 'text', value: 't_abcdef12' }])
  })
})
