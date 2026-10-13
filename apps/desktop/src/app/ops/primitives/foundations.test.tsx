import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { Box } from '@/lib/icons'
import { stubMenuDomApis } from '@/test/jsdom'

import {
  DESCRIPTION_PREVIEW,
  DataTable,
  OPS_BODY_PX,
  OPS_GUTTER_PX,
  OPS_RAIL_ROW_PX,
  OPS_ROW_PX,
  OpsSelect
} from './data-table'
import { Dock } from './dock'
import { NodeCard, PORT_COLOR } from './node-card'
import { TAB_INDICATOR_COLOR, TabStrip } from './tab-strip'
import {
  PREVIEW_BUDGET,
  PROHIBITED_UNDO_KINDS,
  UNDO_KINDS,
  UNDO_MS,
  ToastQueue,
  approvalPreview,
  approvalPreviewStyle,
  createDismissalStore,
  previewIsCropped,
  type OpsToastItem,
  undoVisible
} from './toast-queue'

afterEach(() => {
  cleanup()
})

interface Row {
  id: string
  name: string
  count: number
  description: string
}

const ROWS: Row[] = [
  { id: 'a', name: 'Bravo', count: 2, description: 'short' },
  {
    id: 'b',
    name: 'Alpha',
    count: 10,
    description: `${'visible '.repeat(8)}HIDDEN-TAIL`
  }
]

function TableHarness() {
  return (
    <DataTable
      columns={[
        { id: 'name', header: 'Name', sortable: true, sortValue: row => row.name, cell: row => row.name },
        { id: 'count', header: 'Count', sortable: true, tabular: true, sortValue: row => row.count, cell: row => row.count },
        { id: 'description', header: 'Description', description: row => row.description }
      ]}
      getRowId={row => row.id}
      rows={ROWS}
    />
  )
}

function TabHarness({ maxVisible = 3 }: { maxVisible?: number }) {
  const tabs = [
    { id: 'office', label: 'Office', pinned: true, icon: Box },
    { id: 'canvas', label: 'Canvas', pinned: true, indicator: 'unsaved' as const, icon: Box },
    { id: 'board', label: 'Board', indicator: 'unread' as const },
    { id: 'one', label: 'Overflow one' },
    { id: 'two', label: 'Overflow two' },
    { id: 'three', label: 'Overflow three', icon: Box, indicator: 'unsaved' as const }
  ]
  const [activeId, setActiveId] = useState('office')
  const [open, setOpen] = useState(tabs)
  const closed = vi.fn()

  return (
    <TabStrip
      activeId={activeId}
      maxVisible={maxVisible}
      onActiveChange={id => {
        setActiveId(id)
      }}
      onClose={id => {
        closed(id)
        setOpen(current => current.filter(tab => tab.id !== id))
      }}
      tabs={open}
    />
  )
}

