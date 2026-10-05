import type { SceneGraph } from '@redrob-design/scene-graph'

import { assistantControlsFor } from '@/app/assistant/controls/store'
import { loadPersonalNotes, personalNotes, personalNotesBrief } from '@/app/memory/notes/store'
import { designMemoryBrief, designMemorySource } from '@/app/memory/service'

/** The document a turn is about; in the app, the active editor store. */
export interface TurnOwner {
  graph: SceneGraph
  state: { documentName: string }
}

const PLAN_MODE = [
  'Plan mode. Before you draw anything new, read the brief and Design Memory.',
  'If two answers would change the design, call ask_plan_questions with at most two questions and stop; the answers arrive next.',
  'To start a new page or screen, call create_directions with four different ideas, then draw each inside its frame with render.'
].join(' ')

const RUN_MODE =
  'Run mode. Do not ask questions first; use the likeliest answer and make the change.'

/**
 * What one answer adds to the system prompt: the Plan or Run rule the person
 * chose and, unless Memory is off, Design Memory. Memory off means nothing
 * from Design Memory is read or sent.
 */
export function turnContext(store: TurnOwner): string {
  const controls = assistantControlsFor(store)
  const parts = [controls.mode === 'run' ? RUN_MODE : PLAN_MODE]
  if (controls.memory !== 'none') {
    const memory = designMemorySource().read(store.graph, store.state.documentName)
    parts.push(designMemoryBrief(memory))
  }
  // "All my work" adds the person's own notes; the other scopes never read them.
  if (controls.memory === 'all') {
    void loadPersonalNotes()
    const notes = personalNotesBrief(personalNotes.value)
    if (notes) parts.push(notes)
  }
  return parts.join('\n\n')
}

/** The instructions for one answer: the system prompt, then the turn context. */
export function turnInstructions(store: TurnOwner, systemPrompt: string): string {
  return [systemPrompt, turnContext(store)].join('\n\n')
}
