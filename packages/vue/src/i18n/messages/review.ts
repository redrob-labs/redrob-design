import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** Page checks Redrob posts in the thread: findings, Fix and Fix all. */
export const reviewMessageDefaults = {
  checked: params('Checked {name} on this computer, free: {count} to look at.'),
  checkedClean: params('Checked {name} on this computer, free. Nothing to fix.'),
  findingsLabel: 'Findings',
  severityHigh: 'High',
  severityMedium: 'Medium',
  severityLow: 'Low',
  settled: 'Fixed',
  suggestionLabel: 'Fix',
  fix: 'Fix',
  fixAll: params('Fix all {count}'),
  andMore: params('And {count} more.'),
  freeNote: 'Free. Point at a frame to talk about it.',
  allSettled: 'All fixed. Point at a frame to talk about it.',
  ruleColorContrast: 'Text is hard to read',
  ruleHardcodedColor: 'Color is not from a token',
  ruleSpacing: 'Spacing is off the 4px grid',
  ruleRadius: 'Corner radius is off the scale',
  ruleTextSize: 'Text is too small to read',
  ruleTouchTarget: 'Control is too small to tap',
  ruleTextStyle: 'Type is not from a token',
  rulePixels: 'Not on whole pixels',
  ruleOther: 'Something to look at'
} as const

export const reviewMessages = i18n('review', reviewMessageDefaults)
