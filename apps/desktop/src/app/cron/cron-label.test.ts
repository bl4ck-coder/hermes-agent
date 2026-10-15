import { describe, expect, it } from 'vitest'

import { cronRunLabel } from './index'

describe('cronRunLabel', () => {
  it('keeps the outcome of a markdown script-run preview', () => {
    expect(
      cronRunLabel(
        'COMPLETED - # Cron Job: capa3-h3-sync **Job ID:** e6ee **Run Time:** 2026-10-14 **Mode:** no_agent (script) **Status:** silent (empty output)'
      )
    ).toBe('COMPLETED · silent (empty output)')
  })
  it('passes plain titles through untouched', () => {
    expect(cronRunLabel('Morning briefing')).toBe('Morning briefing')
  })
})
