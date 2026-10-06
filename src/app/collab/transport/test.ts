import { appRuntimeConfig } from '@/app/runtime/config'
import { IS_BROWSER } from '@/constants'

import { createActionRegistry, createPeerRoster } from './roster'
import type { CollabRoomTransport } from './types'

const MAX_TEST_MESSAGE_BYTES = 8 * 1024 * 1024

type TestTransportMessage =
  | { type: 'hello'; senderId: string; targetId?: string }
  | { type: 'welcome'; senderId: string; targetId?: string }
  | { type: 'leave'; senderId: string; targetId?: string }
  | {
      type: 'action'
      senderId: string
      targetId?: string
      namespace: string
      data: number[]
    }

function parseMessage(value: unknown): TestTransportMessage | null {
  if (typeof value !== 'string' || value.length > MAX_TEST_MESSAGE_BYTES) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || !('type' in parsed) || !('senderId' in parsed)) {
    return null
  }
  const message = parsed as Partial<TestTransportMessage>
  if (typeof message.senderId !== 'string') return null
  if (message.targetId !== undefined && typeof message.targetId !== 'string') return null
  if (message.type === 'hello' || message.type === 'welcome' || message.type === 'leave') {
    return message as TestTransportMessage
  }
  if (
    message.type !== 'action' ||
    typeof message.namespace !== 'string' ||
    !Array.isArray(message.data) ||
    !message.data.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    return null
  }
  return message as TestTransportMessage
}

function relayURL(roomId: string): URL {
  if (!IS_BROWSER) {
    throw new Error('Test collaboration transport requires a browser')
  }
  const configured = appRuntimeConfig.collaborationRelayURL
  if (!configured) throw new Error('Test collaboration transport requires collabRelay')
  const url = new URL(configured)
  url.searchParams.set('roomId', roomId)
  return url
}

export function joinTestCollabRoom(roomId: string): CollabRoomTransport {
  if (
    !IS_BROWSER ||
    typeof WebSocket === 'undefined' ||
    typeof crypto === 'undefined' ||
    typeof crypto.randomUUID !== 'function'
  ) {
    throw new Error('Test collaboration transport requires browser WebSocket and crypto APIs')
  }
  const peerId = crypto.randomUUID()
  const socket = new WebSocket(relayURL(roomId))
  const roster = createPeerRoster(peerId)
  const pending: TestTransportMessage[] = []
  let left = false

  function post(message: TestTransportMessage) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
    else pending.push(message)
  }

  const actions = createActionRegistry((namespace, data, targetId) => {
    post({ type: 'action', senderId: peerId, targetId, namespace, data: Array.from(data) })
  })

  socket.addEventListener('open', () => {
    for (const message of pending.splice(0)) socket.send(JSON.stringify(message))
    post({ type: 'hello', senderId: peerId })
  })
  socket.addEventListener('error', () => {
    console.error('Test collaboration relay connection failed', socket.url)
  })
  socket.addEventListener('message', (event: MessageEvent<string>) => {
    const message = parseMessage(event.data)
    if (!message || message.senderId === peerId) return
    if (message.targetId && message.targetId !== peerId) return
    if (message.type === 'hello') {
      roster.add(message.senderId)
      post({ type: 'welcome', senderId: peerId, targetId: message.senderId })
      return
    }
    if (message.type === 'welcome') {
      roster.add(message.senderId)
      return
    }
    if (message.type === 'leave') {
      roster.remove(message.senderId)
    } else {
      roster.add(message.senderId)
      actions.receivers.get(message.namespace)?.(new Uint8Array(message.data), message.senderId)
    }
  })

  return {
    makeAction: actions.makeAction,
    onPeerJoin: roster.onPeerJoin,
    onPeerLeave: roster.onPeerLeave,
    async leave() {
      if (left) return
      left = true
      roster.clear()
      actions.receivers.clear()
      const leaveMessage = JSON.stringify({ type: 'leave', senderId: peerId })
      if (socket.readyState === WebSocket.CONNECTING) {
        await new Promise<void>((resolve) => {
          socket.addEventListener('open', () => resolve(), { once: true })
          socket.addEventListener('error', () => resolve(), { once: true })
          socket.addEventListener('close', () => resolve(), { once: true })
        })
      }
      if (socket.readyState === WebSocket.OPEN) socket.send(leaveMessage)
      socket.close()
    }
  }
}
