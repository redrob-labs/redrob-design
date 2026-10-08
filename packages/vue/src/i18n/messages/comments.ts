import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** Comments: threads pinned to layers or the canvas, kept here first and shared when signed in. */
export const commentsMessageDefaults = {
  heading: 'Comments',
  description: params('Threads on {name}. Click a pin on the canvas to open its thread.'),
  add: 'Add comment',
  placing: 'Click where the comment goes. Esc stops.',
  stopPlacing: 'Stop',
  placeholder: 'Add a comment',
  replyPlaceholder: 'Reply',
  post: 'Post',
  reply: 'Reply',
  cancel: 'Cancel',
  resolve: 'Resolve',
  reopen: 'Reopen',
  deleteThread: 'Delete thread',
  deleteComment: 'Delete comment',
  close: 'Close',
  you: 'You',
  empty: 'No comments yet. Add one to start a thread on the canvas.',
  notShared: 'Not shared. Comments stay on this computer until you sign in to Redrob Cloud.',
  shared: 'Shared with your Redrob Cloud workspace.',
  replies: params('{count} replies'),
  resolved: 'Resolved',
  threadLabel: params('Thread {number}'),
  failed: params('Could not update comments: {error}')
} as const

export const commentsMessages = i18n('comments', commentsMessageDefaults)
