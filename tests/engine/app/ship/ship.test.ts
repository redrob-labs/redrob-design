import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@redrob-design/core/editor'

import { changeSetFor, changeSets } from '@/app/assistant/changes/store'
import { demoMode } from '@/app/runtime/demo'
import { hasShipMessage, isShipData, reactAndTokens, shipMessage } from '@/app/ship/ship'
import { simulatePriceSheetChange, watchedSources } from '@/app/ship/watch/service'

const words = {
  ready: 'Ready',
  open: (count: number) => `${count} open`,
  empty: 'Empty'
}

afterEach(() => {
  demoMode.value = false
  changeSets.clear()
})

function pricing() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const card = editor.graph.createNode('FRAME', pageId, { name: 'Team', width: 240, height: 120 })
  editor.graph.createNode('TEXT', card.id, { name: 'Price', text: '$24 per person' })
  return { editor, pageId }
}

describe('Ship', () => {
  test('posts a no-AI message with what is still open', () => {
    const { editor, pageId } = pricing()
    const message = shipMessage(editor.graph, pageId, words)
    const data = message.parts[1]
    expect(data.type).toBe('data-ship')
    expect('data' in data && isShipData(data.data)).toBe(true)
    expect(hasShipMessage([message])).toBe(true)
    expect(
      shipMessage(createEditor().graph, createEditor().state.currentPageId, words).parts[0]
    ).toEqual({
      type: 'text',
      text: 'Empty'
    })
  })

  test('downloads the page as one React component with its tokens', () => {
    const { editor, pageId } = pricing()
    const { jsx, tokens } = reactAndTokens(editor.graph, pageId)
    expect(jsx).toContain('export default function Page()')
    expect(jsx).toContain('$24 per person')
    expect(JSON.parse(tokens)).toEqual({})
  })

  test('watching says not connected outside demo mode', () => {
    expect(watchedSources()).toBeNull()
    expect(simulatePriceSheetChange(pricing().editor, { changed: 'c', nothing: 'n' })).toBeNull()

    demoMode.value = true
    expect(watchedSources()?.length).toBeGreaterThan(0)
  })

  test('in demo mode a price sheet change proposes its own Keep it or Put it back', () => {
    demoMode.value = true
    const { editor } = pricing()
    const message = simulatePriceSheetChange(editor, { changed: 'changed', nothing: 'nothing' })
    if (!message) throw new Error('expected an update message')
    expect(message.parts[0]).toEqual({ type: 'text', text: 'changed' })
    const set = changeSetFor(message.id)
    expect(set?.status).toBe('open')
    expect(set?.items[0]).toMatchObject({
      textBefore: '$24 per person',
      textAfter: '$28 per person'
    })
  })
})
