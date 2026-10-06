import { envelopeEpoch, open, seal } from '@/app/cloud/crypto'
import { contentKey, type CloudFileBinding } from '@/app/cloud/files'
import { consoleClient } from '@/app/integrations/console'

import { deferredCollabRoom } from './deferred'
import {
  connectRelayRoom,
  type RelayFrameCipher,
  type RelayStop,
  type RelayTicket
} from './relay/room'
import type { CollabRoomTransport } from './types'

/**
 * Live collaboration on a shared file: the Redrob Cloud relay, and nothing else. Every frame's
 * payload is sealed with the file's content key, bound to its namespace and sender, so the relay
 * routes ciphertext it cannot read or move. There is no peer-to-peer fallback: a relay that will
 * not admit someone is an answer, not an outage to route around.
 */
export function relayCipher(fileId: string, epoch: number): RelayFrameCipher {
  return {
    async seal(namespace, senderId, data) {
      const key = await contentKey(fileId, epoch)
      return seal(key, { fileId, epoch, purpose: { kind: 'frame', namespace, senderId } }, data)
    },
    async open(namespace, senderId, data) {
      const key = await contentKey(fileId, envelopeEpoch(data))
      return open(key, { fileId, purpose: { kind: 'frame', namespace, senderId } }, data)
    }
  }
}

export async function fileRelayTicket(binding: CloudFileBinding): Promise<RelayTicket> {
  const { data } = await consoleClient().call('createFileRelayTicket', {
    params: { fileId: binding.fileId },
    link: binding.link ?? undefined
  })
  return { url: data.url, ticket: data.ticket, peerId: data.peerId }
}

export interface CloudRoomHooks {
  onLive?: () => void
  onUnavailable?: (error: unknown) => void
  onStop?: (reason: RelayStop) => void
}

/** Joins the file's room. Usable at once; frames made before the relay answers are kept. */
export function joinCloudFileRoom(
  binding: CloudFileBinding,
  hooks: CloudRoomHooks = {},
  connect: typeof connectRelayRoom = connectRelayRoom
): CollabRoomTransport {
  return deferredCollabRoom(() =>
    connect(binding.fileId, {
      ticket: () => fileRelayTicket(binding),
      cipher: relayCipher(binding.fileId, binding.epoch),
      onStop: hooks.onStop
    }).then(
      (room) => {
        hooks.onLive?.()
        return room
      },
      (error: unknown) => {
        hooks.onUnavailable?.(error)
        throw error
      }
    )
  )
}

export type { RelayStop } from './relay/room'
export type { CollabRoomTransport, JoinCollabRoom } from './types'
