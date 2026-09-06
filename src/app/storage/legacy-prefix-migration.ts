// One-time adoption of persisted browser storage written by pre-rebrand
// OpenPencil builds.
//
// Every app localStorage key now uses the `redrob-design:` prefix. Older
// installs persisted the same data under the legacy `open-pencil:` prefix.
// This module renames any surviving legacy keys to the new prefix exactly once,
// preserving user preferences, credentials-in-transit, caches, and layout.
//
// The legacy prefix literal below is a compatibility wire value and is
// intentionally the only place in the app that references it. The migration is
// idempotent and must run before any store reads localStorage, so `main.ts`
// imports it before the app modules that construct `useLocalStorage` refs.

// Compatibility wire value: legacy persisted-storage prefix. Read-only; never
// written back under this prefix.
const LEGACY_STORAGE_PREFIX = 'open-pencil:'
const STORAGE_PREFIX = 'redrob-design:'
const MIGRATION_MARKER_KEY = `${STORAGE_PREFIX}storage-prefix-migrated`
const MIGRATION_MARKER_VALUE = '1'

function storageIfAvailable(): Storage | null {
  try {
    if (!('localStorage' in globalThis)) return null
    return globalThis.localStorage
  } catch {
    // Access to localStorage can throw in some sandboxed contexts.
    return null
  }
}

/**
 * Rename legacy `open-pencil:*` localStorage keys to `redrob-design:*` once.
 *
 * Existing new-prefix keys always win: if a value already lives under the new
 * prefix we keep it and drop the legacy copy, so re-running never clobbers
 * fresh data. Returns the number of keys adopted.
 */
export function migrateLegacyStoragePrefix(storage: Storage): number {
  if (storage.getItem(MIGRATION_MARKER_KEY) === MIGRATION_MARKER_VALUE) return 0

  const legacyKeys: string[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key?.startsWith(LEGACY_STORAGE_PREFIX)) legacyKeys.push(key)
  }

  let adopted = 0
  for (const legacyKey of legacyKeys) {
    const suffix = legacyKey.slice(LEGACY_STORAGE_PREFIX.length)
    const newKey = `${STORAGE_PREFIX}${suffix}`
    const legacyValue = storage.getItem(legacyKey)
    if (legacyValue !== null && storage.getItem(newKey) === null) {
      storage.setItem(newKey, legacyValue)
      adopted++
    }
    storage.removeItem(legacyKey)
  }

  storage.setItem(MIGRATION_MARKER_KEY, MIGRATION_MARKER_VALUE)
  return adopted
}

export function initializeStoragePrefixMigration(): void {
  const storage = storageIfAvailable()
  if (!storage) return
  migrateLegacyStoragePrefix(storage)
}

// Run on import so it completes before store modules read localStorage.
initializeStoragePrefixMigration()
