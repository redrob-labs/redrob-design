import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** Ship in the thread: the ways a page leaves Redrob Design, and the page watching its sources. */
export const shipMessageDefaults = {
  ship: 'Ship',
  shipOpen: 'Ship is already open in the thread.',
  ready: 'Checked and ready. It is layers, code and tokens already.',
  open: params('{count} findings are still open. You can ship anyway; they stay in this thread.'),
  empty: 'There is nothing on this page to ship yet.',
  actionsLabel: 'Ways to ship',
  publish: 'Publish',
  published: 'Published',
  publishedTo: params('Published to {site}.'),
  publishNotConnected: 'Publishing needs a connected site, and none is connected yet.',
  reactTokens: 'React + tokens',
  handToClaudeCode: 'Hand to Claude Code',
  handedOff: 'Handed to Claude Code over MCP: the page, tokens.json and the brief.',
  handoffNotConnected:
    'Handing to Claude Code needs its MCP connection. Connect it in Settings, under Agents and MCP.',
  exportForFigma: 'Export for Figma',
  watchTitle: 'This page updates itself.',
  watchBody: params(
    'It watches {sources} and Design Memory, and proposes its own change when one of them moves.'
  ),
  watchNotConnected:
    'Once a workspace is connected, it can watch a price sheet or a site and propose its own change.',
  tryUpdate: 'Try it: the price sheet changes',
  updateChanged: 'Pricing sheet, Q4 changed, so the page proposes its own update.',
  updateNothing: 'The price sheet changed, but no layer on this page shows the old price.'
} as const

export const shipMessages = i18n('ship', shipMessageDefaults)
