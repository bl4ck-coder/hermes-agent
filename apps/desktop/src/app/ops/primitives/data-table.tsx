import '../motion.css'

import type { CSSProperties, ReactNode } from 'react'
import { useId, useRef, useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useI18n } from '@/i18n'

import { T } from '../main-i18n'

/** Frozen density contract (SPEC §12.3). One gutter, 32px rows, 12–13px body. */
export const OPS_GUTTER_PX = 24
export const OPS_BODY_PX = 13
export const OPS_ROW_PX = 32
export const OPS_RAIL_ROW_PX = 28
export const DESCRIPTION_PREVIEW = 48

export function opsDensityStyle(): CSSProperties {
  return {
    '--gutter': `${OPS_GUTTER_PX}px`,
    '--ops-body': `${OPS_BODY_PX}px`,
    '--ops-row': `${OPS_ROW_PX}px`,
    '--ops-rail-row': `${OPS_RAIL_ROW_PX}px`,
    fontSize: OPS_BODY_PX,
    paddingInline: OPS_GUTTER_PX
  } as CSSProperties
}

export type SortDirection = 'asc' | 'desc'

export interface DataTableSort {
  columnId: string
  direction: SortDirection
}

export interface DataTableColumn<T> {
  id: string
  header: string
  sortable?: boolean
  /** Tabular numerals. Values that tick use this, not prose. */
  tabular?: boolean
  /** Full description. The cell shows a truncated preview plus a keyboard Show popover. */
  description?: (row: T) => string | null | undefined
  cell?: (row: T) => ReactNode
  sortValue?: (row: T) => string | number | null | undefined
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  caption?: string
  emptyLabel?: string
  sort?: DataTableSort | null
  onSortChange?: (sort: DataTableSort) => void
}

export interface OpsSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface OpsSelectProps {
  label: string
  name?: string
  value: string
  options: OpsSelectOption[]
  onValueChange: (value: string) => void
}

function compareValues(left: string | number | null | undefined, right: string | number | null | undefined) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  return String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true, sensitivity: 'base' })
}

export function sortRows<T>(rows: T[], column: DataTableColumn<T> | undefined, direction: SortDirection) {
  if (!column) {
    return rows
  }

  const copy = [...rows]
  const sign = direction === 'asc' ? 1 : -1

  copy.sort((left, right) => {
    const leftValue = column.sortValue?.(left) ?? column.description?.(left) ?? ''
    const rightValue = column.sortValue?.(right) ?? column.description?.(right) ?? ''

    return sign * compareValues(leftValue, rightValue)
  })

  return copy
}

function nextDirection(current: SortDirection | null, columnId: string, activeId: string | null): SortDirection {
  if (activeId !== columnId || current == null) {
    return 'asc'
  }

  return current === 'asc' ? 'desc' : 'asc'
}

function ariaSort(active: boolean, direction: SortDirection | null): 'ascending' | 'descending' | 'none' {
  if (!active || direction == null) {
    return 'none'
  }

  return direction === 'asc' ? 'ascending' : 'descending'
}

function DescriptionCell({ rowId, text }: { rowId: string; text: string }) {
  const [open, setOpen] = useState(false)
  const descriptionId = `${useId()}-${rowId}`
  const truncated = text.length > DESCRIPTION_PREVIEW
  const preview = truncated ? `${text.slice(0, DESCRIPTION_PREVIEW).trimEnd()}…` : text

  return (
    <span className="ops-description" data-truncated={truncated ? 'true' : 'false'}>
      <span data-description-preview>{preview}</span>
      {truncated && (
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger asChild>
            <button
              aria-controls={descriptionId}
              aria-expanded={open}
              className="ops-description__show"
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setOpen(true)
                }
              }}
              type="button"
            >
              Show
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" id={descriptionId} role="dialog">
            <p data-full-description>{text}</p>
          </PopoverContent>
        </Popover>
      )}
    </span>
  )
}

