/**
 * Write `redrob-launcher.json` into a release staging directory, as a module whose IMPORT does it,
 * for the same reason as check-assets-cli.ts: the architecture gate allows the root script to be a
 * bare import only, so the effect happens on import while the tests import the pure functions.
 *
 * Usage: bun scripts/write-launcher-manifest.ts <dir>
 */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { LAUNCHER_MANIFEST_NAME, launcherManifestText } from './launcher-manifest'

const dir = process.argv[2]
if (!dir) throw new Error('Usage: bun scripts/write-launcher-manifest.ts <dir>')
const path = join(dir, LAUNCHER_MANIFEST_NAME)
await writeFile(path, launcherManifestText())
console.log(`wrote ${path}`)
