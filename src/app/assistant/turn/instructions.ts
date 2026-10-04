import { assistantControlsFor } from '@/app/assistant/controls/store'
import type { EditorStore } from '@/app/editor/active-store'
import { designMemoryBrief, designMemorySource } from '@/app/memory/service'

const PLAN_MODE = [
  'Plan mode. Before you draw anything new, read the brief and Design Memory.',
  'If two answers would change the design, call ask_plan_questions with at most two questions and stop; the answers arrive next.',
  'To start a new page or screen, call create_directions with four different ideas, then draw each inside its frame with render.'
].join(' ')

const RUN_MODE =
  'Run mode. Do not ask questions first; use the likeliest answer and make the change.'

/**
 * The instructions for one answer: the system prompt, the Plan or Run rule
 * the person chose, and Design Memory, which every model reads before it draws.
 */
export function turnInstructions(store: EditorStore, systemPrompt: string): string {
  const mode = assistantControlsFor(store).mode === 'run' ? RUN_MODE : PLAN_MODE
  const memory = designMemorySource().read(store.graph, store.state.documentName)
  return [systemPrompt, mode, designMemoryBrief(memory)].join('\n\n')
}
