import { createActionRegistry, createPeerRoster } from '../roster'
import type { CollabRoomTransport } from '../types'
import { decodeRelayFrame, encodeActionFrame, encodeControlFrame, type RelayFrame } from './frames'

/** Where to connect and the one-use ticket that admits this connection. */
export interface RelayTicket {
  url: string
  ticket: string
}

export interface RelayRoomOptions {
  /** A fresh ticket for every connection, including each reconnect. */
  ticket: (roomId: string) => Promise<RelayTicket>
  createSocket?: (url: string) => WebSocket
  /** Waits before each reconnect attempt; the last one repeats. */
  backoffMs?: readonly number[]
  peerId?: string
}

/** What goes on the socket: control frames as text, actions as bytes. */
type RelayWireFrame = string | Uint8Array<ArrayBuffer>

const DEFAULT_BACKOFF_MS = [500, 1000, 2000, 5000, 10_000, 30_000] as const
/** Frames kept while reconnecting; older ones are dropped, and Yjs resyncs on rejoin. */
const MAX_PENDING_FRAMES = 500

function ticketURL({ url, ticket }: RelayTicket): string {
  const address = new URL(url)
  address.searchParams.set('ticket', ticket)
  return address.toString()
}

/**
 * Joins a room on the Redrob Cloud relay. Resolves once the first connection
 * is open and rejects when it cannot be made, so the caller can fall back to
 * peer-to-peer. After that, a dropped connection reconnects with a new ticket
 * and backoff; peers leave on the drop and join again on the hello.
 */
export function connectRelayRoom(
  roomId: string,
  options: RelayRoomOptions
): Promise<CollabRoomTransport> {
  const peerId = options.peerId ?? crypto.randomUUID()
  const createSocket = options.createSocket ?? ((url: string) => new WebSocket(url))
  const backoff = options.backoffMs ?? DEFAULT_BACKOFF_MS
  const roster = createPeerRoster(peerId)
  const pending: RelayWireFrame[] = []
  let socket: WebSocket | null = null
  let attempt = 0
  let left = false
  let timer: ReturnType<typeof setTimeout> | null = null

  function send(frame: RelayWireFrame): void {
    if (socket?.readyState === WebSocket.OPEN) socket.send(frame)
    else {
      pending.push(frame)
      if (pending.length > MAX_PENDING_FRAMES) pending.shift()
    }
  }

  const actions = createActionRegistry((namespace, data, targetId) =>
    send(encodeActionFrame({ senderId: peerId, targetId, namespace, data }))
  )

  function receive(frame: RelayFrame): void {
    if (frame.senderId === peerId) return
    if (frame.targetId && frame.targetId !== peerId) return
    if (frame.type === 'action') {
      roster.add(frame.senderId)
      actions.receivers.get(frame.namespace)?.(frame.data, frame.senderId)
    } else if (frame.type === 'hello') {
      roster.add(frame.senderId)
      send(encodeControlFrame({ type: 'welcome', senderId: peerId, targetId: frame.senderId }))
    } else if (frame.type === 'welcome') {
      roster.add(frame.senderId)
    } else {
      roster.remove(frame.senderId)
    }
  }

  async function open(): Promise<void> {
    const ticket = await options.ticket(roomId)
    if (left) return
    const next = createSocket(ticketURL(ticket))
    next.binaryType = 'arraybuffer'
    socket = next
    await new Promise<void>((resolve, reject) => {
      let opened = false
      next.addEventListener('open', () => {
        opened = true
        attempt = 0
        next.send(encodeControlFrame({ type: 'hello', senderId: peerId }))
        for (const frame of pending.splice(0)) next.send(frame)
        resolve()
      })
      next.addEventListener('message', (event: MessageEvent<unknown>) => {
        const frame = decodeRelayFrame(event.data)
        if (frame) receive(frame)
      })
      next.addEventListener('close', () => {
        if (socket !== next) return
        socket = null
        if (!opened) {
          reject(new Error('The collaboration relay refused the connection'))
          return
        }
        roster.removeAll()
        if (!left) scheduleReconnect()
      })
    })
  }

  function scheduleReconnect(): void {
    const wait = backoff[Math.min(attempt, backoff.length - 1)] ?? 0
    attempt++
    timer = setTimeout(() => {
      timer = null
      open().catch((error: unknown) => {
        console.warn('[Collab] Relay reconnect failed; trying again', error)
        if (!left) scheduleReconnect()
      })
    }, wait)
  }

  const transport: CollabRoomTransport = {
    makeAction: actions.makeAction,
    onPeerJoin: roster.onPeerJoin,
    onPeerLeave: roster.onPeerLeave,
    leave() {
      if (left) return Promise.resolve()
      left = true
      if (timer !== null) clearTimeout(timer)
      const current = socket
      socket = null
      if (current?.readyState === WebSocket.OPEN) {
        current.send(encodeControlFrame({ type: 'leave', senderId: peerId }))
      }
      current?.close(1000, 'left')
      roster.clear()
      actions.receivers.clear()
      pending.length = 0
      return Promise.resolve()
    }
  }

  return open().then(() => transport)
}
