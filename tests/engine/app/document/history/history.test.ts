import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import { createEditor } from '@redrob-design/core/editor'

import { threadKeyFor } from '@/app/assistant/thread/store'
import { generateContentKey } from '@/app/cloud/crypto'
import {
  bindCloudFile,
  contentKey,
  forgetSessionKeys,
  newCloudFileId,
  sealText,
  setCloudBlobFetchForTests
} from '@/app/cloud/files'
import { adoptNewKey } from '@/app/cloud/files/keyring'
import { createMemoryVersionStore } from '@/app/document/history/memory'
import {
  AUTO_VERSION_INTERVAL_MS,
  AUTO_VERSION_LIMIT,
  overflowingAutoVersions,
  saveVersion
} from '@/app/document/history/ring'
import {
  autoSaveVersion,
  deleteVersion,
  listHistory,
  renameVersion,
  restoreVersion,
  saveDocumentVersion
} from '@/app/document/history/service'
import { getVersionStore, setVersionStoreForTests } from '@/app/document/history/store'
import type { VersionMeta } from '@/app/document/history/types'
import type { EditorStore } from '@/app/editor/active-store'
import {
  cloudState,
  createConsoleClient,
  setConsoleClientForTests
} from '@/app/integrations/console'
import { createTab } from '@/app/tabs'

import {
  MOCK_TOKEN,
  createMockConsole,
  mockConsoleFetch,
  type MockConsole
} from '#tests/helpers/console/server'

function document(path = '/work/landing.fig') {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const title = editor.graph.createNode('TEXT', pageId, { name: 'Title', text: 'Version one' })
  const target = Object.assign(editor, {
    getSourceIdentity: () => ({ path }),
    getRecoveryId: () => `recovery-${path}`,
    state: Object.assign(editor.state, { documentName: 'Landing' })
  })
  return { editor: target, pageId, titleId: title.id }
}

function titleOf(editor: ReturnType<typeof document>['editor']): string | undefined {
  const node = [...editor.graph.nodes.values()].find((candidate) => candidate.name === 'Title')
  return node?.type === 'TEXT' ? node.text : undefined
}

function meta(id: string, kind: VersionMeta['kind'], minutes: number): VersionMeta {
  return {
    id,
    documentKey: 'file:/a.fig',
    documentName: 'A',
    kind,
    name: kind === 'named' ? id : null,
    createdAt: new Date(Date.UTC(2026, 9, 6, 9, minutes)).toISOString(),
    sceneVersion: minutes,
    byteLength: 1,
    remoteId: null
  }
}

beforeEach(() => {
  setVersionStoreForTests(createMemoryVersionStore())
})

afterEach(() => {
  setVersionStoreForTests(null)
})

describe('the version ring', () => {
  test('keeps the newest automatic versions and every named one', async () => {
    const versions = [
      ...Array.from({ length: AUTO_VERSION_LIMIT + 2 }, (_, index) =>
        meta(`auto-${index}`, 'auto', index)
      ),
      meta('launch', 'named', 0)
    ]
    expect(overflowingAutoVersions(versions).map((version) => version.id)).toEqual([
      'auto-0',
      'auto-1'
    ])

    const store = createMemoryVersionStore()
    for (let index = 0; index < 3; index++) {
      await saveVersion(
        store,
        {
          documentKey: 'file:/a.fig',
          documentName: 'A',
          kind: 'auto',
          name: null,
          sceneVersion: index,
          figBytes: new Uint8Array([index]),
          preview: null
        },
        new Date(Date.UTC(2026, 9, 6, 9, index))
      )
    }
    expect(overflowingAutoVersions(await store.list('file:/a.fig'), 2)).toHaveLength(1)
  })

  test('takes an automatic version only after a change and the interval', async () => {
    const { editor, titleId } = document()
    const start = Date.now()
    expect(await autoSaveVersion(editor, start)).not.toBeNull()
    // Nothing changed since.
    expect(await autoSaveVersion(editor, start + AUTO_VERSION_INTERVAL_MS)).toBeNull()

    editor.graph.updateNode(titleId, { text: 'Version two' })
    editor.requestRender()
    expect(await autoSaveVersion(editor, start + 1000)).toBeNull()
    expect(await autoSaveVersion(editor, Date.now() + AUTO_VERSION_INTERVAL_MS)).not.toBeNull()
    expect(await getVersionStore().list('file:/work/landing.fig')).toHaveLength(2)
  })
})

