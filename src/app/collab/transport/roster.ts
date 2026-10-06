import type { CollabAction, CollabActionReceiver } from './types'

/**
 * The peers a relayed transport has met, with the join and leave handlers
 * the collaboration session registers. Handlers registered late still hear
 * about peers already present.
 */
export function createPeerRoster(self: string | (() => string)) {
  const selfId = typeof self === 'string' ? () => self : self
  const peers = new Set<string>()
  let joinHandler: ((peerId: string) => void) | null = null
  let leaveHandler: ((peerId: string) => void) | null = null
  const remove = (peerId: string): void => {
    if (peers.delete(peerId)) leaveHandler?.(peerId)
  }
  return {
    add: (peerId: string): void => {
      if (peerId === selfId() || peers.has(peerId)) return
      peers.add(peerId)
      joinHandler?.(peerId)
    },
    remove,
    /** Everyone leaves at once, as when the connection drops. */
    removeAll: (): void => {
      for (const peerId of peers) remove(peerId)
    },
    clear: (): void => {
      peers.clear()
    },
    onPeerJoin: (handler: (peerId: string) => void): void => {
      joinHandler = handler
      for (const peerId of peers) queueMicrotask(() => handler(peerId))
    },
    onPeerLeave: (handler: (peerId: string) => void): void => {
      leaveHandler = handler
    }
  }
}

/** Named actions over one connection; each name takes one receiver. */
export function createActionRegistry(
  post: (namespace: string, data: Uint8Array, targetId?: string) => void
) {
  const receivers = new Map<string, CollabActionReceiver>()
  return {
    receivers,
    makeAction: (namespace: string): CollabAction => [
      (data, targetId) => post(namespace, data, targetId),
      (handler) => {
        if (receivers.has(namespace)) {
          throw new Error(`Collaboration action ${namespace} is already registered`)
        }
        receivers.set(namespace, handler)
      }
    ]
  }
}
