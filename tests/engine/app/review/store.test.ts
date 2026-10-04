import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@redrob-design/core/editor'

import { isReviewData, reviewPage } from '@/app/review/findings'
import {
  fixFindings,
  isSettled,
  openFindings,
  openingReview,
  reviewMessage,
  settledFindings
} from '@/app/review/store'

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const card = editor.graph.createNode('FRAME', pageId, {
    name: 'Card',
    layoutMode: 'VERTICAL',
    itemSpacing: 13,
    width: 200,
    height: 100
  })
  editor.graph.createNode('TEXT', card.id, { name: 'Caption', text: 'Fine print', fontSize: 9 })
  return { editor, pageId, card }
}

afterEach(() => settledFindings.clear())

describe('page review', () => {
  test('finds problems on the page, most serious first, with where they are', () => {
    const { editor, pageId } = setup()
    const review = reviewPage(editor.graph, pageId)
    expect(review.frameCount).toBe(1)
    expect(review.findings.length).toBeGreaterThan(0)
    const order = { high: 0, medium: 1, low: 2 }
    const ranks = review.findings.map((finding) => order[finding.severity])
    expect(ranks).toEqual(ranks.toSorted((a, b) => a - b))
    expect(review.findings.find((finding) => finding.ruleId === 'min-text-size')?.where).toBe(
      'Card / Caption'
    )
    expect(isReviewData(structuredClone(review))).toBe(true)
    expect(isReviewData({ pageId, findings: 'none' })).toBe(false)
  })

  test('Fix settles one finding and Fix all the rest, each as one undo step', () => {
    const { editor, pageId, card } = setup()
    const review = reviewPage(editor.graph, pageId)
    const spacing = review.findings.find((finding) => finding.ruleId === 'consistent-spacing')
    if (!spacing) throw new Error('expected a spacing finding')

    expect(fixFindings(editor, 'm1', review, [spacing])).toBe(1)
    expect(editor.graph.getNode(card.id)?.itemSpacing).toBe(12)
    expect(isSettled('m1', spacing.id)).toBe(true)

    const rest = openFindings('m1', review)
    const fixed = fixFindings(editor, 'm1', review, rest)
    expect(fixed).toBe(rest.filter((finding) => finding.fix).length)

    editor.undoAction()
    editor.undoAction()
    expect(editor.graph.getNode(card.id)?.itemSpacing).toBe(13)
  })

  test('opens once per change to the page and never for an empty page', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    expect(openingReview(editor, editor.graph, pageId, 1)).toBeNull()

    editor.graph.createNode('FRAME', pageId, { name: 'Frame 1' })
    expect(openingReview(editor, editor.graph, pageId, 2)).not.toBeNull()
    expect(openingReview(editor, editor.graph, pageId, 2)).toBeNull()
    expect(openingReview(editor, editor.graph, pageId, 3)).not.toBeNull()
  })

  test('the message says what was checked and carries the findings', () => {
    const { editor, pageId } = setup()
    const review = reviewPage(editor.graph, pageId)
    const message = reviewMessage(review, 'Pricing', {
      checked: (name, count) => `Checked ${name}: ${count}`,
      checkedClean: (name) => `Checked ${name}: clean`
    })
    expect(message.role).toBe('assistant')
    expect(message.parts[0]).toEqual({
      type: 'text',
      text: `Checked Pricing: ${review.findings.length}`
    })
    expect(message.parts[1]).toEqual({ type: 'data-review', data: review })
  })
})
