import type { UIMessage } from 'ai'

import type { TurnOwner } from './instructions'

export interface AnswerFinished {
  store: TurnOwner
  message: UIMessage
  messages: readonly UIMessage[]
}

type Listener = (event: AnswerFinished) => void

const listeners = new Set<Listener>()

/** Runs after every answer a model finished without error, once its receipt and changes are in. */
export function onAnswerFinished(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitAnswerFinished(event: AnswerFinished): void {
  for (const listener of listeners) listener(event)
}
