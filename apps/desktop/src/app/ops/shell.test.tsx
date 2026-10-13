import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { type ReactNode, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Slot } from '@/contrib/react/slot'
import { registry } from '@/contrib/registry'
import { I18nProvider } from '@/i18n'
import { en } from '@/i18n/en'

import { type FleetFeed, loadScope, narrowFromPane, resetOpsNavigationForTests } from './navigation-store'
import { OpsMotionScope, PresenceGlyph } from './primitives/presence-glyph'
import { OpsSectionState } from './section-state'

import { OpsShell } from './index'

// P0.5-09 integration regression: the merged P0.5 shell across motion, split,
// full-screen, responsive, scope isolation, chrome lifecycle, recovery a11y and
// chat coexistence. Each case mounts the productive OpsShell, not a fixture.

const copy = en.ops
const fleet: FleetFeed = { a1: 'ready', a3: 'ready', rows: [] }

const connections = [
  { id: 'local', label: 'ignacio-local', remote: false },
  { id: 'homelab', label: 'homelab', remote: true }
]

const profiles = [{ name: 'mirror' }, { name: 'judge' }]

type ShellProps = Partial<Parameters<typeof OpsShell>[0]>

let chatMounts = 0

function Chat() {
  useEffect(() => {
    chatMounts += 1
  }, [])

  return <textarea aria-label="chat composer" defaultValue="" />
}

function Harness({ props, withChat = true }: { props: ShellProps; withChat?: boolean }): ReactNode {
  return (
    <I18nProvider configClient={null}>
      <Slot area="titleBar.center" />
      {withChat ? <Chat /> : null}
      <OpsShell
        active
        connectionId="local"
        connections={connections}
        fleet={fleet}
        paneWidth={1440}
        profile="mirror"
        profiles={profiles}
        remote={false}
        {...props}
      />
    </I18nProvider>
  )
}

const statusIds = (side: 'left' | 'right') =>
  registry.getArea(`statusBar.${side}`).map(item => String((item.data as { id?: string }).id ?? item.id))

