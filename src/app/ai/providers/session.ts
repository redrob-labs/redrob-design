import type { AIProviderID } from '@redrob-design/core/constants'

import type { FetchFunction } from '@/app/http/types'

/** Lets the Console join a labeled session to what its requests cost. */
export const REDROB_SESSION_HEADER = 'x-redrob-session'

const SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/

export type SessionIDSource = () => string | null

export function isRedrobSessionID(value: string): boolean {
  return SESSION_ID_PATTERN.test(value)
}

/** The session header for one request: only for the Redrob provider, and only a well-formed id. */
export function redrobSessionHeaders(
  providerID: AIProviderID,
  sessionID: string | null
): Record<string, string> {
  if (providerID !== 'redrob' || sessionID === null || !isRedrobSessionID(sessionID)) return {}
  return { [REDROB_SESSION_HEADER]: sessionID }
}

/**
 * A fetch that adds the session header, read when each request is made, since a chat's session
 * starts and ends while its model stays the same.
 */
export function withRedrobSession(
  providerID: AIProviderID,
  fetch: FetchFunction | undefined,
  sessionID: SessionIDSource | undefined
): FetchFunction | undefined {
  if (providerID !== 'redrob' || !sessionID) return fetch
  const base: FetchFunction = fetch ?? ((input, init) => globalThis.fetch(input, init))
  return (input, init) => {
    const extra = redrobSessionHeaders(providerID, sessionID())
    if (!Object.keys(extra).length) return base(input, init)
    const headers = new Headers(init?.headers)
    for (const [name, value] of Object.entries(extra)) headers.set(name, value)
    return base(input, { ...init, headers })
  }
}
