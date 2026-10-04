import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** The conversation: receipts, progress and the cards Redrob posts. */
export const threadMessageDefaults = {
  receiptLabel: 'About this answer',
  byAuto: 'by Redrob Auto',
  yourChoice: 'your choice',
  free: 'Free',
  priceUnknown: 'Price not reported',
  keptPrivate: params('{count} kept private'),
  private: 'Private',
  factCheck: 'Fact check',
  progressLabel: 'What Redrob is doing',
  stepReading: 'Reading your message',
  stepWorking: 'Working on the page',
  stepAnswering: 'Writing the answer',
  stepTool: params('Used {tool}')
} as const

export const threadMessages = i18n('thread', threadMessageDefaults)
