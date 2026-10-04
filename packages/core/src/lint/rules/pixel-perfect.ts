import { defineRule } from '#core/lint/rule'
import type { LintFixField } from '#core/lint/types'
import { fixFields } from '#core/lint/utils'

export default defineRule({
  meta: {
    id: 'pixel-perfect',
    category: 'layout',
    description: 'Elements should align to whole pixels'
  },
  check(node, context) {
    const values: Array<[LintFixField, number]> = [
      ['x', node.x],
      ['y', node.y],
      ['width', node.width],
      ['height', node.height]
    ]
    const subpixel = values.filter(([, value]) => Math.abs(value - Math.round(value)) >= 0.01)
    if (subpixel.length === 0) return
    context.report({
      node,
      message: `Subpixel values: ${subpixel.map(([k, v]) => `${k}: ${v}`).join(', ')}`,
      suggest: 'Round to whole pixels for crisp rendering',
      fix: fixFields(subpixel.map(([key, value]) => [key, Math.round(value)] as const))
    })
  }
})
