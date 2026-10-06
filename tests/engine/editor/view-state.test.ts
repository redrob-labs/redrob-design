import { describe, expect, test } from 'bun:test'

import {
  copyEditorViewState,
  createDefaultEditorState,
  createDefaultEditorViewState,
  pickEditorViewState
} from '@redrob-design/core/editor'

describe('editor state ownership', () => {
  test('composes editor state from shared and view defaults', () => {
    const state = createDefaultEditorState('page')
    const view = createDefaultEditorViewState('page')

    expect(pickEditorViewState(state)).toEqual(view)
    expect(state.activeTool).toBe('SELECT')
    expect(state.documentName).toBe('Untitled')
  })

  test('copies mutable view state for an independent canvas surface', () => {
    const state = createDefaultEditorState('page')
    state.selectedIds = new Set(['selected'])
    state.snapGuides = [{ axis: 'x', position: 10, from: 0, to: 20 }]
    state.pageColor = { r: 0.2, g: 0.2, b: 0.2, a: 1 }
    const source = pickEditorViewState(state)
    const copy = copyEditorViewState(source)

    copy.selectedIds.add('pane-only')
    copy.snapGuides.length = 0
    if (copy.pageColor) copy.pageColor.r = 0.5
    copy.navigation.phase = 'zoom'

    expect(source.selectedIds).toEqual(new Set(['selected']))
    expect(source.snapGuides).toHaveLength(1)
    expect(source.pageColor).toEqual({ r: 0.2, g: 0.2, b: 0.2, a: 1 })
    expect(copy.pageColor?.r).toBe(0.5)
    expect(source.navigation.phase).toBe('idle')
  })

  test('a new page has no colour of its own, so it follows the theme', () => {
    expect(createDefaultEditorViewState('page').pageColor).toBeNull()
    expect(copyEditorViewState(createDefaultEditorViewState('page')).pageColor).toBeNull()
  })
})
