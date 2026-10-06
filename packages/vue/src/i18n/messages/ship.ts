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
  publishAgain: 'Publish again',
  unpublish: 'Unpublish',
  unpublished: 'The page is no longer published.',
  publishedUnverified: params(
    'Uploaded to {site}. This browser could not check the address; open it to make sure the bucket is public.'
  ),
  publishNoBucket:
    'Publishing needs a publish bucket. Set one up in Settings, under Storage, Publish site.',
  publishNoSiteURL:
    'Publishing needs the public address of the publish bucket. Add it in Settings, under Storage, Publish site.',
  publishFailed: params('Could not publish: {error}'),
  publishUnreachable: params(
    'The files are uploaded, but {url} does not answer yet. Make the publish bucket public with your provider.'
  ),
  publishFontFallbacks: params(
    'These typefaces are not on the web, so visitors see a fallback: {fonts}.'
  ),
  publishConfirmHeading: 'Publish this page?',
  publishConfirmText:
    'Anyone with the address can see it. It goes to your publish bucket, and Unpublish takes it down.',
  reactTokens: 'React + tokens',
  handToClaudeCode: 'Hand to Claude Code',
  handedOffMCP:
    'Sent to Claude Code over MCP: the page, tokens.json and the brief. Run /mcp__redrob-design__redrob_handoff there; the command is copied.',
  handoffSaved: params(
    'Saved the page, tokens.json and the brief to {path}. The prompt for Claude Code is copied.'
  ),
  handoffDownloaded: params(
    'Downloaded {file}. Unzip it at the root of your repository; the prompt for Claude Code is copied.'
  ),
  handoffFailed: params('Could not hand off: {error}'),
  exportForFigma: 'Export for Figma',
  watchTitle: 'This page updates itself.',
  watchBody: params(
    'It watches {sources} and Design Memory, and proposes its own change when one of them moves.'
  ),
  watchNotConnected:
    'Once a workspace is connected, it can watch a price sheet or a site and propose its own change.',
  tryUpdate: 'Try it: the price sheet changes',
  updateChanged: 'Pricing sheet, Q4 changed, so the page proposes its own update.',
  updateNothing: 'The price sheet changed, but no layer on this page shows the old price.',
  watchUpdated: params('{source} changed ({summary}), so the page proposes its own update.'),
  watchNoMatch: params('{source} changed ({summary}), but nothing on this page shows what moved.'),
  stopWatching: 'Stop watching',
  watchStopped: 'This page no longer watches its sources.',
  watchFailed: params('Could not watch the sources: {error}')
} as const

export const shipMessages = i18n('ship', shipMessageDefaults)