beforeEach(() => {
  window.localStorage.clear()
  resetOpsNavigationForTests()
  chatMounts = 0
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('P0.5 shell integration', () => {
  it('reduced motion scopes every glyph to the static path', () => {
    const view = render(
      <OpsMotionScope preference="reduced">
        <PresenceGlyph copyColor="#fff" glyphColor="#fff" label="working" pulse state="working" />
      </OpsMotionScope>
    )

    const glyph = view.container.querySelector('[data-state="working"]') as HTMLElement

    expect(view.container.querySelector('[data-ops-motion-preference="reduced"]')).not.toBeNull()
    expect(glyph.getAttribute('data-ops-motion')).toBe('reduced')
    expect(glyph.getAttribute('data-pulse')).toBe('off')
    expect(glyph.getAttribute('data-paused')).toBe('true')
  })

  it.each([1440, 1279, 1023, 799])('pane width %ipx applies the audited split strategy in the productive shell', width => {
    const expected = narrowFromPane(width)
    const view = render(<Harness props={{ paneWidth: width }} />)

    expect(view.container.querySelector('[data-ops-rail-list]')?.getAttribute('data-ops-rail')).toBe(expected.rail)
    expect(view.container.querySelector('[data-ops-inspector]')?.getAttribute('data-ops-inspector')).toBe(
      expected.inspector
    )

    if (expected.tabs === 'dropdown') {
      expect(view.container.querySelector('[data-ops-tab-dropdown]')).not.toBeNull()
    } else {
      expect(view.container.querySelector('[data-ops-tabs]')?.getAttribute('data-ops-tabs')).toBe('strip')
    }
  })

  it('full-screen round-trip keeps the chat node, its draft and a single mount', () => {
    const onToggleFullscreen = vi.fn()
    const view = render(<Harness props={{ fullscreen: false, onToggleFullscreen }} />)
    const chat = view.getByLabelText('chat composer') as HTMLTextAreaElement

    fireEvent.change(chat, { target: { value: 'half-written draft' } })
    chat.focus()
    fireEvent.click(view.getByRole('button', { name: copy.toolbar.fullScreen }))
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1)

    view.rerender(<Harness props={{ fullscreen: true, onToggleFullscreen }} />)
    expect(view.container.querySelector('[data-ops-fullscreen]')?.getAttribute('data-ops-fullscreen')).toBe('true')
    expect(view.getByRole('button', { name: copy.toolbar.restoreSplit }).getAttribute('aria-pressed')).toBe('true')

    view.rerender(<Harness props={{ fullscreen: false, onToggleFullscreen }} />)
    expect(view.getByLabelText('chat composer')).toBe(chat)
    expect(chat.value).toBe('half-written draft')
    expect(document.activeElement).toBe(chat)
    expect(chatMounts).toBe(1)
  })

  it('chat stays usable with Ops open: typing in chat is not captured by Ops chords', () => {
    const view = render(<Harness props={{}} />)
    const chat = view.getByLabelText('chat composer') as HTMLTextAreaElement
    const railBefore = loadScope('local', 'mirror').rail

    chat.focus()
    fireEvent.keyDown(chat, { key: '[', code: 'BracketLeft' })
    fireEvent.change(chat, { target: { value: '[g o' } })

    expect(chat.value).toBe('[g o')
    expect(loadScope('local', 'mirror').rail).toBe(railBefore)
    expect(document.activeElement).toBe(chat)
  })

  it('isolates rail filter and pins per connection and profile', () => {
    const view = render(<Harness props={{}} />)
    const filter = view.getAllByLabelText(copy.rail.filter)[0] as HTMLInputElement

    fireEvent.change(filter, { target: { value: 'skills' } })
    expect(loadScope('local', 'mirror').filter).toBe('skills')

    view.rerender(<Harness props={{ connectionId: 'homelab', connectionLabel: 'homelab', profile: 'judge', remote: true }} />)
    expect((view.getAllByLabelText(copy.rail.filter)[0] as HTMLInputElement).value).toBe('')
    expect(loadScope('homelab', 'judge').filter).toBe('')
    expect(view.container.querySelector('[data-ops-readonly]')).not.toBeNull()

    view.rerender(<Harness props={{}} />)
    expect((view.getAllByLabelText(copy.rail.filter)[0] as HTMLInputElement).value).toBe('skills')
  })

  it('registers one chrome set, replaces it on scope change and unregisters on unmount', () => {
    const view = render(<Harness props={{}} />)
    const titlebars = () => document.querySelectorAll('[data-ops-titlebar]').length

    expect(titlebars()).toBe(1)
    expect(document.querySelectorAll('[data-ops-search-trigger]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-ops-chrome]')).toHaveLength(1)
    expect(statusIds('left')).toContain('ops-profile')

    view.rerender(<Harness props={{ profile: 'judge' }} />)
    expect(titlebars()).toBe(1)
    expect(statusIds('left').filter(id => id === 'ops-profile')).toHaveLength(1)

    view.rerender(<Harness props={{ active: false }} />)
    expect(titlebars()).toBe(0)
    expect(statusIds('left').filter(id => id.startsWith('ops-'))).toEqual([])
    expect(statusIds('right').filter(id => id.startsWith('ops-'))).toEqual([])

    view.rerender(<Harness props={{}} />)
    expect(titlebars()).toBe(1)
    view.unmount()
    expect(statusIds('left').filter(id => id.startsWith('ops-'))).toEqual([])
  })

  it('recovery states are announced without stealing focus and expose a named recovery action', () => {
    const view = render(
      <>
        <button type="button">elsewhere</button>
        <OpsSectionState error={{ status: 401 }} id="sec-auth" label="Fleet" onReauth={() => {}} />
        <OpsSectionState id="sec-load" label="Runs" loading />
      </>
    )

    const outside = view.getByRole('button', { name: 'elsewhere' })
    outside.focus()

    const auth = view.container.querySelector('[data-ops-state-id="sec-auth"]') as HTMLElement
    const notice = within(auth).getByRole('status')

    expect(auth.getAttribute('aria-label')).toBe('Fleet')
    expect(auth.getAttribute('aria-describedby')).toBe(notice.id)
    expect(within(notice).getByRole('button', { name: en.opsStates.auth.action })).toBeTruthy()
    expect(view.container.querySelector('[data-ops-state-id="sec-load"]')?.getAttribute('aria-busy')).toBe('true')

    act(() => {
      view.rerender(
        <>
          <button type="button">elsewhere</button>
          <OpsSectionState attempt={3} error={{ status: 503 }} id="sec-auth" label="Fleet" onReset={() => {}} />
          <OpsSectionState hasSnapshot id="sec-load" label="Runs">
            <p>runs</p>
          </OpsSectionState>
        </>
      )
    })
    expect(document.activeElement).toBe(outside)
  })
})
