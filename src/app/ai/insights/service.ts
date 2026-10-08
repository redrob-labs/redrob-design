/*
 * Runs Design's insights: labels sessions when they go quiet, and sends the outbox to the Redrob
 * Console every ten minutes or so with the Redrob connection's key. See labels.ts for what a
 * session's labels are, and recorder.ts for where the facts come from.
 */
import { useIntervalFn } from '@vueuse/core'

import { REDROB_CONSOLE_API_BASE } from '@redrob-design/core/constants'

import { finishInsightSessions } from '@/app/ai/insights/recorder'
import { insightsOutboxStorage } from '@/app/ai/insights/storage'
import { InsightsOutbox, syncInsights } from '@/app/ai/insights/sync'
import { resolveModelConnectionAPIKey } from '@/app/ai/models/runtime'
import { aiModelSettings } from '@/app/ai/models/store'
import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'

const CHECK_MS = 60_000
const FIRST_SYNC_MS = 60_000
const SYNC_MS = 10 * 60_000
const SYNC_JITTER_MS = 2 * 60_000

let started = false

/** Up to two minutes either way, so a workspace's apps do not all send at once. */
function jitter(): number {
  const [n = 0] = crypto.getRandomValues(new Uint32Array(1))
  return ((n / 0xffffffff) * 2 - 1) * SYNC_JITTER_MS
}

/** The Redrob connection the chat uses, with its key: the console the sessions belong to. */
async function redrobConnection(): Promise<{ apiKey: string; base: string } | null> {
  const connection = aiModelSettings.value.connections.find((c) => c.providerID === 'redrob')
  if (!connection) return null
  const apiKey = await resolveModelConnectionAPIKey(connection.id)
  if (!apiKey) return null
  return { apiKey, base: connection.customBaseURL.trim() || REDROB_CONSOLE_API_BASE }
}

export function startInsights(): void {
  if (started) return
  started = true
  const outbox = new InsightsOutbox(insightsOutboxStorage)
  const settle = (all = false) => {
    try {
      outbox.add(finishInsightSessions(Date.now(), all))
    } catch (error) {
      // A full storage quota costs these sessions, never the person's work.
      console.warn('[insights] could not keep finished sessions:', error)
    }
  }
  let syncing = false
  const sync = async () => {
    if (syncing) return
    syncing = true
    try {
      settle()
      await syncInsights({
        outbox,
        connection: await redrobConnection(),
        fetch: (input, init) => (isTauri() ? tauriFetch(input, init) : fetch(input, init))
      })
    } catch (error) {
      console.warn('[insights] sync failed; trying again next time:', error)
    } finally {
      syncing = false
    }
  }
  useIntervalFn(() => settle(), CHECK_MS)
  const schedule = (delay: number) => {
    setTimeout(() => {
      void sync().finally(() => schedule(SYNC_MS + jitter()))
    }, delay)
  }
  schedule(FIRST_SYNC_MS)
  // Sessions still open when the window closes are finished as they stand, and sent next time.
  addEventListener('pagehide', () => settle(true))
}
