/**
 * The engine's Redrob account, from this app.
 *
 * Models run through the shared daemon, which calls the Console with ITS credential. Signing in
 * therefore means handing the Console key to the engine (`PUT /auth/redrob`), never keeping one in
 * this app; signed-in status is read from the engine's provider list the way Cowork reads it
 * (apps/server/src/redrob-auth.ts there). A key the launcher shared is also seen here, because the
 * engine reads the launcher's file itself.
 */
import { connectEngine, engineHeaders, EngineUnavailableError } from '@/app/ai/engine/daemon'

export const REDROB_PROVIDER_ID = 'redrob'
/** The engine lists a credential-less Redrob provider with this placeholder; it is not a key. */
const PUBLIC_SENTINEL = 'public'

export type EngineAccountStatus =
  | { connected: false }
  | { connected: true; source: 'api' | 'env' | 'config' | 'launcher' }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function deriveEngineAccountStatus(providerList: unknown): EngineAccountStatus {
  if (!isRecord(providerList) || !Array.isArray(providerList.all)) return { connected: false }
  const entry = providerList.all.find(
    (candidate): candidate is Record<string, unknown> =>
      isRecord(candidate) && candidate.id === REDROB_PROVIDER_ID
  )
  if (!entry) return { connected: false }
  const options = isRecord(entry.options) ? entry.options : {}
  if (options.apiKey === PUBLIC_SENTINEL) return { connected: false }
  const source = entry.source
  const hasKey = typeof entry.key === 'string' && entry.key.trim().length > 0
  if (!(source === 'api' || source === 'env' || source === 'launcher' || hasKey))
    return { connected: false }
  return {
    connected: true,
    source:
      source === 'api' || source === 'env' || source === 'config' || source === 'launcher'
        ? source
        : 'api'
  }
}

export async function engineFetch(
  path: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch
): Promise<Response> {
  let daemon = await connectEngine()
  const call = async () =>
    fetcher(`${daemon.url.replace(/\/+$/, '')}${path}`, {
      ...init,
      headers: { ...engineHeaders(daemon), 'content-type': 'application/json' }
    })
  let response: Response
  try {
    response = await call()
  } catch {
    // The daemon may have restarted with a new secret and port: read the record again, once.
    daemon = await connectEngine({ fresh: true })
    response = await call()
  }
  if (response.status === 401) {
    daemon = await connectEngine({ fresh: true })
    response = await call()
  }
  return response
}

export async function readEngineAccountStatus(
  fetcher: typeof fetch = fetch
): Promise<EngineAccountStatus> {
  const response = await engineFetch('/provider', {}, fetcher)
  if (!response.ok) return { connected: false }
  return deriveEngineAccountStatus(await response.json())
}

/** Hand the Console key to the engine. Rotation is the same call: the entry is overwritten. */
export async function setEngineRedrobKey(
  key: string,
  fetcher: typeof fetch = fetch
): Promise<void> {
  const trimmed = key.trim()
  if (!trimmed) throw new Error('A Redrob key is required')
  const response = await engineFetch(
    `/auth/${REDROB_PROVIDER_ID}`,
    { method: 'PUT', body: JSON.stringify({ type: 'api', key: trimmed }) },
    fetcher
  )
  // The engine's failure body could echo the payload; only the status is reported.
  if (!response.ok)
    throw new EngineUnavailableError(
      `The engine did not accept the Redrob key (${response.status}).`
    )
}

export async function clearEngineRedrobKey(fetcher: typeof fetch = fetch): Promise<void> {
  const response = await engineFetch(`/auth/${REDROB_PROVIDER_ID}`, { method: 'DELETE' }, fetcher)
  if (!response.ok && response.status !== 404) {
    throw new EngineUnavailableError(
      `The engine did not remove the Redrob key (${response.status}).`
    )
  }
}
