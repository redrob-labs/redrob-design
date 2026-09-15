/**
 * Connect Redrob: the device-authorization flow that puts a workspace key into this
 * app without anyone copying one by hand.
 *
 * The shape is RFC 8628. The app asks Console for a device code, shows the human a
 * short user code, and polls until they approve it in Console. Console returns the
 * key exactly once, so whatever runs this must persist what the first successful poll
 * returns -- asking twice gets a refusal, not the key again.
 *
 * This module is transport and state machine only. It does not decide where the key
 * is kept: the caller hands the result to the credential store, which is what already
 * owns secrets in this app. `fetch`, the clock and `sleep` are injected so expiry,
 * back-off and refusal are testable without waiting or reaching the network.
 *
 * Redrob Office runs the same flow from an Electron main process; the state machine is
 * deliberately identical so the two cannot drift into different behaviour against the
 * same Console endpoints.
 */
import { REDROB_CONSOLE_API_BASE } from '@redrob-design/core/constants'

/** Console's product allowlist refuses anything outside this set. */
export type DeviceProduct =
  | 'browser'
  | 'code'
  | 'cowork'
  | 'design'
  | 'extension'
  | 'office'
  | 'work'

export type DeviceAuthorization = {
  deviceCode: string
  userCode: string
  verificationURI: string
  verificationURIComplete: string
  /** seconds */
  expiresIn: number
  /** seconds Console asks us to wait between polls */
  interval: number
}

/**
 * The key Console issues, plus what it says about the account it belongs to. The
 * optional fields are spelled `?: string | undefined` to match Office's copy of this
 * module, where `exactOptionalPropertyTypes` refuses the shorter form.
 */
export type DeviceKey = {
  apiKey: string
  apiKeyName?: string | undefined
  accountName?: string | undefined
  apiBaseURL?: string | undefined
}

export type DeviceConnectOutcome =
  | { status: 'connected'; key: DeviceKey }
  | { status: 'denied' }
  | { status: 'expired' }
  | { status: 'cancelled' }
  | { status: 'unreachable'; attempts: number }
  | { status: 'failed'; code: string }

type PollAnswer =
  | { kind: 'key'; key: DeviceKey }
  | { kind: 'pending' }
  | { kind: 'slow-down' }
  | { kind: 'denied' }
  | { kind: 'expired' }
  | { kind: 'unreachable' }
  | { kind: 'failed'; code: string }

const MIN_INTERVAL_MS = 1_000
const MAX_INTERVAL_MS = 30_000
const DEFAULT_INTERVAL_MS = 5_000
const DEFAULT_EXPIRY_MS = 10 * 60_000
const MAX_EXPIRY_MS = 30 * 60_000
/** Consecutive network failures tolerated before the attempt is called off. */
const MAX_UNREACHABLE = 5

/**
 * Console's device-flow JSON, as received. Every field is `unknown` because this is
 * the boundary: the parsers below narrow each one, and a named type keeps the broad
 * `Record<string, unknown>` cast (which the architecture rules forbid) out of it.
 */
type ConsoleDeviceJSON = {
  deviceCode?: unknown
  userCode?: unknown
  expiresIn?: unknown
  interval?: unknown
  apiKey?: unknown
  apiKeyName?: unknown
  accountName?: unknown
  error?: unknown
} & Partial<Record<'verificationUri' | 'verificationUriComplete' | 'apiBaseUrl', unknown>>

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export type DeviceConnectDeps = {
  fetch: FetchLike
  now: () => number
  sleep: (ms: number) => Promise<void>
}

