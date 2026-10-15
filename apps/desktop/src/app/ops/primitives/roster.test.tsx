import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '@/i18n'

import { DataTable } from './data-table'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const harness = () =>
  render(
    <I18nProvider>
      <DataTable
        columns={[
          { id: 'name', header: 'Name', cell: (row: { id: string; n: number }) => row.id },
          { id: 'n', header: 'Count', tabular: true, cell: row => row.n }
        ]}
        getRowId={row => row.id}
        rows={[{ id: 'alpha', n: 3 }]}
        viewToggleId="test"
      />
    </I18nProvider>
  )

describe('B33 roster view', () => {
  it('switches to cards, keeps every field, and remembers the choice', () => {
    harness()
    expect(document.querySelector('table')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }))
    expect(document.querySelector('table')).toBeNull()
    expect(document.querySelector('[data-ops-roster] [data-row-id="alpha"]')?.textContent).toContain('3')
    expect(localStorage.getItem('ops-view:test')).toBe('cards')
    cleanup()
    harness()
    expect(document.querySelector('[data-ops-roster]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(document.querySelector('table')).not.toBeNull()
  })
})