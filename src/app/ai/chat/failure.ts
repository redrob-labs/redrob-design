import { APICallError } from 'ai'

export type AIChatFailureReason =
  | 'authentication'
  | 'forbidden'
  | 'insufficient-credit'
  | 'model-not-found'
  | 'network'
  | 'output-limit'
  | 'rate-limit'
  | 'request-failed'

export type AIChatFailure = {
  reason: AIChatFailureReason
  detail?: string
  statusCode?: number
  retryable?: boolean
}

export type ProviderErrorShape = {
  statusCode?: unknown
  status?: unknown
  responseStatusCode?: unknown
  responseStatus?: unknown
  code?: unknown
  response?: { status?: unknown }
}

function statusNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return null
}

export function providerErrorStatus(error: unknown): number | null {
  if (APICallError.isInstance(error)) return error.statusCode ?? null
  if (typeof error !== 'object' || error === null) return null
  const value = error as ProviderErrorShape
  return (
    statusNumber(value.statusCode) ??
    statusNumber(value.status) ??
    statusNumber(value.responseStatusCode) ??
    statusNumber(value.responseStatus) ??
    statusNumber(value.code) ??
    statusNumber(value.response?.status)
  )
}

/** Fields a provider or JSON-RPC error is known to carry a human-readable message in. */
const MESSAGE_KEYS = ['message', 'safeMessage', 'errorText', 'detail', 'reason'] as const
/** A nested `data` payload carries fewer of them. */
const NESTED_MESSAGE_KEYS = ['message', 'safeMessage'] as const

export type MessageBearingError = {
  [Key in (typeof MESSAGE_KEYS)[number]]?: unknown
} & {
  data?: unknown
  code?: unknown
  name?: unknown
}

/** Narrow an unknown throwable to the shape above, or null when it is not an object. */
export function asMessageBearingError(error: unknown): MessageBearingError | null {
  if (typeof error !== 'object' || error === null) return null
  return error as MessageBearingError
}

function firstMessageField(
  shape: MessageBearingError,
  keys: readonly (keyof MessageBearingError)[]
): string | null {
  for (const key of keys) {
    const value = shape[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function primitiveErrorText(error: unknown): string | null {
  if (typeof error === 'string') return error
  if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
    return String(error)
  }
  return null
}

function serializedErrorText(error: object): string | null {
  try {
    const json = JSON.stringify(error)
    return json && json !== '{}' ? json : null
  } catch {
    // A circular structure has no serialisation to offer, and the caller already has a
    // fallback string. Warning here would fire on every rendered message of a failing stream.
    return null
  }
}

function objectErrorText(error: object): string | null {
  const shape = asMessageBearingError(error)
  if (!shape) return null

  const direct = firstMessageField(shape, MESSAGE_KEYS)
  if (direct) return direct

  const nested = asMessageBearingError(shape.data)
  const nestedText = nested ? firstMessageField(nested, NESTED_MESSAGE_KEYS) : null
  if (nestedText) return nestedText

  return serializedErrorText(error)
}

/** Prefer message / nested JSON-RPC fields over opaque `[object Object]`. */
export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim()
    if (message && message !== '[object Object]') return message
    if (error.name && error.name !== 'Error') return error.name
  }
  const primitive = primitiveErrorText(error)
  if (primitive !== null) return primitive
  if (error && typeof error === 'object') {
    const text = objectErrorText(error)
    if (text) return text
  }
  return 'Unknown error'
}

function normalizedErrorText(error: unknown): string {
  return formatUnknownError(error).toLowerCase()
}

export function isInsufficientCreditError(error: unknown): boolean {
  if (providerErrorStatus(error) === 402) return true
  const text = normalizedErrorText(error)
  return [
    'insufficient credit',
    'insufficient balance',
    'insufficient quota',
    'credit balance',
    'payment required',
    'quota exceeded',
    'billing quota',
    'top up',
    'top-up'
  ].some((phrase) => text.includes(phrase))
}

function statusFailureReason(status: number | null): AIChatFailureReason | null {
  if (status === 401) return 'authentication'
  if (status === 402) return 'insufficient-credit'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'model-not-found'
  if (status === 408) return 'network'
  if (status === 429) return 'rate-limit'
  return null
}

function isAuthRequiredError(error: unknown): boolean {
  const text = normalizedErrorText(error)
  if (text.includes('authentication required') || text.includes('auth required')) return true
  const shape = asMessageBearingError(error)
  if (!shape) return false
  if (shape.code === -32000) return true
  if (shape.name === 'RequestError' && text.includes('authentication')) return true
  return false
}

function failureReason(error: unknown): AIChatFailureReason {
  const statusReason = statusFailureReason(providerErrorStatus(error))
  if (statusReason) return statusReason
  if (isInsufficientCreditError(error)) return 'insufficient-credit'
  if (isAuthRequiredError(error)) return 'authentication'
  const text = normalizedErrorText(error)
  if (
    (text.includes('expired') || text.includes('invalid') || text.includes('authentication')) &&
    (text.includes('key') || text.includes('token') || text.includes('credential'))
  ) {
    return 'authentication'
  }
  if (text.includes('rate limit') || text.includes('too many requests')) return 'rate-limit'
  if (text.includes('model not found') || text.includes('unknown model')) return 'model-not-found'
  if (
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('cors') ||
    text.includes('connection')
  ) {
    return 'network'
  }
  return 'request-failed'
}

export function classifyAIChatFinish(finishReason?: string): AIChatFailure | null {
  return finishReason === 'length' ? { reason: 'output-limit' } : null
}

export function classifyAIChatError(error: unknown): AIChatFailure {
  return {
    reason: failureReason(error),
    detail: formatUnknownError(error),
    statusCode: providerErrorStatus(error) ?? undefined,
    retryable: APICallError.isInstance(error) ? error.isRetryable : undefined
  }
}
