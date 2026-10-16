import { describe, expect, it } from 'vitest'

import {
  isOpsWrite,
  OPS_ID_HEADER,
  OPS_KIND_HEADER,
  OpsRemoteReadOnlyError,
  opsRequestHeaders,
  withOpsHeaders
} from './ops-write-guard'

describe('ops write guard (D11)', () => {
  it('stamps local kind for a local backend, reads and writes', () => {
    expect(opsRequestHeaders({ mode: 'local' }, 'PUT', '/api/ops/profiles/default/nodes/prompt')).toEqual({
      [OPS_KIND_HEADER]: 'local',
      [OPS_ID_HEADER]: 'local'
    })
    expect(opsRequestHeaders({ mode: 'local', connectionId: 'c1' }, 'GET', '/api/ops/policy')[OPS_ID_HEADER]).toBe('c1')
  })

  it.each(['remote', 'ssh', 'cloud', undefined, null, 'LOCAL'])('refuses writes when mode=%s', mode => {
    expect(() => opsRequestHeaders({ mode }, 'PUT', '/api/ops/profiles/x/nodes/model')).toThrow(OpsRemoteReadOnlyError)
    expect(() => opsRequestHeaders({ mode }, 'post', '/api/ops/profiles/x/nodes/prompt/restore')).toThrow(
      OpsRemoteReadOnlyError
    )
    expect(() => opsRequestHeaders(null, 'DELETE', '/api/ops/x')).toThrow(OpsRemoteReadOnlyError)
  })

  it('lets remote reads through stamped as remote', () => {
    expect(opsRequestHeaders({ mode: 'remote' }, 'GET', '/api/ops/fleet')).toEqual({
      [OPS_KIND_HEADER]: 'remote',
      [OPS_ID_HEADER]: 'remote'
    })
  })

  it('ignores non-ops paths and path tricks', () => {
    expect(opsRequestHeaders({ mode: 'remote' }, 'PUT', '/api/config/raw')).toEqual({})
    expect(opsRequestHeaders({ mode: 'remote' }, 'PUT', '/api/opsx')).toEqual({})
    expect(isOpsWrite('PUT', '//api//ops/profiles/a/nodes/prompt')).toBe(true)
    expect(isOpsWrite('PUT', '/api/ops?x=1')).toBe(true)
    expect(isOpsWrite('GET', '/api/ops/profiles/a/nodes/prompt')).toBe(false)
  })

  it('main values win over spoofed headers in any case', () => {
    const merged = withOpsHeaders(
      { 'x-hermes-ops-connection-kind': 'local', Accept: 'json' },
      opsRequestHeaders({ mode: 'remote' }, 'GET', '/api/ops/policy')
    )

    expect(merged).toEqual({ Accept: 'json', [OPS_KIND_HEADER]: 'remote', [OPS_ID_HEADER]: 'remote' })
  })
})
