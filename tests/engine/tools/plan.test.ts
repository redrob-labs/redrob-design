import { describe, expect, test } from 'bun:test'

import { parseDirections, parsePlanQuestions } from '@redrob-design/core/tools'

import { getTool, setupToolTest, type ToolResult } from '#tests/helpers/tools'

describe('ask_plan_questions', () => {
  test('keeps at most three questions with two to four answers each', () => {
    const questions = parsePlanQuestions(
      JSON.stringify([
        { question: 'Who pays for it?', options: ['Teams', 'Solo founders', 'Both'] },
        {
          id: 'act',
          question: 'What should they do first?',
          options: ['Start free', 'Book a demo']
        },
        { question: 'Three?', options: ['a', 'b'] },
        { question: 'Four?', options: ['a', 'b'] }
      ])
    )
    expect(questions?.map((question) => question.id)).toEqual(['q1', 'act', 'q3'])
  })

  test('rejects a question with fewer than two answers or bad JSON', () => {
    expect(parsePlanQuestions('[{"question":"Who?","options":["Teams"]}]')).toBeNull()
    expect(parsePlanQuestions('not json')).toBeNull()
    const result = getTool('ask_plan_questions').execute(setupToolTest().figma, {
      questions: '[]'
    }) as ToolResult
    expect(result.error).toBeDefined()
  })
})

describe('create_directions', () => {
  test('starts up to four top-level frames side by side, right of what is there', () => {
    const { figma, graph } = setupToolTest()
    const existing = figma.createFrame()
    existing.resize(400, 300)

    const result = getTool('create_directions').execute(figma, {
      directions: JSON.stringify(
        ['Price-first', 'Story-first', 'Compare-first', 'One plan', 'Fifth'].map((name) => ({
          name,
          idea: `${name} idea`
        }))
      ),
      width: 1000,
      height: 800
    }) as { directions: Array<{ id: string; letter: string }> }

    expect(result.directions.map((direction) => direction.letter)).toEqual(['A', 'B', 'C', 'D'])
    const frames = result.directions.map((direction) => graph.getNode(direction.id))
    expect(frames.map((frame) => frame?.name)).toEqual([
      'Direction A: Price-first',
      'Direction B: Story-first',
      'Direction C: Compare-first',
      'Direction D: One plan'
    ])
    expect(frames.map((frame) => frame?.x)).toEqual([560, 1720, 2880, 4040])
    expect(frames.every((frame) => frame?.parentId === figma.currentPageId)).toBe(true)
  })

  test('needs a name and an idea for each direction', () => {
    expect(parseDirections('[{"name":"A"}]')).toBeNull()
  })
})
