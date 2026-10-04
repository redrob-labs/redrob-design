import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from '@redrob-design/scene-graph'

import type { PageSnapshot } from './snapshot'

/**
 * Fields compared separately or not at all: where a node sits, and `source`,
 * the import bookkeeping every update touches.
 */
const STRUCTURE_KEYS = new Set<string>(['id', 'parentId', 'childIds', 'source'])

export interface NodeChange {
  id: string
  /** Name and type from the side of the change that has the node. */
  name: string
  type: SceneNode['type']
  kind: 'added' | 'removed' | 'changed'
  /** Changed fields for a changed node, in the order the node declares them. */
  keys: string[]
}

/** What differs between two snapshots of one page. */
export interface PageChanges {
  added: NodeChange[]
  removed: NodeChange[]
  changed: NodeChange[]
}

export function isEmptyPageChanges(changes: PageChanges): boolean {
  return changes.added.length + changes.removed.length + changes.changed.length === 0
}

function changedKeys(before: SceneNode, after: SceneNode): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changed: string[] = []
  for (const key of keys) {
    if (STRUCTURE_KEYS.has(key)) continue
    if (!isEqual(before[key as keyof SceneNode], after[key as keyof SceneNode])) changed.push(key)
  }
  if (before.parentId !== after.parentId) changed.push('parentId')
  // Children kept on both sides but in a different order.
  const kept = (ids: string[], other: string[]) => ids.filter((id) => other.includes(id))
  if (!isEqual(kept(before.childIds, after.childIds), kept(after.childIds, before.childIds))) {
    changed.push('childIds')
  }
  return changed
}

function describe(node: SceneNode, kind: NodeChange['kind'], keys: string[] = []): NodeChange {
  return { id: node.id, name: node.name, type: node.type, kind, keys }
}

/**
 * Compares two snapshots of a page. Added and removed nodes are reported at
 * their topmost level only: a frame added with three children is one change.
 * A node inside an added or removed subtree is never reported as changed.
 */
export function diffPageSnapshots(
  before: PageSnapshot,
  after: PageSnapshot,
  scope?: ReadonlySet<string>
): PageChanges {
  const added: NodeChange[] = []
  const removed: NodeChange[] = []
  const changed: NodeChange[] = []
  const ids = scope ?? new Set([...before.keys(), ...after.keys()])

  for (const id of ids) {
    const previous = before.get(id)
    const node = after.get(id)
    if (node && !previous) {
      const parentAdded = node.parentId && after.has(node.parentId) && !before.has(node.parentId)
      if (!parentAdded) added.push(describe(node, 'added'))
    } else if (previous && !node) {
      // Out of scope means untouched, not gone: only a scoped parent can be removed.
      const parentRemoved =
        previous.parentId &&
        before.has(previous.parentId) &&
        !after.has(previous.parentId) &&
        (!scope || scope.has(previous.parentId))
      if (!parentRemoved) removed.push(describe(previous, 'removed'))
    } else if (previous && node) {
      const keys = changedKeys(previous, node)
      if (keys.length > 0) changed.push(describe(node, 'changed', keys))
    }
  }
  return { added, removed, changed }
}

/**
 * Clones of just these nodes, for the far side of a scoped diff. Ids no
 * longer in the graph are left out, so they read as removed.
 */
export function snapshotNodes(graph: SceneGraph, ids: Iterable<string>): PageSnapshot {
  const snapshot: PageSnapshot = new Map()
  for (const id of ids) {
    const node = graph.getNode(id)
    if (node) snapshot.set(id, structuredClone(node))
  }
  return snapshot
}

function recreate(graph: SceneGraph, snapshot: PageSnapshot, id: string): void {
  const snap = snapshot.get(id)
  if (!snap?.parentId || graph.getNode(id) || !graph.getNode(snap.parentId)) return
  const { parentId, childIds, ...rest } = snap
  graph.createNode(snap.type, parentId, { ...rest, childIds: [] })
  for (const childId of childIds) recreate(graph, snapshot, childId)
}

/** Puts a node's existing children in the order the snapshot gives. */
function orderChildren(graph: SceneGraph, snapshot: PageSnapshot, parentId: string): void {
  const target = snapshot.get(parentId)
  const parent = graph.getNode(parentId)
  if (!target || !parent) return
  const order = target.childIds.filter((id) => parent.childIds.includes(id))
  order.forEach((childId, index) => graph.reorderChild(childId, parentId, index))
}

/**
 * Brings the nodes that differ between `from` and `to` to their `to` state,
 * leaving every other node alone. Unlike restoring the whole page, a later
 * edit to an unrelated node survives.
 */
export function restoreNodes(
  graph: SceneGraph,
  from: PageSnapshot,
  to: PageSnapshot,
  scope?: ReadonlySet<string>
): void {
  const changes = diffPageSnapshots(from, to, scope)
  // In `to` but not `from`: those were removed since, so recreate them.
  for (const change of changes.added) recreate(graph, to, change.id)
  for (const change of changes.removed) {
    if (graph.getNode(change.id)) graph.deleteNode(change.id)
  }

  const parents = new Set<string>()
  for (const change of changes.changed) {
    const target = to.get(change.id)
    const node = graph.getNode(change.id)
    if (!target || !node) continue
    if (target.parentId && target.parentId !== node.parentId && graph.getNode(target.parentId)) {
      graph.reparentNode(change.id, target.parentId)
    }
    const fields: Partial<SceneNode> = {}
    for (const key of change.keys) {
      if (STRUCTURE_KEYS.has(key)) continue
      Object.assign(fields, { [key]: structuredClone(target[key as keyof SceneNode]) })
    }
    graph.updateNode(change.id, fields)
    parents.add(change.id)
    if (target.parentId) parents.add(target.parentId)
  }
  for (const change of changes.added) {
    const parentId = to.get(change.id)?.parentId
    if (parentId) parents.add(parentId)
  }
  for (const parentId of parents) orderChildren(graph, to, parentId)
  graph.clearAbsPosCache()
}
