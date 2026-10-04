import type { MemoryRule } from './types'

/**
 * Rules from the Redrob Design System itself. They hold for every file, so
 * they are in Design Memory whether or not a workspace is connected.
 */
export const DESIGN_SYSTEM_RULES: readonly MemoryRule[] = [
  {
    id: 'ds-english',
    text: 'American English. Short dashes, never em dashes.',
    source: 'Design System, voice'
  },
  {
    id: 'ds-scarcity',
    text: 'No scarcity words: limited, only, hurry.',
    source: 'Design System, voice'
  },
  {
    id: 'ds-blue-acts',
    text: 'Blue acts. Product color shows where you are, never on text or a control.',
    source: 'Design System, color',
    locked: true
  }
]
