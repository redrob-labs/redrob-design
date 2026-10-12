/**
 * UI-slice stub for `@/app/shell/command-palette`.
 *
 * The real module owns the command-palette singleton (registry, search, Cmd-K
 * binding). The ported TabBar/MainMenu only ever flip its `open` flag, so this
 * stub exposes just that reactive boolean. Opening the palette is a no-op here.
 */
import { ref } from 'vue'

export const commandPaletteOpen = ref(false)
