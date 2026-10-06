import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import { SceneGraph } from '@redrob-design/scene-graph'

import { threadKeyFor } from '@/app/assistant/thread/store'
import { generateContentKey } from '@/app/cloud/crypto'
import {
  bindCloudFile,
  contentKey,
  forgetSessionKeys,
  newCloudFileId,
  sealText
} from '@/app/cloud/files'
import { adoptNewKey } from '@/app/cloud/files/keyring'
import { mergeRemote, threadsOf } from '@/app/comments/model'
import { DRAFT_PIN_ID, anchorAt, commentPinsFor } from '@/app/comments/pins'
import { createMemoryCommentStorage, setCommentStorageForTests } from '@/app/comments/storage'
import {
  addComment,
  commentsOf,
  deleteComment,
  resetCommentsForTests,
  setThreadResolved,
  threadsFor
} from '@/app/comments/store'
import { syncComments } from '@/app/comments/sync'
import type { LocalComment } from '@/app/comments/types'
import {
  cloudState,
  createConsoleClient,
  createMemorySnapshotCache,
  setConsoleCacheForTests,
  setConsoleClientForTests,
  type ConsoleComment,
  type FileComment
} from '@/app/integrations/console'
import { createTab } from '@/app/tabs'

import {
  MOCK_TOKEN,
  createMockConsole,
  mockConsoleFetch,
  type MockConsole
} from '#tests/helpers/console/server'

const KEY = 'file:/work/landing.fig'

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
const anchor = { nodeId: null, x: 10, y: 20, pageId: 'page-1' }

function local(overrides: Partial<LocalComment>): LocalComment {
  return {
    id: 'c1',
    documentKey: KEY,
    threadId: null,
    anchor,
    author: { id: 'local', name: '' },
    text: 'Hi',
    resolved: false,
    createdAt: '2026-10-06T09:00:00.000Z',
    updatedAt: '2026-10-06T09:00:00.000Z',
    remote: true,
    synced: true,
    remoteUpdatedAt: '2026-10-06T09:00:00.000Z',
    deleted: false,
    ...overrides
  }
}

function remote(overrides: Partial<ConsoleComment>): ConsoleComment {
  return {
    id: 'c1',
    documentId: 'doc',
    threadId: null,
    anchor,
    author: { id: 'user-2', name: 'Sam' },
    text: 'Hi',
    resolved: false,
    createdAt: '2026-10-06T09:00:00.000Z',
    updatedAt: '2026-10-06T09:00:00.000Z',
    ...overrides
  }
}

beforeEach(() => {
  resetCommentsForTests()
  setCommentStorageForTests(createMemoryCommentStorage())
})

afterEach(() => {
  setCommentStorageForTests(null)
})

describe('the comment model', () => {
  test('groups replies under their thread, oldest first, without deleted ones', () => {
    const threads = threadsOf([
      local({ id: 'reply-2', threadId: 'c1', createdAt: '2026-10-06T09:02:00.000Z' }),
      local({ id: 'c1' }),
      local({ id: 'reply-1', threadId: 'c1', createdAt: '2026-10-06T09:01:00.000Z' }),
      local({ id: 'gone', threadId: 'c1', deleted: true })
    ])
    expect(threads).toHaveLength(1)
    expect(threads[0].replies.map((reply) => reply.id)).toEqual(['reply-1', 'reply-2'])
  })

  test('merges by id and the later edit wins', () => {
    const resolvedHere = local({
      resolved: true,
      synced: false,
      updatedAt: '2026-10-06T09:05:00.000Z'
    })
    // An older remote copy does not undo the local resolve, but its time is kept for If-Match.
    const [kept] = mergeRemote(
      [resolvedHere],
      [remote({ updatedAt: '2026-10-06T09:03:00.000Z' })],
      KEY
    )
    expect(kept).toMatchObject({ resolved: true, synced: false })
    expect(kept.remoteUpdatedAt).toBe('2026-10-06T09:03:00.000Z')

    // A newer remote reopen wins.
    const [taken] = mergeRemote(
      [resolvedHere],
      [remote({ resolved: false, updatedAt: '2026-10-06T09:09:00.000Z' })],
      KEY
    )
    expect(taken).toMatchObject({ resolved: false, synced: true })

    const both = mergeRemote([resolvedHere], [remote({ id: 'c2', text: 'New' })], KEY)
    expect(both.map((comment) => comment.id).toSorted()).toEqual(['c1', 'c2'])
  })
})

describe('pins', () => {
  test('follow their layer, number threads and hide resolved ones unless asked', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const card = graph.createNode('FRAME', pageId, { x: 100, y: 50, width: 200, height: 100 })
    const onCard = anchorAt(graph, pageId, { x: 110, y: 60 }, card.id)
    expect(onCard).toEqual({ nodeId: card.id, x: 10, y: 10, pageId })
    const threads = threadsOf([
      local({ id: 't1', anchor: onCard }),
      local({ id: 't2', anchor: { nodeId: null, x: 5, y: 5, pageId }, resolved: true })
    ])

    graph.updateNode(card.id, { x: 300 })
    graph.clearAbsPosCache()
    const pins = commentPinsFor(graph, pageId, threads, {
      activeId: 't1',
      showResolved: false,
      draft: { nodeId: null, x: 1, y: 2, pageId }
    })
    expect(pins).toEqual([
      { id: 't1', x: 310, y: 60, label: '1', resolved: false, active: true },
      { id: DRAFT_PIN_ID, x: 1, y: 2, label: '', resolved: false, active: true }
    ])
    const all = commentPinsFor(graph, pageId, threads, {
      activeId: null,
      showResolved: true,
      draft: null
    })
    expect(all.map((pin) => pin.label)).toEqual(['1', '2'])
  })
})

