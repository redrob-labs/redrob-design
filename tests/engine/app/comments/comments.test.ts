import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@redrob-design/scene-graph'

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
  consoleDocumentId,
  createConsoleClient,
  createMemorySnapshotCache,
  setConsoleCacheForTests,
  setConsoleClientForTests,
  type ConsoleComment
} from '@/app/integrations/console'

import {
  MOCK_TOKEN,
  createMockConsole,
  mockConsoleFetch,
  type MockConsole
} from '#tests/helpers/console/server'

const KEY = 'file:/work/landing.fig'
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

describe('comments in Redrob Cloud', () => {
  let mock: MockConsole
  let documentId: string

  beforeEach(async () => {
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
    documentId = await consoleDocumentId(KEY)
  })

  afterEach(() => {
    cloudState.status = 'signed-out'
    setConsoleClientForTests(null)
    setConsoleCacheForTests(null)
  })

  test('uploads threads made offline with their own ids, then their resolve', async () => {
    const root = await addComment(KEY, { anchor, text: 'Check the price' })
    if (!root) throw new Error('expected a comment')
    await setThreadResolved(KEY, root.id, true)
    expect(await syncComments(KEY)).toBe('synced')

    const stored = mock.state.comments.get(documentId) ?? []
    expect(stored.map((comment) => comment.id)).toEqual([root.id])
    expect(stored[0].resolved).toBe(true)
    expect(commentsOf(KEY).every((comment) => comment.synced)).toBe(true)
  })

  test("reads other people's comments and keeps the later of two resolves", async () => {
    mock.state.comments.set(documentId, [remote({ id: 'theirs', documentId, text: 'From Sam' })])
    await syncComments(KEY)
    expect(threadsFor(KEY).map((thread) => thread.root.text)).toEqual(['From Sam'])

    // Sam reopens after this computer resolves, but before it syncs: Sam's is later.
    await setThreadResolved(KEY, 'theirs', true)
    const [theirs] = mock.state.comments.get(documentId) ?? []
    theirs.resolved = false
    theirs.updatedAt = new Date(Date.now() + 60_000).toISOString()
    await syncComments(KEY)
    await syncComments(KEY)
    expect(threadsFor(KEY)[0].root.resolved).toBe(false)
  })

  test('deletes in Redrob Cloud too, and drops what was deleted there', async () => {
    const root = await addComment(KEY, { anchor, text: 'Remove me' })
    const kept = await addComment(KEY, { anchor, text: 'Keep me' })
    if (!root || !kept) throw new Error('expected comments')
    await syncComments(KEY)

    await deleteComment(KEY, root.id)
    await syncComments(KEY)
    expect((mock.state.comments.get(documentId) ?? []).map((c) => c.id)).toEqual([kept.id])

    mock.state.comments.set(documentId, [])
    await setThreadResolved(KEY, kept.id, true)
    await syncComments(KEY)
    expect(commentsOf(KEY)).toEqual([])
  })
})
