import { shallowReactive } from 'vue'

import { diffPageSnapshots, isEmptyPageChanges, snapshotNodes } from '@redrob-design/core/editor'
import type { NodeChange, PageChanges, PageSnapshot } from '@redrob-design/core/editor'
import type { SceneGraph } from '@redrob-design/scene-graph'

/** The part of an editor store a change set needs. */
export interface ChangeOwner {
  graph: SceneGraph
  state: { currentPageId: string }
  snapshotPage(pageId?: string): PageSnapshot
  restoreNodes(
    from: PageSnapshot,
    to: PageSnapshot,
    pageId: string,
    scope?: ReadonlySet<string>
  ): void
  pushUndoEntry(entry: { label: string; forward(): void; inverse(): void }): void
  undo: { readonly undoLabel: string | null }
  undoAction(): void
}

export type ChangeSetStatus = 'open' | 'kept' | 'put-back' | 'undone'

/** A changed node, with the words before and after when its text changed. */
export interface ChangeDetail extends NodeChange {
  textBefore?: string
  textAfter?: string
}

/** Everything one answer changed on the page, and what the person decided. */
export interface TurnChangeSet {
  id: string
  owner: ChangeOwner
  pageId: string
  before: PageSnapshot
  /** Only the nodes the answer touched; `scope` says which. */
  after: PageSnapshot
  scope: ReadonlySet<string>
  items: ChangeDetail[]
  status: ChangeSetStatus
  /** Order of decision, so the latest kept change can offer Undo. */
  decidedAt: number
}

interface OpenTurn {
  pageId: string
  before: PageSnapshot
  /** Nodes created, changed, moved or deleted since the answer began, and their parents. */
  touched: Set<string>
  stop: () => void
}

const openTurns = new WeakMap<ChangeOwner, OpenTurn>()

/**
 * Collects the ids an answer touches from graph events, so the end of the
 * turn snapshots and compares those nodes rather than the whole page.
 */
function watchTouched(graph: SceneGraph, touched: Set<string>): () => void {
  const add = (...ids: Array<string | null | undefined>) => {
    for (const id of ids) if (id) touched.add(id)
  }
  return graph.onNodeEvents({
    created: (node) => add(node.id, node.parentId),
    updated: (id) => add(id),
    deleted: (id, parentId) => add(id, parentId),
    reparented: (id, oldParent, newParent) => add(id, oldParent, newParent),
    reordered: (id, parentId, _index, previousParent) => add(id, parentId, previousParent)
  })
}

/** Change sets by the id of the answer that made them. */
export const changeSets = shallowReactive(new Map<string, TurnChangeSet>())
let decisions = 0

function undoLabelFor(id: string): string {
  return `Redrob changes ${id}`
}

function textOf(snapshot: PageSnapshot, id: string): string | undefined {
  const node = snapshot.get(id)
  return node?.type === 'TEXT' ? node.text : undefined
}

function detailed(changes: PageChanges, before: PageSnapshot, after: PageSnapshot): ChangeDetail[] {
  const changed = changes.changed.map((change): ChangeDetail => {
    if (!change.keys.includes('text')) return change
    return { ...change, textBefore: textOf(before, change.id), textAfter: textOf(after, change.id) }
  })
  return [...changes.added, ...changed, ...changes.removed]
}

/** An answer starts: remember the page as it is. */
export function beginChangeTurn(owner: ChangeOwner): void {
  openTurns.get(owner)?.stop()
  const pageId = owner.state.currentPageId
  const touched = new Set<string>()
  openTurns.set(owner, {
    pageId,
    before: owner.snapshotPage(pageId),
    touched,
    stop: watchTouched(owner.graph, touched)
  })
}

/**
 * The answer finished. Whatever it changed becomes one undo step and, when
 * the answer has an id, one change set waiting for Keep it or Put it back.
 */
export function finishChangeTurn(owner: ChangeOwner, messageId: string | undefined): void {
  const turn = openTurns.get(owner)
  openTurns.delete(owner)
  if (!turn) return
  turn.stop()
  // Nodes on other pages are out of this change set; the page node itself is in.
  const scope = new Set(
    [...turn.touched].filter((id) => turn.before.has(id) || owner.graph.getNode(id))
  )
  if (scope.size === 0) return
  const after = snapshotNodes(owner.graph, scope)
  const changes = diffPageSnapshots(turn.before, after, scope)
  if (isEmptyPageChanges(changes)) return

  const { before, pageId } = turn
  const id = messageId ?? `turn-${Date.now()}`
  owner.pushUndoEntry({
    label: undoLabelFor(id),
    forward: () => owner.restoreNodes(before, after, pageId, scope),
    inverse: () => owner.restoreNodes(after, before, pageId, scope)
  })
  if (!messageId) return
  changeSets.set(messageId, {
    id: messageId,
    owner,
    pageId,
    before,
    after,
    scope,
    items: detailed(changes, before, after),
    status: 'open',
    decidedAt: 0
  })
}

function decide(set: TurnChangeSet, status: ChangeSetStatus): void {
  changeSets.set(set.id, { ...set, status, decidedAt: ++decisions })
}

/** Reverts the answer's changes as one undo step of their own. */
function revert(set: TurnChangeSet): void {
  const { owner, before, after, pageId, scope } = set
  if (owner.undo.undoLabel === undoLabelFor(set.id)) {
    owner.undoAction()
    return
  }
  owner.restoreNodes(after, before, pageId, scope)
  owner.pushUndoEntry({
    label: `Put back ${set.id}`,
    forward: () => owner.restoreNodes(after, before, pageId, scope),
    inverse: () => owner.restoreNodes(before, after, pageId, scope)
  })
}

export function changeSetFor(messageId: string): TurnChangeSet | null {
  return changeSets.get(messageId) ?? null
}

export function keepChanges(messageId: string): void {
  const set = changeSets.get(messageId)
  if (set?.status === 'open') decide(set, 'kept')
}

export function putBackChanges(messageId: string): void {
  const set = changeSets.get(messageId)
  if (set?.status !== 'open') return
  revert(set)
  decide(set, 'put-back')
}

/** The kept change set decided most recently for this editor, if any. */
export function latestKept(owner: ChangeOwner): TurnChangeSet | null {
  let latest: TurnChangeSet | null = null
  for (const set of changeSets.values()) {
    if (set.owner !== owner || set.status !== 'kept') continue
    if (!latest || set.decidedAt > latest.decidedAt) latest = set
  }
  return latest
}

/** Undo offered on the latest kept change only. */
export function undoKeptChanges(messageId: string): void {
  const set = changeSets.get(messageId)
  if (set?.status !== 'kept' || latestKept(set.owner)?.id !== set.id) return
  revert(set)
  decide(set, 'undone')
}

export function openChangeCount(owner: ChangeOwner | null): number {
  if (!owner) return 0
  let count = 0
  for (const set of changeSets.values()) if (set.owner === owner && set.status === 'open') count++
  return count
}

/** The chat was cleared: its change cards go with it, the edits stay. */
export function forgetChangeSets(owner: ChangeOwner): void {
  openTurns.get(owner)?.stop()
  openTurns.delete(owner)
  for (const [id, set] of changeSets) if (set.owner === owner) changeSets.delete(id)
}