function apiURL(path: string): string {
  return `${REDROB_CONSOLE_API_BASE.replace(/\/+$/, '')}${path}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export async function startDeviceAuthorization(
  product: DeviceProduct,
  deps: Pick<DeviceConnectDeps, 'fetch'>
): Promise<DeviceAuthorization> {
  const response = await deps.fetch(apiURL('/device/authorize'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product })
  })
  if (!response.ok) {
    throw new Error(`Console refused the connect request (HTTP ${response.status}).`)
  }
  const raw = (await response.json()) as ConsoleDeviceJSON
  const deviceCode = asString(raw.deviceCode)
  const userCode = asString(raw.userCode)
  if (!deviceCode || !userCode) {
    throw new Error('Console returned an incomplete device authorization.')
  }
  const verificationURI = asString(raw['verificationUri']) || 'https://console.redrob.ai/connect'
  return {
    deviceCode,
    userCode,
    verificationURI,
    verificationURIComplete: asString(raw['verificationUriComplete']) || verificationURI,
    expiresIn: typeof raw.expiresIn === 'number' ? raw.expiresIn : DEFAULT_EXPIRY_MS / 1000,
    interval: typeof raw.interval === 'number' ? raw.interval : DEFAULT_INTERVAL_MS / 1000
  }
}

/**
 * One poll. A refusal is returned as data rather than thrown, because the loop treats
 * each refusal differently and an exception would flatten them into one.
 */
export async function pollDeviceToken(
  deviceCode: string,
  deps: Pick<DeviceConnectDeps, 'fetch'>
): Promise<PollAnswer> {
  let response: Response
  try {
    response = await deps.fetch(apiURL('/device/token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode })
    })
  } catch {
    return { kind: 'unreachable' }
  }

  if (response.ok) {
    const raw = (await response.json()) as ConsoleDeviceJSON
    const apiKey = asString(raw.apiKey)
    if (!apiKey) return { kind: 'failed', code: 'missing_key' }
    return {
      kind: 'key',
      key: {
        apiKey,
        apiKeyName: asString(raw.apiKeyName) || undefined,
        accountName: asString(raw.accountName) || undefined,
        apiBaseURL: asString(raw['apiBaseUrl']) || undefined
      }
    }
  }

  let code = ''
  try {
    const raw = (await response.json()) as ConsoleDeviceJSON
    code = asString(raw.error)
  } catch {
    code = ''
  }

  if (response.status === 403 || code === 'access_denied') return { kind: 'denied' }
  if (code === 'authorization_pending') return { kind: 'pending' }
  if (code === 'slow_down') return { kind: 'slow-down' }
  if (code === 'expired_token') return { kind: 'expired' }
  if (code) return { kind: 'failed', code }
  // A 5xx is Console having a bad minute, not a verdict on this attempt.
  if (response.status >= 500) return { kind: 'unreachable' }
  return { kind: 'failed', code: `http_${response.status}` }
}

export type DeviceConnectRun = {
  authorization: DeviceAuthorization
  deps: DeviceConnectDeps
  isCancelled?: () => boolean
}

/**
 * Poll until Console answers with a key or a refusal.
 *
 * The loop waits one interval BEFORE its first poll: nobody can have approved a code
 * displayed a millisecond ago, and an eager poll only earns a `slow_down` on the next
 * one. `slow_down` then doubles the interval to a cap rather than adding a constant,
 * so a busy Console sheds load instead of being retried at nearly the same rate.
 */
export async function runDeviceConnect(run: DeviceConnectRun): Promise<DeviceConnectOutcome> {
  const { authorization, deps } = run
  const isCancelled = run.isCancelled ?? (() => false)

  let intervalMs = clamp(authorization.interval * 1000, MIN_INTERVAL_MS, MAX_INTERVAL_MS)
  const deadline =
    deps.now() + clamp(authorization.expiresIn * 1000, MIN_INTERVAL_MS, MAX_EXPIRY_MS)
  let unreachable = 0

  for (;;) {
    if (isCancelled()) return { status: 'cancelled' }
    await deps.sleep(intervalMs)
    if (isCancelled()) return { status: 'cancelled' }
    if (deps.now() >= deadline) return { status: 'expired' }

    const answer = await pollDeviceToken(authorization.deviceCode, deps)
    if (answer.kind === 'key') return { status: 'connected', key: answer.key }
    if (answer.kind === 'denied') return { status: 'denied' }
    if (answer.kind === 'expired') return { status: 'expired' }
    if (answer.kind === 'failed') return { status: 'failed', code: answer.code }
    if (answer.kind === 'slow-down') {
      unreachable = 0
      intervalMs = clamp(intervalMs * 2, MIN_INTERVAL_MS, MAX_INTERVAL_MS)
      continue
    }
    if (answer.kind === 'unreachable') {
      unreachable += 1
      if (unreachable >= MAX_UNREACHABLE) return { status: 'unreachable', attempts: unreachable }
      continue
    }
    unreachable = 0
  }
}

/** `ABCD-EFGH`, the grouping Console prints and its confirm page expects. */
export function formatUserCode(userCode: string): string {
  const cleaned = userCode
    .replace(/[^0-9a-z]/gi, '')
    .toUpperCase()
    .slice(0, 8)
  return cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned
}
