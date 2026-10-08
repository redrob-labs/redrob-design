import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** Sharing a file through Redrob Cloud: who can open it, at what role, and view links. */
export const sharingMessageDefaults = {
  share: 'Share',
  shareThisFile: 'Share this file',
  signInToShare: 'Sign in to Redrob Cloud to share this file with people.',
  signIn: 'Sign in',
  shareDescription:
    'Only people you invite can open it. It is encrypted on this computer before it leaves.',
  peopleWithAccess: 'People with access',
  emailAddress: 'Email address',
  invite: 'Invite',
  roleOwner: 'Owner',
  roleEditor: 'Can edit',
  roleCommenter: 'Can comment',
  roleViewer: 'Can view',
  invited: 'Invited',
  you: 'You',
  remove: 'Remove',
  withdraw: 'Withdraw',
  viewLinkTitle: 'View link',
  viewLinkOn: 'Anyone with the link can view this file.',
  viewLinkOff: 'Only people with access can open this file.',
  createViewLink: 'Create view link',
  copyViewLink: 'New view link',
  turnOffViewLink: 'Turn off',
  viewLinkCopied:
    'View link copied. Anyone who has it can read this file, and the old link stops working.',
  copyLink: 'Copy link',
  linkCopied: 'Link copied. It opens for people with access.',
  openShared: 'Open a shared file',
  pasteLink: 'Paste a Redrob Design link',
  open: 'Open',
  notALink: 'That is not a Redrob Design file link.',
  noAccess: 'You do not have access to this file.',
  waitingForKey:
    "This computer is waiting for the file's key. It arrives the next time someone with access opens the file.",
  signInToOpen: 'Sign in to Redrob Cloud to open this file.',
  unreachable: 'Redrob Cloud could not be reached. Try again in a moment.',
  sharedWithYou: 'Shared with you',
  noSharedFiles: 'Files people share with you appear here.',
  waitingForAccess: 'Waiting for access',
  viewOnly: 'View only',
  shareFailed: params('Could not share this file: {error}')
} as const

export const sharingMessages = i18n('sharing', sharingMessageDefaults)
