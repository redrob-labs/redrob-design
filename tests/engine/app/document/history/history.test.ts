import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@redrob-design/core/editor'

import { resetCloudVersionsForTests } from '@/app/document/history/cloud'
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
import {
  cloudState,
  createConsoleClient,
  setConsoleClientForTests
} from '@/app/integrations/console'

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

describe('versions in Redrob Cloud', () => {
  let mock: MockConsole

  beforeEach(() => {
    resetCloudVersionsForTests()
    mock = createMockConsole()
    setConsoleClientForTests(
      createConsoleClient({
        baseURL: 'https://console.mock/v1',
        token: () => Promise.resolve(MOCK_TOKEN),
        fetch: mockConsoleFetch(mock)
      })
    )
    cloudState.status = 'signed-in'
  })

  afterEach(() => {
    cloudState.status = 'signed-out'
    setConsoleClientForTests(null)
  })

  async function settle(): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const pending = (await getVersionStore().list('file:/work/landing.fig')).some(
        (version) => !version.remoteId
      )
      if (!pending) return
      await Bun.sleep(5)
    }
  }

  test('uploads each version once with If-Match, and lists what another device saved', async () => {
    const { editor } = document()
    await saveDocumentVersion(editor, 'named', 'Here')
    await settle()
    const [documentId] = mock.state.versions.keys()
    expect(documentId).toMatch(/^doc_[0-9a-f]{64}$/)
    expect(mock.state.versions.get(documentId)).toHaveLength(1)

    // Another computer saves, so this one's ETag is stale: it reads again and retries.
    const others = mock.state.versions.get(documentId) ?? []
    mock.state.versions.set(documentId, [
      ...others,
      { ...others[0], id: 'version-other', name: 'From the laptop' }
    ])
    await saveDocumentVersion(editor, 'auto')
    await settle()
    expect(mock.state.versions.get(documentId)).toHaveLength(3)

    const rows = await listHistory(editor)
    expect(rows.map((row) => row.origin).toSorted()).toEqual(['cloud', 'local', 'local'])
    expect(rows.find((row) => row.origin === 'cloud')?.name).toBe('From the laptop')
  })

  test('restores a version only Redrob Cloud has', async () => {
    const { editor, titleId } = document()
    await saveDocumentVersion(editor, 'named', 'Shared')
    await settle()
    const [local] = await getVersionStore().list('file:/work/landing.fig')
    await getVersionStore().remove(local.id)

    editor.graph.updateNode(titleId, { text: 'Version two' })
    editor.requestRender()
    const cloudRow = (await listHistory(editor)).find((row) => row.origin === 'cloud')
    if (!cloudRow) throw new Error('expected a version only Redrob Cloud has')
    await restoreVersion(editor, cloudRow)
    expect(titleOf(editor)).toBe('Version one')
  })

  test('offline, History shows the versions on this computer', async () => {
    setConsoleClientForTests(
      createConsoleClient({
        baseURL: 'https://console.mock/v1',
        token: () => Promise.resolve(MOCK_TOKEN),
        fetch: () => Promise.reject(new TypeError('offline'))
      })
    )
    const { editor } = document()
    await saveDocumentVersion(editor, 'auto')
    const rows = await listHistory(editor)
    expect(rows).toHaveLength(1)
    expect(rows[0].synced).toBe(false)
  })
})
