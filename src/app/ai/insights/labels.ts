/*
 * Structural labels for one finished AI session in Redrob Design, for the Redrob Console's insights.
 *
 * The rules follow Cowork's structural labeler (redrob-cowork apps/server/src/insights/labeler.ts) and
 * Office's, so a session reads the same in every Redrob app. Only counts, flags and times go in: what
 * the person wrote, what the model wrote and the file itself never reach this module. What only
 * reading the conversation could tell (the kind of work, whether the first message said what done
 * looks like) is left out, as Cowork leaves it out until a work classifier passes its evaluation.
 */

export const LABELER_ID = 'design-structural'
export const LABELER_VERSION = '1'

/** A session ends after this long with nothing happening, the window Cowork and Office use. */
export const SESSION_QUIET_MS = 15 * 60_000

/** Tool calls per message above which the agent did the work, as Cowork counts it. */
const DELEGATED_STEPS_PER_TURN = 6
/** A gap between an answer and the next message counts at most this towards attention. */
const ATTENTION_CAP_MIN = 10

export type InsightFact =
  /** The person sent a message. `context`: a file or an image went with it. */
  | { kind: 'message'; context: boolean }
  /** A tool ran. `changed`: it changed the canvas. */
  | { kind: 'tool'; changed: boolean }
  | { kind: 'answer' }
  | { kind: 'stopped' }

export type SessionTally = {
  sessionId: string
  startedAt: number
  lastAt: number
  messages: number
  firstWithContext: boolean
  tools: number
  changes: number
  stopped: number
  redirected: number
  busyMinutes: number
  attentionMinutes: number
  lastMessageAt: number | null
  lastAnswerAt: number | null
  lastWasStop: boolean
}

export type LabeledSession = {
  externalId: string
  startedAt: string
  toolKey: 'design'
  mode: number
  producedOutput: boolean
  brief: boolean
  context: boolean
  checked: boolean
  steerApplicable: boolean
  steered: boolean
  outward: boolean
  sensitiveTouched: boolean
  sensitiveOk: boolean
  turns: number
  agent?: {
    actions: number
    instructions: number
    agentMinutes: number
    attentionMinutes: number
    autoApproved: boolean
    interrupted: boolean
    agentsAtOnce: number
    humanEquivHours: number
  }
  labelerId: string
  labelerVersion: string
}

export function newTally(sessionId: string, at: number): SessionTally {
  return {
    sessionId,
    startedAt: at,
    lastAt: at,
    messages: 0,
    firstWithContext: false,
    tools: 0,
    changes: 0,
    stopped: 0,
    redirected: 0,
    busyMinutes: 0,
    attentionMinutes: 0,
    lastMessageAt: null,
    lastAnswerAt: null,
    lastWasStop: false
  }
}

const minutes = (ms: number) => Math.max(0, ms) / 60_000

export function addFact(t: SessionTally, fact: InsightFact, at: number): void {
  t.lastAt = Math.max(t.lastAt, at)
  switch (fact.kind) {
    case 'message':
      if (t.messages === 0) t.firstWithContext = fact.context
      t.messages += 1
      if (t.lastWasStop) t.redirected += 1
      if (t.lastAnswerAt !== null) {
        t.attentionMinutes += Math.min(ATTENTION_CAP_MIN, minutes(at - t.lastAnswerAt))
      }
      t.lastMessageAt = at
      t.lastWasStop = false
      break
    case 'tool':
      t.tools += 1
      if (fact.changed) t.changes += 1
      break
    case 'answer':
      if (t.lastMessageAt !== null) t.busyMinutes += minutes(at - t.lastMessageAt)
      t.lastAnswerAt = at
      t.lastWasStop = false
      break
    case 'stopped':
      t.stopped += 1
      if (t.lastMessageAt !== null) t.busyMinutes += minutes(at - t.lastMessageAt)
      t.lastWasStop = true
      break
  }
}

/**
 * The mode, by Crew's definitions as Cowork applies them. Design runs one agent at a time, so it
 * never reaches 5 (Orchestrate).
 */
export function modeOf(t: SessionTally): number {
  const produced = t.changes > 0
  if (produced && t.messages > 0 && t.tools / t.messages >= DELEGATED_STEPS_PER_TURN) return 4
  if (produced) return t.messages >= 3 ? 3 : 2
  return t.messages >= 2 ? 1 : 0
}

const round2 = (v: number) => Math.round(v * 100) / 100

export function labelSession(t: SessionTally): LabeledSession {
  const mode = modeOf(t)
  return {
    externalId: t.sessionId,
    startedAt: new Date(t.startedAt).toISOString().replace(/\.\d+Z$/, 'Z'),
    toolKey: 'design',
    mode,
    producedOutput: t.changes > 0,
    // Needs the work classifier, which reads the first message on this machine.
    brief: false,
    context: t.firstWithContext,
    // A review or a second model's check is not part of this chat; it is not seen here yet.
    checked: false,
    steerApplicable: t.stopped > 0 || (mode >= 3 && t.messages >= 3),
    steered: t.redirected > 0,
    // The agent changes the canvas on this computer; it sends nothing to anyone.
    outward: false,
    // The privacy redactor does not report what a send touched yet.
    sensitiveTouched: false,
    sensitiveOk: false,
    turns: t.messages,
    ...(mode >= 4
      ? {
          agent: {
            actions: t.tools,
            instructions: Math.max(1, t.messages),
            agentMinutes: round2(Math.min(100_000, t.busyMinutes)),
            attentionMinutes: round2(Math.min(100_000, t.attentionMinutes)),
            // The agent asks no permission for a step.
            autoApproved: true,
            interrupted: t.stopped > 0,
            agentsAtOnce: 1,
            // Crew's "work done by agents" needs the kind of work's baseline; the console estimates it.
            humanEquivHours: 0
          }
        }
      : {}),
    labelerId: LABELER_ID,
    labelerVersion: LABELER_VERSION
  }
}
