export { Linter, createLinter } from './linter'
export { applyLintFix, applyLintFixes, fixableMessages } from './fixes'
export { nearestInScale, nearestSpacing } from './utils'
export { defineRule } from './rule'
export { allRules } from './rules'
export { presets, recommended, strict, accessibility, designSystem } from './presets'
export type {
  Rule,
  RuleMeta,
  RuleContext,
  LintNode,
  LintMessage,
  LintFix,
  LintFixField,
  LintResult,
  LintConfig,
  Severity,
  Category
} from './types'
