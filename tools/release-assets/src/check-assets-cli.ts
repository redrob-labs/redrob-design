/**
 * The asset-name check as a module whose IMPORT runs it, for the same reason as the updater CLIs:
 * the architecture gate allows the root script to be a bare import only, so the effect happens on
 * import, while the tests import the pure functions and must not trigger it.
 */

import { main } from './check-assets'

await main()
