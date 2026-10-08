import { describe, expect, test } from 'bun:test'

import { pageLanguages } from '@/app/language/versions'

import { getTool, setupToolTest, type ToolResult } from '#tests/helpers/tools'

function pricingPage() {
  const { figma, graph } = setupToolTest()
  const frame = figma.createFrame()
  frame.name = 'Pricing'
  frame.resize(1200, 800)
  const title = figma.createText()
  title.characters = 'Simple pricing'
  frame.appendChild(title)
  return { figma, graph, frame }
}

describe('add_language_version', () => {
  test('copies the frame beside the others and lists the copy to rewrite', () => {
    const { figma, graph, frame } = pricingPage()
    const result = getTool('add_language_version').execute(figma, {
      id: frame.id,
      language: 'Korean'
    }) as { id: string; name: string; texts: Array<{ id: string; text: string }> }

    const copy = graph.getNode(result.id)
    expect(result.name).toBe('Pricing (Korean)')
    expect(copy?.x).toBe(1360)
    expect(copy?.parentId).toBe(figma.currentPageId)
    expect(result.texts.map((text) => text.text)).toEqual(['Simple pricing'])
    expect(result.texts[0].id).not.toBe(graph.getNode(frame.id)?.childIds[0])
    expect(pageLanguages(graph, figma.currentPageId)).toEqual(['English', 'Korean'])
  })

  test('asking twice returns the version that is there', () => {
    const { figma, frame } = pricingPage()
    const tool = getTool('add_language_version')
    const first = tool.execute(figma, { id: frame.id, language: 'Korean' }) as ToolResult
    const second = tool.execute(figma, { id: frame.id, language: 'Korean' }) as ToolResult
    expect(second.id).toBe(first.id)
    expect(second.existing).toBe(true)
  })

  test('needs a top-level frame', () => {
    const { figma, graph, frame } = pricingPage()
    const childId = graph.getNode(frame.id)?.childIds[0] ?? ''
    const result = getTool('add_language_version').execute(figma, {
      id: childId,
      language: 'Korean'
    }) as ToolResult
    expect(result.error).toBeDefined()
  })
})
