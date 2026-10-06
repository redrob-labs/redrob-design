import { describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'
import type { LibraryCatalog } from '@redrob-design/core/library'
import { SceneGraph } from '@redrob-design/scene-graph'

import { createConsoleClient } from '@/app/integrations/console'
import type { LibraryObjectStore } from '@/app/integrations/storage'
import { ConsoleLibraryCatalog } from '@/app/libraries/catalog/console'
import { LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import { RoutedLibraryCatalog } from '@/app/libraries/catalog/routed'
import { StorageLibraryCatalog } from '@/app/libraries/catalog/storage'

import {
  MOCK_TOKEN,
  createMockConsole,
  mockConsoleFetch,
  type MockConsole
} from '#tests/helpers/console/server'

class MemoryObjects implements LibraryObjectStore {
  readonly values = new Map<string, { bytes: Uint8Array; etag: string }>()
  #version = 0
  async getObject(key: string) {
    return this.values.get(key)?.bytes ?? null
  }
  async getObjectValue(key: string) {
    const value = this.values.get(key)
    return { bytes: value?.bytes ?? null, etag: value?.etag ?? null }
  }
  async putObject(key: string, bytes: Uint8Array) {
    this.values.set(key, { bytes: new Uint8Array(bytes), etag: `"${++this.#version}"` })
  }
  async listObjects(prefix: string) {
    return [...this.values]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, size: value.bytes.byteLength, etag: value.etag }))
  }
}

function graph(name = 'Button') {
  const result = new SceneGraph()
  result.createNode('COMPONENT', result.getPages()[0].id, { name, componentKey: 'button' })
  return result
}

function consoleCatalog(mock: MockConsole, online = () => true) {
  const client = createConsoleClient({
    baseURL: 'https://console.mock/v1',
    token: () => Promise.resolve(MOCK_TOKEN),
    fetch: (url, init) =>
      online() ? mockConsoleFetch(mock)(url, init) : Promise.reject(new TypeError('offline'))
  })
  return new ConsoleLibraryCatalog({ workspaceId: () => 'ws-1', client: () => client })
}

/** Every place libraries can live must publish, list, read and refuse stale publishes alike. */
function catalogContract(name: string, create: () => LibraryCatalog) {
  describe(`${name} library catalog contract`, () => {
    test('publishes, lists and reads revisions, latest by default', async () => {
      const catalog = create()
      const first = await catalog.publishRevision({
        libraryId: 'design-system',
        name: 'Design system',
        graph: graph()
      })
      const second = await catalog.publishRevision({
        libraryId: 'design-system',
        name: 'Design system',
        graph: graph('Button 2'),
        previousRevisionId: first.manifest.revisionId
      })
      expect(await catalog.listLibraries()).toMatchObject([
        {
          libraryId: 'design-system',
          name: 'Design system',
          latestRevisionId: second.manifest.revisionId,
          assetCount: 1
        }
      ])
      expect((await catalog.getRevision('design-system')).manifest).toEqual(second.manifest)
      const older = await catalog.getRevision('design-system', first.manifest.revisionId)
      expect(older.manifest).toEqual(first.manifest)
    })

    test('refuses a publish that does not name the latest revision', async () => {
      const catalog = create()
      const first = await catalog.publishRevision({
        libraryId: 'tokens',
        name: 'Tokens',
        graph: graph()
      })
      await catalog.publishRevision({
        libraryId: 'tokens',
        name: 'Tokens',
        graph: graph('Newer'),
        previousRevisionId: first.manifest.revisionId
      })
      // Someone else published since: this computer still thinks `first` is the latest.
      await expect(
        catalog.publishRevision({
          libraryId: 'tokens',
          name: 'Tokens',
          graph: graph('Mine'),
          previousRevisionId: first.manifest.revisionId
        })
      ).rejects.toThrow('conflict')
      // A second first publish of the same library is just as stale.
      await expect(
        catalog.publishRevision({ libraryId: 'tokens', name: 'Tokens', graph: graph() })
      ).rejects.toThrow('conflict')
    })
  })
}

catalogContract('storage', () => new StorageLibraryCatalog(new MemoryObjects()))
catalogContract('Redrob Cloud', () => consoleCatalog(createMockConsole()))

describe('workspace libraries', () => {
  test('are shared by everyone in the workspace', async () => {
    const mock = createMockConsole()
    const mine = consoleCatalog(mock)
    const theirs = consoleCatalog(mock)
    const published = await mine.publishRevision({
      libraryId: 'brand',
      name: 'Brand',
      graph: graph()
    })
    expect((await theirs.getRevision('brand')).manifest.revisionId).toBe(
      published.manifest.revisionId
    )
  })

  test('keep working offline from the copies on this computer', async () => {
    let online = true
    const routed = new RoutedLibraryCatalog(
      new LocalLibraryCatalog(`library-cache-${crypto.randomUUID()}`)
    )
    routed.useRemote(
      'console',
      consoleCatalog(createMockConsole(), () => online)
    )
    expect(routed.source).toBe('console')
    const published = await routed.publishRevision({
      libraryId: 'brand',
      name: 'Brand',
      graph: graph()
    })
    online = false
    expect((await routed.getRevision('brand', published.manifest.revisionId)).manifest).toEqual(
      published.manifest
    )
    expect(await routed.listLibraries()).toMatchObject([{ libraryId: 'brand' }])
  })

  test('say so signed out', async () => {
    const catalog = new ConsoleLibraryCatalog({ workspaceId: () => null })
    await expect(catalog.listLibraries()).rejects.toThrow('Sign in to Redrob Cloud')
  })
})
