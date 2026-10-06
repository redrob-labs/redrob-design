import type { UIMessage } from 'ai'

import { rankedPick } from '@/app/ai/models/ranking/store'
import { assistantControlsFor } from '@/app/assistant/controls/store'
import { setReceipt } from '@/app/assistant/thread/store'
import type { EditorStore } from '@/app/editor/active-store'

import { createTurnAccumulator, type TurnAccumulator, type TurnStep } from './usage'

const accumulators = new WeakMap<EditorStore, TurnAccumulator>()

function accumulatorFor(store: EditorStore): TurnAccumulator {
  let accumulator = accumulators.get(store)
  if (!accumulator) {
    accumulator = createTurnAccumulator()
    accumulators.set(store, accumulator)
  }
  return accumulator
}

/** A new answer starts: forget the steps of the last one. */
export function beginTurn(store: EditorStore): void {
  accumulatorFor(store).reset()
}

export function recordTurnStep(store: EditorStore, step: TurnStep): void {
  accumulatorFor(store).addStep(step)
}

export function recordKeptPrivate(store: EditorStore, count: number): void {
  accumulatorFor(store).setKeptPrivate(count)
}

/** The effort label the person set on a pinned model, or null under Redrob Auto. */
function pinnedEffort(store: EditorStore): { pinned: boolean; effort: string | null } {
  const controls = assistantControlsFor(store)
  const pick = rankedPick(controls.pickId)
  if (!pick) return { pinned: false, effort: null }
  const level = controls.effort ?? pick.effort.level
  return {
    pinned: true,
    effort: pick.efforts?.find((candidate) => candidate.level === level)?.label ?? pick.effort.label
  }
}

/** The answer finished: give it one receipt for every step it took. */
export function finishTurn(store: EditorStore, message: UIMessage | undefined): void {
  if (message?.role !== 'assistant') {
    accumulatorFor(store).reset()
    return
  }
  const receipt = accumulatorFor(store).finish(pinnedEffort(store))
  if (receipt) setReceipt(message.id, receipt)
}
