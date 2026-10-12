/**
 * `@redrob-labs/route-labeller` stub.
 *
 * In the full app this is a published package (unpublished at the time of PR
 * #89 — the known install blocker). The ModelGuideDialog only needs its
 * `GuideEditionResponse` type, reproduced here from the component's usage so the
 * dialog typechecks and can render a loaded or empty guide.
 */

export interface GuidePickStep {
  model: string
  effort?: string
}

export interface GuidePickSource {
  label: string
  value: string
  url?: string
}

export interface GuidePick {
  id: string
  rank: number
  kind: string
  monthly: number
  steps: GuidePickStep[]
  sources: GuidePickSource[]
}

export interface GuideTask {
  id: string
  label: { en: string; ko: string }
  picks: { en: GuidePick[]; ko?: GuidePick[]; hi?: GuidePick[] }
}

export interface GuideProfession {
  id: string
  label: { en: string; ko: string }
  tasks: GuideTask[]
}

export interface GuideEditionResponse {
  asOf: string
  models: Record<string, string>
  professions: GuideProfession[]
}
