import type { Color } from '@redrob-design/scene-graph/primitives'

export interface RemotePeer {
  clientId: number
  name: string
  color: Color
  cursor?: { x: number; y: number; pageId: string }
  selection?: string[]
}

/**
 * idle: no shared file open. connecting: waiting for the relay. live: with collaborators.
 * unavailable: the relay cannot be reached; the file still works here and saves when it can.
 * revoked: access to the file ended during the session.
 */
export type CollabStatus = 'idle' | 'connecting' | 'live' | 'unavailable' | 'revoked'

export interface CollabState {
  connected: boolean
  status: CollabStatus
  /** The shared file the session is for. */
  roomId: string | null
  peers: RemotePeer[]
  localName: string
  localColor: Color
}

export const DEFAULT_COLLAB_STATE: CollabState = {
  connected: false,
  status: 'idle',
  roomId: null,
  peers: [],
  localName: '',
  localColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 }
}
