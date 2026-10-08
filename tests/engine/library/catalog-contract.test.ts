import { describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'
import type { LibraryCatalog } from '@redrob-design/core/library'
import { SceneGraph } from '@redrob-design/scene-graph'

import { generateContentKey } from '@/app/cloud/crypto'
import { newCloudFileId, setCloudBlobFetchForTests, type CloudFileBinding } from '@/app/cloud/files'
import { adoptNewKey } from '@/app/cloud/files/keyring'
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

/**
 * A Redrob Cloud catalog publishing from one shared file, which this computer holds the key for.
 * Pass the same file to a second catalog to stand in for another member of it.
 */
async function sharedFile(mock: MockConsole): Promise<CloudFileBinding> {
  const fileId = newCloudFileId()
  await adoptNewKey(fileId, 1, generateContentKey())
  mock.state.design.files.set(fileId, {
    id: fileId,
    encryptedName: 'c2VhbGVk',
    role: 'editor',
    keyEpoch: 1,
    snapshotRevision: 1,
    createdAt: '2026-10-06T09:00:00.000Z',
    updatedAt: '2026-10-06T09:00:00.000Z'
  })
  mock.state.design.members.set(fileId, [
    {
      userId: mock.state.account.id,
      email: 'jane@example.com',
      name: 'Jane',
      role: 'editor',
      addedAt: '2026-10-06T09:00:00.000Z'
    }
  ])
  return {
    fileId,
    name: 'Library file',
    role: 'editor',
    epoch: 1,
    revision: 1,
    link: null,
    seed: null
  }
}

async function consoleCatalog(mock: MockConsole, online = () => true, file?: CloudFileBinding) {
  const fetch = (url: string, init?: RequestInit) =>
    online() ? mockConsoleFetch(mock)(url, init) : Promise.reject(new TypeError('offline'))
  setCloudBlobFetchForTests(fetch)
  const client = createConsoleClient({
    baseURL: 'https://console.mock/v1',
    token: () => Promise.resolve(MOCK_TOKEN),
    fetch
  })
  const binding = file ?? (await sharedFile(mock))
  return new ConsoleLibraryCatalog({ publishingFile: () => binding, client: () => client })
}

/** Every place libraries can live must publish, list, read and refuse stale publishes alike. */
function catalogContract(name: string, create: () => LibraryCatalog | Promise<LibraryCatalog>) {
  describe(`${name} library catalog contract`, () => {
    test('publishes, lists and reads revisions, latest by default', async () => {
      const catalog = await create()
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
      const catalog = await create()
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

describe('libraries in Redrob Cloud', () => {
  test('are shared with everyone who can open the file they are published from, sealed', async () => {
    const mock = createMockConsole()
    const file = await sharedFile(mock)
    const mine = await consoleCatalog(mock, () => true, file)
    const theirs = await consoleCatalog(mock, () => true, file)
    const published = await mine.publishRevision({
      libraryId: 'brand',
      name: 'Brand kit',
      graph: graph('Primary button')
    })
    expect((await theirs.getRevision('brand')).manifest.revisionId).toBe(
      published.manifest.revisionId
    )
    expect((await theirs.listLibraries()).map((library) => library.name)).toEqual(['Brand kit'])

    const [stored] = mock.state.design.libraries.get('brand') ?? []
    expect(stored.summary.encryptedName).not.toContain('Brand')
    const blob = mock.state.design.blobs.get(stored.key)
    expect(blob && Buffer.from(blob).includes(Buffer.from('Primary button'))).toBe(false)
  })

  test('are not listed for people who cannot open their file', async () => {
    const mock = createMockConsole()
    const catalog = await consoleCatalog(mock)
    await catalog.publishRevision({ libraryId: 'brand', name: 'Brand', graph: graph() })
    for (const members of mock.state.design.members.values()) members.length = 0
    expect(await catalog.listLibraries()).toEqual([])
  })

  test('keep working offline from the copies on this computer', async () => {
    let online = true
    const routed = new RoutedLibraryCatalog(
      new LocalLibraryCatalog(`library-cache-${crypto.randomUUID()}`)
    )
    routed.useRemote('console', await consoleCatalog(createMockConsole(), () => online))
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

  test('are published only from a shared file someone may edit', async () => {
    const mock = createMockConsole()
    const none = new ConsoleLibraryCatalog({ publishingFile: () => null })
    await expect(
      none.publishRevision({ libraryId: 'x', name: 'X', graph: graph() })
    ).rejects.toThrow('Share this file')
    const file = await sharedFile(mock)
    const viewer = await consoleCatalog(mock, () => true, { ...file, role: 'viewer' })
    await expect(
      viewer.publishRevision({ libraryId: 'x', name: 'X', graph: graph() })
    ).rejects.toThrow('not publish')
  })
})