export function DataTable<T>({
  caption,
  columns,
  emptyLabel,
  getRowId,
  onSortChange,
  rows,
  sort
}: DataTableProps<T>) {
  const copy = useI18n().t.ops
  const [internalSort, setInternalSort] = useState<DataTableSort | null>(null)
  const activeSort = sort === undefined ? internalSort : sort
  const activeColumn = columns.find(column => column.id === activeSort?.columnId)
  const ordered = activeSort ? sortRows(rows, activeColumn, activeSort.direction) : rows

  const commit = (columnId: string, direction: SortDirection) => {
    const next = { columnId, direction }

    if (sort === undefined) {
      setInternalSort(next)
    }

    onSortChange?.(next)
  }

  return (
    <div className="ops-data-table" data-density="frozen" style={opsDensityStyle()}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: OPS_BODY_PX }}>
        <caption className="sr-only">{caption ?? copy.table.caption}</caption>
        <thead>
          <tr style={{ height: OPS_ROW_PX }}>
            {columns.map(column => {
              const active = activeSort?.columnId === column.id
              const direction = active ? activeSort?.direction ?? null : null

              return (
                <th
                  aria-sort={column.sortable ? ariaSort(active, direction) : undefined}
                  key={column.id}
                  scope="col"
                  style={{ height: OPS_ROW_PX, textAlign: 'left', fontWeight: 600 }}
                >
                  {column.sortable ? (
                    <button
                      aria-label={copy.table.sortBy(column.header)}
                      data-sort-column={column.id}
                      onClick={() => commit(column.id, nextDirection(direction, column.id, activeSort?.columnId ?? null))}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          commit(column.id, nextDirection(direction, column.id, activeSort?.columnId ?? null))
                        }

                        if (event.key === 'ArrowUp') {
                          event.preventDefault()
                          commit(column.id, 'asc')
                        }

                        if (event.key === 'ArrowDown') {
                          event.preventDefault()
                          commit(column.id, 'desc')
                        }
                      }}
                      type="button"
                    >
                      {typeof column.header === 'string' ? T(column.header) : column.header}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {ordered.length === 0 ? (
            <tr style={{ height: OPS_ROW_PX }}>
              <td colSpan={Math.max(columns.length, 1)} data-empty="true">
                {emptyLabel ?? copy.table.empty}
              </td>
            </tr>
          ) : (
            ordered.map(row => (
              <tr data-row-id={getRowId(row)} key={getRowId(row)} style={{ height: OPS_ROW_PX }}>
                {columns.map(column => {
                  const description = column.description?.(row)
                  const tabular = column.tabular === true

                  return (
                    <td
                      data-tabular={tabular ? 'true' : 'false'}
                      key={column.id}
                      style={
                        tabular
                          ? { fontVariantNumeric: 'tabular-nums', height: OPS_ROW_PX }
                          : { height: OPS_ROW_PX }
                      }
                    >
                      {description != null && description !== '' ? (
                        <DescriptionCell rowId={`${getRowId(row)}-${column.id}`} text={description} />
                      ) : (
                        <span className={tabular ? 'tabular-nums' : undefined}>{column.cell?.(row) ?? ''}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Clip the native source of truth. The themed trigger is the only painted control. */
export const nativeSourceStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: 0,
  height: 0,
  margin: 0,
  padding: 0,
  border: 0,
  opacity: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  pointerEvents: 'none'
}

/** R41: themed radix Select. The native select is the value source of truth. */
export function OpsSelect({ label, name, onValueChange, options, value }: OpsSelectProps) {
  const labelId = `${useId()}-label`
  const nativeRef = useRef<HTMLSelectElement>(null)

  const commit = (next: string) => {
    if (nativeRef.current && nativeRef.current.value !== next) {
      nativeRef.current.value = next
    }

    onValueChange(next)
  }

  return (
    <div className="ops-select" data-radix="select" style={{ ...opsDensityStyle(), position: 'relative' }}>
      <span id={labelId}>{label}</span>
      <select
        aria-hidden="true"
        className="sr-only"
        data-source-of-truth="native"
        name={name}
        onChange={event => commit(event.target.value)}
        ref={nativeRef}
        style={nativeSourceStyle}
        tabIndex={-1}
        value={value}
      >
        {options.map(option => (
          <option disabled={option.disabled} key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Select onValueChange={commit} value={value}>
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem disabled={option.disabled} key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
