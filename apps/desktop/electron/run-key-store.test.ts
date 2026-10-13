import { describe, expect, it } from 'vitest'

import { createRunKeyStore, type KeychainIo } from './run-key-store'

function io(available = true) {
  let text = ''

  const fake: KeychainIo & { text: () => string } = {
    isEncryptionAvailable: () => available,
    encryptString: s => Buffer.from(`enc(${Buffer.from(s).toString('hex')})`),
    decryptString: b => {
      const m = /^enc\(([0-9a-f]*)\)$/.exec(Buffer.from(b).toString())

      if (!m) {
        throw new Error('bad blob')
      }

      return Buffer.from(m[1], 'hex').toString()
    },
    readStoreText: () => {
      if (!text) {
        throw new Error('ENOENT')
      }

      return text
    },
    writeStoreText: t => {
      text = t
    },
    text: () => text
  }

  return fake
}

describe('run key store (OS keychain)', () => {
  it('round-trips a remote key encrypted; the file never holds plain text', () => {
    const f = io()
    const store = createRunKeyStore(f)
    store.set('homelab', 'https://gw.example.com:8642/', 'sk-remote-xyz')
    expect(f.text()).not.toContain('sk-remote-xyz')
    expect(store.get('homelab')).toEqual({ baseUrl: 'https://gw.example.com:8642', key: 'sk-remote-xyz' })
  })

  it('status never includes the key', () => {
    const store = createRunKeyStore(io())
    store.set('homelab', 'https://gw.example.com', 'sk-remote-xyz')
    const status = store.status('homelab')
    expect(status).toEqual({ configured: true, baseUrl: 'https://gw.example.com' })
    expect(JSON.stringify(status)).not.toContain('sk-')
  })

  it('refuses to store when the keychain is unavailable (no plain fallback)', () => {
    const f = io(false)
    expect(() => createRunKeyStore(f).set('homelab', 'https://gw', 'k')).toThrow(/keychain unavailable/)
    expect(f.text()).toBe('')
  })

  it('refuses local (local reads the profile .env) and non-http urls', () => {
    const store = createRunKeyStore(io())
    expect(() => store.set('local', 'http://x', 'k')).toThrow()
    expect(() => store.set('r', 'file:///etc', 'k')).toThrow()
  })

  it('clear removes; corrupt store and undecryptable blobs read as absent', () => {
    const f = io()
    const store = createRunKeyStore(f)
    store.set('a', 'http://h', 'k')
    store.clear('a')
    expect(store.get('a')).toBeNull()
    f.writeStoreText('{"b":{"baseUrl":"http://h","encoding":"safeStorage","value":"Zm9v"}}')
    expect(store.get('b')).toBeNull()
    f.writeStoreText('[not json')
    expect(store.status('b')).toEqual({ configured: false, baseUrl: null })
  })
})
