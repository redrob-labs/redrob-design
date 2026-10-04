import { describe, expect, test } from 'bun:test'

import { createEditor } from '@redrob-design/core/editor'

import { composerFocusRequest } from '@/app/ai/chat/ask'
import { nodeAtPoint, pointAt, pointRequest } from '@/app/assistant/pointing/store'

describe('Describe pointing', () => {
  test('finds the deepest layer under the point', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const card = editor.graph.createNode('FRAME', pageId, {
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const label = editor.graph.createNode('RECTANGLE', card.id, {
      x: 10,
      y: 10,
      width: 50,
      height: 20
    })

    expect(nodeAtPoint(editor, 20, 15)).toBe(label.id)
    expect(nodeAtPoint(editor, 150, 80)).toBe(card.id)
    expect(nodeAtPoint(editor, 900, 900)).toBeNull()
  })

  test('hands the node to the composer and asks for focus every time', () => {
    const focus = composerFocusRequest.value
    pointAt('a')
    const first = pointRequest.value?.sequence ?? 0
    pointAt('a')
    expect(pointRequest.value?.nodeId).toBe('a')
    expect(pointRequest.value?.sequence).toBe(first + 1)
    expect(composerFocusRequest.value).toBe(focus + 2)
  })
})
