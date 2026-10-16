/**
 * run-key-store.ts
 *
 * OS-keychain store for remote/SSH gateway `API_SERVER_KEY`s (ops-panel P1-06;
 * decision Nacho 2026-10-13 19:47 ART). Keys are encrypted with Electron
 * safeStorage (injected) and NEVER written as plain text: when the keychain is
 * unavailable, `set` throws instead of falling back. The renderer can store or
 * clear a key and ask whether one is configured; it can never read one back.
 *
 * Standalone (no `import 'electron'`); main.ts injects safeStorage and file I/O.
 */

export interface KeychainIo {
  isEncryptionAvailable: () => boolean
  encryptString: (plain: string) => Uint8Array
  decryptString: (blob: Uint8Array) => string
  readStoreText: () => string
  writeStoreText: (text: string) => void
}

interface StoredEntry {
  baseUrl: string
  encoding: 'safeStorage'
  value: string
}

export const RUN_KEY_STORE_FILE = 'gateway-run-keys.json'

function normalizeBaseUrl(raw: string): string {
  const url = new URL(String(raw ?? '').trim())

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('gateway URL must be http(s)')
  }

  return url.origin + url.pathname.replace(/\/+$/, '')
}

export function createRunKeyStore(io: KeychainIo) {
  const read = (): Record<string, StoredEntry> => {
    try {
      const parsed = JSON.parse(io.readStoreText())

      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  const write = (store: Record<string, StoredEntry>) => io.writeStoreText(JSON.stringify(store, null, 2))

  return {
    set(connectionId: string, baseUrl: string, key: string): void {
      if (!connectionId || connectionId === 'local') {
        throw new Error('local connections read API_SERVER_KEY from the profile .env')
      }

      if (!key || typeof key !== 'string') {
        throw new Error('key is required')
      }

      if (!io.isEncryptionAvailable()) {
        throw new Error('OS keychain unavailable: refusing to store the gateway key unencrypted')
      }

      const store = read()
      store[connectionId] = {
        baseUrl: normalizeBaseUrl(baseUrl),
        encoding: 'safeStorage',
        value: Buffer.from(io.encryptString(key)).toString('base64')
      }
      write(store)
    },

    /** Main-process only. Returns null when absent or undecryptable. */
    get(connectionId: string): { baseUrl: string; key: string } | null {
      const entry = read()[connectionId]

      if (!entry || entry.encoding !== 'safeStorage' || typeof entry.value !== 'string') {
        return null
      }

      try {
        const key = io.decryptString(Buffer.from(entry.value, 'base64'))

        return key ? { baseUrl: entry.baseUrl, key } : null
      } catch {
        return null
      }
    },

    /** Renderer-safe status: never includes the key. */
    status(connectionId: string): { configured: boolean; baseUrl: string | null } {
      const entry = read()[connectionId]

      return { configured: Boolean(entry?.value), baseUrl: entry?.baseUrl ?? null }
    },

    clear(connectionId: string): void {
      const store = read()

      if (connectionId in store) {
        delete store[connectionId]
        write(store)
      }
    }
  }
}

export type RunKeyStore = ReturnType<typeof createRunKeyStore>
