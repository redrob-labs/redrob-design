import { createIdbVersionStore } from './idb'
import { createMemoryVersionStore } from './memory'
import type { VersionStore } from './types'

let singleton: VersionStore | null = null

/** Versions on this computer: IndexedDB, or memory for the session where it is missing. */
export function getVersionStore(): VersionStore {
  singleton ??=
    typeof indexedDB === 'undefined' ? createMemoryVersionStore() : createIdbVersionStore()
  return singleton
}

export function setVersionStoreForTests(store: VersionStore | null): void {
  singleton = store
}
