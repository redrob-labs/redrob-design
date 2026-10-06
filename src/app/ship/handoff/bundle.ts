import type { UIMessage } from 'ai'
import { zipSync } from 'fflate'

import type { SceneGraph } from '@redrob-design/scene-graph'

import { userTexts } from '@/app/assistant/thread/text'
import { pageLanguages } from '@/app/language/versions'
import { reviewPage } from '@/app/review/findings'
import { slugOf } from '@/app/ship/publish/build'
import { reactAndTokens } from '@/app/ship/ship'

/** Where a hand-off lands inside a repository, so Claude Code finds it by path. */
export const HANDOFF_DIR = '.redrob/handoff'

/** Most of the thread a brief quotes: the person's latest words matter most. */
const BRIEF_MESSAGES = 6

export interface HandoffInput {
  graph: SceneGraph
  pageId: string
  /** The thread the page came from; the person's words become the brief. */
  messages: readonly UIMessage[]
  /** Design Memory as models read it, or empty when Memory is off. */
  memory: string
  /** A PNG of the page's frames, when the renderer could draw one. */
  preview: Uint8Array | null
}

export interface HandoffBundle {
  slug: string
  /** Paths inside the hand-off folder, to their bytes. */
  files: Record<string, Uint8Array>
  /** What to paste into Claude Code from the repository root. */
  prompt: string
}

function userWords(messages: readonly UIMessage[]): string[] {
  return userTexts(messages)
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(-BRIEF_MESSAGES)
}

function quoteBlock(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

/** The brief Claude Code reads first: what was asked, what is open, and the rules. */
export function handoffBrief(input: HandoffInput, slug: string): string {
  const page = input.graph.getNode(input.pageId)
  const review = reviewPage(input.graph, input.pageId)
  const languages = pageLanguages(input.graph, input.pageId)
  const asked = userWords(input.messages)
  const lines = [
    `# ${page?.name ?? 'Page'}`,
    '',
    'Handed off from Redrob Design. Build this page in the repository with its existing',
    'components and conventions, reading colors and spacing from `tokens.json`.',
    '',
    '## Files',
    '',
    `- \`${HANDOFF_DIR}/${slug}/Page.jsx\`: the page as React + Tailwind, a starting point to adapt.`,
    `- \`${HANDOFF_DIR}/${slug}/tokens.json\`: design tokens in DTCG format.`
  ]
  if (input.preview) {
    lines.push(`- \`${HANDOFF_DIR}/${slug}/preview.png\`: how the page looks.`)
  }
  lines.push('', '## What was asked', '')
  if (asked.length === 0) lines.push('No brief was written in the thread.')
  else for (const words of asked) lines.push(quoteBlock(words), '')
  lines.push('## Still open', '')
  if (review.findings.length === 0) lines.push('The page check found nothing open.')
  for (const finding of review.findings) {
    const where = finding.where || finding.nodeName
    lines.push(`- **${finding.severity}** ${finding.detail}${where ? ` (${where})` : ''}`)
  }
  if (languages.length > 0) {
    lines.push('', '## Languages', '', `Ships in ${languages.join(', ')}.`)
  }
  if (input.memory) {
    lines.push('', '## Design Memory', '', '```text', input.memory, '```')
  }
  return `${lines.join('\n').trimEnd()}\n`
}

/** The page, its tokens, the brief and a preview, ready for Claude Code. */
export function buildHandoff(input: HandoffInput): HandoffBundle {
  const page = input.graph.getNode(input.pageId)
  const slug = slugOf(page?.name ?? 'page')
  const encoder = new TextEncoder()
  const { jsx, tokens } = reactAndTokens(input.graph, input.pageId)
  const files: Record<string, Uint8Array> = {
    'brief.md': encoder.encode(handoffBrief(input, slug)),
    'Page.jsx': encoder.encode(jsx),
    'tokens.json': encoder.encode(tokens)
  }
  if (input.preview) files['preview.png'] = input.preview
  return { slug, files, prompt: handoffPrompt(slug) }
}

export function handoffPrompt(slug: string): string {
  return `claude "Implement ${HANDOFF_DIR}/${slug}/brief.md"`
}

/** One zip that unpacks into `.redrob/handoff/<slug>/` at the repository root. */
export function handoffZip(bundle: HandoffBundle): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const [name, bytes] of Object.entries(bundle.files)) {
    entries[`${HANDOFF_DIR}/${bundle.slug}/${name}`] = bytes
  }
  return zipSync(entries)
}
