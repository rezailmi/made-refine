import { beforeEach } from 'vitest'

function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(String(key), String(value))
    },
    removeItem: (key: string) => {
      store.delete(String(key))
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }
}

function isValidStorage(value: unknown): value is Storage {
  return Boolean(
    value
    && typeof (value as Storage).getItem === 'function'
    && typeof (value as Storage).setItem === 'function'
    && typeof (value as Storage).removeItem === 'function'
    && typeof (value as Storage).clear === 'function',
  )
}

function ensureStorage() {
  if (isValidStorage(globalThis.localStorage)) return

  const storage = createStorage()

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: storage,
  })

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      writable: true,
      value: storage,
    })
  }
}

ensureStorage()

beforeEach(() => {
  ensureStorage()
  globalThis.localStorage.clear()
})
