import { decodeBase64, encodeBase64 } from '@redrob-design/core/bytes'

import { CONTENT_KEY_BYTES } from '@/app/cloud/crypto'
import { SHARE_LINK_BASE } from '@/constants'

/**
 * Links to shared files.
 *
 * A member's link names the file and nothing else: opening it needs their own access. A view link
 * also carries, in the fragment, the link's token and the file's key. Browsers never send a
 * fragment to a server, so the backend holds the door (the token) and never the key, and anyone
 * the link reaches can read the file and nothing more.
 *
 * Both point at the Redrob Chat page for the file, which hands it to the launcher
 * (`redrob://open/design?file=<id>[&link=<fragment>]`); the launcher starts this app with
 * `--open-file <id>` / `--open-link <fragment>`. Pasting the link into Open shared file works too.
 *
 * The fragment is `<token>.<epoch>.<key>` (all base64url or digits) so it passes the launcher's
 * `link` allowlist unchanged. Older links used `t=<token>&e=<epoch>&k=<key>`; both are read.
 */
export type ParsedCloudLink = {
  fileId: string
  /** Present for a view link. */
  view: CloudLinkView | null
}

type CloudLinkView = { token: string; epoch: number; raw: Uint8Array<ArrayBuffer> }

const FILE_ID = /^dfl_[0-9a-f]{32}$/
const BASE64URL = /^[A-Za-z0-9_-]+$/

export function memberLink(fileId: string): string {
  return `${SHARE_LINK_BASE}/${fileId}`
}

export function viewLink(fileId: string, view: CloudLinkView): string {
  const fragment = [view.token, String(view.epoch), encodeBase64(view.raw, 'base64url')].join('.')
  return `${memberLink(fileId)}#${fragment}`
}

function decodeKey(keyText: string): Uint8Array<ArrayBuffer> | null {
  try {
    const decoded = decodeBase64(keyText)
    if (decoded.byteLength !== CONTENT_KEY_BYTES) return null
    return new Uint8Array(decoded)
  } catch {
    return null
  }
}

/**
 * Reads a view link's fragment (without `#`). `undefined` when there is no view part at all,
 * `null` when there is one but it is malformed.
 */
export function parseViewFragment(fragment: string): CloudLinkView | null | undefined {
  const text = fragment.replace(/^#/, '')
  if (!text) return undefined

  let token: string | null
  let keyText: string | null
  let epoch: number
  if (text.includes('=')) {
    const params = new URLSearchParams(text)
    token = params.get('t')
    keyText = params.get('k')
    epoch = Number(params.get('e'))
    if (!token && !keyText) return undefined
  } else {
    const parts = text.split('.')
    if (parts.length !== 3) return null
    token = parts[0]
    keyText = parts[2]
    epoch = /^\d+$/.test(parts[1]) ? Number(parts[1]) : NaN
    if (!BASE64URL.test(token) || !BASE64URL.test(keyText)) return null
  }
  if (!token || !keyText || !Number.isInteger(epoch) || epoch < 1) return null
  const raw = decodeKey(keyText)
  if (!raw) return null
  return { token, epoch, raw }
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
  const view = parseViewFragment(url.hash)
  if (view === null) return null
  return { fileId, view: view ?? null }
}

/**
 * What the launcher handed over on the command line: a file id and, for a view link, its
 * fragment. Null when the id is not one, or the fragment is malformed.
 */
export function parseLaunchTarget(fileId: string, link: string | null): ParsedCloudLink | null {
  if (!FILE_ID.test(fileId)) return null
  if (!link) return { fileId, view: null }
  const view = parseViewFragment(link)
  if (!view) return null
  return { fileId, view }
}

export function newCloudFileId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return `dfl_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}
