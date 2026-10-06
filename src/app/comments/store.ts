import { ref, shallowReactive } from 'vue'

import { cloudState } from '@/app/integrations/console'

import { threadsOf } from './model'
import { getCommentStorage } from './storage'
import { LOCAL_AUTHOR_ID, type CommentAnchor, type CommentThread, type LocalComment } from './types'

/** The longest comment Redrob Cloud takes. */
export const MAX_COMMENT_LENGTH = 10_000

/** Comments of every document loaded in this session, by document key. */
export const commentsByDocument = shallowReactive(new Map<string, LocalComment[]>())

/** The thread whose pin is open on the canvas, if any. */
export const activeThreadId = ref<string | null>(null)

const loading = new Map<string, Promise<LocalComment[]>>()

function commentId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return `comment-${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function now(): string {
  return new Date().toISOString()
}

/** Reads a document's comments from this computer, once per session. */
export function loadComments(documentKey: string): Promise<LocalComment[]> {
  const loaded = commentsByDocument.get(documentKey)
  if (loaded) return Promise.resolve(loaded)
  let pending = loading.get(documentKey)
  if (!pending) {
    pending = getCommentStorage()
      .list(documentKey)
      .then((comments) => {
        commentsByDocument.set(documentKey, comments)
        return comments
      })
      .finally(() => loading.delete(documentKey))
    loading.set(documentKey, pending)
  }
  return pending
}

export function commentsOf(documentKey: string): LocalComment[] {
  return commentsByDocument.get(documentKey) ?? []
}

export function threadsFor(documentKey: string): CommentThread[] {
  return threadsOf(commentsOf(documentKey))
}

/** Replaces a document's comments, keeping this computer's copy in step. */
export async function replaceComments(
  documentKey: string,
  next: LocalComment[],
  removedIds: readonly string[] = []
): Promise<void> {
  const before = new Map(commentsOf(documentKey).map((comment) => [comment.id, comment]))
  commentsByDocument.set(documentKey, next)
  const storage = getCommentStorage()
  for (const comment of next) {
    if (before.get(comment.id) !== comment) await storage.put(comment)
  }
  for (const id of removedIds) await storage.remove(id)
}

async function change(
  documentKey: string,
  ids: ReadonlySet<string>,
  edit: (c: LocalComment) => LocalComment
) {
  await loadComments(documentKey)
  const next = commentsOf(documentKey).map((comment) =>
    ids.has(comment.id) ? edit(comment) : comment
  )
  await replaceComments(documentKey, next)
}

/** Starts a thread, or replies to one, on this computer first. */
export async function addComment(
  documentKey: string,
  input: { anchor: CommentAnchor; text: string; threadId?: string | null }
): Promise<LocalComment | null> {
  const text = input.text.trim().slice(0, MAX_COMMENT_LENGTH)
  if (text === '') return null
  await loadComments(documentKey)
  const account = cloudState.account
  const at = now()
  const comment: LocalComment = {
    id: commentId(),
    documentKey,
    threadId: input.threadId ?? null,
    // The anchor may come from reactive state, which IndexedDB cannot clone.
    anchor: { ...input.anchor },
    author: account ? { id: account.id, name: account.name } : { id: LOCAL_AUTHOR_ID, name: '' },
    text,
    resolved: false,
    createdAt: at,
    updatedAt: at,
    remote: false,
    synced: false,
    remoteUpdatedAt: null,
    deleted: false
  }
  await replaceComments(documentKey, [...commentsOf(documentKey), comment])
  return comment
}

/** Resolves or reopens a thread; the resolved state lives on its first comment. */
export function setThreadResolved(
  documentKey: string,
  threadId: string,
  resolved: boolean
): Promise<void> {
  return change(documentKey, new Set([threadId]), (comment) => ({
    ...comment,
    resolved,
    updatedAt: now(),
    synced: false
  }))
}

/**
 * Deletes a comment; deleting a thread's first comment deletes the thread.
 * Comments Redrob Cloud has wait as deleted until it confirms.
 */
export async function deleteComment(documentKey: string, id: string): Promise<void> {
  await loadComments(documentKey)
  const doomed = new Set(
    commentsOf(documentKey)
      .filter((comment) => comment.id === id || comment.threadId === id)
      .map((comment) => comment.id)
  )
  const kept: LocalComment[] = []
  const removed: string[] = []
  for (const comment of commentsOf(documentKey)) {
    if (!doomed.has(comment.id)) kept.push(comment)
    else if (comment.remote) {
      kept.push({ ...comment, deleted: true, synced: false, updatedAt: now() })
    } else removed.push(comment.id)
  }
  await replaceComments(documentKey, kept, removed)
  if (activeThreadId.value === id) activeThreadId.value = null
}

/** Forgets what is loaded, for tests. */
export function resetCommentsForTests(): void {
  commentsByDocument.clear()
  loading.clear()
  activeThreadId.value = null
}
