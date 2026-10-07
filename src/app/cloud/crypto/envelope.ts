/**
 * End-to-end encryption for Redrob Cloud files: one AES-256-GCM content key per file and key
 * epoch, and a small envelope around every ciphertext so the reader knows which epoch to use.
 *
 *   [u8 version = 1][u32 big-endian epoch][12-byte IV][ciphertext and 16-byte tag]
 *
 * Every seal binds associated data naming what the bytes are -- the file, the epoch, and the
 * purpose (a frame of a given namespace from a given sender, a snapshot, a comment...). Console
 * and the relay hold only these envelopes, and could otherwise move one somewhere it would still
 * decrypt: a comment pasted in as a file name, or one peer's frame replayed as another's.
 */

export const ENVELOPE_VERSION = 1
const IV_BYTES = 12
const HEADER_BYTES = 1 + 4 + IV_BYTES
const TAG_BYTES = 16
export const CONTENT_KEY_BYTES = 32

/** What a ciphertext is, for its associated data. Never secret; always checked. */
export type SealPurpose =
  | { kind: 'name' }
  | { kind: 'snapshot' }
  | { kind: 'version' }
  | { kind: 'version-name' }
  | { kind: 'comment' }
  | { kind: 'library' }
  | { kind: 'library-name' }
  | { kind: 'frame'; namespace: string; senderId: string }

export class CloudCryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CloudCryptoError'
  }
}

const encoder = new TextEncoder()

/** A fresh random content key, as raw bytes: what is wrapped for each device. */
export function generateContentKey(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(CONTENT_KEY_BYTES))
}

/** The raw key as a WebCrypto key that can seal and open but never be read back out. */
export function importContentKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  if (raw.byteLength !== CONTENT_KEY_BYTES) {
    return Promise.reject(new CloudCryptoError('A content key is 32 bytes'))
  }
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export function associatedData(
  fileId: string,
  epoch: number,
  purpose: SealPurpose
): Uint8Array<ArrayBuffer> {
  const parts = ['redrob-design/e2e/v1', fileId, String(epoch), purpose.kind]
  if (purpose.kind === 'frame') parts.push(purpose.namespace, purpose.senderId)
  // Lengths, not a separator, so no part can be crafted to absorb the next one.
  return new Uint8Array(encoder.encode(parts.map((part) => `${part.length}:${part}`).join('')))
}

/** The epoch an envelope was sealed under, without opening it. */
export function envelopeEpoch(envelope: Uint8Array): number {
  if (envelope.byteLength < HEADER_BYTES + TAG_BYTES || envelope[0] !== ENVELOPE_VERSION) {
    throw new CloudCryptoError('Not a Redrob Cloud envelope')
  }
  return new DataView(envelope.buffer, envelope.byteOffset, envelope.byteLength).getUint32(1)
}

export async function seal(
  key: CryptoKey,
  context: { fileId: string; epoch: number; purpose: SealPurpose },
  plaintext: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: associatedData(context.fileId, context.epoch, context.purpose)
      },
      key,
      plaintext
    )
  )
  const envelope = new Uint8Array(HEADER_BYTES + ciphertext.byteLength)
  const view = new DataView(envelope.buffer)
  view.setUint8(0, ENVELOPE_VERSION)
  view.setUint32(1, context.epoch)
  envelope.set(iv, 5)
  envelope.set(ciphertext, HEADER_BYTES)
  return envelope
}

/**
 * Opens an envelope. Throws `CloudCryptoError` for anything that is not exactly what was sealed
 * for this file, epoch and purpose: a wrong key, a tampered byte, or bytes moved from elsewhere.
 */
export async function open(
  key: CryptoKey,
  context: { fileId: string; purpose: SealPurpose },
  envelope: Uint8Array
): Promise<Uint8Array<ArrayBuffer>> {
  const epoch = envelopeEpoch(envelope)
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: envelope.slice(5, HEADER_BYTES),
          additionalData: associatedData(context.fileId, epoch, context.purpose)
        },
        key,
        envelope.slice(HEADER_BYTES)
      )
    )
  } catch {
    throw new CloudCryptoError('This content could not be decrypted with the file key')
  }
}
