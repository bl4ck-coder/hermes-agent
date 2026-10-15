import { describe, expect, it } from 'vitest'

import { cronRunStatus } from '../cron/index'
import { sessionDateGroup } from './index'

describe('IA helpers', () => {
  const now = new Date(2026, 9, 14, 16, 0).getTime()
  it('groups sessions by today, this week, then month', () => {
    expect(sessionDateGroup(now / 1000 - 60, 'en', now)).toBe('Today')
    expect(sessionDateGroup(now / 1000 - 3 * 86400, 'en', now)).toBe('This week')
    expect(sessionDateGroup(new Date(2026, 7, 24).getTime() / 1000, 'en', now)).toBe('August 2026')
    expect(sessionDateGroup(now - 60_000, 'es', now)).toBe('Hoy')
  })
  it('reads only known run statuses', () => {
    expect(cronRunStatus('COMPLETED · silent')).toBe('completed')
    expect(cronRunStatus('TODO list')).toBe('')
  })
})
