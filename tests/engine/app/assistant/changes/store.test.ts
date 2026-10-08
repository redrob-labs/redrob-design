import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@redrob-design/core/editor'

import {
  beginChangeTurn,
  changeSetFor,
  changeSets,
  finishChangeTurn,
  forgetChangeSets,
  keepChanges,
  latestKept,
  openChangeCount,
  putBackChanges,
  undoKeptChanges
} from '@/app/assistant/changes/store'
import { changeItems, propertyGroups } from '@/components/chat/changes/items'

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const title = editor.graph.createNode('TEXT', pageId, { name: 'Title', text: 'Basic' })
  return { editor, pageId, title }
}

function aiTurn(editor: ReturnType<typeof createEditor>, messageId: string, change: () => void) {
  beginChangeTurn(editor)
  change()
  finishChangeTurn(editor, messageId)
}

afterEach(() => changeSets.clear())

describe('answer change sets', () => {
  test('one answer is one undo step and one open card', () => {
    const { editor, pageId, title } = setup()
    aiTurn(editor, 'a1', () => {
      editor.graph.updateNode(title.id, { text: 'Team' })
      editor.graph.createNode('RECTANGLE', pageId, { name: 'Badge' })
    })

    expect(openChangeCount(editor)).toBe(1)
    expect(
      changeSetFor('a1')
        ?.items.map((item) => item.kind)
        .toSorted()
    ).toEqual(['added', 'changed'])

    editor.undoAction()
    expect(editor.graph.getNode(title.id)?.text).toBe('Basic')
    expect(editor.undo.canUndo).toBe(false)
  })

  test('an answer that changed nothing leaves no card and no undo step', () => {
    const { editor } = setup()
    aiTurn(editor, 'a1', () => undefined)
    expect(changeSetFor('a1')).toBeNull()
    expect(editor.undo.canUndo).toBe(false)
  })

  test('Put it back reverts and can itself be redone', () => {
    const { editor, title } = setup()
    aiTurn(editor, 'a1', () => editor.graph.updateNode(title.id, { text: 'Team' }))

    putBackChanges('a1')
    expect(editor.graph.getNode(title.id)?.text).toBe('Basic')
    expect(changeSetFor('a1')?.status).toBe('put-back')
    expect(openChangeCount(editor)).toBe(0)

    editor.redoAction()
    expect(editor.graph.getNode(title.id)?.text).toBe('Team')
  })

  test('Put it back after a later edit keeps that edit', () => {
    const { editor, pageId, title } = setup()
    aiTurn(editor, 'a1', () => editor.graph.updateNode(title.id, { text: 'Team' }))
    const mine = editor.graph.createNode('RECTANGLE', pageId, { name: 'Mine' })
    editor.pushUndoEntry({ label: 'Mine', forward: () => undefined, inverse: () => undefined })

    putBackChanges('a1')
    expect(editor.graph.getNode(title.id)?.text).toBe('Basic')
    expect(editor.graph.getNode(mine.id)).toBeDefined()
  })

  test('only the latest kept change offers Undo', () => {
    const { editor, title } = setup()
    aiTurn(editor, 'a1', () => editor.graph.updateNode(title.id, { text: 'One' }))
    aiTurn(editor, 'a2', () => editor.graph.updateNode(title.id, { text: 'Two' }))
    keepChanges('a1')
    keepChanges('a2')
    expect(latestKept(editor)?.id).toBe('a2')

    undoKeptChanges('a1')
    expect(changeSetFor('a1')?.status).toBe('kept')

    undoKeptChanges('a2')
    expect(changeSetFor('a2')?.status).toBe('undone')
    expect(editor.graph.getNode(title.id)?.text).toBe('One')
  })

  test('clearing the chat forgets the cards but keeps the edits', () => {
    const { editor, title } = setup()
    aiTurn(editor, 'a1', () => editor.graph.updateNode(title.id, { text: 'Team' }))
    forgetChangeSets(editor)
    expect(changeSetFor('a1')).toBeNull()
    expect(editor.graph.getNode(title.id)?.text).toBe('Team')
  })
})

describe('change items', () => {
  const words = {
    textOf: (name: string) => `Text in ${name}`,
    properties: {
      fill: 'Fill',
      stroke: 'Stroke',
      position: 'Position',
      size: 'Size',
      text: 'Text',
      name: 'Name',
      opacity: 'Opacity',
      effects: 'Effects',
      corners: 'Corners',
      type: 'Type style',
      layout: 'Layout',
      order: 'Order',
      visibility: 'Visibility',
      other: 'Other properties'
    }
  }

  test('group fields into words a person uses and hide derived ones', () => {
    expect(propertyGroups(['fills', 'x', 'y', 'derivedTextGlyphs', 'itemSpacing'])).toEqual([
      'fill',
      'position',
      'layout'
    ])
    expect(propertyGroups(['someFutureField'])).toEqual(['other'])
  })

  test('show text as before and after', () => {
    const items = changeItems(
      [
        {
          id: 't',
          name: 'Title',
          type: 'TEXT',
          kind: 'changed',
          keys: ['text', 'derivedTextGlyphs'],
          textBefore: 'Basic',
          textAfter: 'Team'
        },
        { id: 'r', name: 'Badge', type: 'RECTANGLE', kind: 'added', keys: [] }
      ],
      words
    )
    expect(items).toEqual([
      { id: 't-text', kind: 'changed', label: 'Text in Title', before: 'Basic', after: 'Team' },
      { id: 'r', kind: 'added', label: 'Badge' }
    ])
  })
})
