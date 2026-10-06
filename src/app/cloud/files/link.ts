import { decodeBase64, encodeBase64 } from '@redrob-design/core/bytes'

import { CONTENT_KEY_BYTES } from '@/app/cloud/crypto'
import { WEB_APP_ORIGIN } from '@/constants'

/**
 * Links to shared files.
 *
 * A member's link names the file and nothing else: opening it needs their own access. A view link
 * also carries, in the fragment, the link's token and the file's key. Browsers never send a
 * fragment to a server, so Console holds the door (the token) and never the key, and anyone the
 * link reaches can read the file and nothing more.
 *
 * Both open in the desktop app: paste the link into Open shared file.
 */
export type ParsedCloudLink = {
  fileId: string
  /** Present for a view link. */
  view: { token: string; epoch: number; raw: Uint8Array<ArrayBuffer> } | null
}

const FILE_ID = /^dfl_[0-9a-f]{32}$/

export function memberLink(fileId: string): string {
  return `${WEB_APP_ORIGIN}/f/${fileId}`
}

export function viewLink(
  fileId: string,
  view: { token: string; epoch: number; raw: Uint8Array<ArrayBuffer> }
): string {
  const fragment = new URLSearchParams({
    t: view.token,
    e: String(view.epoch),
    k: encodeBase64(view.raw, 'base64url')
  })
  return `${memberLink(fileId)}#${fragment.toString()}`
}

/** Reads a pasted link, or a bare file id. Anything else is null. */
export function parseCloudLink(input: string): ParsedCloudLink | null {
  const trimmed = input.trim()
  if (FILE_ID.test(trimmed)) return { fileId: trimmed, view: null }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  const match = /\/f\/(dfl_[0-9a-f]{32})\/?$/.exec(url.pathname)
  if (!match) return null
  const fileId = match[1]
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''))
  const token = fragment.get('t')
  const keyText = fragment.get('k')
  const epoch = Number(fragment.get('e'))
  if (!token && !keyText) return { fileId, view: null }
  if (!token || !keyText || !Number.isInteger(epoch) || epoch < 1) return null
  let raw: Uint8Array<ArrayBuffer>
  try {
    const decoded = decodeBase64(keyText)
    if (decoded.byteLength !== CONTENT_KEY_BYTES) return null
    raw = new Uint8Array(decoded)
  } catch {
    return null
  }
  return { fileId, view: { token, epoch, raw } }
}

export function newCloudFileId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return `dfl_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}
