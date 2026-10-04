import { nextTick } from 'vue'

import { askRedrob } from '@/app/ai/chat/ask'
import type { ChatSubmission } from '@/app/ai/chat/submission/types'
import type { EditorStore } from '@/app/editor/active-store'
import { createDocumentInCurrentTab } from '@/app/tabs'

/** Briefs from Home waiting for their new file's Redrob tab to send them. */
const pendingBriefs = new WeakMap<EditorStore, ChatSubmission>()

/**
 * Starts a file from a Home brief: the Home tab becomes the new file, and the
 * brief becomes the first message in its Redrob thread.
 */
export function startBrief(submission: ChatSubmission): EditorStore {
  const tab = createDocumentInCurrentTab()
  pendingBriefs.set(tab.store, submission)
  askRedrob()
  return tab.store
}

/** Takes the brief waiting for this file, once; null when there is none. */
export function takePendingBrief(store: EditorStore): ChatSubmission | null {
  const brief = pendingBriefs.get(store) ?? null
  pendingBriefs.delete(store)
  return brief
}

export function hasPendingBrief(store: EditorStore): boolean {
  return pendingBriefs.has(store)
}

/** A frame size New can start with. Blank has none. */
export interface StartPreset {
  id: 'blank' | 'phone' | 'website' | 'social'
  name: string
  width?: number
  height?: number
}

/** The ways New starts a file, as the prototype lists them. */
export const START_PRESETS: readonly StartPreset[] = [
  { id: 'blank', name: 'Blank' },
  { id: 'phone', name: 'Phone app', width: 402, height: 874 },
  { id: 'website', name: 'Website', width: 1440, height: 1024 },
  { id: 'social', name: 'Social card', width: 1200, height: 630 }
]

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else resolve()
  })
}

/** Opens a new file in the current tab, with one frame of the preset's size. */
export async function startFromPreset(preset: StartPreset, frameName = preset.name): Promise<void> {
  const tab = createDocumentInCurrentTab()
  if (preset.width === undefined || preset.height === undefined) return
  // The canvas sizes itself after mount; the frame is centered in it.
  await nextTick()
  await nextFrame()
  tab.store.createFrameFromPreset({ name: frameName, width: preset.width, height: preset.height })
}
