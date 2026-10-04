import type { UIMessage } from 'ai'
import { openDB, type IDBPDatabase } from 'idb'
import { toRaw } from 'vue'

import type { TurnReceipt } from '@/app/assistant/turn/usage'

/** One document's conversation as it is kept on this computer. */
export interface StoredThread {
  key: string
  messages: UIMessage[]
  receipts: Record<string, TurnReceipt>
  updatedAt: number
}

export interface ThreadStorage {
  read(key: string): Promise<StoredThread | null>
  write(thread: StoredThread): Promise<void>
  remove(key: string): Promise<void>
}

/** A thread longer than this keeps its most recent messages. */
export const MAX_STORED_MESSAGES = 200

const DB_NAME = 'redrob-design-threads'
const STORE_NAME = 'threads'

export function trimThread(thread: StoredThread): StoredThread {
  if (thread.messages.length <= MAX_STORED_MESSAGES) return thread
  const messages = thread.messages.slice(-MAX_STORED_MESSAGES)
  const kept = new Set(messages.map((message) => message.id))
  const receipts = Object.fromEntries(
    Object.entries(thread.receipts).filter(([id]) => kept.has(id))
  )
  return { ...thread, messages, receipts }
}

/** Unwraps reactive proxies at every depth; structured cloning rejects them. */
function unwrap(value: unknown): unknown {
  const raw: unknown = toRaw(value)
  if (Array.isArray(raw)) return raw.map(unwrap)
  if (raw && typeof raw === 'object') {
    return Object.fromEntries(Object.entries(raw).map(([key, entry]) => [key, unwrap(entry)]))
  }
  return raw
}

/** A copy of the thread with no reactive proxies, safe for IndexedDB and memory. */
function plainThread(thread: StoredThread): StoredThread {
  return structuredClone({ ...thread, messages: unwrap(thread.messages) as UIMessage[] })
}

export function createMemoryThreadStorage(): ThreadStorage {
  const threads = new Map<string, StoredThread>()
  return {
    read: (key) =>
      Promise.resolve(threads.has(key) ? (structuredClone(threads.get(key)) ?? null) : null),
    write: (thread) => {
      threads.set(thread.key, plainThread(trimThread(thread)))
      return Promise.resolve()
    },
    remove: (key) => {
      threads.delete(key)
      return Promise.resolve()
    }
  }
}

function createIdbThreadStorage(): ThreadStorage {
  let db: Promise<IDBPDatabase> | null = null
  const open = () =>
    (db ??= openDB(DB_NAME, 1, {
      upgrade(database) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }))
  return {
    async read(key) {
      const value: unknown = await (await open()).get(STORE_NAME, key)
      return value && typeof value === 'object' ? (value as StoredThread) : null
    },
    async write(thread) {
      await (await open()).put(STORE_NAME, plainThread(trimThread(thread)))
    },
    async remove(key) {
      await (await open()).delete(STORE_NAME, key)
    }
  }
}

let storage: ThreadStorage | null = null

/** IndexedDB where the browser has it; memory for this session otherwise. */
export function getThreadStorage(): ThreadStorage {
  if (storage) return storage
  storage =
    typeof indexedDB === 'undefined' ? createMemoryThreadStorage() : createIdbThreadStorage()
  return storage
}

export function setThreadStorageForTests(next: ThreadStorage | null): void {
  storage = next
}
