import { fetchGuide, type GuideEditionResponse } from '@redrob-labs/route-labeller'

import { REDROB_CONSOLE_API_BASE } from '@redrob-design/core/constants'

import { aiModelSettings } from '@/app/ai/models/store'
import { prefetchRouteModel } from '@/app/ai/route-labels'
import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'

/**
 * The ModelGuide edition Redrob Auto routes on, from Console's `GET /v1/guide`. Read live rather than
 * bundled, so the ranking shown is the one this window's requests are routed by. Null when Console
 * cannot be reached; the dialog says so.
 */
export function loadModelGuide(): Promise<GuideEditionResponse | null> {
  const fetchImpl = (isTauri() ? tauriFetch : fetch) as typeof fetch
  return fetchGuide(REDROB_CONSOLE_API_BASE, fetchImpl)
}

/**
 * Fetches the route labeller's model once the window is idle after launch, when a Redrob connection
 * is configured; nobody without one pays for the download. See route-labels.ts.
 */
export function prefetchRouteModelForRedrob(): void {
  if (!aiModelSettings.value.connections.some((connection) => connection.providerID === 'redrob')) {
    return
  }
  const fetchImpl = (isTauri() ? tauriFetch : fetch) as typeof fetch
  const start = () => prefetchRouteModel(fetchImpl)
  if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 10_000 })
  else setTimeout(start, 5_000)
}
