import { cloudFileIdOf } from '@/app/assistant/thread/store'
import {
  canCommentOn,
  cloudBindingForKey,
  createFileComment,
  deleteFileComment,
  listFileComments,
  updateFileComment,
  type CloudFileBinding
} from '@/app/cloud/files'
import { ConsoleError, cloudState, consoleCache, signedIn } from '@/app/integrations/console'

import { fromRemote, mergeRemote } from './model'
import { commentsOf, loadComments, replaceComments } from './store'
import type { LocalComment } from './types'

function isCursor(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function cursorKey(fileId: string): string {
  return `comments-since:${fileId}`
}

function errorKind(error: unknown): string | null {
  return error instanceof ConsoleError ? error.kind : null
}

/** Reads what changed in Redrob Cloud since the last read and folds it in, deletions included. */
async function pull(documentKey: string, binding: CloudFileBinding): Promise<void> {
  const cache = consoleCache()
  const since = await cache.get(cursorKey(binding.fileId), isCursor)
  const remote = await listFileComments(binding.fileId, since?.value, binding.link ?? undefined)
  if (remote.length === 0) return
  const comments = remote.flatMap((entry) => (entry.kind === 'comment' ? [entry.comment] : []))
  const deleted = new Set(remote.flatMap((entry) => (entry.kind === 'deleted' ? [entry.id] : [])))
  const merged = mergeRemote(commentsOf(documentKey), comments, documentKey)
  await replaceComments(
    documentKey,
    merged.filter((comment) => !deleted.has(comment.id)),
    [...deleted]
  )
  const latest = comments
    .map((comment) => comment.updatedAt)
    .toSorted()
    .at(-1)
  if (latest) await cache.put(cursorKey(binding.fileId), latest, null)
}

/** Sends one local change; returns the comment as it stands now, or null once deleted. */
async function push(
  comment: LocalComment,
  binding: CloudFileBinding
): Promise<LocalComment | null> {
  const { fileId, epoch } = binding
  if (comment.deleted) {
    try {
      await deleteFileComment(fileId, comment.id)
    } catch (error) {
      if (errorKind(error) !== 'not-found') throw error
    }
    return null
  }
  if (!comment.remote) {
    const created = fromRemote(await createFileComment(fileId, epoch, comment), comment.documentKey)
    // A thread resolved before it ever reached Redrob Cloud still needs that edit.
    return comment.resolved === created.resolved
      ? created
      : push({ ...comment, remote: true, remoteUpdatedAt: created.updatedAt }, binding)
  }
  const updated = await updateFileComment(
    fileId,
    epoch,
    { ...comment, mine: comment.author.id === cloudState.account?.id },
    comment.remoteUpdatedAt ? `"${comment.remoteUpdatedAt}"` : undefined
  )
  return fromRemote(updated, comment.documentKey)
}

/**
 * Brings a shared file's comments in step with Redrob Cloud: first what changed there, then every
 * change made here. A change someone else made first comes back as a conflict; the next sync reads
 * theirs and the later edit wins. A file on this computer keeps its comments here.
 */
export async function syncComments(documentKey: string): Promise<'synced' | 'local' | 'offline'> {
  await loadComments(documentKey)
  const binding = cloudFileIdOf(documentKey) ? cloudBindingForKey(documentKey) : null
  if (!binding || (!signedIn.value && !binding.link)) return 'local'
  try {
    await pull(documentKey, binding)
    if (!canCommentOn(documentKey)) return 'synced'
    for (const comment of commentsOf(documentKey).filter((entry) => !entry.synced)) {
      try {
        const next = await push(comment, binding)
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
          await consoleCache().remove(cursorKey(binding.fileId))
        } else throw error
      }
    }
    return 'synced'
  } catch (error) {
    console.warn('[Comments] Keeping comments on this computer until Redrob Cloud answers', error)
    return 'offline'
  }
}
