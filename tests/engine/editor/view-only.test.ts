import { describe, expect, test } from 'bun:test'

import { createEditor } from '@redrob-design/core/editor'

describe('view-only', () => {
  test('ends direct editing and announces the change', () => {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { name: 'Card' })
    editor.select([node.id])
    editor.setTool('RECTANGLE')
    const seen: boolean[] = []
    editor.onEditorEvent('view-only:changed', (viewOnly) => seen.push(viewOnly))

    editor.setViewOnly(true)
    expect(editor.state.viewOnly).toBe(true)
    expect(editor.state.selectedIds.size).toBe(0)
    expect(editor.state.activeTool).toBe('SELECT')

    editor.setViewOnly(true)
    editor.setViewOnly(false)
    expect(seen).toEqual([true, false])
  })

  test('still lets programmatic edits through, the way Redrob changes a file', () => {
    const editor = createEditor()
    editor.setViewOnly(true)
    const node = editor.graph.createNode('FRAME', editor.state.currentPageId, { name: 'Made' })
    editor.updateNode(node.id, { name: 'Renamed' })
    expect(editor.graph.getNode(node.id)?.name).toBe('Renamed')
  })
})
