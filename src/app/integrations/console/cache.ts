import { openDB, type IDBPDatabase } from 'idb'

/** A Console answer kept on this computer, so features keep working offline. */
export interface CachedSnapshot<T> {
  key: string
  value: T
  etag: string | null
  fetchedAt: number
}

export interface SnapshotCache {
  get<T>(key: string, check: (value: unknown) => value is T): Promise<CachedSnapshot<T> | null>
  put(key: string, value: unknown, etag: string | null, fetchedAt?: number): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
}

const DB_NAME = 'redrob-design-console'
const STORE_NAME = 'snapshots'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function snapshotOf<T>(
  raw: unknown,
  check: (value: unknown) => value is T
): CachedSnapshot<T> | null {
  if (!isRecord(raw) || typeof raw.key !== 'string' || typeof raw.fetchedAt !== 'number') {
    return null
  }
  if (!check(raw.value)) return null
  return {
    key: raw.key,
    value: raw.value,
    etag: typeof raw.etag === 'string' ? raw.etag : null,
    fetchedAt: raw.fetchedAt
  }
}

export function createMemorySnapshotCache(): SnapshotCache {
  const entries = new Map<string, unknown>()
  return {
    get: (key, check) => Promise.resolve(snapshotOf(structuredClone(entries.get(key)), check)),
    put: (key, value, etag, fetchedAt = Date.now()) => {
      entries.set(key, structuredClone({ key, value, etag, fetchedAt }))
      return Promise.resolve()
    },
    remove: (key) => {
      entries.delete(key)
      return Promise.resolve()
    },
    clear: () => {
      entries.clear()
      return Promise.resolve()
    }
  }
}

function createIdbSnapshotCache(): SnapshotCache {
  let connection: Promise<IDBPDatabase> | null = null
  /** Runs one step against the snapshot store, opening the database on first use. */
  async function withStore<R>(step: (db: IDBPDatabase) => Promise<R>): Promise<R> {
    connection ??= openDB(DB_NAME, 1, {
      upgrade: (database) => void database.createObjectStore(STORE_NAME, { keyPath: 'key' })
    })
    return step(await connection)
  }
  return {
    get: async (key, check) => snapshotOf(await withStore((db) => db.get(STORE_NAME, key)), check),
    put: (key, value, etag, fetchedAt = Date.now()) =>
      withStore(async (db) => {
        await db.put(STORE_NAME, structuredClone({ key, value, etag, fetchedAt }))
      }),
    remove: (key) => withStore((db) => db.delete(STORE_NAME, key)),
    clear: () => withStore((db) => db.clear(STORE_NAME))
  }
}

let cache: SnapshotCache | null = null

export function consoleCache(): SnapshotCache {
  cache ??=
    typeof indexedDB === 'undefined' ? createMemorySnapshotCache() : createIdbSnapshotCache()
  return cache
}

export function setConsoleCacheForTests(next: SnapshotCache | null): void {
  cache = next
}
