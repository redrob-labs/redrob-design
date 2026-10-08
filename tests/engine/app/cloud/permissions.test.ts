import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import { threadKeyFor } from '@/app/assistant/thread/store'
import {
  ReadOnlyFileError,
  assertCanEdit,
  bindCloudFile,
  canCommentOn,
  canEditKey,
  newCloudFileId,
  updateCloudBinding,
  type CloudFileBinding
} from '@/app/cloud/files'
import {
  addComment,
  deleteComment,
  resetCommentsForTests,
  setThreadResolved
} from '@/app/comments/store'
import { createTab, setTabMode } from '@/app/tabs'

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

beforeEach(setupGlobals)
afterEach(() => resetCommentsForTests())

function shared(role: CloudFileBinding['role']) {
  const tab = createTab()
  const binding: CloudFileBinding = {
    fileId: newCloudFileId(),
    name: 'Shared',
    role,
    epoch: 1,
    revision: 1,
    link: null,
    seed: null
  }
  bindCloudFile(tab.store, binding)
  return { tab, key: threadKeyFor(tab.store) }
}

const anchor = { nodeId: null, x: 0, y: 0, pageId: 'page' }

describe('what each role may do to an open shared file', () => {
  test('a file on this computer allows everything', async () => {
    const tab = createTab()
    expect(() => assertCanEdit(tab.store)).not.toThrow()
    expect(tab.readOnly ?? false).toBe(false)
    expect(canEditKey(threadKeyFor(tab.store))).toBe(true)
  })

  test('a viewer opens read-only in Edit too, and cannot be edited by Redrob, restored or commented on', async () => {
    const { tab, key } = shared('viewer')
    expect(tab.store.state.viewOnly).toBe(true)
    setTabMode(tab.id, 'edit')
    expect(tab.store.state.viewOnly).toBe(true)
    setTabMode(tab.id, 'describe')
    setTabMode(tab.id, 'edit')
    expect(tab.store.state.viewOnly).toBe(true)

    expect(() => assertCanEdit(tab.store)).toThrow(ReadOnlyFileError)
    expect(canEditKey(key)).toBe(false)
    expect(canCommentOn(key)).toBe(false)
    expect(addComment(key, { anchor, text: 'hello' })).rejects.toBeInstanceOf(ReadOnlyFileError)
    expect(() => setThreadResolved(key, 'x', true)).toThrow(ReadOnlyFileError)
    expect(deleteComment(key, 'x')).rejects.toBeInstanceOf(ReadOnlyFileError)
  })

  test('a commenter comments but does not edit', async () => {
    const { tab, key } = shared('commenter')
    expect(tab.store.state.viewOnly).toBe(true)
    expect(() => assertCanEdit(tab.store)).toThrow(ReadOnlyFileError)
    expect(canCommentOn(key)).toBe(true)
    const comment = await addComment(key, { anchor, text: 'Looks good' })
    expect(comment?.text).toBe('Looks good')
  })

  test('an editor edits, and losing the role makes the tab read-only at once', () => {
    const { tab } = shared('editor')
    expect(tab.store.state.viewOnly).toBe(false)
    expect(() => assertCanEdit(tab.store)).not.toThrow()
    updateCloudBinding(tab.store, { role: 'viewer' })
    expect(tab.store.state.viewOnly).toBe(true)
    expect(() => assertCanEdit(tab.store)).toThrow(ReadOnlyFileError)
  })
})
