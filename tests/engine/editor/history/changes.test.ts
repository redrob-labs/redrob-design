import { describe, expect, test } from 'bun:test'

import { createEditor, diffPageSnapshots, isEmptyPageChanges } from '@redrob-design/core/editor'

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const card = editor.graph.createNode('FRAME', pageId, { name: 'Card', width: 200, height: 100 })
  const title = editor.graph.createNode('TEXT', card.id, { name: 'Title', text: 'Basic' })
  const other = editor.graph.createNode('RECTANGLE', pageId, { name: 'Other', x: 300 })
  return { editor, pageId, card, title, other }
}

describe('page snapshot diffs', () => {
  test('report added and removed subtrees once, at the top', () => {
    const { editor, pageId, card } = setup()
    const before = editor.snapshotPage()
    const banner = editor.graph.createNode('FRAME', pageId, { name: 'Banner' })
    editor.graph.createNode('TEXT', banner.id, { name: 'Label' })
    editor.graph.deleteNode(card.id)

    const changes = diffPageSnapshots(before, editor.snapshotPage())
    expect(changes.added.map((change) => change.name)).toEqual(['Banner'])
    expect(changes.removed.map((change) => change.name)).toEqual(['Card'])
  })

  test('name the fields that changed and ignore child bookkeeping', () => {
    const { editor, title, card } = setup()
    const before = editor.snapshotPage()
    editor.graph.updateNode(title.id, { text: 'Team' })
    editor.graph.updateNode(card.id, {
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const changes = diffPageSnapshots(before, editor.snapshotPage())
    const byName = Object.fromEntries(changes.changed.map((change) => [change.name, change.keys]))
    expect(byName.Title).toContain('text')
    expect(byName.Card).toEqual(['fills'])
  })

  test('are empty when nothing changed', () => {
    const { editor } = setup()
    const snapshot = editor.snapshotPage()
    expect(isEmptyPageChanges(diffPageSnapshots(snapshot, editor.snapshotPage()))).toBe(true)
  })
})

describe('restoring changed nodes', () => {
  test('reverts and reapplies only what changed, keeping unrelated edits', () => {
    const { editor, pageId, card, title, other } = setup()
    const before = editor.snapshotPage()
    editor.graph.updateNode(title.id, { text: 'Team' })
    const added = editor.graph.createNode('RECTANGLE', card.id, { name: 'Badge' })
    const after = editor.snapshotPage()

    // An edit made after the turn, to a node the turn did not touch.
    editor.graph.updateNode(other.id, { x: 500 })

    editor.restoreNodes(after, before, pageId)
    expect(editor.graph.getNode(title.id)?.text).toBe('Basic')
    expect(editor.graph.getNode(added.id)).toBeUndefined()
    expect(editor.graph.getNode(other.id)?.x).toBe(500)

    editor.restoreNodes(before, after, pageId)
    expect(editor.graph.getNode(title.id)?.text).toBe('Team')
    expect(editor.graph.getNode(added.id)?.parentId).toBe(card.id)
    expect(editor.graph.getNode(card.id)?.childIds).toEqual([title.id, added.id])
  })

  test('recreates removed subtrees in their place', () => {
    const { editor, pageId, card, title, other } = setup()
    const before = editor.snapshotPage()
    editor.graph.deleteNode(card.id)
    const after = editor.snapshotPage()

    editor.restoreNodes(after, before, pageId)
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([card.id, other.id])
    expect(editor.graph.getNode(title.id)?.parentId).toBe(card.id)
  })

  test('drops removed nodes from the selection', () => {
    const { editor, pageId } = setup()
    const before = editor.snapshotPage()
    const added = editor.graph.createNode('RECTANGLE', pageId, { name: 'New' })
    const after = editor.snapshotPage()
    editor.select([added.id])

    editor.restoreNodes(after, before, pageId)
    expect(editor.state.selectedIds.has(added.id)).toBe(false)
  })
})
