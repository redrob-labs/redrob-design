/**
 * Redrob Launcher's shared sign-in, as this app's fallback workspace key.
 *
 * The launcher signs a computer in once and writes the key to one file every Redrob app
 * may read (redrob-launcher `docs/shared-account.md`). The rules every reader follows:
 *
 * 1. Read only. Nothing here writes or deletes the shared file, and the app's own
 *    "Clear key" removes the app's own credential and nothing else.
 * 2. Read at the moment the key is needed, not once at startup: the person may sign in
 *    or out of the launcher while this app runs. A reader may cache for a few seconds.
 * 3. The app's OWN stored key wins. The shared one is the fallback only.
 * 4. The key is never logged, printed or displayed.
 *
 * This module is pure: the file reader and the clock are injected, so the precedence
 * rules are testable against a scratch directory and never touch the real `~/.config`.
 * The desktop binding lives in `app-shared-account.ts`.
 */
import type { DeviceKey } from '@/app/ai/connect/device-connect'

export const SHARED_ACCOUNT_FILE = 'account.json'

/**
 * The directory override every Redrob app honours; the file name stays `account.json`.
 * The path itself is resolved in `desktop/src/shared_account.rs`, the only place that can
 * see environment variables; tests point this at a scratch directory.
 */
export const SHARED_DIR_ENV = 'REDROB_SHARED_DIR'

/** The launcher's JSON, as received. Every field is `unknown` because this is the boundary. */
type SharedAccountJSON = {
  apiKey?: unknown
  apiKeyName?: unknown
  accountName?: unknown
  apiBaseUrl?: unknown
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

/**
 * Parses the shared file into the app's own credential shape. A missing or empty
 * `apiKey` means "not signed in", and so does anything that is not the expected object:
 * a half-written file is not a key.
 */
export function parseSharedAccount(text: string): DeviceKey | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const json = raw as SharedAccountJSON
  const apiKey = asString(json.apiKey)
  if (!apiKey) return null
  return {
    apiKey,
    apiKeyName: asString(json.apiKeyName),
    accountName: asString(json.accountName),
    apiBaseURL: asString(json.apiBaseUrl)
  }
}

/** Reads the launcher's sign-in right now; `null` when there is none. */
export type SharedAccountReader = () => Promise<DeviceKey | null>

/**
 * A reader over a file. `readText` resolves to `null` for a missing file; any other
 * failure is also "not signed in", because a key that cannot be read is no key.
 */
export function sharedAccountFileReader(
  path: string | null,
  readText: (path: string) => Promise<string | null>
): SharedAccountReader {
  return async () => {
    if (!path) return null
    try {
      const text = await readText(path)
      return text === null ? null : parseSharedAccount(text)
    } catch {
      return null
    }
  }
}

/**
 * Caches a reader for `ttlMs`, the most the contract allows, so a hot path that asks
 * several times in one breath reads the disk once while a launcher sign-out still lands
 * within seconds.
 */
export function cachedSharedAccountReader(
  reader: SharedAccountReader,
  options: { now: () => number; ttlMs: number }
): SharedAccountReader {
  let readAt = Number.NEGATIVE_INFINITY
  let last: DeviceKey | null = null
  return async () => {
    const now = options.now()
    if (now - readAt < options.ttlMs) return last
    last = await reader()
    readAt = now
    return last
  }
}

/** Where the key in use came from. The UI shows the launcher case differently. */
export type WorkspaceKeySource = 'own' | 'launcher'

export type WorkspaceKey = {
  apiKey: string
  source: WorkspaceKeySource
  /** Who the launcher says is signed in. Only present for `launcher`. */
  accountName?: string | undefined
  apiKeyName?: string | undefined
  apiBaseURL?: string | undefined
}

/**
 * The key to use: the app's own stored key when there is one, else the launcher's.
 * `own` is read first and the shared file is not consulted when it answers, so the
 * app's own key always wins and the shared file is only touched as a fallback.
 */
export async function resolveWorkspaceKey(
  own: () => Promise<string | null>,
  shared: SharedAccountReader
): Promise<WorkspaceKey | null> {
  const ownKey = await own()
  if (ownKey) return { apiKey: ownKey, source: 'own' }
  const account = await shared()
  if (!account) return null
  return {
    apiKey: account.apiKey,
    source: 'launcher',
    accountName: account.accountName,
    apiKeyName: account.apiKeyName,
    apiBaseURL: account.apiBaseURL
  }
}
