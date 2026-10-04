import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** Home: the brief, Recent and the files footer. */
export const homeMessageDefaults = {
  title: 'What are you making?',
  lede: "Say what it is and who it's for. Attach what you already have, and Redrob reads it before it draws.",
  briefLabel: 'Your brief',
  briefPlaceholder: 'Describe a screen, a page or a flow',
  start: 'Start',
  addFiles: 'Add files',
  removeFile: params('Remove {name}'),
  suggestionsLabel: 'Try',
  suggestionPricing: 'A pricing page for Redrob Office',
  suggestionPricingBrief:
    'A pricing page for Redrob Office, for startup teams. Three plans, the price on every plan, and one clear way to start.',
  suggestionOnboarding: 'An onboarding flow for Redrob Passport',
  suggestionLaunch: 'A launch card for Redrob Design',
  recent: 'Recent',
  newMenu: 'New',
  newBlank: 'Blank',
  newPhone: 'Phone app',
  newWebsite: 'Website',
  newSocial: 'Social card',
  newPresets: 'More ways to start',
  openFile: 'Open a file…',
  onThisComputer: 'On this computer',
  editedAt: params('Edited {when}'),
  filesStayHere: 'Files stay on this computer.',
  keepInCloud: 'Keep them in your own cloud',
  syncingWith: params('Also syncing with {bucket}.')
} as const

export const homeMessages = i18n('home', homeMessageDefaults)
