import { decodeBase64, encodeBase64 } from '@redrob-design/core/bytes'

import { open, seal, type SealPurpose } from '@/app/cloud/crypto'

/**
 * Small values -- a file's name, a version's name, a comment -- sealed to base64url, which is what
 * Console stores them as.
 */
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export async function sealText(
  key: CryptoKey,
  context: { fileId: string; epoch: number; purpose: SealPurpose },
  value: string
): Promise<string> {
  return encodeBase64(await seal(key, context, new Uint8Array(encoder.encode(value))), 'base64url')
}

export async function openText(
  key: CryptoKey,
  context: { fileId: string; purpose: SealPurpose },
  sealed: string
): Promise<string> {
  return decoder.decode(await open(key, context, decodeBase64(sealed)))
}
