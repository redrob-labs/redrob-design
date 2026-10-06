import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import { createEditor } from '@redrob-design/core/editor'

import { changeSetFor, changeSets } from '@/app/assistant/changes/store'
import {
  cloudState,
  createConsoleClient,
  createMemorySnapshotCache,
  setConsoleCacheForTests,
  setConsoleClientForTests,
  type WatchEvent
} from '@/app/integrations/console'
import { connectedWorkspace } from '@/app/memory/workspace'
import { applyWatchEvent } from '@/app/ship/watch/apply'
import {
  deliverWatchUpdates,
  isWatching,
  pollWatchEvents,
  registerWatchDelivery,
  resetWatchesForTests,
  startWatching,
  stopWatching,
  watchedSources
} from '@/app/ship/watch/service'

import {
  MOCK_TOKEN,
  createMockConsole,
  mockConsoleFetch,
  type MockConsole
} from '#tests/helpers/console/server'

const words = { changed: 'changed', nothing: 'nothing' }

function priced(path = '/work/pricing.fig') {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const team = editor.graph.createNode('FRAME', pageId, { name: 'Team', width: 240, height: 120 })
  const teamPrice = editor.graph.createNode('TEXT', team.id, { text: '$24 per person' })
  const solo = editor.graph.createNode('FRAME', pageId, { name: 'Solo', width: 240, height: 120 })
  const soloPrice = editor.graph.createNode('TEXT', solo.id, { text: '$24 per person' })
  const target = Object.assign(editor, {
    getSourceIdentity: () => ({ path }),
    getRecoveryId: () => `recovery-${path}`
  })
  return { editor: target, pageId, teamPrice, soloPrice }
}

function textOf(editor: ReturnType<typeof priced>['editor'], id: string): string | undefined {
  const node = editor.graph.getNode(id)
  return node?.type === 'TEXT' ? node.text : undefined
}

function event(change: WatchEvent['change'], overrides: Partial<WatchEvent> = {}): WatchEvent {
  return {
    id: 'event-1',
    watchId: 'watch-1',
    sourceId: 'src-sheet',
    summary: 'Team is $28 now',
    at: '2026-10-06T10:00:00.000Z',
    change,
    ...overrides
  }
}

afterEach(() => {
  changeSets.clear()
})

