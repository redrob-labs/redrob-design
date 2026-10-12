/**
 * UI-slice stub for `@/app/ai/model-guide`.
 *
 * The real module (PR #89) fetches the live ModelGuide edition from the Redrob
 * Console — the ranked model picks Redrob Auto routes on, per profession / task /
 * language. That is a credentialed backend call and out of a presentation slice.
 *
 * `ModelGuideDialog.vue` calls `loadModelGuide()` once when it opens and renders
 * whatever `GuideEditionResponse` it gets back (or an empty state on reject).
 * This stub returns a small, representative edition so the dialog's selects,
 * ranked list, badges and pricing all render. Swap this module for the real one
 * to reconnect; the dialog does not change.
 */
import type { GuideEditionResponse } from '@redrob-labs/route-labeller'

const SAMPLE: GuideEditionResponse = {
  asOf: '2026-09-01',
  models: {
    'auto-flagship': 'Redrob Auto (flagship)',
    'auto-balanced': 'Redrob Auto (balanced)',
    'auto-fast': 'Redrob Auto (fast)'
  },
  professions: [
    {
      id: 'design',
      label: { en: 'Product design', ko: '제품 디자인' },
      tasks: [
        {
          id: 'ui-exploration',
          label: { en: 'UI exploration', ko: 'UI 탐색' },
          picks: {
            en: [
              {
                id: 'p1',
                rank: 1,
                kind: 'single',
                monthly: 24,
                steps: [{ model: 'auto-balanced', effort: 'medium' }],
                sources: [{ label: 'Benchmark', value: 'DesignBench 92', url: 'https://example.com' }]
              },
              {
                id: 'p2',
                rank: 2,
                kind: 'cascade',
                monthly: 48,
                steps: [
                  { model: 'auto-fast', effort: 'low' },
                  { model: 'auto-flagship', effort: 'high' }
                ],
                sources: [{ label: 'Benchmark', value: 'DesignBench 95' }]
              }
            ]
          }
        }
      ]
    }
  ]
}

/** Returns the current ModelGuide edition. The stub resolves with sample data. */
export function loadModelGuide(): Promise<GuideEditionResponse> {
  return Promise.resolve(SAMPLE)
}
