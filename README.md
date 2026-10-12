# redrob-design — UI/UX slice

A clean, standalone extraction of the **frontend UI/UX** introduced by
[`redrob-labs/redrob-design` PR #89](https://github.com/redrob-labs/redrob-design/pull/89)
(`feat/design-consolidation`). That PR consolidated four features:

- 2026 brand icons, favicons and launch splash
- a desktop tab-bar title bar with window controls (Windows/Linux)
- the Redrob Auto **Model Guide** dialog
- the on-device **AI work-insights** settings status

This repository keeps **only the presentation layer** of that work: Vue
components, their styling (theme token maps), the i18n UI copy, and the brand
assets. The colour theme in [`src/app.css`](src/app.css) is transcribed from
the canonical **Redrob Design System 2026** source
([redrob-labs/redrob-ui](https://github.com/redrob-labs/redrob-ui),
`src/styles/tokens.css`), so the slice stays colour-faithful to the real
product without depending on the design-system package. Everything the original UI reached into — the AI engine, provider
plumbing, local storage, the Tauri native shell, telemetry — has been **removed**
and replaced with small, clearly-labelled **stubs** under
[`src/stubs/`](src/stubs). Each stub documents the real contract it stands in
for, so the components typecheck and render in isolation without any backend.

## What is a stub here?

Every import the components make to `@/app/*` (backend/domain logic) or to the
app's wider shared UI foundation (`@/components/ui/*`, the `@redrob-design/vue`
i18n package, `@redrob-design/core`) is satisfied by a local module in
`src/stubs/`. Stubs are typed and minimally functional — enough to render the UI
and exercise its states — not re-implementations of the backend. They are the
seams where this slice would reconnect to the full application.

## Components ported from PR #89

All eight UI components the PR added or modified are present and build:

| Component | Fidelity |
|---|---|
| `window-controls/WindowControls.vue` | verbatim |
| `settings/insights/WorkModelStatus.vue` | verbatim |
| `chat/ModelGuideDialog.vue` | verbatim |
| `TabBar.vue` + `main-menu/MainMenu.vue` | verbatim |
| `settings/models/ModelsPanel.vue` + `RoleAssignments.vue` | verbatim |
| `settings/models/ProfileEditor.vue` | ported verbatim; backend seams are no-ops |
| `ChatPanel.vue` | **presentational skeleton** |

`ProfileEditor` and `ChatPanel` are the two integration-heavy surfaces: in the
app they are ~90% AI-engine wiring. They are kept as presentational skeletons —
their layout and interaction shape are real, their backend calls resolve to
documented no-ops — rather than re-authoring a fake chat/model engine, which
would be plumbing, not UI/UX.

## Layout

| Path | What it is |
|---|---|
| `src/components/` | The UI components ported from PR #89 + trimmed shared primitives (`ui/`) |
| `src/theme/` | Tailwind-variants token maps for those components |
| `src/stubs/` | Documented stand-ins for every backend / shared-foundation seam |
| `src/i18n/` | Translated UI copy (9 locales) kept as reference — see its README |
| `public/` | Brand assets: favicons, app icons, launch splash |
| `src/App.vue` | A showcase that mounts every component |

## Running

```sh
bun install   # or npm/pnpm install
bun run dev        # vite dev server — the showcase in src/App.vue
bun run typecheck  # vue-tsc --noEmit
bun run build      # vue-tsc + vite production build
```

## Provenance & scope

This is a derivative UI extraction for design/engineering reference. The
components render and the showcase is interactive, but the stubs have **no real
backend** behind them — it is a presentation slice, not the product. The
canonical application lives at
[redrob-labs/redrob-design](https://github.com/redrob-labs/redrob-design).
Licensed MIT, matching the upstream repository.
