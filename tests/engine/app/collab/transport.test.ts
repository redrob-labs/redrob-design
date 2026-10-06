import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { deferredCollabRoom } from '@/app/collab/transport/deferred'
import {
  decodeRelayFrame,
  encodeActionFrame,
  encodeControlFrame
} from '@/app/collab/transport/relay/frames'
import { connectRelayRoom } from '@/app/collab/transport/relay/room'
import { consoleRelayTicket } from '@/app/collab/transport/relay/ticket'
import type { CollabRoomTransport } from '@/app/collab/transport/types'
import { createConsoleClient, setConsoleClientForTests } from '@/app/integrations/console'

import { createMockRelay, type MockRelay } from '#tests/helpers/console/relay'
import { MOCK_TOKEN, createMockConsole, mockConsoleFetch } from '#tests/helpers/console/server'

const mock = createMockConsole()
let relay: MockRelay
const open: CollabRoomTransport[] = []

beforeAll(() => {
  relay = createMockRelay(mock.state.relayTickets)
  mock.state.relayURL = relay.url
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
})

async function until(check: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (check()) return
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

function track(room: CollabRoomTransport): CollabRoomTransport {
  open.push(room)
  return room
}

type JoinRoom = (roomId: string, peerId: string) => Promise<CollabRoomTransport>

const relayRoom: JoinRoom = async (roomId, peerId) =>
  track(await connectRelayRoom(roomId, { ticket: consoleRelayTicket, peerId, backoffMs: [20] }))

const deferredRelayRoom: JoinRoom = (roomId, peerId) =>
  Promise.resolve(
    track(
      deferredCollabRoom(() =>
        connectRelayRoom(roomId, { ticket: consoleRelayTicket, peerId, backoffMs: [20] })
      )
    )
  )

/** Every transport the app can pick must behave the same to the collaboration session. */
function transportContract(name: string, join: JoinRoom) {
  describe(`${name} transport contract`, () => {
    test('peers meet, broadcast, send to one peer, and leave', async () => {
      const roomId = `room-${name}-${crypto.randomUUID()}`
      const alice = await join(roomId, 'alice')
      const bob = await join(roomId, 'bob')
      const carol = await join(roomId, 'carol')
      const seen = { alice: new Set<string>(), bob: new Set<string>() }
      const leaves: string[] = []
      alice.onPeerJoin((id) => seen.alice.add(id))
      alice.onPeerLeave((id) => leaves.push(id))
      bob.onPeerJoin((id) => seen.bob.add(id))
      const [aliceSend] = alice.makeAction('doc')
      const [, bobReceive] = bob.makeAction('doc')
      const [, carolReceive] = carol.makeAction('doc')
      const got = { bob: [] as string[], carol: [] as string[] }
      bobReceive((data, from) => got.bob.push(`${from}:${[...data].join(',')}`))
      carolReceive((data, from) => got.carol.push(`${from}:${[...data].join(',')}`))

      await until(() => seen.alice.size === 2 && seen.bob.size === 2, 'peers to meet')
      aliceSend(new Uint8Array([1, 2, 3]))
      aliceSend(new Uint8Array([9]), 'carol')
      await until(() => got.bob.length === 1 && got.carol.length === 2, 'actions')
      expect(got.bob).toEqual(['alice:1,2,3'])
      expect(got.carol).toEqual(['alice:1,2,3', 'alice:9'])

      await carol.leave()
      await until(() => leaves.includes('carol'), 'carol to leave')
    })
  })
}

transportContract('relay', relayRoom)
transportContract('deferred relay', deferredRelayRoom)

describe('relay frames', () => {
  test('round-trip control and binary action frames, and refuse malformed ones', () => {
    const control = decodeRelayFrame(encodeControlFrame({ type: 'hello', senderId: 'a' }))
    expect(control).toEqual({ v: 1, type: 'hello', senderId: 'a' })
    const action = decodeRelayFrame(
      encodeActionFrame({
        senderId: 'a',
        targetId: 'b',
        namespace: 'doc',
        data: new Uint8Array([7])
      })
    )
    expect(action).toEqual({
      type: 'action',
      senderId: 'a',
      targetId: 'b',
      namespace: 'doc',
      data: new Uint8Array([7])
    })
    expect(decodeRelayFrame('{"v":2,"type":"hello","senderId":"a"}')).toBeNull()
    expect(decodeRelayFrame(new Uint8Array([1, 0, 0, 9, 0]))).toBeNull()
    expect(decodeRelayFrame(42)).toBeNull()
  })
})

describe('the relay room', () => {
  test('reconnects with a new ticket after the relay drops, and peers meet again', async () => {
    const roomId = `room-reconnect-${crypto.randomUUID()}`
    const alice = await relayRoom(roomId, 'alice')
    const bob = await relayRoom(roomId, 'bob')
    const joins: string[] = []
    const leaves: string[] = []
    alice.onPeerJoin((id) => joins.push(id))
    alice.onPeerLeave((id) => leaves.push(id))
    const [, aliceReceive] = alice.makeAction('doc')
    const [bobSend] = bob.makeAction('doc')
    const got: number[] = []
    aliceReceive((data) => got.push(...data))
    await until(() => joins.length === 1, 'first meeting')

    const refusedBefore = relay.refused.length
    relay.dropAll()
    await until(() => leaves.includes('bob'), 'bob to drop')
    await until(() => joins.length === 2 && relay.connections(roomId) === 2, 'meeting again')
    expect(relay.refused.length).toBe(refusedBefore)

    bobSend(new Uint8Array([5]))
    await until(() => got.length === 1, 'an action after reconnecting')
    expect(got).toEqual([5])
  })

  test('refuses to start without a valid ticket, so the app can fall back', async () => {
    const attempt = connectRelayRoom('room-refused', {
      ticket: () =>
        Promise.resolve({ url: `${relay.url}/room-refused`, ticket: 'forged-ticket-0000' })
    })
    await expect(attempt).rejects.toThrow('refused')
  })

  test('a room falls back to the other transport and keeps what was sent meanwhile', async () => {
    const sent: Array<{ namespace: string; data: number[] }> = []
    const fallback: CollabRoomTransport = {
      makeAction: (namespace) => [
        (data) => sent.push({ namespace, data: [...data] }),
        () => undefined
      ],
      onPeerJoin: (handler) => queueMicrotask(() => handler('peer-p2p')),
      onPeerLeave: () => undefined,
      leave: () => Promise.resolve()
    }
    const room = deferredCollabRoom(() =>
      connectRelayRoom('room-fallback', {
        ticket: () => Promise.reject(new Error('not signed in'))
      }).catch(() => fallback)
    )
    open.push(room)
    const [send] = room.makeAction('doc')
    send(new Uint8Array([4, 2]))
    const joined: string[] = []
    room.onPeerJoin((id) => joined.push(id))
    await until(() => sent.length === 1 && joined.length === 1, 'the fallback')
    expect(sent).toEqual([{ namespace: 'doc', data: [4, 2] }])
    expect(joined).toEqual(['peer-p2p'])
  })
})
