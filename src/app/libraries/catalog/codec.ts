import { decodeBase64, encodeBase64 } from '@redrob-design/core/bytes'
import { deserializeLibraryRevision, serializeLibraryRevision } from '@redrob-design/core/library'
import type {
  ComponentLibraryRevision,
  SerializedComponentLibraryRevision
} from '@redrob-design/core/library'

/**
 * A library revision as JSON bytes, the same for storage buckets and
 * Redrob Cloud: maps and bytes are tagged so they survive JSON.
 */
const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()

const MAP_TAG = 'redrobdesign/map'

interface EncodedMap {
  $redrobDesignType: typeof MAP_TAG
  entries: unknown[]
}

function isEncodedMap(value: object): value is EncodedMap {
  return (
    '$redrobDesignType' in value &&
    value.$redrobDesignType === MAP_TAG &&
    'entries' in value &&
    Array.isArray(value.entries)
  )
}

function isMap(value: unknown): value is Map<unknown, unknown> {
  return value instanceof Map
}

function isMarkerShapedObject(value: object): boolean {
  return '$redrobDesignType' in value
}

function encodeValue(value: unknown): unknown {
  if (isMap(value)) {
    return {
      $redrobDesignType: MAP_TAG,
      entries: [...value].map(([key, entry]) => [encodeValue(key), encodeValue(entry)])
    }
  }
  if (value instanceof Uint8Array) return { $bytes: encodeBase64(value) }
  if (Array.isArray(value)) return value.map(encodeValue)
  if (value && typeof value === 'object') {
    const encoded = Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, encodeValue(entry)])
    )
    return isMarkerShapedObject(value)
      ? { $redrobDesignType: 'redrobdesign/object', value: encoded }
      : encoded
  }
  return value
}

function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue)
  if (value && typeof value === 'object') {
    if (
      '$redrobDesignType' in value &&
      value.$redrobDesignType === 'redrobdesign/object' &&
      'value' in value &&
      value.value &&
      typeof value.value === 'object' &&
      !Array.isArray(value.value)
    ) {
      return Object.fromEntries(
        Object.entries(value.value).map(([key, entry]) => [key, decodeValue(entry)])
      )
    }
    if (isEncodedMap(value)) {
      return new Map(
        value.entries.flatMap((entry) =>
          Array.isArray(entry) && entry.length === 2
            ? [[decodeValue(entry[0]), decodeValue(entry[1])] as const]
            : []
        )
      )
    }
    if ('$bytes' in value && typeof (value as { $bytes?: unknown }).$bytes === 'string') {
      return decodeBase64((value as { $bytes: string }).$bytes)
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, decodeValue(entry)])
    )
  }
  return value
}

export function encodeRevision(revision: ComponentLibraryRevision): Uint8Array {
  return textEncoder.encode(JSON.stringify(encodeValue(serializeLibraryRevision(revision))))
}

export function decodeRevision(bytes: Uint8Array): ComponentLibraryRevision {
  const parsed = decodeValue(
    JSON.parse(textDecoder.decode(bytes))
  ) as SerializedComponentLibraryRevision
  return deserializeLibraryRevision(parsed)
}
