import type { DBSchema } from 'idb'

import { APP_DATABASE_NAMES, defineAppDatabase, openAppDatabase } from '@/app/storage/idb'

import type { VersionMeta, VersionStore } from './types'

interface HistoryDatabase extends DBSchema {
  meta: { key: string; value: VersionMeta; indexes: { byDocument: string } }
  fig: { key: string; value: Uint8Array }
  preview: { key: string; value: Uint8Array }
}

const historyDatabase = defineAppDatabase<HistoryDatabase>({
  name: APP_DATABASE_NAMES.history,
  version: 1,
  callbacks: {
    upgrade(database) {
      const meta = database.createObjectStore('meta', { keyPath: 'id' })
      meta.createIndex('byDocument', 'documentKey')
      database.createObjectStore('fig')
      database.createObjectStore('preview')
    }
  }
})

function newestFirst(rows: VersionMeta[]): VersionMeta[] {
  return rows.toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
}

/** Versions in IndexedDB: metadata, `.fig` bytes and previews in one transaction each. */
export function createIdbVersionStore(): VersionStore {
  const database = openAppDatabase(historyDatabase)
  return {
    async list(documentKey) {
      const db = await database
      return newestFirst(await db.getAllFromIndex('meta', 'byDocument', documentKey))
    },
    async readBytes(id) {
      const bytes = await (await database).get('fig', id)
      return bytes ? Uint8Array.from(bytes) : null
    },
    async readPreview(id) {
      const bytes = await (await database).get('preview', id)
      return bytes ? Uint8Array.from(bytes) : null
    },
    async write(meta, figBytes, preview) {
      const db = await database
      const transaction = db.transaction(['meta', 'fig', 'preview'], 'readwrite')
      await Promise.all([
        transaction.objectStore('meta').put(meta),
        transaction.objectStore('fig').put(Uint8Array.from(figBytes), meta.id),
        preview ? transaction.objectStore('preview').put(Uint8Array.from(preview), meta.id) : null,
        transaction.done
      ])
    },
    async update(meta) {
      await (await database).put('meta', meta)
    },
    async remove(id) {
      const db = await database
      const transaction = db.transaction(['meta', 'fig', 'preview'], 'readwrite')
      await Promise.all([
        transaction.objectStore('meta').delete(id),
        transaction.objectStore('fig').delete(id),
        transaction.objectStore('preview').delete(id),
        transaction.done
      ])
    }
  }
}
