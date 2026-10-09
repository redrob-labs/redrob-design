import { syncOutbox } from '@redrob-labs/work-labeller'
import type { SessionOutbox, SyncOutcome } from '@redrob-labs/work-labeller'

import type { FetchFunction } from '@/app/http/types'

/** About how often finished sessions are sent. */
export const SYNC_INTERVAL_MS = 10 * 60_000

/** The Redrob key and the Console it belongs to, resolved when a batch is sent. */
export type ConsoleTarget = { key: string; baseUrl: string }

export type InsightsSyncOptions = {
  outbox: SessionOutbox
  /** Null when no Redrob connection has a key. */
  resolveTarget: () => Promise<ConsoleTarget | null>
  fetch: FetchFunction
}

/**
 * Sends the outbox with the package's `syncOutbox`. The key is resolved through the credential
 * resolver at send time and never held between runs. Overlapping runs share one.
 */
export function createInsightsSync(options: InsightsSyncOptions) {
  let running: Promise<SyncOutcome> | null = null

  async function once(): Promise<SyncOutcome> {
    // An empty outbox never touches the credential store.
    if (!(await options.outbox.list()).length) return { status: 'nothing' }
    const target = await options.resolveTarget()
    if (!target) return { status: 'no-key' }
    return syncOutbox(options.outbox, {
      readKey: async () => target.key,
      fetch: (input, init) => options.fetch(input, init),
      baseUrl: target.baseUrl
    })
  }

  function run(): Promise<SyncOutcome> {
    running ??= once()
      .catch((): SyncOutcome => ({ status: 'unreachable' }))
      .finally(() => {
        running = null
      })
    return running
  }

  return { run }
}