describe('restoring', () => {
  test('puts a version back as one undo step and keeps the work it replaced', async () => {
    const { editor, titleId } = document()
    await saveDocumentVersion(editor, 'named', 'First draft')
    editor.graph.updateNode(titleId, { text: 'Version two' })
    editor.requestRender()

    const entry = (await listHistory(editor)).find((row) => row.name === 'First draft')
    if (!entry) throw new Error('expected the named version')
    await restoreVersion(editor, entry)
    expect(titleOf(editor)).toBe('Version one')
    // The edits it replaced were kept as a version first.
    expect((await listHistory(editor)).map((row) => row.kind)).toEqual(['auto', 'named'])

    editor.undoAction()
    expect(titleOf(editor)).toBe('Version two')
    editor.redoAction()
    expect(titleOf(editor)).toBe('Version one')
  })

  test('names and deletes versions', async () => {
    const { editor } = document()
    const saved = await saveDocumentVersion(editor, 'auto')
    const named = await renameVersion(saved, '  Launch  ')
    expect(named).toMatchObject({ kind: 'named', name: 'Launch' })
    await deleteVersion(named)
    expect(await listHistory(editor)).toEqual([])
  })
})

describe('versions of a shared file in Redrob Cloud', () => {
  let mock: MockConsole

  function setupGlobals() {
    globalThis.window = {
      innerWidth: 1024,
      innerHeight: 768,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0)
        return 0
      },
      cancelAnimationFrame: vi.fn(),
      redrobDesign: {},
      location: { href: 'http://localhost/' } as Location,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as Window & typeof globalThis
    globalThis.document = { fonts: { add: vi.fn(), ready: Promise.resolve() } } as Document
  }

  /** An open tab showing a shared file this computer holds the key for. */
  async function sharedDocument(role: 'editor' | 'viewer' = 'editor') {
    const fileId = newCloudFileId()
    await adoptNewKey(fileId, 1, generateContentKey())
    mock.state.design.files.set(fileId, {
      id: fileId,
      encryptedName: 'c2VhbGVk',
      role,
      keyEpoch: 1,
      snapshotRevision: 3,
      createdAt: '2026-10-06T09:00:00.000Z',
      updatedAt: '2026-10-06T09:00:00.000Z'
    })
    mock.state.design.members.set(fileId, [
      {
        userId: mock.state.account.id,
        email: 'jane@example.com',
        name: 'Jane',
        role,
        addedAt: '2026-10-06T09:00:00.000Z'
      }
    ])
    const tab = createTab()
    const title = tab.store.graph.createNode('TEXT', tab.store.state.currentPageId, {
      name: 'Title',
      text: 'Version one'
    })
    bindCloudFile(tab.store, {
      fileId,
      name: 'Landing',
      role,
      epoch: 1,
      revision: 3,
      link: null,
      seed: null
    })
    return { editor: tab.store, fileId, titleId: title.id, key: threadKeyFor(tab.store) }
  }

  beforeEach(() => {
    setupGlobals()
    mock = createMockConsole()
    setConsoleClientForTests(
      createConsoleClient({
        baseURL: 'https://console.mock/v1',
        token: () => Promise.resolve(MOCK_TOKEN),
        fetch: mockConsoleFetch(mock)
      })
    )
    setCloudBlobFetchForTests(mockConsoleFetch(mock))
    cloudState.status = 'signed-in'
  })

  afterEach(() => {
    cloudState.status = 'signed-out'
    setConsoleClientForTests(null)
    setCloudBlobFetchForTests(null)
    forgetSessionKeys()
  })

  async function settle(key: string): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt++) {
      const pending = (await getVersionStore().list(key)).some((version) => !version.remoteId)
      if (!pending) return
      await Bun.sleep(5)
    }
  }

  const textOf = (editor: EditorStore, id: string) => {
    const node = editor.graph.getNode(id)
    return node?.type === 'TEXT' ? node.text : undefined
  }

  test('a file on this computer keeps its versions here', async () => {
    const { editor } = document()
    await saveDocumentVersion(editor, 'named', 'Local')
    await Bun.sleep(20)
    expect(mock.state.design.versions.size).toBe(0)
  })

  test('uploads each version sealed, names sealed, and lists what a collaborator saved', async () => {
    const { editor, fileId, key } = await sharedDocument()
    await saveDocumentVersion(editor, 'named', 'Pricing v2')
    await settle(key)
    const stored = mock.state.design.versions.get(fileId) ?? []
    expect(stored).toHaveLength(1)
    expect(stored[0].kind).toBe('named')
    expect(stored[0].revision).toBe(3)
    expect(stored[0].encryptedName).not.toContain('Pricing')
    const blob = mock.state.design.blobs.get(stored[0].key)
    expect(blob && Buffer.from(blob).includes(Buffer.from('Version one'))).toBe(false)

    // A collaborator's version, under a sealed name this computer can open.
    const sealedName = await sealText(
      await contentKey(fileId, 1),
      { fileId, epoch: 1, purpose: { kind: 'version-name' } },
      'From Sam'
    )
    mock.state.design.versions.set(fileId, [
      ...stored,
      {
        ...stored[0],
        id: 'version-sam',
        encryptedName: sealedName,
        createdBy: { id: 'user-2', name: 'Sam' }
      }
    ])
    const rows = await listHistory(editor)
    expect(rows.map((row) => row.origin).toSorted()).toEqual(['cloud', 'local'])
    expect(rows.find((row) => row.origin === 'cloud')?.name).toBe('From Sam')
  })

  test('restores a version only Redrob Cloud has', async () => {
    const { editor, key, titleId } = await sharedDocument()
    await saveDocumentVersion(editor, 'named', 'Shared')
    await settle(key)
    const [local] = await getVersionStore().list(key)
    await getVersionStore().remove(local.id)

    editor.graph.updateNode(titleId, { text: 'Version two' })
    editor.requestRender()
    const cloudRow = (await listHistory(editor)).find((row) => row.origin === 'cloud')
    if (!cloudRow) throw new Error('expected a version only Redrob Cloud has')
    await restoreVersion(editor, cloudRow)
    const restored = [...editor.graph.getAllNodes()].find((node) => node.name === 'Title')
    expect(restored && textOf(editor, restored.id)).toBe('Version one')
  })

  test('a viewer lists versions but uploads none and cannot restore', async () => {
    const { editor, fileId } = await sharedDocument('viewer')
    await saveDocumentVersion(editor, 'auto')
    await Bun.sleep(30)
    expect(mock.state.design.versions.get(fileId) ?? []).toHaveLength(0)
    const [row] = await listHistory(editor)
    expect(restoreVersion(editor, row)).rejects.toThrow('not change')
  })

  test('offline, History shows the versions on this computer', async () => {
    const { editor } = await sharedDocument()
    setConsoleClientForTests(
      createConsoleClient({
        baseURL: 'https://console.mock/v1',
        token: () => Promise.resolve(MOCK_TOKEN),
        fetch: () => Promise.reject(new TypeError('offline'))
      })
    )
    await saveDocumentVersion(editor, 'auto')
    const rows = await listHistory(editor)
    expect(rows).toHaveLength(1)
    expect(rows[0].synced).toBe(false)
  })
})
