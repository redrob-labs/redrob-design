import type { NodeChange } from '@redrob-design/kiwi/fig/codec'
import type { DerivedTextGlyph } from '@redrob-design/scene-graph'

/**
 * Resolve Figma derivedTextData.glyphs into scene glyphs.
 * Dropping `rotation` used to flatten path text to axis-aligned scribbles;
 * units are radians (schema `float`, DomeSticker values ≈ -1.75…-0.5).
 */
export function convertFigmaDerivedTextGlyphs(
  derivedTextData: NodeChange['derivedTextData'],
  blobs: Uint8Array[]
): DerivedTextGlyph[] {
  return (derivedTextData?.glyphs ?? [])
    .map((glyph) => {
      if (glyph.commandsBlob === undefined) return null
      return {
        commandsBlob: blobs[glyph.commandsBlob],
        x: glyph.position.x,
        y: glyph.position.y,
        fontSize: glyph.fontSize,
        rotation: glyph.rotation
      }
    })
    .filter((glyph): glyph is NonNullable<typeof glyph> => !!glyph)
}
