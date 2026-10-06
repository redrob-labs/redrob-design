import { createActionRegistry, createPeerRoster } from '../roster'
import type { CollabRoomTransport } from '../types'
import { decodeRelayFrame, encodeActionFrame, encodeControlFrame, type RelayFrame } from './frames'

/** Where to connect, the one-use ticket that admits this connection, and the peer id it pins. */
export interface RelayTicket {
  url: string
  ticket: string
  /** Assigned by Console; the relay closes a connection that sends as anyone else. */
  peerId?: string
}

/**
 * Seals what goes onto the relay and opens what comes off it. The relay only ever sees the
 * frame header; the payload is the file's content, end-to-end encrypted.
 */
export interface RelayFrameCipher {
  seal(
    namespace: string,
    senderId: string,
    data: Uint8Array<ArrayBuffer>
  ): Promise<Uint8Array<ArrayBuffer>>
  open(namespace: string, senderId: string, data: Uint8Array): Promise<Uint8Array<ArrayBuffer>>
}

/** Why the relay stopped for good: access ended, or it could not be reached at all. */
export type RelayStop = 'revoked' | 'unavailable'

export interface RelayRoomOptions {
  /** A fresh ticket for every connection, including each reconnect. */
  ticket: (roomId: string) => Promise<RelayTicket>
  cipher?: RelayFrameCipher
  createSocket?: (url: string) => WebSocket
  /** Waits before each reconnect attempt; the last one repeats. */
  backoffMs?: readonly number[]
  peerId?: string
  /** The relay will not have this connection back: told once, and nothing reconnects. */
  onStop?: (reason: RelayStop) => void
}

/** The relay's close code for a connection whose access was revoked. */
export const RELAY_REVOKED_CLOSE = 4001

type Outgoing =
  | { kind: 'control'; type: 'hello' | 'welcome' | 'leave'; targetId?: string }
  | { kind: 'action'; namespace: string; data: Uint8Array<ArrayBuffer>; targetId?: string }

const DEFAULT_BACKOFF_MS = [500, 1000, 2000, 5000, 10_000, 30_000] as const
/** Frames kept while reconnecting; older ones are dropped, and Yjs resyncs on rejoin. */
const MAX_PENDING_FRAMES = 500

function ticketURL({ url, ticket }: RelayTicket): string {
  const address = new URL(url)
  address.searchParams.set('ticket', ticket)
  return address.toString()
}

function copy(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.byteLength)
  out.set(bytes)
  return out
}

/**
 * Joins a file's room on the Redrob Cloud relay. Resolves once the first connection is open and
 * rejects when it cannot be made. After that, a dropped connection reconnects with a new ticket
 * and backoff; peers leave on the drop and join again on the hello. A revoked connection stops.
 *
 * Sealing and opening are asynchronous, so both directions run through a chain: frames leave and
 * are delivered in the order they were made and received.
 */
export function connectRelayRoom(
  roomId: string,
  options: RelayRoomOptions
): Promise<CollabRoomTransport> {
  let peerId = options.peerId ?? crypto.randomUUID()
  const createSocket = options.createSocket ?? ((url: string) => new WebSocket(url))
  const backoff = options.backoffMs ?? DEFAULT_BACKOFF_MS
  const roster = createPeerRoster(() => peerId)
  const pending: Outgoing[] = []
  let socket: WebSocket | null = null
  let attempt = 0
  let left = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let outgoing: Promise<void> = Promise.resolve()
  let incoming: Promise<void> = Promise.resolve()

  async function wire(frame: Outgoing): Promise<string | Uint8Array<ArrayBuffer>> {
    if (frame.kind === 'control') {
      return encodeControlFrame({ type: frame.type, senderId: peerId, targetId: frame.targetId })
    }
    const data = options.cipher
      ? await options.cipher.seal(frame.namespace, peerId, frame.data)
      : frame.data
    return encodeActionFrame({
      senderId: peerId,
      targetId: frame.targetId,
      namespace: frame.namespace,
      data
    })
  }

  function transmit(frame: Outgoing, target: WebSocket): void {
    outgoing = outgoing
      .then(async () => {
        const bytes = await wire(frame)
        if (target.readyState === WebSocket.OPEN) target.send(bytes)
        return undefined
      })
      .catch((error: unknown) => console.warn('[Collab] A frame could not be sent', error))
  }

  function send(frame: Outgoing): void {
    if (socket?.readyState === WebSocket.OPEN) transmit(frame, socket)
    else {
      pending.push(frame)
      if (pending.length > MAX_PENDING_FRAMES) pending.shift()
    }
  }

  const actions = createActionRegistry((namespace, data, targetId) =>
    send({ kind: 'action', namespace, data: copy(data), targetId })
  )

  function receive(frame: RelayFrame): void {
    if (frame.senderId === peerId) return
    if (frame.targetId && frame.targetId !== peerId) return
    if (frame.type === 'action') {
      const { senderId, namespace, data } = frame
      incoming = incoming
        .then(async () => {
          const plain = options.cipher ? await options.cipher.open(namespace, senderId, data) : data
          roster.add(senderId)
          actions.receivers.get(namespace)?.(plain, senderId)
          return undefined
        })
        .catch((error: unknown) =>
          console.warn('[Collab] Dropped a frame that did not open', error)
        )
    } else if (frame.type === 'hello') {
      roster.add(frame.senderId)
      send({ kind: 'control', type: 'welcome', targetId: frame.senderId })
    } else if (frame.type === 'welcome') {
      roster.add(frame.senderId)
    } else {
      roster.remove(frame.senderId)
    }
  }

  function stop(reason: RelayStop): void {
    if (left) return
    left = true
    roster.removeAll()
    options.onStop?.(reason)
  }

  async function open(): Promise<void> {
    const ticket = await options.ticket(roomId)
    if (left) return
    if (ticket.peerId) peerId = ticket.peerId
    const next = createSocket(ticketURL(ticket))
    next.binaryType = 'arraybuffer'
    socket = next
    await new Promise<void>((resolve, reject) => {
      let opened = false
      next.addEventListener('open', () => {
        opened = true
        attempt = 0
        transmit({ kind: 'control', type: 'hello' }, next)
        for (const frame of pending.splice(0)) transmit(frame, next)
        resolve()
      })
      next.addEventListener('message', (event: MessageEvent<unknown>) => {
        const frame = decodeRelayFrame(event.data)
        if (frame) receive(frame)
      })
      next.addEventListener('close', (event: CloseEvent) => {
        if (socket !== next) return
        socket = null
        if (!opened) {
          reject(new Error('The collaboration relay refused the connection'))
          return
        }
        roster.removeAll()
        if (event.code === RELAY_REVOKED_CLOSE) stop('revoked')
        else if (!left) scheduleReconnect()
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
    async leave() {
      if (left) return
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
      await outgoing
    }
  }

  return open().then(
    () => transport,
    (error: unknown) => {
      left = true
      throw error
    }
  )
}
