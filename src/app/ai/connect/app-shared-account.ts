/**
 * The desktop binding of the shared-account fallback.
 *
 * The file lives outside anything the renderer may read directly and its location depends
 * on environment variables the renderer cannot see, so the Rust side (`shared_account_read`)
 * resolves the path and reads it. This module adds the few-second cache the contract
 * allows and a revision counter that moves when the launcher's key changes, which is what
 * lets a running chat transport pick up a launcher sign-in or sign-out without a restart.
 *
 * A browser build has no launcher and no shared file: the reader answers `null`.
 */
import { useIntervalFn } from '@vueuse/core'
import { ref } from 'vue'

import type { DeviceKey } from '@/app/ai/connect/device-connect'
import {
  cachedSharedAccountReader,
  type SharedAccountReader
} from '@/app/ai/connect/shared-account'
import { isTauri } from '@/app/tauri/env'

/** How long one read of the shared file stands in for the next. */
const SHARED_ACCOUNT_TTL_MS = 3_000
/** How often the launcher's sign-in is re-read while the app is open. */
const SHARED_ACCOUNT_POLL_MS = 5_000

/** Moves whenever the launcher's key appears, changes or disappears. Never holds the key. */
export const sharedAccountRevision = ref(0)

async function readFromDesktop(): Promise<DeviceKey | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<DeviceKey | null>('shared_account_read')
  } catch {
    return null
  }
}

function desktopReader(): SharedAccountReader {
  return cachedSharedAccountReader(readFromDesktop, {
    now: () => Date.now(),
    ttlMs: SHARED_ACCOUNT_TTL_MS
  })
}

let source = desktopReader()
let lastKey: string | null = null

/**
 * The launcher's sign-in right now, read-only, or `null` when there is none. Each read
 * also moves `sharedAccountRevision` when the key differs from the last one seen, so a
 * sign-in or sign-out in the launcher reaches whoever watches the revision.
 */
export async function readSharedAccount(): Promise<DeviceKey | null> {
  const account = await source()
  const key = account?.apiKey ?? null
  if (key !== lastKey) {
    lastKey = key
    sharedAccountRevision.value++
  }
  return account
}

/** Tests swap the desktop reader for one over a scratch directory. */
export function setSharedAccountReaderForTests(next: SharedAccountReader | null): void {
  lastKey = null
  source = next ?? desktopReader()
}

const poll = useIntervalFn(
  () => {
    void readSharedAccount()
  },
  SHARED_ACCOUNT_POLL_MS,
  { immediate: false }
)

/**
 * Keeps `sharedAccountRevision` current while the app is open. Nothing is read in a
 * browser build, where there is no launcher to watch.
 */
export function startSharedAccountWatch(): void {
  if (isTauri()) poll.resume()
}
