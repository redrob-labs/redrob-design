/**
 * Check a directory of files about to be uploaded as a GitHub release's assets.
 *
 * Usage: bun scripts/check-release-assets.ts <dir> <version> [--require <os>-<arch>:<ext>[,<ext>]]...
 *
 * Exits non-zero when any file carries a name Redrob Launcher cannot read, when any required
 * platform/extension is absent, when `redrob-launcher.json` is absent or does not say what this app
 * does, or when the directory is empty. Runs in the release workflow after every platform job has
 * staged its bundles and BEFORE the release leaves draft, so a renaming mistake in one job fails the
 * release rather than publishing an app the launcher cannot install.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { checkReleaseAssets, parseRequirement, type Requirement } from './asset-names'
import { checkLauncherManifest, LAUNCHER_MANIFEST_NAME } from './launcher-manifest'

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const positional: string[] = []
  const requirements: Requirement[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg === '--require') {
      const spec = argv[++i]
      if (!spec) throw new Error('--require needs a value')
      requirements.push(parseRequirement(spec))
    } else {
      positional.push(arg)
    }
  }
  const [dir, version] = positional
  if (!dir || !version) {
    throw new Error(
      'Usage: bun scripts/check-release-assets.ts <dir> <version> [--require <os>-<arch>:<ext>[,<ext>]]...'
    )
  }

  const names = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()
  if (names.length === 0) throw new Error(`${dir} holds no files to release`)

  const result = checkReleaseAssets(names, version, requirements)
  const manifest = names.includes(LAUNCHER_MANIFEST_NAME)
    ? await readFile(join(dir, LAUNCHER_MANIFEST_NAME), 'utf8')
    : null
  const errors = [...result.errors, ...checkLauncherManifest(manifest)]
  for (const name of result.installable) console.log(`installable  ${name}`)
  for (const name of result.companions) console.log(`companion    ${name}`)
  if (errors.length > 0) {
    for (const error of errors) console.error(`::error::${error}`)
    throw new Error(`${errors.length} release asset problem(s)`)
  }
  console.log(
    `${result.installable.length} launcher-installable asset(s) for ${version.replace(/^v/, '')}.`
  )
}