describe('data table', () => {
  it('sorts from the keyboard and keeps the frozen density contract', () => {
    const { container } = render(<TableHarness />)
    const root = container.querySelector('.ops-data-table') as HTMLElement
    const nameSort = screen.getByRole('button', { name: 'Sort by Name' })

    expect(root.getAttribute('data-density')).toBe('frozen')
    expect(root.style.getPropertyValue('--gutter')).toBe(`${OPS_GUTTER_PX}px`)
    expect(root.style.getPropertyValue('--ops-body')).toBe(`${OPS_BODY_PX}px`)
    expect(root.style.getPropertyValue('--ops-row')).toBe(`${OPS_ROW_PX}px`)
    expect(root.style.getPropertyValue('--ops-rail-row')).toBe(`${OPS_RAIL_ROW_PX}px`)
    expect(OPS_BODY_PX).toBeGreaterThanOrEqual(12)
    expect(OPS_BODY_PX).toBeLessThanOrEqual(13)
    expect((container.querySelector('tr') as HTMLElement).style.height).toBe(`${OPS_ROW_PX}px`)

    fireEvent.keyDown(nameSort, { key: 'Enter' })

    const ids = [...container.querySelectorAll('[data-row-id]')].map(row => row.getAttribute('data-row-id'))
    expect(ids).toEqual(['b', 'a'])
    expect(nameSort.closest('th')?.getAttribute('aria-sort')).toBe('ascending')

    fireEvent.keyDown(nameSort, { key: 'ArrowDown' })
    const descending = [...container.querySelectorAll('[data-row-id]')].map(row => row.getAttribute('data-row-id'))
    expect(descending).toEqual(['a', 'b'])
    expect(nameSort.closest('th')?.getAttribute('aria-sort')).toBe('descending')

    const tabular = container.querySelector('[data-tabular="true"]') as HTMLElement
    expect(tabular.style.fontVariantNumeric).toBe('tabular-nums')
    expect(tabular?.querySelector('.tabular-nums')).toBeTruthy()
  })

  it('opens the full description from the keyboard and does not leak it into the preview', () => {
    render(<TableHarness />)
    const show = screen.getByRole('button', { name: 'Show' })
    const preview = document.querySelector('[data-description-preview]')

    expect(preview?.textContent?.includes('HIDDEN-TAIL')).toBe(false)
    expect((preview?.textContent ?? '').length).toBeLessThanOrEqual(DESCRIPTION_PREVIEW + 1)

    fireEvent.keyDown(show, { key: 'Enter' })

    const full = screen.getByRole('dialog')
    expect(full.textContent).toContain('HIDDEN-TAIL')
    expect(show.getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps the native select as the source of truth for the themed menu', () => {
    const onValueChange = vi.fn()
    const { container, rerender } = render(
      <OpsSelect
        label="Kind"
        name="kind"
        onValueChange={onValueChange}
        options={[
          { value: 'log', label: 'Log' },
          { value: 'events', label: 'Events' }
        ]}
        value="log"
      />
    )
    const native = container.querySelector('[data-source-of-truth="native"]')

    expect(native).toBeInstanceOf(HTMLSelectElement)
    expect((native as HTMLSelectElement).value).toBe('log')

    fireEvent.change(native as HTMLSelectElement, { target: { value: 'events' } })
    expect(onValueChange).toHaveBeenCalledWith('events')

    rerender(
      <OpsSelect
        label="Kind"
        name="kind"
        onValueChange={onValueChange}
        options={[
          { value: 'log', label: 'Log' },
          { value: 'events', label: 'Events' }
        ]}
        value="events"
      />
    )
    expect((container.querySelector('[data-source-of-truth="native"]') as HTMLSelectElement).value).toBe('events')
    expect(container.querySelector('[data-radix="select"]')).toBeTruthy()
    expect(container.querySelectorAll('[role="combobox"]')).toHaveLength(1)
    expect((native as HTMLSelectElement).style.width).toBe('0px')
    expect((native as HTMLSelectElement).style.height).toBe('0px')
    expect((native as HTMLSelectElement).style.clip).toContain('rect')
    expect((native as HTMLSelectElement).classList.contains('sr-only')).toBe(true)
    expect((native as HTMLSelectElement).querySelector('option[value="events"]')).toBeTruthy()
  })

  it('clips the native select so keyboard focus stays on the themed trigger', () => {
    function Harness() {
      const [value, setValue] = useState('log')

      return (
        <OpsSelect
          label="Kind"
          name="kind"
          onValueChange={setValue}
          options={[
            { value: 'log', label: 'Log' },
            { value: 'events', label: 'Events' },
            { value: 'cut', label: 'Cut', disabled: true }
          ]}
          value={value}
        />
      )
    }

    const { container } = render(<Harness />)
    const native = container.querySelector('[data-source-of-truth="native"]') as HTMLSelectElement
    const cut = native.querySelector('option[value="cut"]') as HTMLOptionElement

    expect(container.querySelectorAll('select')).toHaveLength(1)
    expect(container.querySelectorAll('[role="combobox"]')).toHaveLength(1)
    expect(native.style.position).toBe('absolute')
    expect(native.style.height).toBe('0px')
    expect(native.style.opacity).toBe('0')
    expect(cut.disabled).toBe(true)

    const combo = screen.getByRole('combobox')
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    combo.focus()
    expect(document.activeElement).toBe(combo)
    expect(native.tabIndex).toBe(-1)
    expect(native.style.width).toBe('0px')

    fireEvent.keyDown(combo, { key: 'ArrowDown' })
    const events = screen.getByRole('option', { name: 'Events' })
    expect(screen.getByRole('option', { name: 'Cut' }).getAttribute('aria-disabled')).toBe('true')
    events.focus()
    fireEvent.keyDown(events, { key: 'Enter' })

    expect(native.value).toBe('events')
    expect(container.querySelector('[role="combobox"]')?.textContent).toContain('Events')
  })
})

describe('tab strip', () => {
  it('pins, marks caller-supplied indicators, and overflows the rest into the chevron', () => {
    const { container } = render(<TabHarness />)
    const strip = container.querySelector('.ops-tab-strip')

    expect(strip?.getAttribute('data-overflow-count')).toBe('3')
    expect(screen.queryByRole('button', { name: 'Close Office' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Close Board' })).toBeTruthy()
    expect(container.querySelector('[data-kind-icon="true"]')).toBeTruthy()
    expect(container.querySelector('[data-active="true"] [role="tab"]')?.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('[data-indicator="unsaved"]')?.getAttribute('data-indicator-color')).toBe(
      TAB_INDICATOR_COLOR.unsaved
    )
    expect(container.querySelector('[data-indicator="unread"]')?.getAttribute('data-indicator-color')).toBe(
      TAB_INDICATOR_COLOR.unread
    )
    expect(screen.queryByText('Overflow three')).toBeNull()

    fireEvent.keyDown(screen.getByRole('button', { name: /More tabs/ }), { key: 'Enter' })
    expect(screen.getByText('Overflow three')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Overflow three/ }).querySelector('[data-kind-icon="true"]')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Overflow three/ }).querySelector('[data-indicator="unsaved"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close Overflow three' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Close Office' })).toBeNull()
  })

  it('uses a portalled narrow menu that keeps icons, indicators, and close', async () => {
    stubMenuDomApis()
    const original = window.matchMedia

    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes('800'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null
    })) as unknown as typeof window.matchMedia

    try {
      const onClose = vi.fn()
      const onActiveChange = vi.fn()
      const { container } = render(
        <TabStrip
          activeId="board"
          onActiveChange={onActiveChange}
          onClose={onClose}
          tabs={[
            { id: 'office', label: 'Office', pinned: true, icon: Box },
            { id: 'canvas', label: 'Canvas', pinned: true, icon: Box, indicator: 'unsaved' },
            { id: 'board', label: 'Board', icon: Box, indicator: 'unread' }
          ]}
        />
      )
      const strip = container.querySelector('.ops-tab-strip') as HTMLElement

      expect(strip.getAttribute('data-layout')).toBe('narrow')
      expect(container.querySelector('[data-narrow-menu]')).toBeNull()
      expect(container.querySelector('[aria-label="Close Office"]')).toBeNull()
      expect(container.querySelector('[aria-label="Close Canvas"]')).toBeNull()
      expect(container.querySelector('[aria-label="Close Board"]')).toBeTruthy()

      fireEvent.keyDown(strip, { key: 'w', ctrlKey: true })
      expect(onClose).toHaveBeenCalledWith('board')

      const trigger = screen.getByRole('button', { name: /Ops tabs, Board/ })

      trigger.focus()
      fireEvent.keyDown(trigger, { key: 'Enter' })

      const menu = await screen.findByRole('menu')

      expect(strip.contains(menu)).toBe(false)
      expect(menu.querySelector('[data-tour="tab-office"]')).toBeTruthy()
      expect(menu.querySelectorAll('[data-kind-icon="true"]').length).toBeGreaterThan(0)
      expect(menu.querySelector('[data-indicator="unsaved"]')).toBeTruthy()
      expect(menu.querySelector('[data-indicator="unread"]')).toBeTruthy()
      expect(within(menu).queryByRole('button', { name: 'Close Office' })).toBeNull()
      expect(within(menu).queryByRole('button', { name: 'Close Canvas' })).toBeNull()
      expect(within(menu).getByRole('button', { name: 'Close Board' })).toBeTruthy()
      expect(within(menu).getByRole('menuitem', { name: /Board/ }).getAttribute('data-active')).toBe('true')

      fireEvent.keyDown(screen.getByRole('menuitem', { name: /^Office/ }), { key: 'Enter' })
      expect(onActiveChange).toHaveBeenCalledWith('office')
    } finally {
      window.matchMedia = original
    }
  })

  it('navigates and dismisses the narrow menu from the keyboard', async () => {
    stubMenuDomApis()
    const original = window.matchMedia

    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes('800'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null
    })) as unknown as typeof window.matchMedia

    try {
      const onClose = vi.fn()
      const onActiveChange = vi.fn()
      const { container } = render(
        <>
          <button type="button">Outside</button>
          <TabStrip
            activeId="board"
            onActiveChange={onActiveChange}
            onClose={onClose}
            tabs={[
              { id: 'office', label: 'Office', pinned: true, icon: Box },
              { id: 'canvas', label: 'Canvas', pinned: true, icon: Box, indicator: 'unsaved' },
              { id: 'board', label: 'Board', icon: Box, indicator: 'unread' },
              { id: 'other', label: 'Overflow other' }
            ]}
          />
        </>
      )
      const outside = [...container.querySelectorAll('button')].find(button => button.textContent === 'Outside') as HTMLButtonElement
      const trigger = screen.getByRole('button', { name: /Ops tabs, Board/ })

      trigger.focus()
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })

      const office = await screen.findByRole('menuitem', { name: /^Office/ })

      await waitFor(() => {
        expect(document.activeElement).toBe(office)
      })

      fireEvent.keyDown(office, { key: 'ArrowDown' })

      const canvas = screen.getByRole('menuitem', { name: /^Canvas/ })

      await waitFor(() => {
        expect(document.activeElement).toBe(canvas)
      })

      fireEvent.keyDown(canvas, { key: 'Enter' })
      expect(onActiveChange).toHaveBeenCalledWith('canvas')
      expect(onClose).not.toHaveBeenCalled()

      trigger.focus()
      fireEvent.keyDown(trigger, { key: 'Enter' })
      await screen.findByRole('menu')
      fireEvent.keyDown(document.activeElement ?? trigger, { key: 'Escape' })

      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBeNull()
      })
      await waitFor(() => {
        expect(document.activeElement).toBe(trigger)
      })

      fireEvent.keyDown(trigger, { key: 'ArrowDown' })
      await screen.findByRole('menu')
      fireEvent.pointerDown(outside, { button: 0, pointerType: 'mouse' })
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBeNull()
      })

      trigger.focus()
      fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' })
      fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse' })
      await screen.findByRole('menu')
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })
      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /^Office/ }))
      })
      fireEvent.keyDown(document.activeElement ?? trigger, { key: 'Escape' })
      await waitFor(() => {
        expect(document.activeElement).toBe(trigger)
      })

      fireEvent.keyDown(trigger, { key: 'Enter' })
      const menu = await screen.findByRole('menu')
      const closeOther = within(menu).getByRole('button', { name: 'Close Overflow other' })

      expect(within(menu).queryByRole('button', { name: 'Close Office' })).toBeNull()
      expect(within(menu).queryByRole('button', { name: 'Close Canvas' })).toBeNull()
      closeOther.focus()
      fireEvent.keyDown(closeOther, { key: 'Enter' })
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledWith('other')
      expect(onActiveChange).toHaveBeenCalledTimes(1)
    } finally {
      window.matchMedia = original
    }
  })

  it('cycles with Ctrl+Tab and refuses to close a pinned tab', () => {
    const onClose = vi.fn()
    const onActiveChange = vi.fn()
    const { container } = render(
      <TabStrip
        activeId="office"
        onActiveChange={onActiveChange}
        onClose={onClose}
        tabs={[
          { id: 'office', label: 'Office', pinned: true },
          { id: 'board', label: 'Board' }
        ]}
      />
    )
    const strip = container.querySelector('.ops-tab-strip') as HTMLElement

    fireEvent.keyDown(strip, { key: 'w', ctrlKey: true })
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(strip, { key: 'Tab', ctrlKey: true })
    expect(onActiveChange).toHaveBeenCalledWith('board')
  })
})

