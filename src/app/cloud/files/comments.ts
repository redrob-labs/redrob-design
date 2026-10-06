import { z } from 'zod'

import {
  commentAnchorSchema,
  consoleClient,
  type ConsoleComment,
  type FileComment
} from '@/app/integrations/console'

import { contentKey } from './keyring'
import { openText, sealText } from './sealed'

/**
 * Comments on a shared file, as the comment sync speaks them: plain text and pin here, one sealed
 * value at Console. The sealed value also names the comment it belongs to, so Console moving one
 * comment's ciphertext onto another is caught when it is opened.
 */
const sealedCommentSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(10_000),
  anchor: commentAnchorSchema
})

/** What Console sent: a comment, opened, or word that one was deleted. */
export type RemoteComment =
  | { kind: 'comment'; comment: ConsoleComment }
  | { kind: 'deleted'; id: string }

async function seal(
  fileId: string,
  epoch: number,
  value: { id: string; text: string; anchor: ConsoleComment['anchor'] }
): Promise<string> {
  const key = await contentKey(fileId, epoch)
  return sealText(key, { fileId, epoch, purpose: { kind: 'comment' } }, JSON.stringify(value))
}

async function opened(fileId: string, remote: FileComment): Promise<RemoteComment | null> {
  if (remote.deleted || remote.ciphertext === null) return { kind: 'deleted', id: remote.id }
  try {
    const key = await contentKey(fileId, remote.epoch)
    const plain = await openText(key, { fileId, purpose: { kind: 'comment' } }, remote.ciphertext)
    const parsed = sealedCommentSchema.safeParse(JSON.parse(plain))
    if (!parsed.success || parsed.data.id !== remote.id) return null
    return {
      kind: 'comment',
      comment: {
        id: remote.id,
        documentId: fileId,
        threadId: remote.threadId,
        anchor: parsed.data.anchor,
        author: { id: remote.author.id ?? 'unknown', name: remote.author.name },
        text: parsed.data.text,
        resolved: remote.resolved,
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt
      }
    }
  } catch (error) {
    console.warn('[Comments] Skipped a comment that did not open with the file key', error)
    return null
  }
}

/** Every change since `since` (or every live comment), opened, across pages. */
export async function listFileComments(
  fileId: string,
  since: string | undefined,
  link?: string
): Promise<RemoteComment[]> {
  const out: RemoteComment[] = []
  let cursor: string | undefined
  do {
    const { data } = await consoleClient().call('listComments', {
      params: { fileId },
      query: { updatedSince: since, cursor },
      link
    })
    for (const remote of data.items) {
      const entry = await opened(fileId, remote)
      if (entry) out.push(entry)
    }
    cursor = data.nextCursor ?? undefined
  } while (cursor)
  return out
}

export async function createFileComment(
  fileId: string,
  epoch: number,
  comment: {
    id: string
    threadId: string | null
    text: string
    anchor: ConsoleComment['anchor']
    createdAt: string
  }
): Promise<ConsoleComment> {
  const ciphertext = await seal(fileId, epoch, comment)
  const { data } = await consoleClient().call('createComment', {
    params: { fileId },
    body: {
      id: comment.id,
      threadId: comment.threadId,
      ciphertext,
      epoch,
      createdAt: comment.createdAt
    }
  })
  const entry = await opened(fileId, data)
  if (entry?.kind !== 'comment')
    throw new Error('Redrob Cloud answered with a comment that did not open')
  return entry.comment
}

/**
 * Sends a change. Only the author may change the text and pin, so anyone else sends just the
 * resolved state; Console refuses the rest from them.
 */
export async function updateFileComment(
  fileId: string,
  epoch: number,
  comment: {
    id: string
    text: string
    anchor: ConsoleComment['anchor']
    resolved: boolean
    mine: boolean
  },
  ifMatch: string | undefined
): Promise<ConsoleComment> {
  const body = comment.mine
    ? { ciphertext: await seal(fileId, epoch, comment), epoch, resolved: comment.resolved }
    : { resolved: comment.resolved }
  const { data } = await consoleClient().call('updateComment', {
    params: { fileId, commentId: comment.id },
    body,
    ifMatch
  })
  const entry = await opened(fileId, data)
  if (entry?.kind !== 'comment')
    throw new Error('Redrob Cloud answered with a comment that did not open')
  return entry.comment
}

export async function deleteFileComment(fileId: string, commentId: string): Promise<void> {
  await consoleClient().call('deleteComment', { params: { fileId, commentId } })
}
