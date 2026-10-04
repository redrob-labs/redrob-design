import { describe, expect, test } from 'bun:test'

import {
  applyLintFixes,
  createLinter,
  fixableMessages,
  nearestInScale,
  nearestSpacing,
  presets
} from '@redrob-design/core/lint'
import { SceneGraph } from '@redrob-design/scene-graph'

function page() {
  const graph = new SceneGraph()
  return { graph, pageId: graph.getPages()[0].id }
}

describe('lint fixes', () => {
  test('snap to the nearest step', () => {
    expect(nearestInScale(13, [0, 8, 12, 16])).toBe(12)
    expect(nearestSpacing(13, 4)).toBe(12)
    expect(nearestSpacing(30, 4)).toBe(32)
    // A tie goes to the smaller step.
    expect(nearestSpacing(1.5, 4)).toBe(1)
  })

  test('spacing, radius, size and pixel rules carry fixes that settle them', () => {
    const { graph, pageId } = page()
    const card = graph.createNode('FRAME', pageId, {
      name: 'Card',
      layoutMode: 'VERTICAL',
      itemSpacing: 13,
      paddingTop: 10,
      cornerRadius: 13,
      x: 0.5,
      width: 200,
      height: 100
    })
    graph.createNode('TEXT', card.id, { name: 'Caption', text: 'Fine print', fontSize: 9 })
    graph.createNode('FRAME', card.id, { name: 'Close button', width: 20, height: 20 })

    const linter = createLinter({ preset: 'design-system' })
    const before = fixableMessages(linter.lintGraph(graph, [pageId]).messages)
    expect(before.map((message) => message.ruleId).toSorted()).toEqual([
      'consistent-radius',
      'consistent-spacing',
      'consistent-spacing',
      'min-text-size',
      'pixel-perfect',
      'touch-target-size'
    ])

    expect(applyLintFixes(graph, before)).toBe(before.length)
    expect(graph.getNode(card.id)).toMatchObject({
      itemSpacing: 12,
      paddingTop: 8,
      cornerRadius: 12,
      x: 1
    })
    expect(fixableMessages(linter.lintGraph(graph, [pageId]).messages)).toEqual([])
  })

  test('the design-system preset checks tokens on the 4px grid', () => {
    expect(presets['design-system'].rules['consistent-spacing']).toEqual({
      severity: 'warning',
      options: { base: 4 }
    })
    expect(presets['design-system'].rules['no-hardcoded-colors']).toBe('warning')
  })
})
