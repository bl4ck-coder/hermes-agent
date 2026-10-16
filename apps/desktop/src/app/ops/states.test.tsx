import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { en } from '@/i18n/en'

import { OpsNodeState } from './node-state'
import {
  clampOpsRetries,
  classifyOpsFailure,
  OPS_RETRY_CEILING,
  OpsSectionState,
  type OpsStateKind,
  resolveOpsState,
  useOpsBoundedRetry,
  useOpsWritesEnabled
} from './section-state'

const copy = en.opsStates

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const section = (id: string) => document.querySelector(`[data-ops-state-id="${id}"]`) as HTMLElement

describe('W10 state resolution', () => {
  it('classifies 401/403 as auth, explicit capability/501 as capability, everything else as transient', () => {
    expect(classifyOpsFailure({ status: 401 })).toBe('auth')
    expect(classifyOpsFailure({ response: { status: 403 } })).toBe('auth')
    expect(classifyOpsFailure({ capability: 'fleet.watch' })).toBe('capability')
    expect(classifyOpsFailure({ code: 'capability_missing' })).toBe('capability')
    expect(classifyOpsFailure({ status: 501 })).toBe('capability')
    expect(classifyOpsFailure({ status: 500 })).toBe('transient')
    expect(classifyOpsFailure({ status: 404 })).toBe('transient')
    expect(classifyOpsFailure(new Error('socket closed'))).toBe('transient')
  })

  it('bounds retries and keeps a snapshot through background refreshes', () => {
    const net = { status: 503 }
    expect(resolveOpsState({ loading: true })).toBe('loading')
    expect(resolveOpsState({ loading: true, hasSnapshot: true })).toBe('ready')
    expect(resolveOpsState({ empty: true })).toBe('empty')
    expect(resolveOpsState({ stale: true, hasSnapshot: true })).toBe('stale')
    expect(resolveOpsState({ stale: true })).toBe('ready')
    expect(resolveOpsState({ error: net, attempt: 1 })).toBe('reconnecting')
    expect(resolveOpsState({ error: net, attempt: 3 })).toBe('exhausted')
    expect(resolveOpsState({ error: net, attempt: 2, maxRetries: 2 })).toBe('exhausted')
    expect(resolveOpsState({ error: net, attempt: 6, maxRetries: 99 })).toBe('exhausted')
    expect(resolveOpsState({ error: { status: 401 }, attempt: 0 })).toBe('auth')
    expect(resolveOpsState({ error: { capability: 'x' }, attempt: 9 })).toBe('capability')
    expect(clampOpsRetries(1000)).toBe(OPS_RETRY_CEILING)
    expect(clampOpsRetries(0)).toBe(1)
    expect(clampOpsRetries(Number.NaN)).toBe(3)
  })

  it('useOpsBoundedRetry stops calling the source after the limit until reset', () => {
    const run = vi.fn()
    const { result } = renderHook(() => useOpsBoundedRetry(run, 2))

    act(() => {
      result.current.retry()
      result.current.retry()
    })
    let extra = true
    act(() => {
      extra = result.current.retry()
    })
    expect(extra).toBe(false)
    expect(run).toHaveBeenCalledTimes(2)
    expect(result.current.exhausted).toBe(true)
    act(() => result.current.reset())
    expect(result.current.attempt).toBe(0)
    expect(run).toHaveBeenCalledTimes(3)
  })
})

const KINDS: Exclude<OpsStateKind, 'ready'>[] = ['empty', 'loading', 'reconnecting', 'stale', 'exhausted', 'auth', 'capability']

