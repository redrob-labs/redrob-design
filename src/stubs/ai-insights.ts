/**
 * UI-slice stub for `@/app/ai/insights`.
 *
 * The real module (PR #89) downloads and runs an on-device ONNX work-classifier,
 * drives an IndexedDB outbox, and syncs session labels to the Redrob Console. All
 * of that is backend/native and lives outside a presentation slice.
 *
 * `WorkModelStatus.vue` consumes exactly one thing from it: a reactive
 * `workModel.state` whose shape it switches on to render a status line. This stub
 * reproduces that surface with a plain `shallowRef` so the component renders and
 * typechecks. The state is settable from the showcase to exercise every branch.
 */
import { shallowRef } from 'vue'

/** The classifier model's lifecycle, mirrored verbatim from the real module. */
export type WorkModelState =
  | { status: 'unavailable' }
  | { status: 'absent' }
  | { status: 'downloading'; percent: number }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'failed'; reason: string; retryAt: number }

/**
 * Browser builds never download the model, so the real module reports
 * `unavailable` here. The showcase can reassign `workModel.state.value` to any
 * variant above to preview the other states.
 */
export const workModel = {
  state: shallowRef<WorkModelState>({ status: 'unavailable' })
}
