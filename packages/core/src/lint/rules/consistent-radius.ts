import { defineRule } from '#core/lint/rule'
import { nearestInScale } from '#core/lint/utils'

const STEPS = [0, 2, 4, 6, 8, 12, 16, 20, 24, 32]
/** 9999 is the pill radius; it is valid but never the nearest step. */
const SCALE = new Set([...STEPS, 9999])
export default defineRule({
  meta: {
    id: 'consistent-radius',
    category: 'layout',
    description: 'Corner radius should follow the radius scale'
  },
  match: ['RECTANGLE', 'FRAME', 'COMPONENT', 'INSTANCE'],
  check(node, context) {
    if (node.cornerRadius > 0 && !SCALE.has(node.cornerRadius))
      context.report({
        node,
        message: `Corner radius ${node.cornerRadius}px is not in scale`,
        suggest: 'Use a radius token or a scale value',
        fix: { set: { cornerRadius: nearestInScale(node.cornerRadius, STEPS) } }
      })
  }
})
