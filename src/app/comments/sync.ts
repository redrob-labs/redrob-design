import {
  ConsoleError,
  consoleCache,
  consoleClient,
  consoleDocumentId,
  signedIn
} from '@/app/integrations/console'

import { fromRemote, mergeRemote } from './model'
import { commentsOf, loadComments, replaceComments } from './store'
import type { LocalComment } from './types'

function isCursor(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function cursorKey(documentId: string): string {
  return `comments-since:${documentId}`
}

function errorKind(error: unknown): string | null {
  return error instanceof ConsoleError ? error.kind : null
}

/** Reads what changed in Redrob Cloud since the last read and folds it in. */
async function pull(documentKey: string, documentId: string): Promise<void> {
  const cache = consoleCache()
  const since = await cache.get(cursorKey(documentId), isCursor)
  const client = consoleClient()
  const remote = []
  let cursor: string | undefined
  do {
    const { data } = await client.call('listComments', {
      params: { documentId },
      query: { updatedSince: since?.value, cursor }
    })
    remote.push(...data.items)
    cursor = data.nextCursor ?? undefined
  } while (cursor)
  if (remote.length === 0) return
  await replaceComments(documentKey, mergeRemote(commentsOf(documentKey), remote, documentKey))
  const latest = remote
    .map((comment) => comment.updatedAt)
    .toSorted()
    .at(-1)
  if (latest) await cache.put(cursorKey(documentId), latest, null)
}

/** Sends one local change; returns the comment as it stands now, or null once deleted. */
async function push(comment: LocalComment, documentId: string): Promise<LocalComment | null> {
  const client = consoleClient()
  const params = { documentId, commentId: comment.id }
  if (comment.deleted) {
    try {
      await client.call('deleteComment', { params })
    } catch (error) {
      if (errorKind(error) !== 'not-found') throw error
    }
    return null
  }
  if (!comment.remote) {
    const { data } = await client.call('createComment', {
      params: { documentId },
      body: {
        id: comment.id,
        threadId: comment.threadId,
        anchor: comment.anchor,
        text: comment.text,
        createdAt: comment.createdAt
      }
    })
    const created = fromRemote(data, comment.documentKey)
    // A thread resolved before it ever reached Redrob Cloud still needs that edit.
    return comment.resolved === created.resolved
      ? created
      : push({ ...comment, remote: true, remoteUpdatedAt: created.updatedAt }, documentId)
  }
  const { data } = await client.call('updateComment', {
    params,
    body: {
      text: comment.text,
      resolved: comment.resolved,
      anchor: comment.anchor,
      updatedAt: comment.updatedAt
    },
    ifMatch: comment.remoteUpdatedAt ? `"${comment.remoteUpdatedAt}"` : undefined
  })
  return fromRemote(data, comment.documentKey)
}

/**
 * Brings a document's comments in step with Redrob Cloud: first what
 * changed there, then every change made here. A change someone else made
 * first comes back as a conflict; the next sync reads theirs and the later
 * edit wins. Signed out, comments stay on this computer.
 */
export async function syncComments(documentKey: string): Promise<'synced' | 'local' | 'offline'> {
  await loadComments(documentKey)
  if (!signedIn.value) return 'local'
  const documentId = await consoleDocumentId(documentKey)
  try {
    await pull(documentKey, documentId)
    for (const comment of commentsOf(documentKey).filter((entry) => !entry.synced)) {
      try {
        const next = await push(comment, documentId)
        const rest = commentsOf(documentKey).filter((entry) => entry.id !== comment.id)
        await replaceComments(documentKey, next ? [...rest, next] : rest, next ? [] : [comment.id])
      } catch (error) {
        const kind = errorKind(error)
        if (kind === 'not-found') {
          // Someone deleted it in Redrob Cloud; it goes here too.
          const rest = commentsOf(documentKey).filter((entry) => entry.id !== comment.id)
          await replaceComments(documentKey, rest, [comment.id])
        } else if (kind === 'conflict') {
          // Theirs is newer: read everything again next time, and the later edit wins.
          await consoleCache().remove(cursorKey(documentId))
        } else throw error
      }
    }
    return 'synced'
  } catch (error) {
    console.warn('[Comments] Keeping comments on this computer until Redrob Cloud answers', error)
    return 'offline'
  }
}
