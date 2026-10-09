import type { LabeledSession, LabelingApp } from '@redrob-labs/work-labeller'

/** Redrob Design as the Console's insights know it (console `insights/reference.ts`: `design`). */
export const DESIGN_LABELING_APP: LabelingApp = {
  toolKey: 'design',
  idPrefix: 'dz_',
  labelerId: 'design',
  labelerVersion: '1'
}

/** The highest mode Design reports: Iterate. */
export const DESIGN_MAX_MODE = 3

/**
 * The session as Design sends it.
 *
 * The Console's tool table marks `design` as `agentic: false, orchestrates: false`: it may not run
 * Delegate (4) or Orchestrate (5). Its ingest does not refuse a higher mode, it stores it, and then
 * a non-agentic tool would show delegated work and agent figures the Console says it cannot have.
 * Design has no subagents; a long tool loop is still one person iterating with one assistant. So a
 * session the shared rules call 4 or 5 is labeled by the produced-output rule instead (Iterate at
 * three messages or more, Draft below), and the `agent` block is dropped.
 */
export function toDesignSession(session: LabeledSession): LabeledSession {
  const rest: LabeledSession = { ...session }
  delete rest.agent
  if (session.mode <= DESIGN_MAX_MODE) return rest
  // Modes 4 and 5 always produced something, so the produced-output rule applies.
  return { ...rest, mode: session.turns >= 3 ? DESIGN_MAX_MODE : 2 }
}