describe('comments on this computer', () => {
  test('start threads, reply, resolve and delete without an account', async () => {
    const root = await addComment(KEY, { anchor, text: '  Tighten the hero  ' })
    if (!root) throw new Error('expected a comment')
    expect(root).toMatchObject({ text: 'Tighten the hero', author: { id: 'local' }, synced: false })
    await addComment(KEY, { anchor, text: 'On it', threadId: root.id })
    expect(await addComment(KEY, { anchor, text: '   ' })).toBeNull()

    await setThreadResolved(KEY, root.id, true)
    expect(threadsFor(KEY)[0].root.resolved).toBe(true)
    expect(await syncComments(KEY)).toBe('local')

    await deleteComment(KEY, root.id)
    // Never shared, so nothing waits on Redrob Cloud.
    expect(commentsOf(KEY)).toEqual([])
  })
})

describe('comments on a shared file', () => {
  let mock: MockConsole
  let fileId: string
  let key: string

  /** Seals a comment the way another collaborator's app would. */
  async function theirs(id: string, text: string): Promise<FileComment> {
    const contentKeyFor = await contentKey(fileId, 1)
    const ciphertext = await sealText(
      contentKeyFor,
      { fileId, epoch: 1, purpose: { kind: 'comment' } },
      JSON.stringify({ id, text, anchor })
    )
    return {
      id,
      fileId,
      threadId: null,
      author: { id: 'user-2', name: 'Sam' },
      ciphertext,
      epoch: 1,
      resolved: false,
      deleted: false,
      createdAt: '2026-10-06T09:00:00.000Z',
      updatedAt: '2026-10-06T09:00:00.000Z'
    }
  }

  beforeEach(async () => {
    setupGlobals()
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
    cloudState.account = mock.state.account
    fileId = newCloudFileId()
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
    const tab = createTab()
    bindCloudFile(tab.store, {
      fileId,
      name: 'Shared',
      role: 'editor',
      epoch: 1,
      revision: 1,
      link: null,
      seed: null
    })
    key = threadKeyFor(tab.store)
  })

  afterEach(() => {
    cloudState.status = 'signed-out'
    cloudState.account = null
    setConsoleClientForTests(null)
    setConsoleCacheForTests(null)
    forgetSessionKeys()
  })

  test('a file on this computer keeps its comments here', async () => {
    await addComment(KEY, { anchor, text: 'Local only' })
    expect(await syncComments(KEY)).toBe('local')
    expect(mock.state.design.comments.size).toBe(0)
  })

  test('uploads threads made offline sealed, with their own ids, then their resolve', async () => {
    const root = await addComment(key, { anchor, text: 'Check the price' })
    if (!root) throw new Error('expected a comment')
    await setThreadResolved(key, root.id, true)
    expect(await syncComments(key)).toBe('synced')

    const stored = mock.state.design.comments.get(fileId) ?? []
    expect(stored.map((comment) => comment.id)).toEqual([root.id])
    expect(stored[0].resolved).toBe(true)
    expect(stored[0].ciphertext).not.toContain('price')
    expect(
      Buffer.from(stored[0].ciphertext ?? '', 'base64url').includes(Buffer.from('price'))
    ).toBe(false)
    expect(commentsOf(key).every((comment) => comment.synced)).toBe(true)
  })

  test("reads other people's comments, and resolves them without touching their text", async () => {
    mock.state.design.comments.set(fileId, [await theirs('theirs-1', 'From Sam')])
    await syncComments(key)
    expect(threadsFor(key).map((thread) => thread.root.text)).toEqual(['From Sam'])
    expect(threadsFor(key)[0].root.author.name).toBe('Sam')

    await setThreadResolved(key, 'theirs-1', true)
    expect(await syncComments(key)).toBe('synced')
    const [stored] = mock.state.design.comments.get(fileId) ?? []
    expect(stored.resolved).toBe(true)
    expect(stored.author.id).toBe('user-2')
  })

  test('a comment whose sealed id does not match is not shown', async () => {
    const moved = await theirs('original', 'Moved by Console')
    mock.state.design.comments.set(fileId, [{ ...moved, id: 'elsewhere' }])
    await syncComments(key)
    expect(threadsFor(key)).toEqual([])
  })

  test('deletes in Redrob Cloud too, and drops what was deleted there', async () => {
    const root = await addComment(key, { anchor, text: 'Remove me' })
    const kept = await addComment(key, { anchor, text: 'Keep me' })
    if (!root || !kept) throw new Error('expected comments')
    await syncComments(key)

    await deleteComment(key, root.id)
    await syncComments(key)
    const live = (mock.state.design.comments.get(fileId) ?? []).filter((c) => !c.deleted)
    expect(live.map((c) => c.id)).toEqual([kept.id])

    // Someone else deletes the other one; the tombstone reaches this computer.
    const [, other] = mock.state.design.comments.get(fileId) ?? []
    Object.assign(other, { deleted: true, ciphertext: null, updatedAt: '2030-01-01T00:00:00.000Z' })
    await syncComments(key)
    expect(commentsOf(key).filter((c) => !c.deleted)).toEqual([])
  })
})
