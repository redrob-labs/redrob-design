import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** The composer bar and the status line under it, on Home, in Describe and in Edit. */
export const composerMessageDefaults = {
  fieldLabel: 'Describe a change',
  send: 'Send',
  stop: 'Stop',
  addFiles: 'Add files',
  modeLabel: 'How Redrob works on this brief',
  modePlan: 'Plan',
  modePlanHint: 'Redrob asks two things and offers directions before it draws.',
  modeRun: 'Run',
  modeRunHint: 'Redrob draws from its best guess.',
  modelLabel: 'Model',
  auto: 'Redrob Auto',
  autoText: 'Each message goes to the highest place on the Redrob Leaderboard that runs here.',
  rankingHeading: 'Top 5 for designing screens and layouts',
  effort: 'Effort',
  runsElsewhere: params('Runs in {harness}'),
  statusLabel: 'How Redrob treats every message',
  privacy: 'Privacy',
  privacyHigh: 'High',
  privacyRunning: 'Running on this computer',
  privacyHeading: 'Privacy protection is on',
  privacySummary:
    'A small AI on this computer swaps private details for placeholders before anything leaves it.',
  privacyAdmin: 'Set for your whole team by your admin.',
  privacyStandard: 'Standard',
  privacyStandardDetail: 'Numbers with a fixed shape, like cards, accounts and IDs.',
  privacyHighDetail: 'Also names, addresses and contact details.',
  privacyStrict: 'Strict',
  privacyStrictDetail: 'Nothing private leaves this computer.',
  memory: 'Memory',
  memoryOn: 'On for every AI',
  memoryOff: 'Off',
  memoryLabel: 'What Memory reads',
  memoryOnTitle: 'One memory for every AI',
  memoryOffTitle: 'Memory is off for this chat',
  memoryOffText: 'Nothing is read, and nothing is saved.',
  memoryProduct: 'This product',
  memoryProductDetail: 'Design Memory for this file',
  memoryProductSummary:
    'Colors, type, components and rules, kept by Redrob outside any AI, so they work with every model.',
  memoryAll: 'All my work',
  memoryAllDetail: 'Also your notes on how you like to work',
  memoryAllSummary: 'Design Memory plus your notes, kept by Redrob outside any AI.',
  memoryNone: 'Off for this chat',
  memoryFoot: 'Yours to keep: download every note at any time.',
  crossCheck: 'Cross-check',
  crossCheckLede:
    'After Redrob draws, AIs from other companies check the work. Every check says who ran it.',
  factCheck: 'Fact check',
  factCheckText:
    'An AI from another company reads the page as drawn against Design Memory: contrast, type, prices, voice and every line break. About 40 seconds.',
  challenge: 'Challenge',
  challengeText:
    'One AI argues for the direction, another against, for three rounds, and a third says what held up. About 2 minutes.',
  levelOff: 'Off',
  levelAuto: 'When it matters',
  levelAlways: 'Always',
  someOn: params('{on} of {total} on'),
  crossCheckFoot: 'Every check says which AI ran it.',
  modelsAndKeys: 'Models and keys'
} as const

export const composerMessages = i18n('composer', composerMessageDefaults)
