import 'fake-indexeddb/auto'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { generateContentKey, resetKeystoreForTests } from '@/app/cloud/crypto'
import { forgetSessionKeys, newCloudFileId, type CloudFileBinding } from '@/app/cloud/files'
import { adoptNewKey } from '@/app/cloud/files/keyring'
import { fileRelayTicket, joinCloudFileRoom, relayCipher } from '@/app/collab/transport'
import { deferredCollabRoom } from '@/app/collab/transport/deferred'
import {
  decodeRelayFrame,
  encodeActionFrame,
  encodeControlFrame
} from '@/app/collab/transport/relay/frames'
import { connectRelayRoom, type RelayStop } from '@/app/collab/transport/relay/room'
import type { CollabRoomTransport } from '@/app/collab/transport/types'
import { createConsoleClient, setConsoleClientForTests } from '@/app/integrations/console'

import { createMockRelay, type MockRelay } from '#tests/helpers/console/relay'
import { MOCK_TOKEN, createMockConsole, mockConsoleFetch } from '#tests/helpers/console/server'

const mock = createMockConsole()
let relay: MockRelay
const open: CollabRoomTransport[] = []

/** A shared file the mock knows, with this computer holding its key. */
async function sharedFile(): Promise<CloudFileBinding> {
  const fileId = newCloudFileId()
  await adoptNewKey(fileId, 1, generateContentKey())
  mock.state.design.files.set(fileId, {
    id: fileId,
    encryptedName: 'c2VhbGVk',
    role: 'owner',
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
      role: 'owner',
      addedAt: '2026-10-06T09:00:00.000Z'
    }
  ])
  return { fileId, name: 'File', role: 'owner', epoch: 1, revision: 0, link: null, seed: null }
}

beforeAll(() => {
  relay = createMockRelay(mock.state.design.relayTickets)
  mock.state.design.relay.url = relay.url
  setConsoleClientForTests(
    createConsoleClient({
      baseURL: 'https://console.mock/v1',
      token: () => Promise.resolve(MOCK_TOKEN),
      fetch: mockConsoleFetch(mock)
    })
  )
})

afterEach(async () => {
  await Promise.all(open.splice(0).map((room) => room.leave()))
})

afterAll(() => {
  relay.stop()
  setConsoleClientForTests(null)
  forgetSessionKeys()
  resetKeystoreForTests()
})

