import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { type CanvasData, CanvasView, stepZoom } from './canvas'

afterEach(() => cleanup())

const data = (o: Partial<CanvasData> = {}): CanvasData => ({ model: null, policy: null, prompt: null, cron: null, delegation: null, ...o })

describe('canvas extras (P6 F6)', () => {
  it('skills and schedule nodes show real data or unknown', () => {
    render(
      <CanvasView
        data={data({ skills: 4, cron: [{ id: 'a', next_run_at: '2026-10-14T03:00:00Z' }, { id: 'b', failure_streak: 2 }] })}
        profile="p"
      />
    )
    expect(document.querySelector('[data-ops-node="skills"]')?.textContent).toContain('4 skills installed')
    const sched = document.querySelector('[data-ops-node="schedule"]')
    expect(sched?.textContent).toContain('2 cron jobs, next 2026-10-14T03:00:00.000Z, 1 failing')
    expect(sched?.getAttribute('data-ops-port')).toBe('policy')
  })

  it('skills unknown when not loaded', () => {
    render(<CanvasView data={data()} profile="p" />)
    expect(document.querySelector('[data-ops-node="skills"] [data-ops-node-body]')?.textContent).toBe('unknown')
  })

  it('collapse per node and all; zoom in/out/fit', () => {
    render(<CanvasView data={data()} profile="p" />)
    fireEvent.click(screen.getByLabelText('Collapse model'))
    expect(document.querySelector('[data-ops-node="model"]')?.hasAttribute('data-ops-collapsed')).toBe(true)
    expect(document.querySelector('[data-ops-node="model"] [data-ops-node-body]')).toBeNull()
    fireEvent.click(screen.getByLabelText('Collapse all'))
    expect(document.querySelectorAll('[data-ops-collapsed]').length).toBe(9)
    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(document.querySelector('[data-ops-canvas-zoom]')?.getAttribute('data-ops-canvas-zoom')).toBe('1.25')
    fireEvent.click(screen.getByLabelText('Fit'))
    fireEvent.click(screen.getByLabelText('Zoom out'))
    expect(document.querySelector('[data-ops-canvas-zoom]')?.getAttribute('data-ops-canvas-zoom')).toBe('0.75')
    expect(stepZoom(0.5, -1)).toBe(0.5)
    expect(stepZoom(1.5, 1)).toBe(1.5)
  })
})
