import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** Version history: versions of the open file, kept here and in Redrob Cloud when signed in. */
export const historyMessageDefaults = {
  heading: 'Version history',
  description: params(
    'Versions of {name}. Redrob saves one every 10 minutes while you edit; named versions stay until you delete them.'
  ),
  notShared: 'On this computer only. Sign in to Redrob Cloud to keep versions there too.',
  shared: 'Kept on this computer and in Redrob Cloud.',
  nameLabel: 'Version name',
  namePlaceholder: 'What changed',
  save: 'Save version',
  saved: 'Version saved.',
  empty: 'No versions yet. Edit the file or save a version to start its history.',
  autosaved: 'Autosaved',
  unnamed: 'Named version',
  inCloud: 'In Redrob Cloud',
  notUploaded: 'On this computer',
  savedBy: params('Saved by {name}'),
  previewAlt: params('Preview of {name}'),
  restore: 'Restore',
  rename: 'Name',
  renameDone: 'Done',
  delete: 'Delete',
  restored: params('Restored {name}. Undo puts the file back as it was.'),
  restoreFailed: params('Could not restore the version: {error}'),
  failed: params('Could not update version history: {error}'),
  close: 'Close'
} as const

export const historyMessages = i18n('history', historyMessageDefaults)
