import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { deleteProfile } from '@/hermes'
import { retireLocalProfileGateways } from '@/store/gateway'
import { dropTilesForProfile } from '@/store/session-states'

import { DeleteProfileDialog } from './delete-profile-dialog'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  localStorage.clear()
})

vi.mock('@/hermes', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()

  return {
    ...actual,
    deleteProfile: vi.fn(async () => undefined)
  }
})

vi.mock('@/store/gateway', () => ({
  retireLocalProfileGateways: vi.fn()
}))

vi.mock('@/store/session-states', () => ({
  dropTilesForProfile: vi.fn()
}))

it('drops the scoped ops split key when a profile is deleted', async () => {
  const { resizeOpsSplit, readOpsLayout, OPS_DEFAULT_WIDTH_PX, OPS_SPLIT_STORAGE_KEY } = await import('@/app/ops/layout-store')

  resizeOpsSplit(510, 1600, { connectionId: 'local', profile: 'selena', remote: false, label: 'local' })
  resizeOpsSplit(420, 1600, { connectionId: 'remote-1', profile: 'selena', remote: true, label: 'bench' })

  render(
    <DeleteProfileDialog
      onClose={vi.fn()}
      open
      profile={{ name: 'selena', path: '/tmp/selena' }}
    />
  )

  fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

  await waitFor(() => expect(dropTilesForProfile).toHaveBeenCalledWith('selena'))
  expect(deleteProfile).toHaveBeenCalledWith('selena')
  expect(retireLocalProfileGateways).toHaveBeenCalledWith('selena')
  expect(readOpsLayout('local', 'selena').widthPx).toBe(OPS_DEFAULT_WIDTH_PX)
  expect(readOpsLayout('remote-1', 'selena').widthPx).toBe(OPS_DEFAULT_WIDTH_PX)
  expect(localStorage.getItem(OPS_SPLIT_STORAGE_KEY)).not.toContain('selena')
})