describe('applyWatchEvent', () => {
  test('replaces text as one answer with Keep it and Put it back, and one undo step', () => {
    const { editor, teamPrice, soloPrice } = priced()
    const message = applyWatchEvent(
      editor,
      event({ kind: 'text-replace', from: 'per person', to: 'a seat' }),
      words
    )
    expect(message.parts[0]).toEqual({ type: 'text', text: 'changed' })
    expect(textOf(editor, teamPrice.id)).toBe('$24 a seat')
    expect(textOf(editor, soloPrice.id)).toBe('$24 a seat')
    expect(changeSetFor(message.id)?.status).toBe('open')

    editor.undoAction()
    expect(textOf(editor, teamPrice.id)).toBe('$24 per person')
    expect(textOf(editor, soloPrice.id)).toBe('$24 per person')
  })

  test("a price change keeps to the plan's own card", () => {
    const { editor, teamPrice, soloPrice } = priced()
    applyWatchEvent(editor, event({ kind: 'price', plan: 'Team', from: '$24', to: '$28' }), words)
    expect(textOf(editor, teamPrice.id)).toBe('$28 per person')
    expect(textOf(editor, soloPrice.id)).toBe('$24 per person')
  })

  test('a token change sets the variable and undoes in one step', () => {
    const { editor } = priced()
    editor.graph.addCollection({
      id: 'c1',
      name: 'Brand',
      modes: [{ modeId: 'm1', name: 'Light' }],
      defaultModeId: 'm1',
      variableIds: ['v1']
    })
    editor.graph.addVariable({
      id: 'v1',
      name: 'action-primary',
      type: 'COLOR',
      collectionId: 'c1',
      valuesByMode: { m1: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })
    const message = applyWatchEvent(
      editor,
      event({ kind: 'token-value', token: 'action-primary', value: '#0000ff' }),
      words
    )
    expect(message.parts[0]).toEqual({ type: 'text', text: 'changed' })
    expect(editor.graph.variables.get('v1')?.valuesByMode.m1).toEqual({ r: 0, g: 0, b: 1, a: 1 })
    editor.undoAction()
    expect(editor.graph.variables.get('v1')?.valuesByMode.m1).toEqual({ r: 1, g: 0, b: 0, a: 1 })
  })

  test('says so when nothing on the page shows what moved', () => {
    const { editor } = priced()
    const before = editor.undo.undoLabel
    const message = applyWatchEvent(
      editor,
      event({ kind: 'price', plan: 'Team', from: '$99', to: '$100' }),
      words
    )
    expect(message.parts[0]).toEqual({ type: 'text', text: 'nothing' })
    expect(changeSetFor(message.id)).toBeNull()
    expect(editor.undo.undoLabel).toBe(before)
  })
})

describe('watching through Console', () => {
  let mock: MockConsole
  let posted: UIMessage[]

  beforeEach(() => {
    resetWatchesForTests()
    setConsoleCacheForTests(createMemorySnapshotCache())
    mock = createMockConsole()
    setConsoleClientForTests(
      createConsoleClient({
        baseURL: 'https://console.mock/v1',
        token: () => Promise.resolve(MOCK_TOKEN),
        fetch: mockConsoleFetch(mock)
      })
    )
    cloudState.status = 'signed-in'
    connectedWorkspace.value = mock.state.workspaces.get('ws-1') ?? null
    posted = []
    registerWatchDelivery({
      ready: () => true,
      words: (source, summary) => ({
        changed: `${source}: ${summary}`,
        nothing: `${source}: nothing`
      }),
      post: (message) => posted.push(message)
    })
  })

  afterEach(() => {
    resetWatchesForTests()
    cloudState.status = 'signed-out'
    connectedWorkspace.value = null
    setConsoleClientForTests(null)
    setConsoleCacheForTests(null)
  })

  test('names the workspace sources, and none without a workspace', () => {
    expect(watchedSources()).toEqual(['redrob.io', 'Pricing sheet, Q4'])
    connectedWorkspace.value = null
    expect(watchedSources()).toBeNull()
  })

  test('registers a watch without sending the file path', async () => {
    const { pageId } = priced()
    expect(await startWatching('file:/work/pricing.fig', pageId)).toBe(true)
    const [watch] = mock.state.watches.values()
    expect(watch.sourceIds).toEqual(['src-site', 'src-sheet'])
    expect(watch.documentId).not.toContain('pricing')
    expect(isWatching('file:/work/pricing.fig', pageId)).toBe(true)
    // A second Ship of the same page reuses the watch.
    await startWatching('file:/work/pricing.fig', pageId)
    expect(mock.state.watches.size).toBe(1)
  })

  test('polls from a cursor and lands each change once on the open page', async () => {
    const { editor, pageId, teamPrice } = priced()
    await startWatching('file:/work/pricing.fig', pageId)
    const [watch] = mock.state.watches.values()

    // The first poll only takes a cursor; nothing from before lands.
    mock.state.events.push(
      event({ kind: 'price', plan: 'Team', from: '$24', to: '$20' }, { watchId: watch.id })
    )
    expect(await pollWatchEvents()).toBe(0)

    mock.state.events.push(
      event(
        { kind: 'price', plan: 'Team', from: '$24', to: '$28' },
        { id: 'event-2', watchId: watch.id }
      )
    )
    expect(await pollWatchEvents()).toBe(1)
    expect(deliverWatchUpdates(editor)).toBe(1)
    expect(textOf(editor, teamPrice.id)).toBe('$28 per person')
    expect(posted.map((message) => message.parts[0])).toEqual([
      { type: 'text', text: 'Pricing sheet, Q4: Team is $28 now' }
    ])

    expect(await pollWatchEvents()).toBe(0)
    expect(deliverWatchUpdates(editor)).toBe(0)
    expect(posted).toHaveLength(1)
  })

  test('a change for a file that is not open waits for it', async () => {
    const open = priced('/work/open.fig')
    const other = priced('/work/other.fig')
    await startWatching('file:/work/other.fig', other.pageId)
    await pollWatchEvents()
    const [watch] = mock.state.watches.values()
    mock.state.events.push(
      event({ kind: 'text-replace', from: 'per person', to: 'a seat' }, { watchId: watch.id })
    )
    await pollWatchEvents()
    expect(deliverWatchUpdates(open.editor)).toBe(0)
    expect(deliverWatchUpdates(other.editor)).toBe(1)
    expect(textOf(other.editor, other.teamPrice.id)).toBe('$24 a seat')
  })

  test('stopping deletes the watch and drops its waiting changes', async () => {
    const { pageId } = priced()
    await startWatching('file:/work/pricing.fig', pageId)
    await stopWatching('file:/work/pricing.fig', pageId)
    expect(mock.state.watches.size).toBe(0)
    expect(isWatching('file:/work/pricing.fig', pageId)).toBe(false)
  })
})
