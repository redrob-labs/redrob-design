import { consoleClient } from '@/app/integrations/console'

import type { RelayTicket } from './room'

/** A one-use ticket for the room's relay WebSocket, from Redrob Console. */
export async function consoleRelayTicket(roomId: string): Promise<RelayTicket> {
  const { data } = await consoleClient().call('createRelayTicket', { params: { roomId } })
  return { url: data.url, ticket: data.ticket }
}
