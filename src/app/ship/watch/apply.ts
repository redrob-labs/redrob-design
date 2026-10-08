import type { UIMessage } from 'ai'
import { converter, parse } from 'culori'

import type { SceneGraph, SceneNode, Variable, VariableValue } from '@redrob-design/scene-graph'

import { beginChangeTurn, finishChangeTurn, type ChangeOwner } from '@/app/assistant/changes/store'
import type { WatchChange, WatchEvent } from '@/app/integrations/console'

/** The editor a watched change lands in: its page, its undo history and its tokens. */
export interface WatchTarget extends ChangeOwner {
  updateVariableValue(id: string, modeId: string, value: VariableValue): void
}

/** The thread message for a change, already in the person's language. */
export interface WatchWords {
  changed: string
  nothing: string
}

const toRGB = converter('rgb')

function textNodesOn(graph: SceneGraph, pageId: string): SceneNode[] {
  const found: SceneNode[] = []
  const walk = (nodeId: string) => {
    const node = graph.getNode(nodeId)
    if (!node) return
    if (node.type === 'TEXT') found.push(node)
    for (const childId of node.childIds) walk(childId)
  }
  walk(pageId)
  return found
}

/** True when the node sits in a layer named for the plan, or beside text that names it. */
function belongsToPlan(graph: SceneGraph, node: SceneNode, plan: string): boolean {
  const wanted = plan.toLowerCase()
  let parentId = node.parentId
  while (parentId) {
    const parent = graph.getNode(parentId)
    if (!parent || parent.type === 'CANVAS') return false
    if (parent.name.toLowerCase().includes(wanted)) return true
    const named = parent.childIds.some((id) => {
      const sibling = graph.getNode(id)
      return sibling?.type === 'TEXT' && sibling.text.toLowerCase().includes(wanted)
    })
    if (named) return true
    parentId = parent.parentId
  }
  return false
}

/**
 * Replaces words in the page's text layers. A price change keeps to the
 * plan's own card when the page has one, so another plan's equal price stays.
 */
function replaceText(target: WatchTarget, pageId: string, from: string, to: string, plan?: string) {
  const candidates = textNodesOn(target.graph, pageId).filter((node) => node.text.includes(from))
  const scoped = plan
    ? candidates.filter((node) => belongsToPlan(target.graph, node, plan))
    : candidates
  const nodes = scoped.length > 0 ? scoped : candidates
  for (const node of nodes) {
    target.graph.updateNode(node.id, { text: node.text.replaceAll(from, to) })
  }
  return nodes.length
}

/** The token's new value in the variable's own type, or null when it does not read as one. */
function valueFor(variable: Variable, value: string): VariableValue | null {
  if (variable.type === 'STRING') return value
  if (variable.type === 'FLOAT') {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }
  if (variable.type === 'BOOLEAN') {
    if (value === 'true' || value === 'false') return value === 'true'
    return null
  }
  const rgb = toRGB(parse(value))
  if (!rgb) return null
  return { r: rgb.r, g: rgb.g, b: rgb.b, a: rgb.alpha ?? 1 }
}

/** Sets a token's value in its default mode; one undo step of its own. */
function updateToken(target: WatchTarget, token: string, value: string): number {
  for (const variable of target.graph.variables.values()) {
    if (variable.name !== token) continue
    const collection = target.graph.variableCollections.get(variable.collectionId)
    const next = valueFor(variable, value)
    if (!collection || next === null) return 0
    const modeId = collection.defaultModeId
    if (JSON.stringify(variable.valuesByMode[modeId]) === JSON.stringify(next)) return 0
    target.updateVariableValue(variable.id, modeId, next)
    return 1
  }
  return 0
}

function applyChange(target: WatchTarget, pageId: string, change: WatchChange): number {
  if (change.kind === 'text-replace') return replaceText(target, pageId, change.from, change.to)
  if (change.kind === 'price') {
    return replaceText(target, pageId, change.from, change.to, change.plan)
  }
  return updateToken(target, change.token, change.value)
}

/**
 * A watched source moved: the open page proposes its own update. Text and
 * price changes become one answer with Keep it and Put it back; a token
 * change is one undo step. Either way the thread says what happened.
 */
export function applyWatchEvent(
  target: WatchTarget,
  event: Pick<WatchEvent, 'id' | 'change'>,
  words: WatchWords
): UIMessage {
  const id = `watch-${event.id}`
  const pageId = target.state.currentPageId
  const tracked = event.change.kind !== 'token-value'
  if (tracked) beginChangeTurn(target)
  const changed = applyChange(target, pageId, event.change)
  if (tracked) finishChangeTurn(target, changed > 0 ? id : undefined)
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text: changed > 0 ? words.changed : words.nothing }]
  }
}
