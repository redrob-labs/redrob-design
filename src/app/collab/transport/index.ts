import { signedIn } from '@/app/integrations/console'
import { appRuntimeConfig } from '@/app/runtime/config'

import { deferredCollabRoom } from './deferred'
import { connectRelayRoom } from './relay/room'
import { consoleRelayTicket } from './relay/ticket'
import { joinTestCollabRoom } from './test'
import { joinTrysteroCollabRoom } from './trystero'
import type { JoinCollabRoom } from './types'

function usesTestTransport(): boolean {
  return import.meta.env.DEV && appRuntimeConfig.collaborationTransport === 'test'
}

/** Signed in, rooms go through the Redrob Cloud relay unless peer-to-peer is asked for. */
function usesRelay(): boolean {
  const mode = appRuntimeConfig.collaborationTransport
  return mode === 'relay' || (mode === 'default' && signedIn.value)
}

/** The relay, or peer-to-peer when the relay cannot be reached or admits no one. */
const joinRelayOrPeerRoom: JoinCollabRoom = (roomId) =>
  deferredCollabRoom(() =>
    connectRelayRoom(roomId, { ticket: consoleRelayTicket }).catch((error: unknown) => {
      console.warn('[Collab] Relay unavailable; connecting peer-to-peer', error)
      return joinTrysteroCollabRoom(roomId)
    })
  )

export const joinCollabRoom: JoinCollabRoom = (roomId) => {
  if (usesTestTransport()) return joinTestCollabRoom(roomId)
  return usesRelay() ? joinRelayOrPeerRoom(roomId) : joinTrysteroCollabRoom(roomId)
}

export type { CollabRoomTransport, JoinCollabRoom } from './types'
