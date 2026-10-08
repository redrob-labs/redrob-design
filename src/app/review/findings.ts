import { createLinter } from '@redrob-design/core/lint'
import type { LintFix, LintMessage } from '@redrob-design/core/lint'
import type { SceneGraph } from '@redrob-design/scene-graph'

/** The preset a file is checked against when it opens in Describe. */
export const REVIEW_PRESET = 'design-system'

export type ReviewSeverity = 'high' | 'medium' | 'low'

/** One thing the check found, as it is kept in the thread. */
export interface ReviewFinding {
  id: string
  ruleId: string
  severity: ReviewSeverity
  nodeId: string
  nodeName: string
  /** Where on the page, from the outermost frame in. */
  where: string
  detail: string
  suggestion?: string
  fix?: LintFix
}

/** A review message's data: what was checked and what it found. */
export interface ReviewData {
  pageId: string
  frameCount: number
  findings: ReviewFinding[]
}

const SEVERITY: Record<LintMessage['severity'], ReviewSeverity> = {
  error: 'high',
  warning: 'medium',
  info: 'low'
}

const SEVERITY_ORDER: Record<ReviewSeverity, number> = { high: 0, medium: 1, low: 2 }

function toFinding(message: LintMessage, index: number): ReviewFinding {
  return {
    id: `${message.ruleId}:${message.nodeId}:${index}`,
    ruleId: message.ruleId,
    severity: SEVERITY[message.severity],
    nodeId: message.nodeId,
    nodeName: message.nodeName,
    // The first path entry is the page; the person already knows which page.
    where: message.nodePath.slice(1).join(' / '),
    detail: message.message,
    suggestion: message.suggest,
    fix: message.fix
  }
}

/** Checks one page on this computer: no AI, no cost. Most serious first. */
export function reviewPage(graph: SceneGraph, pageId: string): ReviewData {
  const page = graph.getNode(pageId)
  const frameCount = page?.childIds.length ?? 0
  const result = createLinter({ preset: REVIEW_PRESET }).lintGraph(graph, [pageId])
  const findings = result.messages
    .map(toFinding)
    .toSorted((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  return { pageId, frameCount, findings }
}

function isSeverity(value: unknown): value is ReviewSeverity {
  return value === 'high' || value === 'medium' || value === 'low'
}

function isFinding(value: unknown): value is ReviewFinding {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'nodeId' in value &&
    typeof value.nodeId === 'string' &&
    'ruleId' in value &&
    typeof value.ruleId === 'string' &&
    'severity' in value &&
    isSeverity(value.severity)
  )
}

/** Review data read back from a stored thread, checked before it is trusted. */
export function isReviewData(value: unknown): value is ReviewData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pageId' in value &&
    typeof value.pageId === 'string' &&
    'frameCount' in value &&
    typeof value.frameCount === 'number' &&
    'findings' in value &&
    Array.isArray(value.findings) &&
    value.findings.every(isFinding)
  )
}
