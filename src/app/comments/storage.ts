import type { DBSchema } from 'idb'

import { APP_DATABASE_NAMES, defineAppDatabase, openAppDatabase } from '@/app/storage/idb'

import type { CommentStorage, LocalComment } from './types'

interface CommentsDatabase extends DBSchema {
  comments: { key: string; value: LocalComment; indexes: { byDocument: string } }
}

const commentsDatabase = defineAppDatabase<CommentsDatabase>({
  name: APP_DATABASE_NAMES.comments,
  version: 1,
  callbacks: {
    upgrade(database) {
      const store = database.createObjectStore('comments', { keyPath: 'id' })
      store.createIndex('byDocument', 'documentKey')
    }
  }
})

function createIdbCommentStorage(): CommentStorage {
  const database = openAppDatabase(commentsDatabase)
  return {
    list: async (documentKey) =>
      (await database).getAllFromIndex('comments', 'byDocument', documentKey),
    put: async (comment) => {
      await (await database).put('comments', structuredClone(comment))
    },
    remove: async (id) => {
      await (await database).delete('comments', id)
    }
  }
}

/** Comments for this session only, where IndexedDB is unavailable and in tests. */
export function createMemoryCommentStorage(): CommentStorage {
  const comments = new Map<string, LocalComment>()
  return {
    list: (documentKey) =>
      Promise.resolve(
        [...comments.values()]
          .filter((comment) => comment.documentKey === documentKey)
          .map((comment) => structuredClone(comment))
      ),
    put: (comment) => {
      comments.set(comment.id, structuredClone(comment))
      return Promise.resolve()
    },
    remove: (id) => {
      comments.delete(id)
      return Promise.resolve()
    }
  }
}

let storage: CommentStorage | null = null

export function getCommentStorage(): CommentStorage {
  storage ??=
    typeof indexedDB === 'undefined' ? createMemoryCommentStorage() : createIdbCommentStorage()
  return storage
}

export function setCommentStorageForTests(next: CommentStorage | null): void {
  storage = next
}
