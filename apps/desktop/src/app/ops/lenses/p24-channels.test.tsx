import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type B4Client, ChannelsLens } from './b4-lenses'

afterEach(() => cleanup())

const full = {
  catalog: [{ name: 'github', description: 'Repos and PRs', installed: false }],
  servers: [{ name: 'linear', enabled: true }],
  platforms: [{ id: 'telegram', name: 'Telegram', description: 'Bot', configured: true, enabled: true, gateway_running: true }],
  providers: [{ id: 'anthropic', name: 'Claude', flow: 'pkce', status: { logged_in: true } }]
}

const client = (channels: B4Client['channels']) => ({ channels }) as unknown as B4Client
const catCount = (cat: string) => document.querySelector(`[data-ops-app-cat="${cat}"] span`)?.textContent

describe('P24d Channels: unknown is not zero; the failed source can be retried in place', () => {
  it('catalog failed: Tools (MCP) count reads unknown, other categories keep real counts', async () => {
    render(<ChannelsLens client={client(vi.fn().mockResolvedValue({ ...full, catalog: null, servers: [] }))} profile="p" />)
    await screen.findByText(/Couldn't load the MCP catalog/)
    expect(catCount('Tools (MCP)')).toBe('unknown')
    expect(document.querySelector('[data-ops-app-cat="Tools (MCP)"] [data-ops-count-unknown]')).toBeTruthy()
    expect(catCount('Messaging')).toBe('1')
    expect(catCount('Models')).toBe('1')
    // Picking the unknown category explains the failure instead of "No app matches."
    fireEvent.click(document.querySelector('[data-ops-app-cat="Tools (MCP)"]')!)
    expect(document.querySelector('[data-ops-empty="apps"]')?.textContent).toContain('This category could not be loaded.')
  })

  it('a real zero stays 0 when every source answered', async () => {
    render(<ChannelsLens client={client(vi.fn().mockResolvedValue({ ...full, catalog: [], servers: [] }))} profile="p" />)
    await screen.findByText('Telegram')
    expect(catCount('Tools (MCP)')).toBe('0')
    expect(document.querySelector('[data-ops-partial]')).toBeNull()
    expect(document.querySelector('[data-ops-count-unknown]')).toBeNull()
  })

  it('Retry in the failure notice reloads through the lens load and clears the notice when the source answers', async () => {
    const channels = vi.fn().mockResolvedValueOnce({ ...full, catalog: null }).mockResolvedValue(full)
    render(<ChannelsLens client={client(channels)} profile="p" />)
    await screen.findByText(/Couldn't load the MCP catalog/)
    const retry = document.querySelector('[data-ops-partial] [data-ops-partial-retry]') as HTMLButtonElement
    expect(retry.textContent).toBe('Retry')
    const before = channels.mock.calls.length
    fireEvent.click(retry)
    await waitFor(() => expect(channels.mock.calls.length).toBeGreaterThan(before))
    await waitFor(() => expect(document.querySelector('[data-ops-partial]')).toBeNull())
    expect(catCount('Tools (MCP)')).toBe('2')
  })
})
