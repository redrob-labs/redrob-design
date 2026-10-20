/**
 * Sign-in with redrob-auth: Authorization Code + PKCE S256 through the system browser and a
 * loopback redirect (RFC 8252), as the public client `redrob-design`.
 *
 * Adapted from redrob-cowork `packages/redrob-login/src/index.ts` (Redrob, MIT): the same
 * discovery, token, refresh-rotation and revoke steps, rewritten for a webview. The loopback
 * listener is the desktop's (`desktop/src/oauth_loopback.rs`), and the refresh token goes to
 * this app's own credential store (the OS keychain on desktop) instead of `ai.redrob.login`.
 * Apps never hand tokens to each other; each signs in with its own client id.
 *
 * The access token stays in this module's memory. A browser build cannot listen on a port, so
 * there `redrobAuthAvailable()` is false and the caller keeps the Console sign-in.
 */
import { decodeBase64, encodeBase64 } from '@redrob-design/core/bytes'

import { REDROB_AUTH_ISSUER } from '@/app/integrations/console/endpoints'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'
import { isTauri } from '@/app/tauri/env'

export const REDROB_AUTH_CLIENT_ID = 'redrob-design'
export const REDROB_AUTH_REFRESH_REF = credentialRef('redrob-auth', 'refresh-token')

const SCOPE = 'openid profile email'
const REFRESH_SKEW_MS = 60_000

/** Login cannot be used here: not configured, client or grant unknown to the server, no desktop. */
export class RedrobAuthUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(reason)
    this.name = 'RedrobAuthUnavailableError'
  }
}

/** Any other failure, with the OAuth error code when there is one. Never carries a token. */
export class RedrobAuthError extends Error {
  constructor(
    readonly code: string,
    message?: string
  ) {
    super(message ?? code)
    this.name = 'RedrobAuthError'
  }
}

const NOT_AVAILABLE_CODES = new Set([
  'invalid_client',
  'unauthorized_client',
  'unsupported_grant_type'
])

type Fetch = (url: string, init: RequestInit) => Promise<Response>

interface Endpoints {
  authorization: string
  token: string
  revocation: string
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

type LoopbackCallback =
  | { kind: 'code'; code: string }
  | { kind: 'error'; error: string; description?: string | null }

let access: { token: string; expiresAt: number } | null = null
let refreshing: Promise<string | null> | null = null
let endpoints: Endpoints | null = null
let pendingPort: number | null = null

export function redrobAuthAvailable(): boolean {
  return isTauri() && REDROB_AUTH_ISSUER !== ''
}

async function appFetch(): Promise<Fetch> {
  const { tauriFetch } = await import('@/app/tauri/http')
  return (url, init) => tauriFetch(url, init)
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const tauri = await import('@tauri-apps/api/core')
  return tauri.invoke<T>(command, args)
}

function base64url(bytes: Uint8Array): string {
  return encodeBase64(bytes, 'base64url')
}

function randomToken(size: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(size)))
}

async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function discover(fetch: Fetch): Promise<Endpoints> {
  if (endpoints) return endpoints
  let discovery: Record<string, unknown> = {}
  try {
    const response = await fetch(`${REDROB_AUTH_ISSUER}/.well-known/openid-configuration`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit'
    })
    if (response.ok) {
      const body: unknown = await response.json()
      if (isRecord(body)) discovery = body
    }
  } catch (error) {
    throw new RedrobAuthError('unreachable', error instanceof Error ? error.message : String(error))
  }
  const pick = (key: string, fallback: string): string => {
    const value = discovery[key]
    return typeof value === 'string' && value.startsWith('https://') ? value : fallback
  }
  endpoints = {
    authorization: pick('authorization_endpoint', `${REDROB_AUTH_ISSUER}/oauth/authorize`),
    token: pick('token_endpoint', `${REDROB_AUTH_ISSUER}/oauth/token`),
    revocation: pick('revocation_endpoint', `${REDROB_AUTH_ISSUER}/oauth/revoke`)
  }
  return endpoints
}

function toError(code: string, description?: string | null): Error {
  return NOT_AVAILABLE_CODES.has(code)
    ? new RedrobAuthUnavailableError(code)
    : new RedrobAuthError(code, description ?? undefined)
}

async function postForm(
  fetch: Fetch,
  url: string,
  form: Record<string, string>
): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams(form).toString(),
      credentials: 'omit'
    })
  } catch (error) {
    throw new RedrobAuthError('unreachable', error instanceof Error ? error.message : String(error))
  }
}

async function requestToken(form: Record<string, string>): Promise<TokenResponse> {
  const fetch = await appFetch()
  const { token } = await discover(fetch)
  const response = await postForm(fetch, token, { client_id: REDROB_AUTH_CLIENT_ID, ...form })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string
      error_description?: string
    }
    throw toError(body.error ?? `http_${response.status}`, body.error_description)
  }
  const body = (await response.json()) as Partial<TokenResponse>
  if (typeof body.access_token !== 'string') throw new RedrobAuthError('invalid_token_response')
  return body as TokenResponse
}

