import { wrapContentKey } from '@/app/cloud/crypto'
import { consoleClient } from '@/app/integrations/console'

import { rawContentKey } from './keyring'

/**
 * Hands the file's key to members' devices that do not have it yet. Run by an editor or owner whose
 * app holds the key: Console cannot do it, because it never has the key. Someone invited while
 * nobody with access is online gets theirs the next time one of those people opens the file.
 *
 * Returns how many devices were given the key.
 */
export async function grantPendingDevices(fileId: string, epoch: number): Promise<number> {
  const client = consoleClient()
  const { data: pending } = await client.call('listPendingDevices', { params: { fileId } })
  if (pending.length === 0) return 0
  const raw = await rawContentKey(fileId, epoch)
  const grants = await Promise.all(
    pending.slice(0, 100).map(async (device) => ({
      deviceId: device.deviceId,
      epoch,
      wrappedKey: await wrapContentKey(raw, device.publicKey, { fileId, epoch })
    }))
  )
  const { data } = await client.call('createKeyGrants', { params: { fileId }, body: { grants } })
  return data.granted
}
