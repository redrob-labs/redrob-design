import { describe, expect, test } from 'bun:test'

import { createEditor } from '@redrob-design/core/editor'

import {
  beginChangeTurn,
  changeSetFor,
  finishChangeTurn,
  putBackChanges
} from '@/app/assistant/changes/store'
import { reviewPage } from '@/app/review/findings'

/**
 * Budgets for the work every answer and every Describe entry adds: two page
 * snapshots and a diff per answer, a node-scoped restore for Put it back,
 * and the free page check. Generous so a loaded CI machine passes; the
 * timings are printed for the PR.
 */
const NODE_COUNT = 3_000
const BUDGET_MS = { snapshotAndDiff: 1_500, restore: 1_500, review: 1_500 }

function bigPage() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  for (let card = 0; card < NODE_COUNT / 10; card++) {
    const frame = editor.graph.createNode('FRAME', pageId, {
      name: `Card ${card}`,
      layoutMode: 'VERTICAL',
      itemSpacing: 13,
      x: card * 10,
      width: 200,
      height: 120
    })
    for (let child = 0; child < 9; child++) {
      editor.graph.createNode('TEXT', frame.id, {
        name: `Line ${child}`,
        text: 'Copy',
        fontSize: 11
      })
    }
  }
  return { editor, pageId }
}

function time<T>(run: () => T): { value: T; ms: number } {
  const started = performance.now()
  const value = run()
  return { value, ms: performance.now() - started }
}

describe('assistant work stays within budget on a 3,000-layer page', () => {
  test('snapshot, diff, restore and review', () => {
    const { editor, pageId } = bigPage()
    const firstCard = editor.graph.getNode(pageId)?.childIds[0] ?? ''

    const diff = time(() => {
      beginChangeTurn(editor)
      editor.graph.updateNode(firstCard, { name: 'Pricing' })
      finishChangeTurn(editor, 'bench')
      return changeSetFor('bench')
    })
    expect(diff.value?.items).toHaveLength(1)
    expect(diff.value?.scope.size).toBe(1)

    const restore = time(() => putBackChanges('bench'))
    expect(editor.graph.getNode(firstCard)?.name).toBe('Card 0')

    const review = time(() => reviewPage(editor.graph, pageId))
    expect(review.value.findings.length).toBeGreaterThan(0)

    console.info(
      `[benchmark] ${NODE_COUNT} layers: one answer's change set ${diff.ms.toFixed(0)} ms, ` +
        `restore ${restore.ms.toFixed(0)} ms, review ${review.ms.toFixed(0)} ms`
    )
    expect(diff.ms).toBeLessThan(BUDGET_MS.snapshotAndDiff)
    expect(restore.ms).toBeLessThan(BUDGET_MS.restore)
    expect(review.ms).toBeLessThan(BUDGET_MS.review)
  })
})
