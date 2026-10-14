import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** P8 B13: free card-drag, Chat->Canvas compose (proposal-only), residual i18n. */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { acceptProposal, hasStaged, patchFor, propose, resetStaged, takeStaged } from './canvas/compose'
import { ComposePanel } from './canvas/compose-view'
import { setOpsMainLocale, T } from './main-i18n'
import { MAIN_TRANSLATIONS } from './main-i18n-table'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')

afterEach(() => (resetStaged(), setOpsMainLocale('en')))

describe('B13 compose parser', () => {
  it('parses model, prompt replace/append and edge/node notes; never writes', () => {
    const p = propose('default', 'use model openrouter/deepseek-chat\nalways answer in Spanish\nconnect tools to skills\nadd a memory node', [['tools', 'skills']])
    expect(p.items).toEqual([
      { kind: 'model', provider: 'openrouter', model: 'deepseek-chat' },
      { kind: 'note', text: 'tools → skills is already linked.' },
      expect.objectContaining({ kind: 'note' }),
      { kind: 'prompt', mode: 'append', text: 'always answer in Spanish' }
    ])
    expect(hasStaged('default', 'prompt')).toBe(false)
    expect(propose('x', 'prompt: be brief').items).toEqual([{ kind: 'prompt', mode: 'replace', text: 'be brief' }])
  })

  it('patches append on a new line and replace wholesale', () => {
    expect(patchFor({ kind: 'prompt', mode: 'append', text: 'b' }, { content: 'a' })).toEqual({ node: 'prompt', patch: { content: 'a\nb\n' } })
    expect(patchFor({ kind: 'prompt', mode: 'replace', text: 'z' }, { content: 'a' })?.patch.content).toBe('z')
    expect(patchFor({ kind: 'note', text: 'n' }, {})).toBeNull()
  })

  it('accept only stages drafts per node; notes are not staged', () => {
    const n = acceptProposal(propose('p', 'model: a/b; hi; add a x node'))
    expect(n).toBe(2)
    expect(takeStaged('p', 'model')).toHaveLength(1)
    expect(takeStaged('p', 'model')).toHaveLength(0)
    expect(hasStaged('p', 'prompt')).toBe(true)
  })
})

describe('B13 ComposePanel', () => {
  it('shows a proposal that is not applied until Accept; Discard drops it', async () => {
    render(<ComposePanel edges={[]} profile="p" />)
    fireEvent.change(screen.getByLabelText('Describe a change to this agent'), { target: { value: 'model: a/b' } })
    fireEvent.click(screen.getByText('Propose'))
    expect(screen.getByText('Proposal (not applied)')).toBeTruthy()
    expect(hasStaged('p', 'model')).toBe(false)
    fireEvent.click(screen.getByText('Discard'))
    expect(screen.queryByText('Proposal (not applied)')).toBeNull()
    expect(hasStaged('p', 'model')).toBe(false)
    fireEvent.change(screen.getByLabelText('Describe a change to this agent'), { target: { value: 'model: a/b' } })
    fireEvent.click(screen.getByText('Propose'))
    await act(async () => fireEvent.click(screen.getByText('Accept into drafts')))
    expect(hasStaged('p', 'model')).toBe(true)
  })

  it('read-only disables Accept', () => {
    render(<ComposePanel edges={[]} profile="p" readOnly />)
    fireEvent.change(screen.getByLabelText('Describe a change to this agent'), { target: { value: 'model: a/b' } })
    fireEvent.click(screen.getByText('Propose'))
    expect((screen.getByText('Accept into drafts') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('B13 board drag', () => {
  it('cards are draggable and columns are drop targets that route through props.move', () => {
    const b = read('board/board.tsx')
    expect(b).toContain('draggable={!readOnly}')
    expect(b).toContain("e.dataTransfer.setData('text/ops-card', t.id)")
    expect(b).toMatch(/from && from !== col\.name[\s\S]*props\.move\(id, col\.name\)/)
    expect(read('ops-base.css')).toContain("[data-ops-drop='over']")
  })
})

describe('B13 residual i18n', () => {
  it('stat cards, presence, columns, composer and compose are translated in every locale', () => {
    for (const l of ['es', 'fr', 'de', 'ru', 'ja', 'zh', 'zh-hant', 'ar']) {
      for (const k of ['Working agents', 'Open tasks', 'Done this week', 'Needs attention', 'Unknown', 'ready', 'running', 'Propose', 'Accept into drafts', 'Type a task. Start with @profile to assign it, add #project to file it; otherwise it goes to triage.']) {
        expect(MAIN_TRANSLATIONS[l][k], `${l}:${k}`).toBeTruthy()
      }
    }

    setOpsMainLocale('es')
    expect(T('Working agents')).toBe('Agentes trabajando')
  })
})
