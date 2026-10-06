import 'fake-indexeddb/auto'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import * as Y from 'yjs'

import { generateContentKey, resetKeystoreForTests } from '@/app/cloud/crypto'
import {
  forgetSessionKeys,
  loadSnapshot,
  newCloudFileId,
  saveSnapshot,
  setCloudBlobFetchForTests,
  type CloudFileBinding
} from '@/app/cloud/files'
import { adoptNewKey } from '@/app/cloud/files/keyring'
import { createSnapshotKeeper } from '@/app/collab/snapshots'
import { createConsoleClient, setConsoleClientForTests } from '@/app/integrations/console'

import { MOCK_TOKEN, createMockConsole, mockConsoleFetch } from '#tests/helpers/console/server'

const mock = createMockConsole()

beforeAll(() => {
  setConsoleClientForTests(
    createConsoleClient({
      baseURL: 'https://console.mock/v1',
      token: () => Promise.resolve(MOCK_TOKEN),
      fetch: mockConsoleFetch(mock)
    })
  )
  setCloudBlobFetchForTests(mockConsoleFetch(mock))
})

afterAll(() => {
  setConsoleClientForTests(null)
  setCloudBlobFetchForTests(null)
  forgetSessionKeys()
  resetKeystoreForTests()
})

async function sharedFile(): Promise<string> {
  const fileId = newCloudFileId()
  await adoptNewKey(fileId, 1, generateContentKey())
  mock.state.design.files.set(fileId, {
    id: fileId,
    encryptedName: 'c2VhbGVk',
    role: 'editor',
    keyEpoch: 1,
    snapshotRevision: 0,
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
  return fileId
}

describe('keeping a shared file’s snapshot', () => {
  test('saves after edits stop, and merges a collaborator’s save rather than losing either', async () => {
    const fileId = await sharedFile()
    let binding: CloudFileBinding = {
      fileId,
      name: 'F',
      role: 'editor',
      epoch: 1,
      revision: 0,
      link: null,
      seed: null
    }

    const mine = new Y.Doc()
    mine.getMap('nodes').set('mine', 'mine')
    // Someone else saved first, from their own document.
    const theirs = new Y.Doc()
    theirs.getMap('nodes').set('theirs', 'theirs')
    await saveSnapshot(fileId, 1, new Uint8Array(Y.encodeStateAsUpdate(theirs)), 0)

    const saved: number[] = []
    const keeper = createSnapshotKeeper({
      ydoc: mine,
      binding: () => binding,
      onSaved: (revision) => {
        saved.push(revision)
        binding = { ...binding, revision }
      },
      idleMs: 10,
      maxIntervalMs: 1000
    })
    keeper.touch()
    await Bun.sleep(30)
    await keeper.flush()

    expect(saved).toEqual([2])
    expect(mine.getMap('nodes').get('theirs')).toBe('theirs')
    const stored = await loadSnapshot(fileId)
    const reopened = new Y.Doc()
    if (stored) Y.applyUpdate(reopened, stored.state)
    expect(reopened.getMap('nodes').toJSON()).toEqual({ mine: 'mine', theirs: 'theirs' })
    keeper.dispose()
  })

  test('saves nothing when nothing changed', async () => {
    const fileId = await sharedFile()
    const keeper = createSnapshotKeeper({
      ydoc: new Y.Doc(),
      binding: () => ({
        fileId,
        name: 'F',
        role: 'editor',
        epoch: 1,
        revision: 0,
        link: null,
        seed: null
      }),
      onSaved: () => {
        throw new Error('should not save')
      }
    })
    await keeper.flush()
    expect(await loadSnapshot(fileId)).toBeNull()
    keeper.dispose()
  })
})
