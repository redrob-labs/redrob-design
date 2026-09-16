/**
 * The feed-builder CLI, as a module whose IMPORT runs it. Separate from build-feed.ts for the same
 * reason as config-overlay-cli.ts: the architecture gate allows the root script to be a bare import
 * only, so the effect must happen on import, while the tests import the pure functions and must not
 * trigger it.
 */

import { main } from './build-feed'

await main()
