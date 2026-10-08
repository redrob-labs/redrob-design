import type { SceneGraph } from '@redrob-design/scene-graph'

import { defineTool } from './schema'

const VERSION_GAP = 160

export interface LanguageVersionText {
  id: string
  name: string
  text: string
  /** The box the rewritten copy has to fit, so overflow can be checked. */
  width: number
}

/** Every text layer under a node, in reading order, for the copy to be rewritten. */
export function textLayers(graph: SceneGraph, rootId: string): LanguageVersionText[] {
  const texts: LanguageVersionText[] = []
  const walk = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    if (node.type === 'TEXT') {
      texts.push({ id: node.id, name: node.name, text: node.text, width: node.width })
    }
    for (const childId of node.childIds) walk(childId)
  }
  walk(rootId)
  return texts
}

export const addLanguageVersion = defineTool({
  name: 'add_language_version',
  mutates: true,
  description:
    'Add a version of a top-level frame in another language: duplicates the frame beside the others, ' +
    'named "<frame> (<language>)", and returns every text layer in the copy. ' +
    'Then rewrite each text with set_text as a native writer of that language would, not word for word: ' +
    'keep prices and units right for that market, and check that nothing overflows.',
  params: {
    id: {
      type: 'string',
      description: 'The top-level frame to make a language version of',
      required: true
    },
    language: {
      type: 'string',
      description: 'Language name in English, e.g. "Korean"',
      required: true
    }
  },
  execute: (figma, { id, language }) => {
    const source = figma.graph.getNode(id)
    if (!source) return { error: `Node "${id}" not found` }
    if (source.parentId !== figma.currentPageId) {
      return { error: 'Pass a top-level frame; a language version is a whole screen.' }
    }
    const name = `${source.name} (${language.trim()})`
    const existing = figma.graph.getChildren(figma.currentPageId).find((node) => node.name === name)
    if (existing)
      return {
        id: existing.id,
        name,
        language,
        existing: true,
        texts: textLayers(figma.graph, existing.id)
      }

    const proxy = figma.getNodeById(id)
    if (!proxy) return { error: `Node "${id}" not found` }
    const copy = proxy.clone()
    const right = figma.graph
      .getChildren(figma.currentPageId)
      .reduce((edge, node) => Math.max(edge, node.x + node.width), source.x + source.width)
    copy.name = name
    copy.x = right + VERSION_GAP
    copy.y = source.y
    return { id: copy.id, name, language, texts: textLayers(figma.graph, copy.id) }
  }
})
