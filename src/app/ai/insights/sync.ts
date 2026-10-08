/*
 * The outbox of labeled sessions and its trip to the Redrob Console.
 *
 * Finished sessions wait in localStorage until the console has answered for them, so the labels are
 * there to read before they go. Every ten minutes or so they are posted to the console
 * (POST /insights/sessions) with the key of the Redrob connection, the same key the chat uses.
 * Anything without an answer (no Redrob connection, a refused key, the console out of reach) stays
 * for the next run.
 */
import type { LabeledSession } from '@/app/ai/insights/labels'

const OUTBOX_KEY = 'redrob-design:insights-outbox'
/** Sessions kept while the console is out of reach; the oldest go first past this. */
const OUTBOX_MAX = 2_000
/** The console's limit for one request. */
const BATCH = 500

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>

export class InsightsOutbox {
  constructor(private readonly storage: Storage) {}

  read(): LabeledSession[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(OUTBOX_KEY) ?? '[]')
      return Array.isArray(parsed) ? (parsed as LabeledSession[]) : []
    } catch {
      return []
    }
  }

  add(sessions: readonly LabeledSession[]): void {
    if (!sessions.length) return
    const byId = new Map(this.read().map((s) => [s.externalId, s]))
    for (const s of sessions) byId.set(s.externalId, s)
    this.storage.setItem(OUTBOX_KEY, JSON.stringify([...byId.values()].slice(-OUTBOX_MAX)))
  }

  remove(ids: ReadonlySet<string>): void {
    if (!ids.size) return
    this.storage.setItem(
      OUTBOX_KEY,
      JSON.stringify(this.read().filter((s) => !ids.has(s.externalId)))
    )
  }
}

export type InsightsSyncOutcome =
  | { status: 'sent'; settled: number }
  | { status: 'empty' }
  | { status: 'no-key' }
  | { status: 'refused'; code: number }
  | { status: 'unreachable' }

export async function syncInsights(opts: {
  outbox: InsightsOutbox
  connection: { apiKey: string; base: string } | null
  fetch: (input: string, init: RequestInit) => Promise<Response>
}): Promise<InsightsSyncOutcome> {
  const pending = opts.outbox.read()
  if (!pending.length) return { status: 'empty' }
  if (!opts.connection?.apiKey.trim()) return { status: 'no-key' }
  const { apiKey, base } = opts.connection
  let settled = 0
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH)
    let response: Response
    try {
      response = await opts.fetch(`${base.replace(/\/+$/, '')}/insights/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ sessions: batch })
      })
    } catch {
      return settled ? { status: 'sent', settled } : { status: 'unreachable' }
    }
    // A 200 settles the batch: each session was stored, updated, or refused with a reason that
    // sending it again would not change. Anything else (a key it does not take, or a label an older
    // console does not know yet) keeps everything, as Cowork does, until the console takes it.
    if (!response.ok) return { status: 'refused', code: response.status }
    opts.outbox.remove(new Set(batch.map((s) => s.externalId)))
    settled += batch.length
  }
  return { status: 'sent', settled }
}