/** `exp` in milliseconds when the access token is a JWT that carries one. */
function jwtExpiry(accessToken: string): number | null {
  const part = accessToken.split('.')[1]
  if (!part) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64(part))) as { exp?: unknown }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

/** `exp` from the access token when it is a JWT; otherwise `expires_in`. */
function expiryOf(token: TokenResponse): number {
  return jwtExpiry(token.access_token) ?? Date.now() + (token.expires_in ?? 3600) * 1000
}

async function keep(token: TokenResponse): Promise<string> {
  access = { token: token.access_token, expiresAt: expiryOf(token) }
  // redrob-auth rotates refresh tokens on every use.
  if (token.refresh_token) {
    await appCredentialServices.manager.set(REDROB_AUTH_REFRESH_REF, token.refresh_token)
  }
  return token.access_token
}

/** Whether a redrob-auth session is kept on this computer. */
export async function hasRedrobAuthSession(): Promise<boolean> {
  if (!redrobAuthAvailable()) return false
  return (await appCredentialServices.manager.status(REDROB_AUTH_REFRESH_REF)) === 'configured'
}

async function refresh(): Promise<string | null> {
  const stored = await appCredentialServices.resolver.resolve(REDROB_AUTH_REFRESH_REF)
  if (!stored) return null
  try {
    return await keep(await requestToken({ grant_type: 'refresh_token', refresh_token: stored }))
  } catch (error) {
    if (
      (error instanceof RedrobAuthError && error.code === 'invalid_grant') ||
      error instanceof RedrobAuthUnavailableError
    ) {
      // Revoked, expired or already rotated: the stored token is dead.
      access = null
      await appCredentialServices.manager.clear(REDROB_AUTH_REFRESH_REF)
      return null
    }
    throw error
  }
}

/**
 * A live access token, refreshed when within a minute of `exp`; null when signed out of
 * redrob-auth. Unreachable redrob-auth throws, so a caller can tell offline from signed out.
 */
export async function redrobAuthAccessToken(): Promise<string | null> {
  if (!redrobAuthAvailable()) return null
  if (access && Date.now() < access.expiresAt - REFRESH_SKEW_MS) return access.token
  refreshing ??= refresh().finally(() => {
    refreshing = null
  })
  return refreshing
}

/** Opens the browser and waits for the loopback callback; the refresh token goes to the keychain. */
export async function signInWithRedrobAuth(
  openBrowser: (url: string) => Promise<void>
): Promise<void> {
  if (!redrobAuthAvailable()) throw new RedrobAuthUnavailableError('not_configured')
  const fetch = await appFetch()
  const { authorization } = await discover(fetch)
  const verifier = randomToken(32)
  const state = randomToken(16)
  const port = await invoke<number>('oauth_loopback_start').catch((error: unknown) => {
    throw new RedrobAuthUnavailableError(error instanceof Error ? error.message : String(error))
  })
  pendingPort = port
  const redirectURI = `http://127.0.0.1:${port}/callback`
  try {
    const url = new URL(authorization)
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: REDROB_AUTH_CLIENT_ID,
      redirect_uri: redirectURI,
      scope: SCOPE,
      state,
      code_challenge: await s256(verifier),
      code_challenge_method: 'S256'
    }).toString()
    const waiting = invoke<LoopbackCallback>('oauth_loopback_wait', {
      port,
      expectedState: state
    })
    await openBrowser(url.toString())
    let callback: LoopbackCallback
    try {
      callback = await waiting
    } catch (error) {
      const code = typeof error === 'string' ? error : 'loopback_failed'
      throw new RedrobAuthError(code)
    }
    if (callback.kind === 'error') throw toError(callback.error, callback.description)
    await keep(
      await requestToken({
        grant_type: 'authorization_code',
        code: callback.code,
        redirect_uri: redirectURI,
        code_verifier: verifier
      })
    )
  } finally {
    if (pendingPort === port) pendingPort = null
  }
}

export function cancelRedrobAuthSignIn(): void {
  const port = pendingPort
  pendingPort = null
  if (port !== null) void invoke('oauth_loopback_cancel', { port }).catch(() => undefined)
}

/** Revokes the refresh token (best effort) and forgets the session. */
export async function signOutOfRedrobAuth(): Promise<void> {
  cancelRedrobAuthSignIn()
  access = null
  if (!redrobAuthAvailable()) return
  const stored = await appCredentialServices.resolver.resolve(REDROB_AUTH_REFRESH_REF)
  if (stored) {
    try {
      const fetch = await appFetch()
      const { revocation } = await discover(fetch)
      await postForm(fetch, revocation, {
        client_id: REDROB_AUTH_CLIENT_ID,
        token: stored,
        token_type_hint: 'refresh_token'
      })
    } catch (error) {
      // Best effort: the token is forgotten either way.
      console.warn('[redrob-auth] Could not revoke the refresh token', error)
    }
  }
  await appCredentialServices.manager.clear(REDROB_AUTH_REFRESH_REF)
}
