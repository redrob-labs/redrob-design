import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@redrob-design/scene-graph'

import { privacyLevel, privacyLevelLocked, setPrivacyLevel } from '@/app/assistant/privacy/store'
import {
  createConsoleClient,
  createMemorySnapshotCache,
  setConsoleCacheForTests,
  setConsoleClientForTests
} from '@/app/integrations/console'
import { memoryFromDocument } from '@/app/memory/document'
import {
  designMemorySource,
  setDesignMemorySource,
  setDesignMemorySourceForTests
} from '@/app/memory/service'
import {
  connectedWorkspace,
  consoleMemorySource,
  disconnectWorkspace,
  loadWorkspace,
  mergeMemory,
  workspaceMemory
} from '@/app/memory/workspace'
import { demoMode } from '@/app/runtime/demo'

import { MOCK_TOKEN, createMockConsole, mockConsoleFetch } from '#tests/helpers/console/server'

function fileWithTokens() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  graph.addCollection({
    id: 'c1',
    name: 'File',
    modes: [{ modeId: 'm1', name: 'Light' }],
    defaultModeId: 'm1',
    variableIds: ['v1', 'v2']
  })
  graph.addVariable({
    id: 'v1',
    name: 'action-primary',
    type: 'COLOR',
    collectionId: 'c1',
    valuesByMode: { m1: { r: 1, g: 0, b: 0, a: 1 } },
    description: '',
    hiddenFromPublishing: false
  })
  graph.addVariable({
    id: 'v2',
    name: 'file-only',
    type: 'COLOR',
    collectionId: 'c1',
    valuesByMode: { m1: { r: 0, g: 1, b: 0, a: 1 } },
    description: '',
    hiddenFromPublishing: false
  })
  graph.createNode('TEXT', pageId, { text: 'Hi', fontFamily: 'Inter' })
  graph.createNode('RECTANGLE', pageId, { cornerRadius: 6 })
  graph.createNode('COMPONENT', pageId, { name: 'Hero' })
  return graph
}

let online = true

beforeEach(() => {
  online = true
  setConsoleCacheForTests(createMemorySnapshotCache())
  const mock = createMockConsole()
  setConsoleClientForTests(
    createConsoleClient({
      baseURL: 'https://console.mock/v1',
      token: () => Promise.resolve(MOCK_TOKEN),
      fetch: (url, init) =>
        online ? mockConsoleFetch(mock)(url, init) : Promise.reject(new TypeError('offline'))
    })
  )
  setDesignMemorySource(consoleMemorySource)
})

afterEach(() => {
  disconnectWorkspace()
  setDesignMemorySourceForTests(null)
  setConsoleClientForTests(null)
  setConsoleCacheForTests(null)
  demoMode.value = false
  setPrivacyLevel('high')
})

describe('workspace Design Memory', () => {
  test('puts the workspace first and keeps what only the file has', async () => {
    await loadWorkspace('ws-1')
    const memory = mergeMemory(
      workspaceMemory.value ?? fail(),
      memoryFromDocument(fileWithTokens(), 'Pricing')
    )
    expect(memory.owner).toBe('Redrob Office')
    expect(memory.origin).toBe('workspace')
    expect(memory.colors.map((group) => group.name)).toEqual(['Redrob Blue', 'File'])
    // The workspace's action-primary wins; the file keeps only its own token.
    expect(memory.colors[1].swatches.map((swatch) => swatch.token)).toEqual(['file-only'])
    expect(memory.typefaces.map((face) => face.family)).toEqual(['Pretendard', 'Inter'])
    expect(memory.radii).toEqual([4, 6, 8, 12])
    expect(memory.rules[0].id).toBe('rule-voice')
    expect(memory.components.slice(0, 1)).toEqual(['Hero'])
    expect(memory.prices).toEqual([{ plan: 'Team', price: '$24' }])
  })

  test('is what every model reads once a workspace is connected', async () => {
    const graph = fileWithTokens()
    expect(designMemorySource().workspace()).toEqual({ connected: false })
    expect(designMemorySource().read(graph, 'Pricing').origin).toBe('document')

    await loadWorkspace('ws-1')
    expect(designMemorySource().workspace()).toEqual({
      connected: true,
      name: 'Redrob Office',
      sources: ['redrob.io', 'Pricing sheet, Q4']
    })
    expect(designMemorySource().read(graph, 'Pricing').owner).toBe('Redrob Office')

    demoMode.value = true
    expect(designMemorySource().read(graph, 'Pricing').owner).toBe('Redrob Office')
    expect(designMemorySource().workspace()).toMatchObject({ connected: true })
  })

  test("locks Privacy to the admin's level and hands it back on disconnect", async () => {
    setPrivacyLevel('standard')
    await loadWorkspace('ws-1')
    expect(privacyLevelLocked.value).toBe(true)
    expect(privacyLevel.value).toBe('strict')
    disconnectWorkspace()
    expect(privacyLevelLocked.value).toBe(false)
    expect(privacyLevel.value).toBe('standard')

    await loadWorkspace('ws-2')
    expect(privacyLevelLocked.value).toBe(false)
    expect(workspaceMemory.value).toBeNull()
  })

  test('offline, the cached workspace answers; with no copy the file alone does', async () => {
    await loadWorkspace('ws-1')
    disconnectWorkspace()
    online = false
    await loadWorkspace('ws-1')
    expect(connectedWorkspace.value?.name).toBe('Redrob Office')
    expect(workspaceMemory.value?.owner).toBe('Redrob Office')

    setConsoleCacheForTests(createMemorySnapshotCache())
    disconnectWorkspace()
    await loadWorkspace('ws-1')
    expect(connectedWorkspace.value).toBeNull()
    expect(designMemorySource().read(fileWithTokens(), 'Pricing').origin).toBe('document')
  })

  test('a workspace the account cannot see is dropped', async () => {
    await loadWorkspace('ws-missing')
    expect(connectedWorkspace.value).toBeNull()
  })
})

function fail(): never {
  throw new Error('expected workspace memory')
}
