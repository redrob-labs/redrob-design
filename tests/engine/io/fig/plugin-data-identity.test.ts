import { describe, expect, test } from 'bun:test'

import {
  getRedrobDesignPluginValue,
  REDROB_DESIGN_PLUGIN_ID,
  TEXT_PATH_BOX_PLUGIN_KEY,
  upsertPluginData,
  extractTextPathBox
} from '@redrob-design/fig/node-change'
import type { NodeChange } from '@redrob-design/kiwi/fig/codec'
import type { PluginDataEntry } from '@redrob-design/scene-graph'

/**
 * Pins the one compatibility literal the rebrand kept in the `.fig` writer path.
 *
 * `.fig` documents saved by pre-rebrand builds tag their plugin data with the
 * `open-pencil` pluginId — a round-trip of `gold-preview.fig` writes 97 such
 * entries — so the reader still accepts it while every write uses the current id.
 * Without these assertions the legacy branch could be dropped silently and every
 * document saved by an earlier build would quietly lose its text-on-path boxes,
 * export settings, and library sources.
 */
const LEGACY_PLUGIN_ID = 'open-pencil'

function nodeChangeWithPluginData(pluginID: string, key: string, value: string): NodeChange {
  return { pluginData: [{ pluginID, key, value }] } as unknown as NodeChange
}

describe('.fig plugin data brand identity', () => {
  test('writes the current plugin id', () => {
    const node: { pluginData: PluginDataEntry[] } = { pluginData: [] }

    upsertPluginData(node, TEXT_PATH_BOX_PLUGIN_KEY, '{"x":0,"y":0,"width":1,"height":1}')

    expect(node.pluginData).toEqual([
      {
        pluginId: REDROB_DESIGN_PLUGIN_ID,
        key: TEXT_PATH_BOX_PLUGIN_KEY,
        value: '{"x":0,"y":0,"width":1,"height":1}'
      }
    ])
    expect(REDROB_DESIGN_PLUGIN_ID).toBe('redrob-design')
  })

  test('reads plugin data written under the pre-rebrand plugin id', () => {
    const legacy = nodeChangeWithPluginData(LEGACY_PLUGIN_ID, TEXT_PATH_BOX_PLUGIN_KEY, 'stored')

    expect(getRedrobDesignPluginValue(legacy, TEXT_PATH_BOX_PLUGIN_KEY)).toBe('stored')
  })

  test('recovers a text-on-path box from a document saved by an earlier build', () => {
    const legacy = nodeChangeWithPluginData(
      LEGACY_PLUGIN_ID,
      TEXT_PATH_BOX_PLUGIN_KEY,
      JSON.stringify({ x: 4, y: 8, width: 120, height: 32 })
    )

    expect(extractTextPathBox(legacy)).toEqual({ x: 4, y: 8, width: 120, height: 32 })
  })

  test('ignores plugin data owned by third-party plugins', () => {
    const foreign = nodeChangeWithPluginData('some-figma-plugin', TEXT_PATH_BOX_PLUGIN_KEY, 'nope')

    expect(getRedrobDesignPluginValue(foreign, TEXT_PATH_BOX_PLUGIN_KEY)).toBeNull()
  })

  test('replaces a legacy entry instead of keeping both copies', () => {
    const node: { pluginData: PluginDataEntry[] } = {
      pluginData: [
        { pluginId: LEGACY_PLUGIN_ID, key: TEXT_PATH_BOX_PLUGIN_KEY, value: 'old' },
        { pluginId: 'other-plugin', key: TEXT_PATH_BOX_PLUGIN_KEY, value: 'keep' }
      ]
    }

    upsertPluginData(node, TEXT_PATH_BOX_PLUGIN_KEY, 'new')

    expect(node.pluginData).toEqual([
      { pluginId: 'other-plugin', key: TEXT_PATH_BOX_PLUGIN_KEY, value: 'keep' },
      { pluginId: REDROB_DESIGN_PLUGIN_ID, key: TEXT_PATH_BOX_PLUGIN_KEY, value: 'new' }
    ])
  })
})
