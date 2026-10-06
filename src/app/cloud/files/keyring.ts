import {
  cacheFileKey,
  cachedFileKey,
  deviceKeyPair,
  importContentKey,
  unwrapContentKey
} from '@/app/cloud/crypto'
import { consoleClient } from '@/app/integrations/console'

/**
 * The content keys of shared files, as this installation can get them:
 *
 * - from the cache, once unwrapped;
 * - from a view link, whose fragment carries the key itself;
 * - from Console, wrapped for this device by someone who already had it.
 *
 * Raw key bytes are only ever held in memory, for the one thing that needs them: wrapping the key
 * for another member's device. The cached key can seal and open but not be read back.
 */
export class CloudKeyPendingError extends Error {
  constructor() {
    super('This computer has not been given the file’s key yet')
    this.name = 'CloudKeyPendingError'
  }
}

type LinkKey = { epoch: number; raw: Uint8Array<ArrayBuffer> }

const linkKeys = new Map<string, LinkKey>()
const sessionRaw = new Map<string, Uint8Array<ArrayBuffer>>()

function rawId(fileId: string, epoch: number): string {
  return `${fileId}:${epoch}`
}

/** A key that arrived in a view link; kept for this session only. */
export function rememberLinkKey(fileId: string, epoch: number, raw: Uint8Array<ArrayBuffer>): void {
  linkKeys.set(fileId, { epoch, raw })
}

/** A key this installation just made, for a file it is sharing. */
export async function adoptNewKey(
  fileId: string,
  epoch: number,
  raw: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  sessionRaw.set(rawId(fileId, epoch), raw)
  const key = await importContentKey(raw)
  await cacheFileKey(fileId, epoch, key)
  return key
}

/** The raw key, unwrapped from this device's grant: for wrapping it again for someone else. */
export async function rawContentKey(
  fileId: string,
  epoch: number
): Promise<Uint8Array<ArrayBuffer>> {
  const known = sessionRaw.get(rawId(fileId, epoch))
  if (known) return known
  const link = linkKeys.get(fileId)
  if (link?.epoch === epoch) return link.raw
  const { data } = await consoleClient().call('getFileKeys', { params: { fileId } })
  const grant = data.grants.find((entry) => entry.epoch === epoch)
  if (!grant) throw new CloudKeyPendingError()
  const device = await deviceKeyPair()
  const raw = await unwrapContentKey(grant.wrappedKey, device.privateKey, { fileId, epoch })
  sessionRaw.set(rawId(fileId, epoch), raw)
  return raw
}

/** The content key for sealing and opening this file's content at an epoch. */
export async function contentKey(fileId: string, epoch: number): Promise<CryptoKey> {
  const link = linkKeys.get(fileId)
  if (link?.epoch === epoch) return importContentKey(link.raw)
  const cached = await cachedFileKey(fileId, epoch)
  if (cached) return cached
  const key = await importContentKey(await rawContentKey(fileId, epoch))
  await cacheFileKey(fileId, epoch, key)
  return key
}

/** Drops what this session holds in memory. The IndexedDB cache is cleared on sign-out. */
export function forgetSessionKeys(): void {
  linkKeys.clear()
  sessionRaw.clear()
}
