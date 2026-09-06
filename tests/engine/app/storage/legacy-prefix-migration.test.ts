import { beforeEach, describe, expect, test } from 'bun:test'

import { migrateLegacyStoragePrefix } from '@/app/storage/legacy-prefix-migration'

function createStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear()
  } as Storage
}

function snapshot(storage: Storage): Record<string, string> {
  const entries: Record<string, string> = {}
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key) entries[key] = storage.getItem(key) ?? ''
  }
  return entries
}

describe('migrateLegacyStoragePrefix', () => {
  let storage: Storage

  beforeEach(() => {
    storage = createStorage()
  })

  test('moves pre-rebrand entries into the current namespace', () => {
    storage.setItem('open-pencil:theme', 'light')
    storage.setItem('open-pencil:preferences:v1', '{"version":1}')
    storage.setItem('unrelated', 'keep')

    expect(migrateLegacyStoragePrefix(storage)).toBe(2)
    expect(snapshot(storage)).toEqual({
      unrelated: 'keep',
      'redrob-design:theme': 'light',
      'redrob-design:preferences:v1': '{"version":1}',
      'redrob-design:storage-prefix-migrated': '1'
    })
  })

  test('never overwrites an existing current-namespace entry', () => {
    storage.setItem('open-pencil:theme', 'light')
    storage.setItem('redrob-design:theme', 'dark')

    expect(migrateLegacyStoragePrefix(storage)).toBe(0)
    expect(storage.getItem('redrob-design:theme')).toBe('dark')
    expect(storage.getItem('open-pencil:theme')).toBeNull()
  })

  test('moves rather than copies, so plaintext secrets do not survive twice', () => {
    storage.setItem('open-pencil:openrouter-api-key', 'secret')

    migrateLegacyStoragePrefix(storage)

    expect(storage.getItem('open-pencil:openrouter-api-key')).toBeNull()
    expect(storage.getItem('redrob-design:openrouter-api-key')).toBe('secret')
  })

  test('runs once, so stale legacy values cannot come back later', () => {
    storage.setItem('open-pencil:theme', 'light')
    migrateLegacyStoragePrefix(storage)
    storage.setItem('redrob-design:theme', 'dark')
    storage.setItem('open-pencil:theme', 'light')

    expect(migrateLegacyStoragePrefix(storage)).toBe(0)
    expect(storage.getItem('redrob-design:theme')).toBe('dark')
    expect(storage.getItem('open-pencil:theme')).toBe('light')
  })

  test('is a no-op on storage that has nothing to adopt', () => {
    storage.setItem('redrob-design:theme', 'dark')

    expect(migrateLegacyStoragePrefix(storage)).toBe(0)
    expect(snapshot(storage)).toEqual({
      'redrob-design:theme': 'dark',
      'redrob-design:storage-prefix-migrated': '1'
    })
  })
})
