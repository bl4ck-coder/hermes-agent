import { describe, expect, it } from 'vitest'

import { isSlotWaitTimeout } from './index'

describe('isSlotWaitTimeout', () => {
  it('spots the transient local-backend slot timeout only', () => {
    expect(isSlotWaitTimeout(new Error('LocalBackendSlotWaitTimeoutError: Local backend start for "sandhi" timed out while waiting for a free slot.'))).toBe(true)
    expect(isSlotWaitTimeout(new Error('Session transcript page exceeds the Desktop safe-load limit'))).toBe(false)
  })
})
