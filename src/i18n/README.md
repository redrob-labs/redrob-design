# UI copy — translated locales

These JSON files are the **real, translated UI strings** PR #89 added for the
three surfaces this slice ports:

- `ai.json` — model settings, Model Guide, chat
- `insights.json` — the work-model status copy
- `menu.json` — the application menu

Nine locales are included — `de`, `es`, `fr`, `it`, `ja`, `ko`, `pl`, `ru`,
`zh-cn` — exactly the files PR #89 touched (the English base lives inline in the
message definitions). They are copied verbatim from
`redrob-labs/redrob-design` `packages/vue/src/i18n/locales/<locale>/`.

**How they relate to the running slice.** The full app resolves these through a
`@nanostores/i18n` catalogue. This slice does not reimplement that engine — the
i18n stub (`src/stubs/i18n.ts`, aliased as `@redrob-design/vue`) returns the
English defaults as reactive refs, which is all the components need to render.
These JSON files are therefore kept as **reference UI copy**: they preserve the
translation work from PR #89 and document the exact strings, and a future
reconnection to the real i18n engine would load them directly. Nothing in the
build imports them, so they never affect typecheck or bundle size.

Provenance: redrob-labs/redrob-design PR #89 (feat/design-consolidation).
