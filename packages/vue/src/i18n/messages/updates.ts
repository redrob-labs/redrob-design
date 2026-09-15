import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const updatesMessageDefaults = {
  upToDate: 'Redrob Design is up to date',
  availableTitle: 'Update Redrob Design',
  available: params('Redrob Design {version} is available.'),
  installPrompt: 'Download and install it now? The app will restart after the update is installed.',
  downloading: params('Downloading Redrob Design {version}'),
  installedTitle: 'Update installed',
  installed: params('Redrob Design {version} was installed{size}. Restarting now.'),
  unavailable: 'Updates are not available yet. Publish a signed release with latest.json first.',
  checkFailed: params('Could not check for updates: {error}')
} as const

export const updatesMessages = i18n('updates', updatesMessageDefaults)