async function until(check: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (check()) return
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function join(binding: CloudFileBinding, onStop?: (reason: RelayStop) => void) {
  const room = await connectRelayRoom(binding.fileId, {
    ticket: () => fileRelayTicket(binding),
    cipher: relayCipher(binding.fileId, binding.epoch),
    backoffMs: [20],
    onStop
  })
  open.push(room)
  return room
}

describe('relay frames', () => {
  test('round-trip control and binary action frames, and refuse malformed ones', () => {
    const control = encodeControlFrame({ type: 'hello', senderId: 'a' })
    expect(decodeRelayFrame(control)).toEqual({ v: 1, type: 'hello', senderId: 'a' })
    const action = encodeActionFrame({
      senderId: 'a',
      targetId: 'b',
      namespace: 'yjs-update',
      data: new Uint8Array([1, 2, 3])
    })
    const decoded = decodeRelayFrame(action.buffer)
    expect(decoded?.type).toBe('action')
    expect(decodeRelayFrame('{"v":2,"type":"hello","senderId":"a"}')).toBeNull()
    expect(decodeRelayFrame(new Uint8Array([9, 0, 0, 0, 0]))).toBeNull()
  })
})

describe('a shared file’s room', () => {
  test('peers meet, broadcast and target, and the relay only ever sees ciphertext', async () => {
    const binding = await sharedFile()
    const alice = await join(binding)
    const bob = await join(binding)
    const carol = await join(binding)
    const [aliceSend] = alice.makeAction('yjs-update')
    const [, bobReceive] = bob.makeAction('yjs-update')
    const [, carolReceive] = carol.makeAction('yjs-update')
    const got = { bob: [] as number[][], carol: [] as number[][] }
    bobReceive((data) => got.bob.push([...data]))
    carolReceive((data) => got.carol.push([...data]))
    const joined: string[] = []
    alice.onPeerJoin((id) => joined.push(id))
    await until(() => joined.length === 2, 'everyone to meet')

    const before = relay.payloads.length
    const secret = new TextEncoder().encode('the price is $24')
    aliceSend(new Uint8Array(secret))
    await until(() => got.bob.length === 1 && got.carol.length === 1, 'a broadcast')
    expect(new TextDecoder().decode(new Uint8Array(got.bob[0]))).toBe('the price is $24')

    const crossed = relay.payloads.slice(before)
    expect(crossed.length).toBeGreaterThan(0)
    for (const frame of crossed) {
      expect(Buffer.from(frame).includes(Buffer.from('the price is'))).toBe(false)
    }

    aliceSend(new Uint8Array([7]), joined[0])
    await until(() => got.bob.length + got.carol.length === 3, 'a targeted frame')
  })

  test('a frame that does not open with the file key is dropped, not applied', async () => {
    const binding = await sharedFile()
    const alice = await join(binding)
    const bob = await join(binding)
    const [, bobReceive] = bob.makeAction('yjs-update')
    const got: number[][] = []
    bobReceive((data) => got.push([...data]))
    // Alice sends without the file key, as the relay itself or a stranger could.
    const plain = await connectRelayRoom(binding.fileId, { ticket: () => fileRelayTicket(binding) })
    open.push(plain)
    const [plainSend] = plain.makeAction('yjs-update')
    const met: string[] = []
    bob.onPeerJoin((id) => met.push(id))
    await until(() => met.length === 2, 'peers to meet')
    plainSend(new Uint8Array([1, 2, 3]))
    const [aliceSend] = alice.makeAction('yjs-update')
    aliceSend(new Uint8Array([9]))
    await until(() => got.length === 1, 'the genuine frame')
    expect(got).toEqual([[9]])
  })

  test('reconnects with a new ticket after the relay drops, and peers meet again', async () => {
    const binding = await sharedFile()
    const alice = await join(binding)
    const bob = await join(binding)
    const joins: string[] = []
    const leaves: string[] = []
    alice.onPeerJoin((id) => joins.push(id))
    alice.onPeerLeave((id) => leaves.push(id))
    const [, aliceReceive] = alice.makeAction('doc')
    const [bobSend] = bob.makeAction('doc')
    const got: number[] = []
    aliceReceive((data) => got.push(...data))
    await until(() => joins.length === 1, 'first meeting')

    relay.dropAll()
    await until(() => leaves.length === 1, 'bob to drop')
    await until(() => joins.length >= 2 && relay.connections(binding.fileId) === 2, 'meeting again')
    bobSend(new Uint8Array([5]))
    await until(() => got.length === 1, 'an action after reconnecting')
    expect(got).toEqual([5])
  })

  test('a revoked connection stops for good and says so', async () => {
    const binding = await sharedFile()
    const stops: RelayStop[] = []
    await join(binding, (reason) => stops.push(reason))
    await until(() => relay.connections(binding.fileId) === 1, 'the connection')
    relay.revoke(binding.fileId)
    await until(() => stops.length === 1, 'the stop')
    expect(stops).toEqual(['revoked'])
    await Bun.sleep(100)
    expect(relay.connections(binding.fileId)).toBe(0)
  })

  test('a relay that refuses the connection is reported, with no other way in', async () => {
    const binding = await sharedFile()
    mock.state.design.members.set(binding.fileId, [])
    const failures: unknown[] = []
    const room = joinCloudFileRoom(binding, { onUnavailable: (error) => failures.push(error) })
    open.push(room)
    await until(() => failures.length === 1, 'the refusal')
  })

  test('frames made before the relay answers are kept and sent once it does', async () => {
    const binding = await sharedFile()
    const bob = await join(binding)
    const [, bobReceive] = bob.makeAction('doc')
    const got: number[][] = []
    bobReceive((data) => got.push([...data]))
    const room = deferredCollabRoom(() =>
      connectRelayRoom(binding.fileId, {
        ticket: () => fileRelayTicket(binding),
        cipher: relayCipher(binding.fileId, binding.epoch)
      })
    )
    open.push(room)
    const [send] = room.makeAction('doc')
    send(new Uint8Array([4, 2]))
    await until(() => got.length === 1, 'the queued frame')
    expect(got).toEqual([[4, 2]])
  })
})
