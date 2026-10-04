import type { Severity } from './types'

type RuleConfig = Severity | { severity: Severity; options?: Record<string, unknown> }
export interface Preset {
  rules: Record<string, RuleConfig>
}

export const recommended: Preset = {
  rules: {
    'no-hardcoded-colors': 'warning',
    'no-default-names': 'info',
    'prefer-auto-layout': 'info',
    'consistent-spacing': 'warning',
    'consistent-radius': 'info',
    'color-contrast': 'error',
    'touch-target-size': 'warning',
    'text-style-required': 'info',
    'min-text-size': 'warning',
    'no-hidden-layers': 'info',
    'no-deeply-nested': 'warning',
    'no-empty-frames': 'info',
    'pixel-perfect': 'info',
    'no-groups': 'info',
    'effect-style-required': 'info',
    'no-mixed-styles': 'warning',
    'no-detached-instances': 'off'
  }
}

export const strict: Preset = {
  rules: Object.fromEntries(
    Object.keys(recommended.rules).map((id) => [id, id === 'color-contrast' ? 'error' : 'warning'])
  )
}
export const accessibility: Preset = {
  rules: {
    'color-contrast': 'error',
    'touch-target-size': 'error',
    'min-text-size': 'error',
    'no-hardcoded-colors': 'off',
    'no-default-names': 'off',
    'prefer-auto-layout': 'off',
    'consistent-spacing': 'off',
    'consistent-radius': 'off',
    'text-style-required': 'off',
    'no-hidden-layers': 'off',
    'no-deeply-nested': 'off',
    'no-empty-frames': 'off',
    'pixel-perfect': 'off',
    'no-groups': 'off',
    'effect-style-required': 'off',
    'no-mixed-styles': 'off',
    'no-detached-instances': 'off'
  }
}
/**
 * Checks a file against a design system: colors and type from tokens, the
 * 4px spacing grid, the radius scale, readable and reachable controls, and
 * whole pixels. Every warning here is one a person can fix in one step.
 */
export const designSystem: Preset = {
  rules: {
    'color-contrast': 'error',
    'no-hardcoded-colors': 'warning',
    'consistent-spacing': { severity: 'warning', options: { base: 4 } },
    'consistent-radius': 'warning',
    'min-text-size': 'warning',
    'touch-target-size': 'warning',
    'text-style-required': 'info',
    'pixel-perfect': 'info'
  }
}

export const presets: Record<string, Preset> = {
  recommended,
  strict,
  accessibility,
  'design-system': designSystem
}