describe('W10 section and node wrappers', () => {
  it.each(['section', 'node'] as const)('%s renders every state with its own copy, metadata and recovery', variant => {
    const Wrapper = variant === 'section' ? OpsSectionState : OpsNodeState
    const handlers = { onRetry: vi.fn(), onReset: vi.fn(), onReauth: vi.fn(), onCapabilityHelp: vi.fn() }
    const titles = new Set<string>()
    const explanations = new Set<string>()

    for (const kind of KINDS) {
      const { unmount } = render(
        <Wrapper
          {...handlers}
          attempt={2}
          capability="fleet.watch"
          hasSnapshot={kind === 'stale'}
          id={kind}
          label={`view ${kind}`}
          source="GET /api/status"
          state={kind}
          updatedAt={Date.UTC(2026, 9, 13, 12, 0)}
        >
          <p>snapshot</p>
        </Wrapper>
      )

      const root = section(kind)
      expect(root.getAttribute(variant === 'section' ? 'data-ops-section-state' : 'data-ops-node-state')).toBe(kind)
      const notice = within(root).getByRole('status')
      expect(within(notice).getByText(copy[kind].title)).toBeTruthy()
      expect(within(notice).getByText(copy[kind].explanation)).toBeTruthy()
      const meta = notice.querySelector('[data-ops-state-meta]')?.textContent ?? ''
      expect(meta).toContain(copy.source('GET /api/status'))
      expect(meta).toContain('Updated ')
      expect(meta).toContain(copy.writesDisabled)
      const action = within(notice).getByRole('button', { name: copy[kind].action }) as HTMLButtonElement
      expect(action.disabled).toBe(false)
      fireEvent.click(action)
      titles.add(copy[kind].title)
      explanations.add(copy[kind].explanation)

      if (kind === 'loading') {
        const shimmer = root.querySelector('[data-ops-shimmer="gold-night"]')
        expect(shimmer?.querySelector('.shimmer-bg')).toBeTruthy()
        expect(root.getAttribute('aria-busy')).toBe('true')
      }

      if (kind === 'stale') {
        expect(within(root).getByText('snapshot')).toBeTruthy()
      }

      if (kind === 'capability') {
        expect(meta).toContain(copy.capabilityName('fleet.watch'))
      }

      if (kind === 'exhausted') {
        expect(meta).toContain(copy.attempt(2, 3))
      }

      unmount()
    }

    expect(titles.size).toBe(KINDS.length)
    expect(explanations.size).toBe(KINDS.length)
    expect(handlers.onReauth).toHaveBeenCalledTimes(1)
    expect(handlers.onCapabilityHelp).toHaveBeenCalledTimes(1)
    expect(handlers.onReset).toHaveBeenCalledTimes(1)
    expect(handlers.onRetry).toHaveBeenCalledTimes(4)
  })

  it('auth, capability and exhausted copy are distinct from each other and from transient reconnecting', () => {
    const picks = ['auth', 'capability', 'exhausted', 'reconnecting'] as const
    expect(new Set(picks.map(kind => copy[kind].title)).size).toBe(4)
    expect(new Set(picks.map(kind => copy[kind].action)).size).toBe(4)
  })

  it('renders only locale copy: no visible text outside the registered opsStates keys', () => {
    render(<OpsSectionState error={{ status: 403 }} id="a" label="A" source="s" />)
    const notice = within(section('a')).getByRole('status')
    const allowed = new Set([copy.auth.title, copy.auth.explanation, copy.auth.action])

    for (const node of notice.querySelectorAll('p, button')) {
      if (node.hasAttribute('data-ops-state-meta')) {
        expect(node.textContent).toBe([copy.source('s'), copy.neverUpdated, copy.writesDisabled].join(' · '))
      } else {
        expect(allowed.has(node.textContent ?? '')).toBe(true)
      }
    }
  })

  it('keeps the same snapshot DOM, focus and scroll when a section goes stale or reconnecting', () => {
    const view = (props: { stale?: boolean; error?: unknown; attempt?: number }) => (
      <OpsSectionState hasSnapshot id="s" label="S" source="GET /api/x" {...props}>
        <div data-testid="scroller" style={{ overflow: 'auto', height: 20 }}>
          <input aria-label="filter" />
        </div>
      </OpsSectionState>
    )

    const { rerender } = render(view({}))
    const input = screen.getByLabelText('filter') as HTMLInputElement
    const scroller = screen.getByTestId('scroller')
    input.focus()
    fireEvent.change(input, { target: { value: 'gold' } })
    scroller.scrollTop = 40
    rerender(view({ stale: true }))
    expect(section('s').getAttribute('data-ops-section-state')).toBe('stale')
    rerender(view({ error: { status: 503 }, attempt: 1 }))
    expect(section('s').getAttribute('data-ops-section-state')).toBe('reconnecting')
    expect(screen.getByLabelText('filter')).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('gold')
    expect(screen.getByTestId('scroller')).toBe(scroller)
    expect(scroller.scrollTop).toBe(40)
  })

  it('fault injection: two sibling sections and two sibling nodes fail; siblings, focus, scroll and chat survive', () => {
    let chatMounts = 0

    function Chat() {
      useEffect(() => {
        chatMounts += 1
      }, [])

      return <textarea aria-label="chat composer" />
    }

    function Page({ faults }: { faults: boolean }) {
      return (
        <div>
          <Chat />
          <OpsSectionState error={faults ? { status: 401 } : undefined} hasSnapshot id="sec-a" label="A">
            <p>A data</p>
          </OpsSectionState>
          <OpsSectionState
            attempt={faults ? 3 : 0}
            error={faults ? { status: 502 } : undefined}
            hasSnapshot
            id="sec-b"
            label="B"
          >
            <p>B data</p>
          </OpsSectionState>
          <OpsSectionState hasSnapshot id="sec-c" label="C">
            <div data-testid="c-scroll" style={{ overflow: 'auto', height: 20 }}>
              <input aria-label="c input" />
            </div>
            <OpsNodeState error={faults ? { capability: 'node.query' } : undefined} hasSnapshot id="node-1" label="N1">
              <p>N1 data</p>
            </OpsNodeState>
            <OpsNodeState attempt={1} error={faults ? { status: 500 } : undefined} hasSnapshot id="node-2" label="N2">
              <p>N2 data</p>
            </OpsNodeState>
            <OpsNodeState hasSnapshot id="node-3" label="N3">
              <p>N3 data</p>
            </OpsNodeState>
          </OpsSectionState>
        </div>
      )
    }

    const { rerender } = render(<Page faults={false} />)
    const cInput = screen.getByLabelText('c input') as HTMLInputElement
    const scroller = screen.getByTestId('c-scroll')
    const chat = screen.getByLabelText('chat composer')
    cInput.focus()
    scroller.scrollTop = 33

    rerender(<Page faults />)

    expect(section('sec-a').getAttribute('data-ops-section-state')).toBe('auth')
    expect(within(section('sec-a')).getByText(copy.auth.title)).toBeTruthy()
    expect(section('sec-b').getAttribute('data-ops-section-state')).toBe('exhausted')
    expect(within(section('sec-b')).getByText(copy.exhausted.title)).toBeTruthy()
    expect(within(section('sec-b')).getByText('B data')).toBeTruthy()
    expect(section('node-1').getAttribute('data-ops-node-state')).toBe('capability')
    expect(within(section('node-1')).getByText(copy.capability.title)).toBeTruthy()
    expect(section('node-2').getAttribute('data-ops-node-state')).toBe('reconnecting')
    expect(within(section('node-2')).getByText('N2 data')).toBeTruthy()

    expect(section('sec-c').getAttribute('data-ops-section-state')).toBe('ready')
    expect(section('sec-c').querySelector(':scope > [data-ops-state-notice]')).toBeNull()
    expect(section('node-3').getAttribute('data-ops-node-state')).toBe('ready')
    expect(within(section('node-3')).getByText('N3 data')).toBeTruthy()
    expect(section('node-3').querySelector('[data-ops-state-notice]')).toBeNull()

    expect(screen.getByLabelText('c input')).toBe(cInput)
    expect(document.activeElement).toBe(cInput)
    expect(scroller.scrollTop).toBe(33)
    expect(screen.getByLabelText('chat composer')).toBe(chat)
    expect(chatMounts).toBe(1)
  })

  it('contains a render crash to its own section and recovers on demand', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let explode = true

    function Bomb() {
      if (explode) {
        throw new Error('injected')
      }

      return <p>recovered</p>
    }

    render(
      <>
        <OpsSectionState id="boom" label="Boom">
          <Bomb />
        </OpsSectionState>
        <OpsSectionState id="ok" label="Ok">
          <p>sibling ok</p>
        </OpsSectionState>
      </>
    )

    expect(within(section('boom')).getByText(copy.crashed.title)).toBeTruthy()
    expect(within(section('ok')).getByText('sibling ok')).toBeTruthy()
    explode = false
    fireEvent.click(within(section('boom')).getByRole('button', { name: copy.crashed.action }))
    expect(within(section('boom')).getByText('recovered')).toBeTruthy()
  })

  it('keeps future writes disabled unless the view is ready and explicitly writable', () => {
    function Save() {
      const enabled = useOpsWritesEnabled()

      return <button disabled={!enabled}>save</button>
    }

    function Harness() {
      const [state, setState] = useState<{ writable?: boolean; stale?: boolean }>({})

      return (
        <>
          <button onClick={() => setState({ writable: true })}>opt-in</button>
          <button onClick={() => setState({ writable: true, stale: true })}>go-stale</button>
          <OpsSectionState hasSnapshot id="w" label="W" {...state}>
            <Save />
          </OpsSectionState>
        </>
      )
    }

    render(<Harness />)
    const save = () => screen.getByRole('button', { name: 'save' }) as HTMLButtonElement
    expect(save().disabled).toBe(true)
    expect(section('w').getAttribute('data-ops-writes')).toBe('disabled')
    fireEvent.click(screen.getByText('opt-in'))
    expect(save().disabled).toBe(false)
    fireEvent.click(screen.getByText('go-stale'))
    expect(save().disabled).toBe(true)
  })
})