describe('dock and node card', () => {
  it('exposes Log, Events, and one Problems count that matches the list', () => {
    const problems = [
      { id: 'p1', summary: 'policy' },
      { id: 'p2', summary: 'validation' }
    ]
    const { container, rerender } = render(
      <I18nProvider configClient={null}>
        <Dock logLines={[]} onSlotChange={() => undefined} problems={problems} slot="problems" />
      </I18nProvider>
    )

    expect(screen.getByRole('tab', { name: /Log/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Events/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Problems/ })).toBeTruthy()
    expect(container.querySelectorAll('[data-problems-count]')).toHaveLength(1)
    expect(container.querySelector('[data-problems-count]')?.textContent).toBe('2')
    expect(container.querySelectorAll('[data-slot="problems"] li')).toHaveLength(2)
    expect(screen.queryByRole('tab', { name: /Terminal/ })).toBeNull()
    expect(container.querySelector('[data-terminal]')?.getAttribute('data-terminal')).toBe('cut')
    expect(container.textContent).not.toContain('zsh')

    rerender(
      <I18nProvider configClient={null}>
        <Dock logLines={['line']} onSlotChange={() => undefined} problems={[]} slot="log" />
      </I18nProvider>
    )
    expect(container.querySelector('[data-problems-count]')?.textContent).toBe('0')
  })

  it('collapses, keeps child controls keyboard-reachable, and does not let the overlay block scrolling', () => {
    const onEdit = vi.fn()
    const onChild = vi.fn()
    const onCanvasWheel = vi.fn()
    const { container } = render(
      <div onWheel={onCanvasWheel}>
        <NodeCard
          controls={
            <button onClick={onChild} type="button">
              Child control
            </button>
          }
          onEdit={onEdit}
          port="unset"
          title="Prompt"
        >
          <p>scroll body</p>
        </NodeCard>
      </div>
    )
    const collapse = screen.getByRole('button', { name: 'Prompt' })
    const edit = screen.getByRole('button', { name: 'Edit' })
    const child = screen.getByRole('button', { name: 'Child control' })
    const overlay = container.querySelector('[data-pan-overlay]') as HTMLElement
    const controls = container.querySelector('[data-overlay-intercept="false"]') as HTMLElement
    const scroll = container.querySelector('[data-scroll="internal"]') as HTMLElement

    expect(collapse.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-port]')?.getAttribute('data-port')).toBe('unset')
    expect(container.querySelector('[data-port-color]')?.getAttribute('data-port-color')).toBe(PORT_COLOR.unset)
    expect(container.querySelector('[data-edge]')?.getAttribute('data-edge')).toBe('dashed')
    expect(edit.tabIndex).toBe(0)
    expect(child.tabIndex).toBe(0)
    expect(edit.style.opacity).toBe('0')
    expect(child.style.opacity).not.toBe('0')
    expect(edit.getAttribute('data-revealed')).toBe('false')

    fireEvent.mouseEnter(container.querySelector('.ops-node') as HTMLElement)
    expect(edit.style.opacity).toBe('1')
    expect(edit.getAttribute('data-revealed')).toBe('true')
    edit.focus()
    fireEvent.mouseLeave(container.querySelector('.ops-node') as HTMLElement)
    expect(edit.style.opacity).toBe('1')
    edit.blur()
    fireEvent.mouseLeave(container.querySelector('.ops-node') as HTMLElement)
    expect(edit.style.opacity).toBe('0')
    expect(overlay.style.pointerEvents).toBe('none')
    expect(Number(controls.style.zIndex)).toBeGreaterThan(Number(overlay.style.zIndex))
    expect(scroll.style.overflow).toBe('auto')

    fireEvent.wheel(scroll)
    expect(onCanvasWheel).not.toHaveBeenCalled()

    fireEvent.keyDown(edit, { key: 'Enter' })
    expect(onEdit).toHaveBeenCalledOnce()
    fireEvent.keyDown(child, { key: 'Enter' })
    child.click()
    expect(onChild).toHaveBeenCalled()

    fireEvent.keyDown(collapse, { key: 'Enter' })
    expect(collapse.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(container.querySelector('[data-scroll="internal"]')).toBeNull()
  })
})

describe('toast queue', () => {
  const now = 10_000

  function item(partial: Partial<OpsToastItem> & Pick<OpsToastItem, 'id' | 'kind'>): OpsToastItem {
    return {
      createdAt: now,
      message: partial.kind,
      ...partial
    }
  }

  it('shows one per kind plus the remainder, and never moves focus', () => {
    const before = document.activeElement
    const onNeedsYou = vi.fn()
    render(
      <ToastQueue
        items={[
          item({ id: 'a1', kind: 'approval', command: 'ls', args: '-l' }),
          item({ id: 'a2', kind: 'approval', command: 'pwd' }),
          item({ id: 'b1', kind: 'blocked' })
        ]}
        now={now}
        onNeedsYou={onNeedsYou}
      />
    )

    expect(document.querySelectorAll('[data-kind="approval"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-kind="blocked"]')).toHaveLength(1)
    expect(document.querySelector('[data-toast-id="a2"]')).toBeTruthy()
    expect(document.activeElement).toBe(before)
    expect(document.querySelector('[autofocus]')).toBeNull()
    expect(document.querySelector('.ops-toast-queue')?.getAttribute('data-steals-focus')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: '+1 more → Needs-you' }))
    expect(onNeedsYou).toHaveBeenCalledOnce()
  })

  it('offers Undo only for move, archive, and reassign, and drops it at eight seconds', () => {
    const onUndo = vi.fn()
    const move = item({ id: 'm', kind: 'move', onUndo })
    const { rerender } = render(<ToastQueue items={[move]} now={now} />)

    expect(undoVisible(move, now)).toBe(true)
    expect(undoVisible(move, now + UNDO_MS)).toBe(true)
    expect(undoVisible(move, now + UNDO_MS + 1)).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalledOnce()

    rerender(<ToastQueue items={[move]} now={now + UNDO_MS + 1} />)
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()

    for (const kind of UNDO_KINDS) {
      expect(undoVisible(item({ id: kind, kind, onUndo }), now + UNDO_MS)).toBe(true)
    }

    for (const kind of PROHIBITED_UNDO_KINDS) {
      rerender(<ToastQueue items={[item({ id: kind, kind, onUndo })]} now={now} />)
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    }
  })

  it('never approves hidden content, and a blocked toast only opens', () => {
    const hidden = 'HIDDEN-TAIL'
    const command = `${'x'.repeat(PREVIEW_BUDGET)} ${hidden}`
    const onApprove = vi.fn()
    const onReview = vi.fn()
    const { rerender } = render(
      <ToastQueue
        items={[item({ id: 'cut', kind: 'approval', command, onApprove, onReview, onUndo: vi.fn() })]}
        now={now}
      />
    )

    expect(approvalPreview({ command }).action).toBe('review')
    expect(screen.getByRole('button', { name: 'Review' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    expect(document.body.textContent).not.toContain(hidden)
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    expect(onReview).toHaveBeenCalledOnce()
    expect(onApprove).not.toHaveBeenCalled()

    rerender(
      <ToastQueue
        items={[item({ id: 'fit', kind: 'approval', command: 'pwd', args: '-P', onApprove, onReview })]}
        now={now}
      />
    )
    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull()
    expect(document.body.textContent).toContain('pwd -P')

    const onOpen = vi.fn()
    rerender(<ToastQueue items={[item({ id: 'block', kind: 'blocked', onOpen, onUndo: vi.fn() })]} now={now} />)
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Unblock' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('does not approve a short command that is geometrically cropped', () => {
    const command = 'W'.repeat(60)
    const mixed = 'go\n📦'
    const onApprove = vi.fn()
    const onReview = vi.fn()
    const original = HTMLElement.prototype.getBoundingClientRect
    const rect = (left: number, top: number, right: number, bottom: number) =>
      ({
        x: left,
        y: top,
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
        toJSON() {
          return {}
        }
      }) as DOMRect

    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.getAttribute('data-approval-preview')) {
        return rect(161, 0, 946, 19)
      }

      if (this.getAttribute('data-toast-id')) {
        return rect(24, 0, 616, 80)
      }

      return original.call(this)
    }

    try {
      const { container, rerender } = render(
        <ToastQueue
          items={[item({ id: 'wide', kind: 'approval', command, onApprove, onReview })]}
          now={now}
        />
      )
      const preview = container.querySelector('[data-approval-preview]') as HTMLElement
      const card = container.querySelector('[data-toast-id]') as HTMLElement

      expect(command.length).toBeLessThanOrEqual(PREVIEW_BUDGET)
      expect(previewIsCropped(preview, card)).toBe(true)
      expect(preview.style.whiteSpace).toBe(approvalPreviewStyle.whiteSpace)
      expect(preview.style.overflowWrap).toBe(approvalPreviewStyle.overflowWrap)
      expect(preview.textContent).toBe(command)
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Review' }))
      expect(onApprove).not.toHaveBeenCalled()
      expect(onReview).toHaveBeenCalledOnce()

      rerender(
        <ToastQueue
          items={[item({ id: 'mixed', kind: 'approval', command: mixed, onApprove, onReview })]}
          now={now}
        />
      )
      const mixedPreview = container.querySelector('[data-approval-preview]') as HTMLElement
      expect(mixedPreview.textContent).toContain('\n')
      expect(mixedPreview.textContent).toContain('📦')
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original
    }
  })

  it('stores dismissal per item id and makes no mutation call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const store = createDismissalStore()
    const items = [item({ id: 'keep', kind: 'stop' }), item({ id: 'drop', kind: 'blocked' })]
    const { rerender } = render(<ToastQueue dismissals={store} items={items} now={now} />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss blocked' }))
    expect(store.has('drop')).toBe(true)
    expect(document.querySelector('[data-toast-id="drop"]')).toBeNull()

    rerender(<ToastQueue dismissals={store} items={items} now={now} />)
    expect(document.querySelector('[data-toast-id="drop"]')).toBeNull()
    expect(document.querySelector('[data-toast-id="keep"]')).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
