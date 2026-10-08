import type { UIMessage } from 'ai'
import { shallowReactive } from 'vue'

import type { PageSnapshot } from '@redrob-design/core/editor'
import { applyLintFix } from '@redrob-design/core/lint'
import type { SceneGraph } from '@redrob-design/scene-graph'

import { reviewPage, type ReviewData, type ReviewFinding } from './findings'

/** The part of an editor store fixing needs. */
export interface FixTarget {
  graph: SceneGraph
  snapshotPage(pageId?: string): PageSnapshot
  restoreNodes(from: PageSnapshot, to: PageSnapshot, pageId: string): void
  pushUndoEntry(entry: { label: string; forward(): void; inverse(): void }): void
}

/** Findings settled by a Fix, as `<message id>/<finding id>`. */
export const settledFindings = shallowReactive(new Set<string>())

function settledKey(messageId: string, findingId: string): string {
  return `${messageId}/${findingId}`
}

export function isSettled(messageId: string, findingId: string): boolean {
  return settledFindings.has(settledKey(messageId, findingId))
}

export function openFindings(messageId: string, review: ReviewData): ReviewFinding[] {
  return review.findings.filter((finding) => !isSettled(messageId, finding.id))
}

/**
 * Applies the fixes of the given findings as one undo step and marks them
 * settled. Findings without a fix are left open. Returns how many it fixed.
 */
export function fixFindings(
  target: FixTarget,
  messageId: string,
  review: ReviewData,
  findings: readonly ReviewFinding[]
): number {
  const fixable = findings.filter((finding) => finding.fix && !isSettled(messageId, finding.id))
  if (fixable.length === 0) return 0
  const { pageId } = review
  const before = target.snapshotPage(pageId)
  const fixed: ReviewFinding[] = []
  for (const finding of fixable) {
    const applied = applyLintFix(target.graph, {
      ruleId: finding.ruleId,
      severity: 'warning',
      message: finding.detail,
      nodeId: finding.nodeId,
      nodeName: finding.nodeName,
      nodePath: [],
      fix: finding.fix
    })
    if (applied) fixed.push(finding)
  }
  if (fixed.length === 0) return 0
  const after = target.snapshotPage(pageId)
  // Lays the page out again and repaints; the graph already holds `after`.
  target.restoreNodes(before, after, pageId)
  target.pushUndoEntry({
    label: `Fix ${messageId}`,
    forward: () => target.restoreNodes(before, after, pageId),
    inverse: () => target.restoreNodes(after, before, pageId)
  })
  for (const finding of fixed) settledFindings.add(settledKey(messageId, finding.id))
  return fixed.length
}

/** The words of a review message, in the reader's language. */
export interface ReviewWords {
  checked: (name: string, count: number) => string
  checkedClean: (name: string) => string
}

let reviewCount = 0

/** The assistant message that reports a page check: one sentence and the findings. */
export function reviewMessage(
  review: ReviewData,
  documentName: string,
  words: ReviewWords
): UIMessage {
  const text =
    review.findings.length > 0
      ? words.checked(documentName, review.findings.length)
      : words.checkedClean(documentName)
  return {
    id: `review-${Date.now()}-${++reviewCount}`,
    role: 'assistant',
    parts: [
      { type: 'text', text },
      { type: 'data-review', data: review }
    ]
  }
}

/** The scene version each page was last checked at, per editor. */
const checkedAt = new WeakMap<object, Map<string, number>>()

/**
 * The opening check in Describe. Null when the page is empty or has not
 * changed since it was last checked, so switching modes does not repeat it.
 */
export function openingReview(
  owner: object,
  graph: SceneGraph,
  pageId: string,
  sceneVersion: number
): ReviewData | null {
  const pages = checkedAt.get(owner) ?? new Map<string, number>()
  checkedAt.set(owner, pages)
  if (pages.get(pageId) === sceneVersion) return null
  const review = reviewPage(graph, pageId)
  if (review.frameCount === 0) return null
  pages.set(pageId, sceneVersion)
  return review
}
