import type { SessionUpdate } from '@agentclientprotocol/sdk'
import type { UIMessageChunk } from 'ai'

import type { JSONObject } from '@redrob-design/scene-graph/primitives'

export interface MapResult {
  chunks: UIMessageChunk[]
  textStarted: boolean
}

export function mapUpdate(update: SessionUpdate, textId: string, textStarted: boolean): MapResult {
  const chunks: UIMessageChunk[] = []

  switch (update.sessionUpdate) {
    case 'agent_message_chunk': {
      if (update.content.type === 'text' && update.content.text) {
        if (!textStarted) {
          chunks.push({ type: 'text-start', id: textId })
          textStarted = true
        }
        chunks.push({
          type: 'text-delta',
          id: textId,
          delta: update.content.text
        })
      } else if (update.content.type !== 'text') {
        console.warn('[ACP] Unhandled content type:', update.content.type)
      }
      break
    }
    case 'agent_thought_chunk': {
      if (update.content.type === 'text') {
        const rid = `reasoning-${textId}`
        chunks.push({ type: 'reasoning-start', id: rid })
        chunks.push({
          type: 'reasoning-delta',
          id: rid,
          delta: update.content.text
        })
        chunks.push({ type: 'reasoning-end', id: rid })
      }
      break
    }
    case 'tool_call': {
      if (!update.title) {
        console.warn('[ACP] Tool call without title:', update.toolCallId)
      }
      const toolName = update.title || 'unknown'
      chunks.push({
        type: 'tool-input-start',
        toolCallId: update.toolCallId,
        toolName,
        providerExecuted: true,
        title: update.title
      })
      if (update.rawInput) {
        chunks.push({
          type: 'tool-input-available',
          toolCallId: update.toolCallId,
          toolName,
          input: update.rawInput,
          providerExecuted: true,
          title: update.title
        })
      }
      break
    }
    case 'tool_call_update': {
      const inputChunk = toolInputUpdate(update)
      if (inputChunk) {
        chunks.push(inputChunk)
      } else if (update.status === 'completed') {
        chunks.push({
          type: 'tool-output-available',
          toolCallId: update.toolCallId,
          output: update.rawOutput ?? textFromContent(update.content ?? undefined),
          providerExecuted: true
        })
      } else if (update.status === 'failed') {
        chunks.push({
          type: 'tool-output-error',
          toolCallId: update.toolCallId,
          errorText: textFromContent(update.content ?? undefined) ?? 'Tool call failed',
          providerExecuted: true
        })
      }
      break
    }
  }

  return { chunks, textStarted }
}

type ToolCallUpdate = Extract<SessionUpdate, { sessionUpdate: 'tool_call_update' }>

/**
 * The first tool_call often carries an empty input (it is still streaming); the full input
 * arrives with the in_progress update. The engine's `question` tool needs it to show what it asks.
 */
function toolInputUpdate(update: ToolCallUpdate): UIMessageChunk | null {
  const input = update.rawInput
  if (update.status !== 'in_progress' || !update.title) return null
  if (typeof input !== 'object' || input === null || Object.keys(input).length === 0) return null
  return {
    type: 'tool-input-available',
    toolCallId: update.toolCallId,
    toolName: update.title,
    input,
    providerExecuted: true,
    title: update.title
  }
}

export function textFromContent(content: JSONObject[] | undefined): string | undefined {
  if (!content) return undefined
  const parts: string[] = []
  for (const c of content) {
    if (c.type !== 'content') continue
    const inner = c.content as JSONObject | undefined
    if (inner?.type === 'text' && typeof inner.text === 'string') {
      parts.push(inner.text)
    }
  }
  return parts.length > 0 ? parts.join('\n') : undefined
}
