import { externalIdOf, SessionRecorder } from '@redrob-labs/work-labeller'
import type { Fact, LabeledSession, WorkClassifier } from '@redrob-labs/work-labeller'

import type { AIProviderID } from '@redrob-design/core/constants'

import { DESIGN_LABELING_APP, toDesignSession } from '@/app/ai/insights/app'

/** A session ends after this long with nothing running and nothing sent. */
export const SESSION_QUIET_MS = 15 * 60_000

export type ChatTurn = {
  /** What the person wrote. Read once, by the work classifier, for a session's first message. */
  text: string
  /** The message attached images or referenced nodes. */
  attachedSource: boolean
}

export type ChatFinish = { isAbort: boolean; isError: boolean; isDisconnect: boolean }

export type ToolCallOutcome = { failed: boolean; changedScene: boolean }

export type ChatInsightsOptions = {
  queue: (session: LabeledSession) => Promise<void> | void
  /** The work classifier when its model is ready; null records structural labels only. */
  classifier: () => WorkClassifier | null
  /** A Redrob chat run ended: the moment the work model may start downloading. */
  onRedrobChatFinished?: () => void
  now?: () => number
  newRootID?: () => string
  quietMs?: number
}

type LiveSession = {
  rootID: string
  externalId: string
  recorder: SessionRecorder
  turns: number
  calls: number
  answers: number
  busy: boolean
  lastActivityAt: number
  classifying: Promise<unknown> | null
}

/**
 * Folds one chat per editor tab into AI work-insights sessions.
 *
 * Only chats through the Redrob provider are recorded: OpenRouter, ACP agents and Pi do not go
 * through the Console, so it would have no cost or model to join them to. A session runs from the
 * first message until the chat is reset, its tab closes, or it has been quiet for 15 minutes.
 *
 * Each session has a recorder of its own, so one can end without waiting for the others to go
 * quiet. Facts carry counts and flags only; the first message's text is handed to the classifier
 * and never kept.
 */
export function createChatInsights<Key extends object>(options: ChatInsightsOptions) {
  const now = options.now ?? Date.now
  const newRootID = options.newRootID ?? (() => crypto.randomUUID())
  const quietMs = options.quietMs ?? SESSION_QUIET_MS
  const providers = new WeakMap<Key, AIProviderID | null>()
  const live = new Map<Key, LiveSession>()
  const ending = new Set<Promise<void>>()

  function observe(session: LiveSession, fact: Fact): void {
    session.recorder.observe(fact)
    session.lastActivityAt = Math.max(session.lastActivityAt, fact.at)
  }

  async function finish(session: LiveSession): Promise<void> {
    const at = now()
    if (session.busy) {
      session.busy = false
      session.recorder.observe({ kind: 'busy', sessionID: session.rootID, at, busy: false })
    }
    await session.classifying
    await session.recorder.sweep(Number.POSITIVE_INFINITY)
  }

  function retire(key: Key): Promise<void> {
    const session = live.get(key)
    if (!session) return Promise.resolve()
    live.delete(key)
    const done = finish(session)
      .catch(() => undefined)
      .finally(() => ending.delete(done))
    ending.add(done)
    return done
  }

  function start(at: number): LiveSession {
    const rootID = newRootID()
    return {
      rootID,
      externalId: externalIdOf(DESIGN_LABELING_APP, rootID),
      recorder: new SessionRecorder(
        DESIGN_LABELING_APP,
        (labeled) => options.queue(toDesignSession(labeled)),
        quietMs
      ),
      turns: 0,
      calls: 0,
      answers: 0,
      busy: false,
      lastActivityAt: at,
      classifying: null
    }
  }

  /** The provider a tab's chat now runs on. Moving off Redrob ends the tab's session. */
  function bindChat(key: Key, providerID: AIProviderID | null): void {
    providers.set(key, providerID)
    if (providerID !== 'redrob') void retire(key)
  }

  function userTurn(key: Key, turn: ChatTurn): void {
    if (providers.get(key) !== 'redrob') return
    const at = now()
    const current = live.get(key)
    if (current && !current.busy && at - current.lastActivityAt >= quietMs) void retire(key)
    let session = live.get(key)
    if (!session) {
      session = start(at)
      live.set(key, session)
    }
    session.turns += 1
    const messageID = `m${session.turns}`
    observe(session, {
      kind: 'user-turn',
      sessionID: session.rootID,
      messageID,
      at,
      attachedSource: turn.attachedSource
    })
    if (!session.busy) {
      session.busy = true
      observe(session, { kind: 'busy', sessionID: session.rootID, at, busy: true })
    }
    const classifier = session.turns === 1 ? options.classifier() : null
    if (classifier) {
      session.classifying = session.recorder
        .observeFirstMessage(session.rootID, messageID, turn.text, (text) => classifier.label(text))
        .catch(() => false)
    }
  }

  function toolCall(key: Key, outcome: ToolCallOutcome): void {
    const session = live.get(key)
    if (!session) return
    session.calls += 1
    observe(session, {
      kind: 'tool',
      sessionID: session.rootID,
      callID: `c${session.calls}`,
      at: now(),
      status: outcome.failed ? 'error' : 'completed',
      effect: outcome.changedScene ? 'artifact' : 'reads'
    })
  }

  /** The person exported from the tab: output sent outward. */
  function exported(key: Key): void {
    const session = live.get(key)
    if (!session) return
    session.calls += 1
    observe(session, {
      kind: 'tool',
      sessionID: session.rootID,
      callID: `x${session.calls}`,
      at: now(),
      status: 'completed',
      effect: 'sends'
    })
  }

  function chatFinished(key: Key, event: ChatFinish): void {
    const session = live.get(key)
    if (!session) return
    const at = now()
    if (event.isAbort) observe(session, { kind: 'aborted', sessionID: session.rootID, at })
    else if (!event.isError && !event.isDisconnect) {
      session.answers += 1
      observe(session, {
        kind: 'assistant-done',
        sessionID: session.rootID,
        messageID: `a${session.answers}`,
        at
      })
    }
    if (session.busy) {
      session.busy = false
      observe(session, { kind: 'busy', sessionID: session.rootID, at, busy: false })
    }
    options.onRedrobChatFinished?.()
  }

  /** Ends every session quiet for long enough. */
  async function sweep(): Promise<void> {
    const at = now()
    const quiet = [...live].filter(
      ([, session]) => !session.busy && at - session.lastActivityAt >= quietMs
    )
    await Promise.all(quiet.map(([key]) => retire(key)))
  }

  return {
    bindChat,
    userTurn,
    toolCall,
    exported,
    chatFinished,
    sweep,
    /** Reset or tab close. */
    end: retire,
    /** The `x-redrob-session` value while a tab's session runs. */
    sessionID: (key: Key): string | null => live.get(key)?.externalId ?? null,
    /** Waits for sessions being ended to reach the queue. */
    settled: async (): Promise<void> => {
      await Promise.all(ending)
    },
    liveCount: (): number => live.size
  }
}

export type ChatInsights<Key extends object> = ReturnType<typeof createChatInsights<Key>>
