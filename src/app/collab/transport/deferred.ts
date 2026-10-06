import type { CollabAction, CollabActionReceiver, CollabRoomTransport } from './types'

interface DeferredAction {
  queue: Array<{ data: Uint8Array; peerId?: string }>
  receiver: CollabActionReceiver | null
  send: CollabAction[0] | null
}

/**
 * A room whose transport is picked asynchronously, such as the relay with a
 * peer-to-peer fallback. Actions, sends and handlers made before it is
 * ready are kept and handed over, in order, once it is.
 */
export function deferredCollabRoom(
  connect: () => Promise<CollabRoomTransport>
): CollabRoomTransport {
  const actions = new Map<string, DeferredAction>()
  const joinHandlers: Array<(peerId: string) => void> = []
  const leaveHandlers: Array<(peerId: string) => void> = []
  const peers = new Set<string>()
  let room: CollabRoomTransport | null = null
  let left = false

  function bind(namespace: string, action: DeferredAction, target: CollabRoomTransport): void {
    const [send, receive] = target.makeAction(namespace)
    action.send = send
    receive((data, peerId) => action.receiver?.(data, peerId))
    for (const { data, peerId } of action.queue.splice(0)) send(data, peerId)
  }

  const ready = connect().then((target) => {
    if (left) return target.leave().then(() => target)
    room = target
    for (const [namespace, action] of actions) bind(namespace, action, target)
    target.onPeerJoin((peerId) => {
      peers.add(peerId)
      for (const handler of joinHandlers) handler(peerId)
    })
    target.onPeerLeave((peerId) => {
      peers.delete(peerId)
      for (const handler of leaveHandlers) handler(peerId)
    })
    return target
  })
  ready.catch((error: unknown) => {
    console.error('[Collab] No collaboration transport could connect', error)
  })

  return {
    makeAction(namespace): CollabAction {
      if (actions.has(namespace)) {
        throw new Error(`Collaboration action ${namespace} is already registered`)
      }
      const action: DeferredAction = { queue: [], receiver: null, send: null }
      actions.set(namespace, action)
      if (room) bind(namespace, action, room)
      return [
        (data, peerId) => {
          if (action.send) action.send(data, peerId)
          else action.queue.push({ data, peerId })
        },
        (handler) => {
          action.receiver = handler
        }
      ]
    },
    onPeerJoin(handler) {
      joinHandlers.push(handler)
      for (const peerId of peers) queueMicrotask(() => handler(peerId))
    },
    onPeerLeave(handler) {
      leaveHandlers.push(handler)
    },
    async leave() {
      if (left) return
      left = true
      actions.clear()
      const current = room
      room = null
      if (current) await current.leave()
    }
  }
}
