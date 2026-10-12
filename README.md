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
assets. Everything the original UI reached into — the AI engine, provider
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

## Layout

| Path | What it is |
|---|---|
| `src/components/` | The UI components ported from PR #89 |
| `src/theme/` | Tailwind-variants token maps for those components |
| `src/stubs/` | Documented stand-ins for every backend / shared-foundation seam |
| `src/i18n/` | UI copy (message defaults) used by the components |
| `public/` | Brand assets: favicons, app icon, launch splash |

## Running

```sh
bun install   # or npm/pnpm install
bun run dev   # vite dev server
bun run typecheck
bun run storybook
```

## Provenance & scope

This is a derivative UI extraction for design/engineering reference. It is
**not** a runnable product — the stubs have no real backend behind them. The
canonical application lives at
[redrob-labs/redrob-design](https://github.com/redrob-labs/redrob-design).
Licensed MIT, matching the upstream repository.
