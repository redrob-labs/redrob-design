import { onScopeDispose, ref } from 'vue'

import { IS_TAURI } from '@/constants'

/**
 * The desktop window's own controls, for the tab bar when the window has no OS
 * title bar (Windows and Linux; see `use_custom_title_bar` in desktop/src/menu.rs).
 *
 * `frameless` is read from the window rather than guessed from the platform, so
 * macOS (decorated, traffic lights) and the browser both get no controls.
 */
export function useDesktopWindow() {
  const frameless = ref(false)
  const maximized = ref(false)
  let stop: (() => void) | undefined
  let disposed = false

  onScopeDispose(() => {
    disposed = true
    stop?.()
  })

  async function connect(): Promise<void> {
    if (!IS_TAURI) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    if (await win.isDecorated()) return
    frameless.value = true
    maximized.value = await win.isMaximized()
    // Maximise and restore arrive as resizes however they happen: the button,
    // a double click on the bar, Win+Up, a drag to the screen edge.
    const refresh = async (): Promise<void> => {
      maximized.value = await win.isMaximized()
    }
    const unlisten = await win.onResized(() => void refresh())
    if (disposed) unlisten()
    else stop = unlisten
  }
  void connect()

  async function run(action: 'minimize' | 'toggleMaximize' | 'close'): Promise<void> {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow()[action]()
  }

  return {
    frameless,
    maximized,
    minimize: () => run('minimize'),
    toggleMaximize: () => run('toggleMaximize'),
    close: () => run('close')
  }
}
