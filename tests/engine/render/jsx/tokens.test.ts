import { describe, expect, test } from 'bun:test'

import {
  exportDTCG,
  exportTokensCSS,
  sceneNodeToJSX,
  tokenCSSName
} from '@redrob-design/core/design-jsx'
import { SceneGraph } from '@redrob-design/scene-graph'

function tokenGraph() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  graph.addCollection({
    id: 'c1',
    name: 'Brand',
    modes: [
      { modeId: 'light', name: 'Light' },
      { modeId: 'dark', name: 'Dark' }
    ],
    defaultModeId: 'light',
    variableIds: ['blue', 'action', 'space']
  })
  graph.addVariable({
    id: 'blue',
    name: 'Blue/600',
    type: 'COLOR',
    collectionId: 'c1',
    valuesByMode: {
      light: { r: 43 / 255, g: 82 / 255, b: 1, a: 1 },
      dark: { r: 0.5, g: 0.6, b: 1, a: 1 }
    },
    description: '',
    hiddenFromPublishing: false
  })
  graph.addVariable({
    id: 'action',
    name: 'Action primary',
    type: 'COLOR',
    collectionId: 'c1',
    valuesByMode: { light: { aliasId: 'blue' } },
    description: 'Buttons and links',
    hiddenFromPublishing: false
  })
  graph.addVariable({
    id: 'space',
    name: 'Space/4',
    type: 'FLOAT',
    collectionId: 'c1',
    valuesByMode: { light: 16 },
    description: '',
    hiddenFromPublishing: false
  })
  const button = graph.createNode('FRAME', pageId, {
    name: 'Button',
    width: 120,
    height: 40,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 16,
    fills: [
      { type: 'SOLID', color: { r: 43 / 255, g: 82 / 255, b: 1, a: 1 }, opacity: 1, visible: true }
    ]
  })
  graph.bindVariable(button.id, 'fills/0/color', 'action')
  graph.bindVariable(button.id, 'itemSpacing', 'space')
  return { graph, button }
}

describe('design tokens', () => {
  test('name CSS custom properties from the variable path', () => {
    expect(tokenCSSName({ name: 'Brand/Action primary' })).toBe('--brand-action-primary')
    expect(tokenCSSName({ name: 'Space/4' })).toBe('--space-4')
  })

  test('export as DTCG with types, aliases and other modes', () => {
    const tokens = exportDTCG(tokenGraph().graph)
    expect(tokens).toEqual({
      Brand: {
        Blue: {
          '600': {
            $type: 'color',
            $value: '#2B52FF',
            $extensions: { 'design.redrob.modes': { Dark: '#8099FF' } }
          }
        },
        'Action-primary': {
          $type: 'color',
          $value: '{Brand.Blue.600}',
          $description: 'Buttons and links'
        },
        Space: { '4': { $type: 'number', $value: 16 } }
      }
    })
  })

  test('export as CSS variables in the default mode', () => {
    expect(exportTokensCSS(tokenGraph().graph)).toBe(
      ':root {\n  --blue-600: #2B52FF;\n  --action-primary: var(--blue-600);\n  --space-4: 16px;\n}\n'
    )
  })

  test('Tailwind output reads bound tokens instead of copying their values', () => {
    const { graph, button } = tokenGraph()
    const jsx = sceneNodeToJSX(button.id, graph, 'tailwind')
    expect(jsx).toContain('bg-(--action-primary)')
    expect(jsx).toContain('gap-(--space-4)')
    expect(jsx).not.toContain('#2b52ff')
    expect(jsx.toLowerCase()).not.toContain('bg-[#2b52ff')
  })
})
