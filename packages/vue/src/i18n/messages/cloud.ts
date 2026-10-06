import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** Redrob Cloud in Settings: signing in to Console and picking a workspace. */
export const cloudMessageDefaults = {
  heading: 'Redrob Cloud',
  description:
    'Optional. Sign in to share Design Memory, comments, versions and libraries with your workspace. Your files and AI keys stay where they are.',
  signedOut: 'Not signed in. Everything works on this computer without an account.',
  signIn: 'Sign in with Redrob Console',
  signingIn: 'Waiting for you to approve this code in Redrob Console.',
  openConsole: 'Open Redrob Console',
  cancel: 'Cancel',
  signedInAs: params('Signed in as {name}.'),
  workspace: 'Workspace',
  noWorkspace: 'This account is not in a workspace yet.',
  signOut: 'Sign out',
  unreachable: 'Redrob Console could not be reached. Cloud features wait until it answers.',
  denied: 'The sign-in was not approved.',
  expired: 'The code expired before it was approved. Try again.',
  role: params('{role} in this workspace')
} as const

export const cloudMessages = i18n('cloud', cloudMessageDefaults)
