/**
 * Frames on the Redrob Cloud collaboration relay. Control frames are JSON
 * text; actions are binary, so Yjs updates travel without base64:
 *
 *   [u8 version][u32 big-endian header length][header JSON, UTF-8][payload]
 *
 * The relay forwards each frame unchanged to every other peer in the room,
 * or only to `targetId` when it is set. It checks that `senderId` is the id
 * the connection said hello with, and sends `leave` for a peer whose
 * connection drops.
 */

export const RELAY_PROTOCOL_VERSION = 1
/** Larger frames are dropped; the relay closes connections that send them. */
export const MAX_RELAY_FRAME_BYTES = 8 * 1024 * 1024

const HEADER_PREFIX_BYTES = 5

export interface RelayControlFrame {
  v: typeof RELAY_PROTOCOL_VERSION
  type: 'hello' | 'welcome' | 'leave'
  senderId: string
  targetId?: string
}

export interface RelayActionFrame {
  type: 'action'
  senderId: string
  targetId?: string
  namespace: string
  data: Uint8Array
}

export type RelayFrame = RelayControlFrame | RelayActionFrame

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function encodeControlFrame(frame: Omit<RelayControlFrame, 'v'>): string {
  return JSON.stringify({ v: RELAY_PROTOCOL_VERSION, ...frame })
}

export function encodeActionFrame(frame: Omit<RelayActionFrame, 'type'>): Uint8Array<ArrayBuffer> {
  const header = encoder.encode(
    JSON.stringify({
      senderId: frame.senderId,
      targetId: frame.targetId,
      namespace: frame.namespace
    })
  )
  const bytes = new Uint8Array(HEADER_PREFIX_BYTES + header.byteLength + frame.data.byteLength)
  const view = new DataView(bytes.buffer)
  view.setUint8(0, RELAY_PROTOCOL_VERSION)
  view.setUint32(1, header.byteLength)
  bytes.set(header, HEADER_PREFIX_BYTES)
  bytes.set(frame.data, HEADER_PREFIX_BYTES + header.byteLength)
  return bytes
}

function decodeControl(text: string): RelayControlFrame | null {
  const value = parseJSON(text)
  if (!isRecord(value) || value.v !== RELAY_PROTOCOL_VERSION) return null
  const { type, senderId, targetId } = value
  if (type !== 'hello' && type !== 'welcome' && type !== 'leave') return null
  if (typeof senderId !== 'string' || !optionalString(targetId)) return null
  return targetId === undefined
    ? { v: RELAY_PROTOCOL_VERSION, type, senderId }
    : { v: RELAY_PROTOCOL_VERSION, type, senderId, targetId }
}

function decodeAction(bytes: Uint8Array): RelayActionFrame | null {
  if (bytes.byteLength < HEADER_PREFIX_BYTES) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint8(0) !== RELAY_PROTOCOL_VERSION) return null
  const headerLength = view.getUint32(1)
  const payloadStart = HEADER_PREFIX_BYTES + headerLength
  if (payloadStart > bytes.byteLength) return null
  const header = parseJSON(decoder.decode(bytes.subarray(HEADER_PREFIX_BYTES, payloadStart)))
  if (!isRecord(header)) return null
  const { senderId, targetId, namespace } = header
  if (typeof senderId !== 'string' || typeof namespace !== 'string') return null
  if (!optionalString(targetId)) return null
  const data = bytes.slice(payloadStart)
  return targetId === undefined
    ? { type: 'action', senderId, namespace, data }
    : { type: 'action', senderId, targetId, namespace, data }
}

/** Reads one frame; anything malformed, too large or from another version is null. */
export function decodeRelayFrame(raw: unknown): RelayFrame | null {
  if (typeof raw === 'string') {
    return raw.length > MAX_RELAY_FRAME_BYTES ? null : decodeControl(raw)
  }
  let bytes: Uint8Array | null = null
  if (raw instanceof Uint8Array) bytes = raw
  else if (raw instanceof ArrayBuffer) bytes = new Uint8Array(raw)
  if (!bytes || bytes.byteLength > MAX_RELAY_FRAME_BYTES) return null
  return decodeAction(bytes)
}
