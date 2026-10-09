import type { LabeledSession, SessionOutbox } from '@redrob-labs/work-labeller'
import type { DBSchema, IDBPDatabase } from 'idb'

import { APP_DATABASE_NAMES, defineAppDatabase, openAppDatabase } from '@/app/storage/idb'

/** Finished sessions kept for sending. The oldest go first when the Console is out of reach. */
export const OUTBOX_LIMIT = 2000

export type OutboxEntry = { session: LabeledSession; queuedAt: number }

export interface InsightsOutbox extends SessionOutbox {
  add(session: LabeledSession): Promise<void>
  list(): Promise<OutboxEntry[]>
  size(): Promise<number>
}

interface InsightsDatabase extends DBSchema {
  sessions: {
    key: string
    value: OutboxEntry & { externalId: string }
    indexes: { 'by-queued': number }
  }
}

const insightsDatabase = defineAppDatabase<InsightsDatabase>({
  name: APP_DATABASE_NAMES.insights,
  version: 1,
  callbacks: {
    upgrade(database) {
      if (database.objectStoreNames.contains('sessions')) return
      const sessions = database.createObjectStore('sessions', { keyPath: 'externalId' })
      sessions.createIndex('by-queued', 'queuedAt')
    }
  }
})

/**
 * The outbox in IndexedDB, so sessions survive a restart until the Console has them. A session
 * queued again (the same external id) replaces the earlier entry.
 */
export function createIDBInsightsOutbox(
  options: { limit?: number; now?: () => number } = {}
): InsightsOutbox {
  const limit = options.limit ?? OUTBOX_LIMIT
  const now = options.now ?? Date.now
  let database: Promise<IDBPDatabase<InsightsDatabase>> | null = null
  const open = () => (database ??= openAppDatabase(insightsDatabase))
  let clock = 0

  return {
    async add(session) {
      const db = await open()
      const transaction = db.transaction('sessions', 'readwrite')
      // Strictly increasing, so entries queued in the same millisecond keep their order.
      clock = Math.max(clock + 1, now())
      await transaction.store.put({ externalId: session.externalId, session, queuedAt: clock })
      const keys = await transaction.store.index('by-queued').getAllKeys()
      for (const key of keys.slice(0, Math.max(0, keys.length - limit))) {
        await transaction.store.delete(key)
      }
      await transaction.done
    },
    async list() {
      const db = await open()
      const rows = await db.getAllFromIndex('sessions', 'by-queued')
      return rows.map(({ session, queuedAt }) => ({ session, queuedAt }))
    },
    async remove(externalIds) {
      const db = await open()
      const transaction = db.transaction('sessions', 'readwrite')
      for (const id of externalIds) await transaction.store.delete(id)
      await transaction.done
    },
    async size() {
      const db = await open()
      return db.count('sessions')
    }
  }
}
