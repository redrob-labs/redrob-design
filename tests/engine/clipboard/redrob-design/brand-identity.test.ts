import { describe, expect, test } from 'bun:test'

import { deflateSync } from 'fflate'

import {
  buildRedrobDesignClipboardHTML,
  parseRedrobDesignClipboard,
  SceneGraph
} from '@redrob-design/core'
import { encodeBase64 } from '@redrob-design/core/bytes'

import { expectDefined } from '#tests/helpers/assert'

/**
 * Pins the compatibility literals the rebrand kept in the rich clipboard reader.
 *
 * Copies taken in a pre-rebrand build carry `<!--(openpencil)…-->` with a
 * `openpencil/v1` payload tag. The parser still accepts both so a paste that
 * crosses an upgrade keeps working, while every copy writes the current marker.
 */
function legacyClipboardHTML(nodes: unknown[]): string {
  const payload = JSON.stringify({ format: 'openpencil/v1', nodes, images: {} })
  const compressed = deflateSync(new TextEncoder().encode(payload))
  return `<!--(openpencil)${encodeBase64(compressed)}(/openpencil)-->`
}

function rectangleClipboardHTML(): string {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const node = graph.createNode('RECTANGLE', page.id, { name: 'Rect', width: 10, height: 10 })
  return buildRedrobDesignClipboardHTML([node], graph)
}

describe('rich clipboard brand identity', () => {
  test('copies write the current marker and payload tag', () => {
    const html = rectangleClipboardHTML()

    expect(html).toContain('<!--(redrobdesign)')
    expect(html).toContain('(/redrobdesign)-->')
    expect(html).not.toContain('openpencil')
  })

  test('current copies round-trip', () => {
    const parsed = expectDefined(
      parseRedrobDesignClipboard(rectangleClipboardHTML()),
      'current clipboard'
    )

    expect(parsed.nodes.map((node) => node.name)).toEqual(['Rect'])
  })

  test('pastes a copy taken in a pre-rebrand build', () => {
    const html = legacyClipboardHTML([
      { id: 'legacy', type: 'RECTANGLE', name: 'Legacy Rect', width: 10, height: 10, children: [] }
    ])

    const parsed = expectDefined(parseRedrobDesignClipboard(html), 'legacy clipboard')

    expect(parsed.nodes.map((node) => node.name)).toEqual(['Legacy Rect'])
  })

  test('rejects a marker whose payload tag is not a known clipboard format', () => {
    const payload = JSON.stringify({ format: 'something-else/v1', nodes: [], images: {} })
    const compressed = deflateSync(new TextEncoder().encode(payload))
    const html = `<!--(redrobdesign)${encodeBase64(compressed)}(/redrobdesign)-->`

    expect(parseRedrobDesignClipboard(html)).toBeNull()
  })

  test('ignores unrelated HTML', () => {
    expect(parseRedrobDesignClipboard('<p>hello</p>')).toBeNull()
  })
})
