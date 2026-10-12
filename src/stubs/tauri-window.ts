/**
 * `@/app/tauri/window` stub.
 *
 * The real module talks to the Tauri window API (minimise/maximise/close the
 * native OS window, report framelessness). There is no native window in a
 * browser slice, so this exposes the same `useDesktopWindow()` contract with a
 * `frameless` toggle you can flip in a showcase, and actions that are no-ops
 * (logged) rather than reaching an OS that is not there.
 */
import { readonly, ref } from 'vue'

const frameless = ref(true)
const maximized = ref(false)

export function useDesktopWindow() {
  return {
    frameless: readonly(frameless),
    maximized: readonly(maximized),
    minimize() {
      console.info('[stub] window.minimize')
    },
    toggleMaximize() {
      maximized.value = !maximized.value
    },
    close() {
      console.info('[stub] window.close')
    }
  }
}

/** Showcase helper — lets a demo toggle the frameless chrome on/off. */
export function setFrameless(value: boolean): void {
  frameless.value = value
}
