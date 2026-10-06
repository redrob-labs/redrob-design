import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import {
  deviceKeyPair,
  exportDevicePublicKey,
  forgetFileKeys,
  generateContentKey,
  resetKeystoreForTests,
  unwrapContentKey
} from '@/app/cloud/crypto'
import {
  CloudKeyPendingError,
  applyGraphState,
  cloudBindingOf,
  contentKey,
  createViewLink,
  encodeGraphState,
  forgetSessionKeys,
  grantPendingDevices,
  listSharedFiles,
  loadSnapshot,
  newCloudFileId,
  openCloudFile,
  parseCloudLink,
  saveSnapshot,
  setCloudBlobFetchForTests,
  shareDocument,
  viewLink
} from '@/app/cloud/files'
import { adoptNewKey } from '@/app/cloud/files/keyring'
import type { EditorStore } from '@/app/editor/active-store'
import {
  CONSOLE_SESSION_REF,
  cloudState,
  createConsoleClient,
  setConsoleClientForTests
} from '@/app/integrations/console'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { createTab, getActiveStore, getTabForStore } from '@/app/tabs'

import { MOCK_DEVICE_ID } from '#tests/helpers/console/design'
import {
  MOCK_TOKEN,
  createMockConsole,
  mockConsoleFetch,
  type MockConsole
} from '#tests/helpers/console/server'

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

let mock: MockConsole

async function signIn(): Promise<void> {
  mock = createMockConsole()
  await appCredentialServices.manager.set(CONSOLE_SESSION_REF, MOCK_TOKEN)
  setConsoleClientForTests(
    createConsoleClient({
      baseURL: 'https://console.mock/v1',
      token: () => appCredentialServices.resolver.resolve(CONSOLE_SESSION_REF),
      fetch: mockConsoleFetch(mock)
    })
  )
  setCloudBlobFetchForTests(mockConsoleFetch(mock))
  cloudState.account = mock.state.account
  cloudState.status = 'signed-in'
}

async function signOut(): Promise<void> {
  cloudState.account = null
  cloudState.status = 'signed-out'
  await appCredentialServices.manager.clear(CONSOLE_SESSION_REF)
}

/** Forget everything this computer knows, as a second computer would. */
async function forgetKeys(): Promise<void> {
  forgetSessionKeys()
  await forgetFileKeys()
}

function pageWithTitle(store: EditorStore, text: string): void {
  store.graph.createNode('TEXT', store.state.currentPageId, { name: 'Title', text })
}

function titleOf(store: EditorStore): string | undefined {
  const node = [...store.graph.getAllNodes()].find((candidate) => candidate.name === 'Title')
  return node?.type === 'TEXT' ? node.text : undefined
}

beforeEach(async () => {
  setupGlobals()
  await signIn()
})

afterEach(async () => {
  await forgetKeys()
  resetKeystoreForTests()
  setConsoleClientForTests(null)
  setCloudBlobFetchForTests(null)
  await signOut()
})

describe('links', () => {
  test('a member link names the file; a view link also carries its token and key in the fragment', () => {
    const fileId = newCloudFileId()
    expect(fileId).toMatch(/^dfl_[0-9a-f]{32}$/)
    expect(parseCloudLink(`https://app.redrob.design/f/${fileId}`)).toEqual({ fileId, view: null })
    expect(parseCloudLink(fileId)).toEqual({ fileId, view: null })

    const raw = generateContentKey()
    const link = viewLink(fileId, { token: 'rrl_token-0123456789', epoch: 2, raw })
    expect(new URL(link).search).toBe('')
    const parsed = parseCloudLink(link)
    expect(parsed?.view?.token).toBe('rrl_token-0123456789')
    expect(parsed?.view?.epoch).toBe(2)
    expect(Buffer.from(parsed?.view?.raw ?? []).equals(Buffer.from(raw))).toBe(true)
  })

  test('anything that is not a file link is refused', () => {
    expect(parseCloudLink('https://example.com/share/abc')).toBeNull()
    expect(parseCloudLink('not a link')).toBeNull()
    expect(parseCloudLink(`https://app.redrob.design/f/${newCloudFileId()}#t=x`)).toBeNull()
    expect(
      parseCloudLink(`https://app.redrob.design/f/${newCloudFileId()}#t=x&e=1&k=AAAA`)
    ).toBeNull()
  })
})

describe('a document as a shared file holds it', () => {
  test('round-trips through its Yjs state', () => {
    const source = createTab().store
    pageWithTitle(source, 'From the owner')
    const target = createTab().store
    applyGraphState(target, encodeGraphState(source))
    expect(titleOf(target)).toBe('From the owner')
  })
})

