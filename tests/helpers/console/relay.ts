import type { ServerWebSocket } from 'bun'

import {
  decodeRelayFrame,
  encodeControlFrame,
  type RelayFrame
} from '@/app/collab/transport/relay/frames'

interface RelayConnection {
  roomId: string
  peerId: string | null
}

/**
 * The collaboration relay as Redrob Console must run it, on a local Bun
 * WebSocket server: one-use tickets in `?ticket=` naming the file's room, frames forwarded unchanged
 * to the room or to `targetId`, `senderId` pinned to the connection's hello,
 * and `leave` sent for a connection that drops.
 */
export function createMockRelay(tickets: Map<string, string>) {
  const rooms = new Map<string, Set<ServerWebSocket<RelayConnection>>>()
  const refused: string[] = []
  /** Every binary payload forwarded, as it crossed the relay: what the relay could read. */
  const payloads: Uint8Array[] = []

  function others(socket: ServerWebSocket<RelayConnection>) {
    return [...(rooms.get(socket.data.roomId) ?? [])].filter((peer) => peer !== socket)
  }

  function forward(
    socket: ServerWebSocket<RelayConnection>,
    frame: RelayFrame,
    raw: string | Buffer
  ) {
    for (const peer of others(socket)) {
      if (frame.targetId && peer.data.peerId !== frame.targetId) continue
      peer.send(raw)
    }
  }

  const server = Bun.serve<RelayConnection, undefined>({
    port: 0,
    fetch(request, bunServer) {
      const url = new URL(request.url)
      const ticket = url.searchParams.get('ticket') ?? ''
      // The room is the file the ticket was issued for, as on the real relay.
      const roomId = tickets.get(ticket) ?? ''
      if (!tickets.delete(ticket)) {
        refused.push(ticket)
        return new Response('unauthorized', { status: 401 })
      }
      if (bunServer.upgrade(request, { data: { roomId, peerId: null } })) return undefined
      return new Response('upgrade required', { status: 426 })
    },
    websocket: {
      open(socket) {
        const room = rooms.get(socket.data.roomId) ?? new Set()
        room.add(socket)
        rooms.set(socket.data.roomId, room)
      },
      message(socket, raw) {
        const frame = decodeRelayFrame(typeof raw === 'string' ? raw : new Uint8Array(raw))
        if (!frame) return
        if (socket.data.peerId === null && frame.type === 'hello') {
          socket.data.peerId = frame.senderId
        }
        if (frame.senderId !== socket.data.peerId) {
          socket.close(1008, 'sender mismatch')
          return
        }
        if (typeof raw !== 'string') payloads.push(new Uint8Array(raw))
        forward(socket, frame, raw)
      },
      close(socket) {
        rooms.get(socket.data.roomId)?.delete(socket)
        const peerId = socket.data.peerId
        if (!peerId) return
        const leave = encodeControlFrame({ type: 'leave', senderId: peerId })
        for (const peer of rooms.get(socket.data.roomId) ?? []) peer.send(leave)
      }
    }
  })

  return {
    url: `ws://localhost:${server.port}/relay`,
    /** Tickets that did not admit a connection. */
    refused,
    connections: (roomId: string) => rooms.get(roomId)?.size ?? 0,
    payloads,
    /** Disconnects a room as Console's revocation would: close code 4001, never to return. */
    revoke(roomId: string) {
      for (const socket of rooms.get(roomId) ?? []) socket.close(4001, 'access revoked')
    },
    /** Drops every connection, as a relay restart would. */
    dropAll() {
      for (const room of rooms.values()) for (const socket of room) socket.close(1012, 'restart')
    },
    stop: () => server.stop(true)
  }
}

export type MockRelay = ReturnType<typeof createMockRelay>
