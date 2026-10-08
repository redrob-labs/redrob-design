import type { SceneGraph } from '@redrob-design/scene-graph'

import type { LintMessage } from './types'

/** Messages that carry a fix the rule is sure of. */
export function fixableMessages(messages: readonly LintMessage[]): LintMessage[] {
  return messages.filter((message) => message.fix !== undefined)
}

/**
 * Applies one message's fix to its node. Returns false when the message has
 * no fix or its node is gone. Layout and undo are the caller's.
 */
export function applyLintFix(graph: SceneGraph, message: LintMessage): boolean {
  if (!message.fix || !graph.getNode(message.nodeId)) return false
  graph.updateNode(message.nodeId, { ...message.fix.set })
  return true
}

/** Applies every fix it can and returns how many it applied. */
export function applyLintFixes(graph: SceneGraph, messages: readonly LintMessage[]): number {
  let applied = 0
  for (const message of messages) if (applyLintFix(graph, message)) applied++
  return applied
}
