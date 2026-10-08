import { fetchGuide, type GuideEditionResponse } from '@redrob-labs/route-labeller'

import { REDROB_CONSOLE_API_BASE } from '@redrob-design/core/constants'

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
