/**
 * Check a directory of files about to be uploaded as a GitHub release's assets.
 *
 * Usage: bun scripts/check-release-assets.ts <dir> <version> [--require <os>-<arch>:<ext>[,<ext>]]...
 *
 * Exits non-zero when any file carries a name Redrob Launcher cannot read, when any required
 * platform/extension is absent, or when the directory is empty. Runs in the release workflow after
 * every platform job has staged its bundles and BEFORE the release leaves draft, so a renaming mistake
 * in one job fails the release rather than publishing an app the launcher cannot install.
 */

import { readdir } from 'node:fs/promises'

import { checkReleaseAssets, parseRequirement, type Requirement } from './asset-names'

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
  for (const name of result.installable) console.log(`installable  ${name}`)
  for (const name of result.companions) console.log(`companion    ${name}`)
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`::error::${error}`)
    throw new Error(`${result.errors.length} release asset name problem(s)`)
  }
  console.log(
    `${result.installable.length} launcher-installable asset(s) for ${version.replace(/^v/, '')}.`
  )
}
