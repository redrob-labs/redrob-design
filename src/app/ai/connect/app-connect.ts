import {
  runDeviceConnect,
  startDeviceAuthorization,
  type DeviceAuthorization,
  type DeviceConnectDeps,
  type DeviceConnectOutcome,
  type FetchLike
} from '@/app/ai/connect/device-connect'
/**
 * Connect Redrob for Design: the app-side binding of the pure device flow.
 *
 * `device-connect.ts` is deliberately free of app runtime, so this is where the real
 * fetch, clock and sleep are supplied. The desktop build goes through Tauri's HTTP
 * client because Console does not serve CORS headers for the device endpoints; a
 * browser build uses `window.fetch` and will fail on CORS, which the caller surfaces
 * as `unreachable` rather than pretending it worked.
 */
import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'

/** Console's allowlist entry for Design. */
export const DESIGN_DEVICE_PRODUCT = 'design' as const

function appFetch(): FetchLike {
  if (!isTauri()) return (url, init) => fetch(url, init)
  return (url, init) => tauriFetch(url, init)
}

export function appDeviceConnectDeps(): DeviceConnectDeps {
  return {
    fetch: appFetch(),
    now: () => Date.now(),
    sleep: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms)
      })
  }
}

export async function beginRedrobConnect(
  deps: DeviceConnectDeps = appDeviceConnectDeps()
): Promise<DeviceAuthorization> {
  return startDeviceAuthorization(DESIGN_DEVICE_PRODUCT, deps)
}

export async function awaitRedrobConnect(
  authorization: DeviceAuthorization,
  isCancelled: () => boolean,
  deps: DeviceConnectDeps = appDeviceConnectDeps()
): Promise<DeviceConnectOutcome> {
  return runDeviceConnect({ authorization, deps, isCancelled })
}
