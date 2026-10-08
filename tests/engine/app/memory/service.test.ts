import { afterEach, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@redrob-design/scene-graph'

import { memoryFromDocument } from '@/app/memory/document'
import { designMemoryBrief, stubMemorySource } from '@/app/memory/service'
import { colorCount } from '@/app/memory/types'
import { demoMode } from '@/app/runtime/demo'

afterEach(() => {
  demoMode.value = false
})

function documentWithTokens() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  graph.addCollection({
    id: 'c1',
    name: 'Brand',
    modes: [{ modeId: 'm1', name: 'Light' }],
    defaultModeId: 'm1',
    variableIds: ['v1']
  })
  graph.addVariable({
    id: 'v1',
    name: 'action-primary',
    type: 'COLOR',
    collectionId: 'c1',
    valuesByMode: { m1: { r: 43 / 255, g: 82 / 255, b: 1, a: 1 } },
    description: '',
    hiddenFromPublishing: false
  })
  graph.createNode('TEXT', pageId, { text: 'Hi', fontFamily: 'Pretendard' })
  graph.createNode('TEXT', pageId, { text: 'Hi', fontFamily: 'Pretendard' })
  graph.createNode('RECTANGLE', pageId, { cornerRadius: 12 })
  graph.createNode('COMPONENT', pageId, { name: 'Button' })
  return graph
}

describe('Design Memory', () => {
  test('reads tokens, type, radii and components from the open file', () => {
    const memory = memoryFromDocument(documentWithTokens(), 'Pricing')
    expect(memory.origin).toBe('document')
    expect(memory.colors).toEqual([
      { name: 'Brand', note: 'Brand', swatches: [{ token: 'action-primary', hex: '#2B52FF' }] }
    ])
    expect(memory.typefaces[0].family).toBe('Pretendard')
    expect(memory.radii).toContain(12)
    expect(memory.components).toEqual(['Button'])
    expect(memory.rules.some((rule) => rule.locked)).toBe(true)
  })

  test('the workspace stub says not connected outside demo mode', () => {
    expect(stubMemorySource.workspace()).toEqual({ connected: false })
    expect(stubMemorySource.read(documentWithTokens(), 'Pricing').origin).toBe('document')

    demoMode.value = true
    expect(stubMemorySource.workspace()).toMatchObject({ connected: true, name: 'Redrob Office' })
    const demo = stubMemorySource.read(new SceneGraph(), 'Anything')
    expect(demo.owner).toBe('Redrob Office')
    expect(colorCount(demo)).toBeGreaterThan(20)
  })

  test('the brief models read names tokens and rules', () => {
    const brief = designMemoryBrief(memoryFromDocument(documentWithTokens(), 'Pricing'))
    expect(brief).toContain('action-primary #2B52FF')
    expect(brief).toContain('Rule: American English')
  })
})
