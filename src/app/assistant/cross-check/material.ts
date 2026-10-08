import type { UIMessage } from 'ai'

import type { SceneGraph } from '@redrob-design/scene-graph'

import type { ChangeDetail } from '@/app/assistant/changes/store'
import { messageText } from '@/app/assistant/thread/text'

/** Longest text a change line quotes, so one long paragraph cannot fill the check. */
const MAX_QUOTED = 240
/** Most change lines a check reads; the rest are counted. */
const MAX_LINES = 60

function quote(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return JSON.stringify(flat.length > MAX_QUOTED ? `${flat.slice(0, MAX_QUOTED)}...` : flat)
}

/** One line per change, quoting the words a reader would see. */
export function describeChanges(items: readonly ChangeDetail[], graph: SceneGraph): string[] {
  const lines = items.slice(0, MAX_LINES).map((item) => {
    const label = `${item.type} "${item.name}"`
    if (item.kind === 'removed') return `removed ${label}`
    if (item.kind === 'added') {
      const node = graph.getNode(item.id)
      return node?.type === 'TEXT'
        ? `added ${label} with text ${quote(node.text)}`
        : `added ${label}`
    }
    if (item.textAfter !== undefined) {
      return `changed ${label}: text ${quote(item.textBefore ?? '')} -> ${quote(item.textAfter)}`
    }
    return `changed ${label}: ${item.keys.join(', ')}`
  })
  if (items.length > MAX_LINES) lines.push(`and ${items.length - MAX_LINES} more changes`)
  return lines
}

/** The words of a message, trimmed, without tool calls or data parts. */
export function answerText(message: UIMessage): string {
  return messageText(message).trim()
}

/** The person's brief for an answer: the last thing they said before it. */
export function briefFor(messages: readonly UIMessage[], answerId: string): string {
  const at = messages.findIndex((message) => message.id === answerId)
  const before = at === -1 ? messages : messages.slice(0, at)
  const user = before.findLast((message) => message.role === 'user')
  return user ? answerText(user) : ''
}
