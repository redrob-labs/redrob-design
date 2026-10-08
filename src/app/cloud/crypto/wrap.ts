import { decodeBase64, encodeBase64 } from '@redrob-design/core/bytes'

import { CONTENT_KEY_BYTES, CloudCryptoError } from './envelope'

/**
 * Wrapping a file's content key for one device: ECIES over P-256, all WebCrypto.
 *
 * An ephemeral key pair is made for each wrap. Its private half meets the device's public key in
 * ECDH, HKDF-SHA256 turns the shared secret into an AES-GCM key, and that seals the content key.
 * The output carries the ephemeral public key so the device can repeat the agreement with its own
 * private key, which never leaves it:
 *
 *   [u8 version = 1][65-byte uncompressed ephemeral public key][12-byte IV][48 bytes: key + tag]
 *
 * The file id and epoch are bound into both HKDF and the AES associated data, so a wrapped key
 * Console moved to another file or epoch does not unwrap.
 */
const WRAP_VERSION = 1
const POINT_BYTES = 65
const IV_BYTES = 12
const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const
const encoder = new TextEncoder()

function info(fileId: string, epoch: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    encoder.encode(`redrob-design/key-wrap/v1|${fileId.length}:${fileId}|${epoch}`)
  )
}

export function importDevicePublicKey(encoded: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', copy(decodeBase64(encoded)), ECDH, true, [])
}

export async function exportDevicePublicKey(key: CryptoKey): Promise<string> {
  return encodeBase64(new Uint8Array(await crypto.subtle.exportKey('spki', key)), 'base64url')
}

function copy(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.byteLength)
  out.set(bytes)
  return out
}

async function wrappingKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
  fileId: string,
  epoch: number,
  usage: 'encrypt' | 'decrypt'
): Promise<CryptoKey> {
  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  )
  const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: info(fileId, epoch) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage]
  )
}

/** Wraps a raw content key for the device whose public key this is. Base64url, for Console. */
export async function wrapContentKey(
  contentKey: Uint8Array<ArrayBuffer>,
  devicePublicKey: string,
  context: { fileId: string; epoch: number }
): Promise<string> {
  const recipient = await importDevicePublicKey(devicePublicKey)
  const ephemeral = await crypto.subtle.generateKey(ECDH, true, ['deriveBits'])
  const point = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey))
  const key = await wrappingKey(
    ephemeral.privateKey,
    recipient,
    point,
    context.fileId,
    context.epoch,
    'encrypt'
  )
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: info(context.fileId, context.epoch) },
      key,
      contentKey
    )
  )
  const out = new Uint8Array(1 + POINT_BYTES + IV_BYTES + sealed.byteLength)
  out[0] = WRAP_VERSION
  out.set(point, 1)
  out.set(iv, 1 + POINT_BYTES)
  out.set(sealed, 1 + POINT_BYTES + IV_BYTES)
  return encodeBase64(out, 'base64url')
}

/** Unwraps a content key with this device's private key. Throws on anything else. */
export async function unwrapContentKey(
  wrapped: string,
  devicePrivateKey: CryptoKey,
  context: { fileId: string; epoch: number }
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const bytes = decodeBase64(wrapped)
    if (
      bytes[0] !== WRAP_VERSION ||
      bytes.byteLength !== 1 + POINT_BYTES + IV_BYTES + CONTENT_KEY_BYTES + 16
    ) {
      throw new Error('shape')
    }
    const point = copy(bytes.subarray(1, 1 + POINT_BYTES))
    const ephemeral = await crypto.subtle.importKey('raw', point, ECDH, false, [])
    const key = await wrappingKey(
      devicePrivateKey,
      ephemeral,
      point,
      context.fileId,
      context.epoch,
      'decrypt'
    )
    return new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: copy(bytes.subarray(1 + POINT_BYTES, 1 + POINT_BYTES + IV_BYTES)),
          additionalData: info(context.fileId, context.epoch)
        },
        key,
        copy(bytes.subarray(1 + POINT_BYTES + IV_BYTES))
      )
    )
  } catch {
    throw new CloudCryptoError('This key was not wrapped for this computer')
  }
}
