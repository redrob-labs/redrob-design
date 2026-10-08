/*
 * One insights session per open document's chat, kept in memory until it goes quiet.
 *
 * The id is random, made for the session and for nothing else, so it is the id the console knows the
 * session by. The chat's requests to the Redrob Console carry it as x-redrob-session (see
 * sessionHeaderFetch), which lets the console join the session to its own record of model and cost.
 */
import {
  addFact,
  labelSession,
  newTally,
  SESSION_QUIET_MS,
  type InsightFact,
  type LabeledSession,
  type SessionTally
} from '@/app/ai/insights/labels'

const byOwner = new WeakMap<object, SessionTally>()
const open = new Set<SessionTally>()
let active: string | null = null

function newSessionId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return `dg_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Records one fact for the chat of `owner` (the editor store the chat belongs to). A new session
 * starts after a quiet stretch, because a conversation picked up later is a new piece of work.
 */
export function recordInsight(owner: object, fact: InsightFact, now = Date.now()): void {
  let tally = byOwner.get(owner)
  if (!tally || now - tally.lastAt > SESSION_QUIET_MS) {
    tally = newTally(newSessionId(), now)
    byOwner.set(owner, tally)
    open.add(tally)
  }
  addFact(tally, fact, now)
  if (fact.kind === 'message') active = tally.sessionId
}

/** The session of the chat that sent the latest message, for x-redrob-session. */
export function activeInsightSession(): string | null {
  return active
}

/** Sessions quiet for the window (or all of them), labeled and let go. One with no message is dropped. */
export function finishInsightSessions(now = Date.now(), all = false): LabeledSession[] {
  const done: LabeledSession[] = []
  for (const tally of open) {
    if (!all && now - tally.lastAt < SESSION_QUIET_MS) continue
    open.delete(tally)
    if (tally.messages > 0) done.push(labelSession(tally))
  }
  return done
}

/** The console accepts 1-128 letters, digits, ".", "_", ":" or "-". */
const SESSION_ID = /^[A-Za-z0-9._:-]{1,128}$/

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/** Adds x-redrob-session to each request, for the provider talking to the Redrob Console. */
export function sessionHeaderFetch(inner: Fetch): Fetch {
  return (input, init) => {
    const session = activeInsightSession()
    if (!session || !SESSION_ID.test(session)) return inner(input, init)
    const headers = new Headers(init?.headers)
    headers.set('x-redrob-session', session)
    return inner(input, { ...init, headers })
  }
}
