import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** Plan mode in the thread: Design Memory, the questions before drawing, and directions. */
export const planMessageDefaults = {
  memoryHeading: 'Design Memory',
  memorySummary: params(
    '{colors} colors, {typefaces} typefaces, {components} components, {rules} rules'
  ),
  memoryOpen: 'Open',
  memoryDescription: params(
    '{owner}. Every model reads this before it draws, and the opening check holds every screen to it.'
  ),
  memoryFromFile: 'Read from this file, on this computer.',
  workspaceNotConnected:
    'No workspace is connected, so sites, repositories and sheets are not read yet.',
  workspaceConnected: params('Read from {sources}.'),
  sectionType: 'Type',
  sectionRadii: 'Radii',
  sectionRules: 'Voice and rules',
  sectionPrices: 'Prices',
  sectionComponents: params('{count} components'),
  noColors: 'No color variables in this file yet.',
  locked: 'Set by the Design System',
  pricePlan: 'Plan',
  priceValue: 'Per person, per month',
  close: 'Close',
  questionsLabel: 'Questions',
  questionsIntro: 'Two things, then I draw. Skip either and I use the likeliest answer.',
  skip: 'Skip, use your best guess',
  bestGuess: 'Use your best guess.',
  directionsLabel: 'Directions',
  directionsIntro:
    'Four directions, each a different idea of what the page is for. Pick one; you can take parts of the others later.',
  directionLetter: params('Direction {letter}'),
  pickDirection: params('Go with direction {letter}: {name}.'),
  showDirection: 'Show on the canvas'
} as const

export const planMessages = i18n('plan', planMessageDefaults)
