/** P26 (judge pass 20 #3): a refusal reads human reason first; the IPC/transport wrapper is only in the raw text. */
import { describe, expect, it } from 'vitest'

import { humanError, humanErrorLine } from './api-error'

const IPC = "Error invoking remote method 'hermes:api': Error: "

describe('P26 humanError', () => {
  it('409 through IPC: conflict meaning + server detail, wrapper stripped, raw kept', () => {
    const raw = `${IPC}409: {"detail":"Task t_1 moved to done by another agent"}`
    const h = humanError(new Error(raw))

    expect(h).toMatchObject({ status: 409, meaning: 'Conflict', reason: 'Task t_1 moved to done by another agent', raw, wrapped: true })
    expect(humanErrorLine(h)).toBe('Conflict (409): Task t_1 moved to done by another agent')
    expect(humanErrorLine(h)).not.toContain('invoking')
  })

  it('422 FastAPI validation list through IPC: field and message, not the JSON', () => {
    const raw = `${IPC}422: {"detail":[{"type":"missing","loc":["body","note"],"msg":"Field required","input":null}]}`
    const h = humanError(raw)

    expect(h.status).toBe(422)
    expect(humanErrorLine(h)).toBe('Invalid (422): note: Field required')
  })

  it('503 restart-required through IPC (real Desktop string): unavailable + the server sentence', () => {
    const raw = `${IPC}503: {"detail":"Restart required: This process is running code from 08b4875f4a but the checkout on disk is now 48d2528066."}`
    const line = humanErrorLine(humanError(new Error(raw)))

    expect(line.startsWith('Unavailable (503): Restart required: This process is running code')).toBe(true)
    expect(line).not.toMatch(/invoking|\{"detail"/)
  })

  it('object detail with a code: the human detail leads; the code only when there is no detail', () => {
    expect(humanErrorLine(humanError(`${IPC}409: {"detail":{"code":"stale_revision","detail":"Changed since you loaded it"}}`))).toBe('Conflict (409): Changed since you loaded it')
    expect(humanErrorLine(humanError(`${IPC}409: {"detail":{"code":"stale_revision"}}`))).toBe('Conflict (409): stale_revision')
  })

  it('no wrapper, plain status message: same line; status text equal to the meaning is not repeated', () => {
    const h = humanError(new Error('409: task moved'))

    expect(h.wrapped).toBe(false)
    expect(humanErrorLine(h)).toBe('Conflict (409): task moved')
    expect(humanErrorLine(humanError('502: Bad Gateway'))).toBe('Bad gateway (502)')
    expect(humanErrorLine(humanError('503: Service Unavailable'))).toBe('Unavailable (503)')
    expect(humanErrorLine(humanError('502: <html><body>nginx</body></html>'))).toBe('Bad gateway (502)')
  })

  it('transport failure without HTTP status: the message only, wrapper and nested Error: prefixes gone', () => {
    const h = humanError(new Error(`${IPC}Error: connect ECONNREFUSED 127.0.0.1:8642`))

    expect(h.status).toBeNull()
    expect(humanErrorLine(h)).toBe('connect ECONNREFUSED 127.0.0.1:8642')
  })

  it('unknown status keeps the number; empty input says the request failed; the meaning is localizable', () => {
    expect(humanErrorLine(humanError('418: teapot'))).toBe('418: teapot')
    expect(humanErrorLine(humanError(''))).toBe('request failed')
    expect(humanErrorLine(humanError(`${IPC}409: {"detail":"x"}`), s => `<${s}>`)).toBe('<Conflict> (409): x')
  })

  it('a long reason is shortened on the line; the raw text stays whole', () => {
    const long = 'a'.repeat(400)
    const h = humanError(`409: ${long}`)

    expect(humanErrorLine(h).length).toBeLessThanOrEqual(200)
    expect(humanErrorLine(h).endsWith('…')).toBe(true)
    expect(h.raw).toContain(long)
  })
})
