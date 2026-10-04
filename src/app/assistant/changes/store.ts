import { shallowReactive } from 'vue'

import { diffPageSnapshots, isEmptyPageChanges } from '@redrob-design/core/editor'
import type { NodeChange, PageChanges, PageSnapshot } from '@redrob-design/core/editor'

/** The part of an editor store a change set needs. */
export interface ChangeOwner {
  state: { currentPageId: string }
  snapshotPage(pageId?: string): PageSnapshot
  restoreNodes(from: PageSnapshot, to: PageSnapshot, pageId: string): void
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
  after: PageSnapshot
  items: ChangeDetail[]
  status: ChangeSetStatus
  /** Order of decision, so the latest kept change can offer Undo. */
  decidedAt: number
}

const openTurns = new WeakMap<ChangeOwner, { pageId: string; before: PageSnapshot }>()

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
  const pageId = owner.state.currentPageId
  openTurns.set(owner, { pageId, before: owner.snapshotPage(pageId) })
}

/**
 * The answer finished. Whatever it changed becomes one undo step and, when
 * the answer has an id, one change set waiting for Keep it or Put it back.
 */
export function finishChangeTurn(owner: ChangeOwner, messageId: string | undefined): void {
  const turn = openTurns.get(owner)
  openTurns.delete(owner)
  if (!turn) return
  const after = owner.snapshotPage(turn.pageId)
  const changes = diffPageSnapshots(turn.before, after)
  if (isEmptyPageChanges(changes)) return

  const { before, pageId } = turn
  const id = messageId ?? `turn-${Date.now()}`
  owner.pushUndoEntry({
    label: undoLabelFor(id),
    forward: () => owner.restoreNodes(before, after, pageId),
    inverse: () => owner.restoreNodes(after, before, pageId)
  })
  if (!messageId) return
  changeSets.set(messageId, {
    id: messageId,
    owner,
    pageId,
    before,
    after,
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
  const { owner, before, after, pageId } = set
  if (owner.undo.undoLabel === undoLabelFor(set.id)) {
    owner.undoAction()
    return
  }
  owner.restoreNodes(after, before, pageId)
  owner.pushUndoEntry({
    label: `Put back ${set.id}`,
    forward: () => owner.restoreNodes(after, before, pageId),
    inverse: () => owner.restoreNodes(before, after, pageId)
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
  openTurns.delete(owner)
  for (const [id, set] of changeSets) if (set.owner === owner) changeSets.delete(id)
}
