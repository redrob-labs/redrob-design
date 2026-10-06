import { describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'
import { unzipSync } from 'fflate'

import { createEditor } from '@redrob-design/core/editor'

import { HANDOFF_DIR, buildHandoff, handoffPrompt, handoffZip } from '@/app/ship/handoff/bundle'

function pricing() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  editor.graph.updateNode(pageId, { name: 'Pricing' })
  const card = editor.graph.createNode('FRAME', pageId, { name: 'Team', width: 240, height: 120 })
  editor.graph.createNode('TEXT', card.id, { name: 'Price', text: '$24 per person' })
  return { editor, pageId }
}

const thread: UIMessage[] = [
  { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'A pricing page for teams' }] },
  { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Drew it.' }] },
  { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'Make Team the default plan' }] }
]

describe('hand-off bundle', () => {
  test('holds the page, its tokens, the brief and the preview', () => {
    const { editor, pageId } = pricing()
    const bundle = buildHandoff({
      graph: editor.graph,
      pageId,
      messages: thread,
      memory: 'Design Memory for Pricing.\nRadii: 8px',
      preview: new Uint8Array([137, 80, 78, 71])
    })
    expect(bundle.slug).toBe('pricing')
    expect(Object.keys(bundle.files).sort()).toEqual([
      'Page.jsx',
      'brief.md',
      'preview.png',
      'tokens.json'
    ])
    const brief = new TextDecoder().decode(bundle.files['brief.md'])
    expect(brief).toContain('# Pricing')
    expect(brief).toContain('> A pricing page for teams')
    expect(brief).toContain('> Make Team the default plan')
    expect(brief).not.toContain('Drew it.')
    expect(brief).toContain('## Still open')
    expect(brief).toContain('Radii: 8px')
    expect(brief).toContain(`\`${HANDOFF_DIR}/pricing/tokens.json\``)
    expect(new TextDecoder().decode(bundle.files['Page.jsx'])).toContain('$24 per person')
    expect(bundle.prompt).toBe('claude "Implement .redrob/handoff/pricing/brief.md"')
  })

  test('says so when there is no brief, memory or preview', () => {
    const { editor, pageId } = pricing()
    const bundle = buildHandoff({
      graph: editor.graph,
      pageId,
      messages: [],
      memory: '',
      preview: null
    })
    const brief = new TextDecoder().decode(bundle.files['brief.md'])
    expect(brief).toContain('No brief was written in the thread.')
    expect(brief).not.toContain('## Design Memory')
    expect(brief).not.toContain('preview.png')
    expect(bundle.files['preview.png']).toBeUndefined()
  })

  test('zips into .redrob/handoff/<slug>/ at the repository root', () => {
    const { editor, pageId } = pricing()
    const bundle = buildHandoff({
      graph: editor.graph,
      pageId,
      messages: thread,
      memory: '',
      preview: null
    })
    const entries = unzipSync(handoffZip(bundle))
    expect(Object.keys(entries).sort()).toEqual([
      '.redrob/handoff/pricing/Page.jsx',
      '.redrob/handoff/pricing/brief.md',
      '.redrob/handoff/pricing/tokens.json'
    ])
    expect(handoffPrompt('x')).toBe('claude "Implement .redrob/handoff/x/brief.md"')
  })
})
