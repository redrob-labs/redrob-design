import type { ConsoleComment } from '@/app/integrations/console'

import type { CommentThread, LocalComment } from './types'

function oldestFirst(left: LocalComment, right: LocalComment): number {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
}

/** Threads in the order they were started, each with its replies oldest first. */
export function threadsOf(comments: readonly LocalComment[]): CommentThread[] {
  const live = comments.filter((comment) => !comment.deleted)
  const roots = live.filter((comment) => comment.threadId === null).toSorted(oldestFirst)
  return roots.map((root) => ({
    id: root.id,
    root,
    replies: live.filter((comment) => comment.threadId === root.id).toSorted(oldestFirst)
  }))
}

/** A comment as Redrob Cloud has it, now confirmed on this computer. */
export function fromRemote(remote: ConsoleComment, documentKey: string): LocalComment {
  return {
    id: remote.id,
    documentKey,
    threadId: remote.threadId,
    anchor: remote.anchor,
    author: remote.author,
    text: remote.text,
    resolved: remote.resolved,
    createdAt: remote.createdAt,
    updatedAt: remote.updatedAt,
    remote: true,
    synced: true,
    remoteUpdatedAt: remote.updatedAt,
    deleted: false
  }
}

/**
 * Folds what Redrob Cloud sent into what this computer has, by id. The
 * later edit wins, so resolving on one computer and replying on another
 * both stand; a local edit Redrob Cloud has not seen yet survives an older
 * remote copy and keeps the remote time for its If-Match.
 */
export function mergeRemote(
  local: readonly LocalComment[],
  remote: readonly ConsoleComment[],
  documentKey: string
): LocalComment[] {
  const merged = new Map(local.map((comment) => [comment.id, comment]))
  for (const incoming of remote) {
    const mine = merged.get(incoming.id)
    const keepMine = mine && !mine.synced && mine.updatedAt > incoming.updatedAt
    merged.set(
      incoming.id,
      keepMine
        ? { ...mine, remote: true, remoteUpdatedAt: incoming.updatedAt }
        : fromRemote(incoming, documentKey)
    )
  }
  return [...merged.values()]
}
