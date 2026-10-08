import type { ConsoleComment } from '@/app/integrations/console'

export type CommentAnchor = ConsoleComment['anchor']
export type CommentAuthor = ConsoleComment['author']

/** The author of comments made signed out; the UI says "You". */
export const LOCAL_AUTHOR_ID = 'local'

/** A comment as this computer keeps it, whether or not Redrob Cloud has it yet. */
export interface LocalComment {
  id: string
  /** The app's own key for the document; see `threadKeyFor`. */
  documentKey: string
  /** The thread's first comment; null for the first comment itself. */
  threadId: string | null
  anchor: CommentAnchor
  author: CommentAuthor
  text: string
  resolved: boolean
  createdAt: string
  updatedAt: string
  /** Redrob Cloud has this comment. */
  remote: boolean
  /** Redrob Cloud has this exact edit. */
  synced: boolean
  /** The `updatedAt` Redrob Cloud last confirmed, for If-Match. */
  remoteUpdatedAt: string | null
  /** Deleted here, waiting for Redrob Cloud to delete it too. */
  deleted: boolean
}

/** A thread: its first comment, which carries the pin and the resolved state, and replies. */
export interface CommentThread {
  id: string
  root: LocalComment
  replies: LocalComment[]
}

export interface CommentStorage {
  list(documentKey: string): Promise<LocalComment[]>
  put(comment: LocalComment): Promise<void>
  remove(id: string): Promise<void>
}