describe('snapshots', () => {
  async function newFile(): Promise<string> {
    const fileId = newCloudFileId()
    const raw = generateContentKey()
    await adoptNewKey(fileId, 1, raw)
    const device = await deviceKeyPair()
    const { wrapContentKey } = await import('@/app/cloud/crypto')
    await mock.app.fetch(
      new Request('http://mock/design/files', {
        method: 'POST',
        headers: { authorization: `Bearer ${MOCK_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          id: fileId,
          encryptedName: 'c2VhbGVk',
          keyGrant: {
            wrappedKey: await wrapContentKey(raw, device.publicKey, { fileId, epoch: 1 })
          }
        })
      })
    )
    return fileId
  }

  test('are sealed in the bucket, and open again from the device’s own grant', async () => {
    const fileId = await newFile()
    const state = new Uint8Array(new TextEncoder().encode('yjs state'))
    expect(await saveSnapshot(fileId, 1, state, 0)).toEqual({ saved: true, revision: 1 })
    const stored = [...mock.state.design.blobs.values()][0]
    expect(Buffer.from(stored).includes(Buffer.from('yjs state'))).toBe(false)

    await forgetKeys()
    const loaded = await loadSnapshot(fileId)
    expect(loaded?.revision).toBe(1)
    expect(new TextDecoder().decode(loaded?.state)).toBe('yjs state')
  })

  test('a save on a stale revision is refused, to be merged and saved again', async () => {
    const fileId = await newFile()
    await saveSnapshot(fileId, 1, new Uint8Array([1]), 0)
    expect(await saveSnapshot(fileId, 1, new Uint8Array([2]), 0)).toEqual({ saved: false })
    expect(await saveSnapshot(fileId, 1, new Uint8Array([2]), 1)).toEqual({
      saved: true,
      revision: 2
    })
  })

  test('a file with nothing saved has no snapshot', async () => {
    expect(await loadSnapshot(await newFile())).toBeNull()
  })
})

describe('sharing and opening', () => {
  test('sharing seals the name, saves the document, and binds the tab', async () => {
    const tab = createTab()
    tab.store.state.documentName = 'Landing page'
    pageWithTitle(tab.store, 'Shared copy')
    const binding = await shareDocument(tab.store)
    expect(binding.role).toBe('owner')
    expect(binding.revision).toBe(1)
    expect(tab.store.getSourceIdentity().cloudFileId).toBe(binding.fileId)
    const file = mock.state.design.files.get(binding.fileId)
    expect(file?.encryptedName).not.toContain('Landing')
    expect(mock.state.design.grants.has(`${binding.fileId}:${MOCK_DEVICE_ID}:1`)).toBe(true)
    expect(await shareDocument(tab.store)).toBe(binding)

    const listed = await listSharedFiles()
    expect(listed.map((entry) => entry.name)).toEqual(['Landing page'])
  })

  test('opening it on another computer of the same person reads it back from its snapshot', async () => {
    const tab = createTab()
    tab.store.state.documentName = 'Pricing'
    pageWithTitle(tab.store, 'Twenty four dollars')
    const { fileId } = await shareDocument(tab.store)
    expect(await openCloudFile({ fileId, view: null })).toBe(tab.store)

    // Another computer: no tab for it, no keys, only the device's grant on Console.
    tab.store.setCloudDocumentSource('dfl_00000000000000000000000000000000', 'detached')
    await forgetKeys()
    createTab()
    const opened = await openCloudFile({ fileId, view: null })
    expect(opened).not.toBe(tab.store)
    expect(getActiveStore()).toBe(opened)
    expect(titleOf(opened)).toBe('Twenty four dollars')
    expect(opened.state.documentName).toBe('Pricing')
    expect(cloudBindingOf(opened)?.role).toBe('owner')
    expect(getTabForStore(opened)?.readOnly).toBe(false)
  })

  test('a view link opens the file read-only, signed out, with nothing but the link', async () => {
    const tab = createTab()
    tab.store.state.documentName = 'Launch'
    pageWithTitle(tab.store, 'Read me')
    const binding = await shareDocument(tab.store)
    const link = await createViewLink(binding)
    // The file's own tab is closed elsewhere; open from the link alone.
    mock.state.account = { ...mock.state.account, id: 'someone-else' }
    await forgetKeys()
    await signOut()
    tab.store.setCloudDocumentSource('dfl_00000000000000000000000000000000', 'detached')

    const target = parseCloudLink(link)
    if (!target) throw new Error('link did not parse')
    const store = await openCloudFile(target)
    expect(titleOf(store)).toBe('Read me')
    expect(store.state.documentName).toBe('Launch')
    expect(cloudBindingOf(store)?.role).toBe('viewer')
    expect(getTabForStore(store)?.readOnly).toBe(true)
    expect(store.state.viewOnly).toBe(true)
  })

  test('without a grant yet, the file waits for someone with access', async () => {
    const tab = createTab()
    const { fileId } = await shareDocument(tab.store)
    mock.state.design.grants.clear()
    await forgetKeys()
    expect(contentKey(fileId, 1)).rejects.toBeInstanceOf(CloudKeyPendingError)
  })
})

describe('handing the key to members’ devices', () => {
  test('an owner wraps the key for each pending device, which can then unwrap it', async () => {
    const tab = createTab()
    const { fileId } = await shareDocument(tab.store)
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
      'deriveBits'
    ])
    const publicKey = await exportDevicePublicKey(pair.publicKey)
    mock.state.design.pendingDevices.set(fileId, [
      { deviceId: 'device-guest', userId: 'user-guest', publicKey }
    ])

    expect(await grantPendingDevices(fileId, 1)).toBe(1)
    const wrapped = mock.state.design.grants.get(`${fileId}:device-guest:1`)
    if (!wrapped) throw new Error('no grant stored')
    const raw = await unwrapContentKey(wrapped, pair.privateKey, { fileId, epoch: 1 })
    expect(raw.byteLength).toBe(32)
    expect(await grantPendingDevices(fileId, 1)).toBe(0)
  })
})
