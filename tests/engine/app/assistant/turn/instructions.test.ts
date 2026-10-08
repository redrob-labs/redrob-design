import { describe, expect, test } from 'bun:test'

import { createEditor } from '@redrob-design/core/editor'

import { assistantControlsFor } from '@/app/assistant/controls/store'
import { withTurnContext } from '@/app/assistant/turn/context'
import { turnContext, turnInstructions } from '@/app/assistant/turn/instructions'

function editorWithMemory(memory: 'project' | 'all' | 'none', mode: 'plan' | 'run' = 'plan') {
  const editor = createEditor()
  editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'Hi',
    fontFamily: 'Pretendard'
  })
  const controls = assistantControlsFor(editor)
  controls.memory = memory
  controls.mode = mode
  return editor
}

describe('turn instructions', () => {
  test('carry Design Memory when Memory is on for this product', () => {
    const text = turnInstructions(editorWithMemory('project'), 'SYSTEM')
    expect(text.startsWith('SYSTEM')).toBe(true)
    expect(text).toContain('Design Memory for')
    expect(text).toContain('Type: Pretendard')
  })

  test('carry Design Memory when Memory covers all work', () => {
    expect(turnContext(editorWithMemory('all'))).toContain('Design Memory for')
  })

  test('send nothing from Design Memory when Memory is off', () => {
    const text = turnInstructions(editorWithMemory('none'), 'SYSTEM')
    expect(text).not.toContain('Design Memory for')
    expect(text).not.toContain('Pretendard')
    expect(text).toContain('Plan mode.')
  })

  test('follow Run mode', () => {
    const context = turnContext(editorWithMemory('none', 'run'))
    expect(context).toContain('Run mode.')
    expect(context).not.toContain('Plan mode.')
  })
})

describe('turn context for prompt-string agents', () => {
  test('goes in front of the words in a tagged block', () => {
    expect(withTurnContext('Make it blue', 'Run mode.')).toBe(
      '<turn-context>\nRun mode.\n</turn-context>\n\nMake it blue'
    )
  })

  test('leaves the words alone when there is no context', () => {
    expect(withTurnContext('Make it blue', '')).toBe('Make it blue')
  })
})
