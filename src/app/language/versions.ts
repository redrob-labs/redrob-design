import type { SceneGraph } from '@redrob-design/scene-graph'

/** `Pricing (Korean)` is the Korean version of `Pricing`, as `add_language_version` names it. */
const VERSION_NAME = /^(.+) \(([^()]+)\)$/

/**
 * The languages a page ships in: the source language, then every language
 * version beside a top-level frame on it. Empty when there are none.
 */
export function pageLanguages(graph: SceneGraph, pageId: string, source = 'English'): string[] {
  const frames = graph.getChildren(pageId)
  const names = new Set(frames.map((frame) => frame.name))
  const languages: string[] = []
  for (const frame of frames) {
    const match = VERSION_NAME.exec(frame.name)
    if (!match || !names.has(match[1])) continue
    if (!languages.includes(match[2])) languages.push(match[2])
  }
  return languages.length > 0 ? [source, ...languages] : []
}
