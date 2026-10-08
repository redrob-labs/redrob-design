import { getToolName, isTextUIPart, isToolUIPart } from 'ai'
import type { UIMessage } from 'ai'

import type { AgentStep, AgentStepState } from '@/components/ui/agent/types'

export interface TimelineWords {
  stepReading: string
  stepWorking: string
  stepAnswering: string
  stepTool: (tool: string) => string
}

/** `create_frame` and `mcp__server__create_frame` both read as "Create frame". */
export function humanToolName(name: string): string {
  const words = name
    .replace(/^mcp__[^_]+__/, '')
    .replace(/_/g, ' ')
    .trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function toolStepState(state: string): AgentStepState {
  if (state === 'output-error') return 'error'
  if (state === 'output-available') return 'done'
  return 'active'
}

/**
 * The steps of the turn in progress, in plain sentences: reading the message,
 * each tool Redrob used, then writing the answer. `answer` is the assistant
 * message being written, or null before the first part arrives.
 */
export function turnSteps(answer: UIMessage | null, words: TimelineWords): AgentStep[] {
  const parts = answer?.parts ?? []
  const tools = parts.filter(isToolUIPart)
  const writing = parts.some((part) => isTextUIPart(part) && part.text.length > 0)
  const toolRunning = tools.some(
    (part) => part.state !== 'output-available' && part.state !== 'output-error'
  )

  const steps: AgentStep[] = [
    { id: 'reading', label: words.stepReading, state: parts.length === 0 ? 'active' : 'done' }
  ]
  for (const part of tools) {
    steps.push({
      id: `tool-${part.toolCallId}`,
      label: words.stepTool(humanToolName(getToolName(part))),
      state: toolStepState(part.state)
    })
  }
  if (parts.length > 0 && !toolRunning) {
    steps.push({
      id: writing ? 'answering' : 'working',
      label: writing ? words.stepAnswering : words.stepWorking,
      state: 'active'
    })
  }
  return steps
}
