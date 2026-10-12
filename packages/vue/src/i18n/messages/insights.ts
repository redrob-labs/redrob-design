import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const insightsMessageDefaults = {
  title: 'AI work insights',
  description:
    'Labels each Redrob AI session on this device. Only labels and counts are sent to your workspace console, never your messages.',
  modelLabel: 'Work model',
  absent: 'Not downloaded. It downloads in the background after your next Redrob chat.',
  downloading: params('Downloading, {percent}%'),
  loading: 'Loading',
  ready: 'Ready',
  failed: params('Download failed: {reason}. It will try again later.'),
  unavailable: 'Not used in the browser. Sessions are labeled without the kind of work.'
} as const

export const insightsMessages = i18n('insights', insightsMessageDefaults)
