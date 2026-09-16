/**
 * The overlay CLI, as a module whose IMPORT runs it.
 *
 * The architecture gate requires scripts/ to hold nothing but `#!/usr/bin/env bun` and a bare
 * `import '../tools/…'`, so the shim cannot call a function. The effect therefore has to happen on
 * import, which is what this file is for -- and why it is separate from config-overlay.ts, whose
 * pure functions the tests import without wanting to run anything.
 *
 * The first version of this split put the CLI body behind `import.meta.main` inside the pure module.
 * That is false in an imported module, so the shim exited 0 having written nothing: the release built
 * without the overlay and produced no update artefacts, with no failure anywhere to notice.
 */

import { main } from './config-overlay'

await main()
