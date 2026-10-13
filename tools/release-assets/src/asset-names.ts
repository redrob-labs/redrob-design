/**
 * Release asset names Redrob Launcher can install.
 *
 * The launcher installs a GitHub release asset only when its name reads
 *
 *     <stem>-<version>-<os>-<arch>[-portable].<ext>
 *
 * with `redrob-design` as the stem, the version without a leading `v`, one of a fixed set of os-arch
 * tokens, and one of a fixed set of installable extensions. Tauri names its bundles from productName
 * (`Redrob.Design_0.15.0_aarch64.dmg`), which the launcher cannot read, so the release workflow stages
 * every bundle under one of these names before uploading it -- and this module is the single place
 * that spells them, for the workflow AND for the check that runs before the release is published.
 *
 * `parseLauncherAssetName` mirrors the launcher's own parser (crates/core/src/platform.rs,
 * `parse_asset_name`): the longest matching suffix wins, then `<os>-<arch>` are the last two
 * `-`-separated parts and the version is everything between the stem and them. Kept in step by hand,
 * since the two repositories share no code.
 */

export const RELEASE_ASSET_STEM = 'redrob-design'

/** os-arch tokens the launcher looks for, in the spelling it looks for them. */
export const LAUNCHER_TOKENS = [
  'linux-x86_64',
  'linux-aarch64',
  'macos-universal',
  'macos-aarch64',
  'macos-x86_64',
  'windows-x64',
  'windows-arm64',
  'windows-x86',
  'freebsd-x86_64'
] as const

export type LauncherToken = (typeof LAUNCHER_TOKENS)[number]

/** Longest suffix first, so `-portable.zip` is tried before anything that could shadow it. */
export const INSTALLABLE_SUFFIXES = [
  '-portable.zip',
  '.AppImage',
  '.flatpak',
  '.tar.gz',
  '.msi',
  '.dmg',
  '.deb',
  '.rpm'
] as const

export type InstallableSuffix = (typeof INSTALLABLE_SUFFIXES)[number]

/**
 * Files the release carries beside the installable ones, by the suffix that follows
 * `<stem>-<version>-<os>-<arch>`. The launcher ignores them; the check tolerates exactly these.
 */
export const COMPANION_SUFFIXES = ['-setup.exe'] as const

export interface LauncherAssetName {
  stem: string
  version: string
  token: LauncherToken
  suffix: InstallableSuffix
}

/** Loose semver: digits first, then whatever the version carries (pre-release, build). */
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

export function isLauncherToken(value: string): value is LauncherToken {
  return (LAUNCHER_TOKENS as readonly string[]).includes(value)
}

/** The name the launcher would read, or null when it would skip the file. */
export function parseLauncherAssetName(
  name: string,
  stem: string = RELEASE_ASSET_STEM
): LauncherAssetName | null {
  const suffix = INSTALLABLE_SUFFIXES.find((candidate) => name.endsWith(candidate))
  if (!suffix) return null
  const base = name.slice(0, -suffix.length)
  if (!base.startsWith(`${stem}-`)) return null
  const rest = base.slice(stem.length + 1)
  const parts = rest.split('-')
  if (parts.length < 3) return null
  const arch = parts.pop() as string
  const os = parts.pop() as string
  const version = parts.join('-')
  const token = `${os}-${arch}`
  if (!isLauncherToken(token)) return null
  if (!VERSION.test(version)) return null
  return { stem, version, token, suffix }
}

export interface AssetNameInput {
  version: string
  token: LauncherToken
  suffix: InstallableSuffix | (typeof COMPANION_SUFFIXES)[number]
  stem?: string
}

/** The one spelling of a release asset name; the workflow stages files under exactly this. */
export function releaseAssetName(input: AssetNameInput): string {
  const stem = input.stem ?? RELEASE_ASSET_STEM
  const version = input.version.replace(/^v/, '')
  if (!VERSION.test(version)) throw new Error(`Not a release version: ${input.version}`)
  return `${stem}-${version}-${input.token}${input.suffix}`
}

export interface Requirement {
  token: LauncherToken
  suffixes: InstallableSuffix[]
}

export interface CheckResult {
  /** Files the launcher would install, by name. */
  installable: string[]
  /** Files the launcher ignores but the release is allowed to carry. */
  companions: string[]
  errors: string[]
}

/**
 * Judge a set of file names about to become the release's assets.
 *
 * Every file must either parse as an installable asset of `version` or be a known companion of one.
 * Every requirement -- a platform and the kinds it must ship -- must be satisfied. Anything else is an
 * error, listed in full so one run names every problem.
 */
export function checkReleaseAssets(
  names: readonly string[],
  version: string,
  requirements: readonly Requirement[],
  stem: string = RELEASE_ASSET_STEM
): CheckResult {
  const expected = version.replace(/^v/, '')
  const installable: string[] = []
  const companions: string[] = []
  const errors: string[] = []
  const present = new Set<string>()

  for (const name of names) {
    const parsed = parseLauncherAssetName(name, stem)
    if (parsed) {
      if (parsed.version !== expected) {
        errors.push(`${name}: version ${parsed.version} is not the release version ${expected}`)
        continue
      }
      installable.push(name)
      present.add(`${parsed.token}${parsed.suffix}`)
      continue
    }
    const companion = COMPANION_SUFFIXES.find((suffix) => {
      if (!name.endsWith(suffix)) return false
      const base = name.slice(0, -suffix.length)
      const prefix = `${stem}-${expected}-`
      return base.startsWith(prefix) && isLauncherToken(base.slice(prefix.length))
    })
    if (companion) {
      companions.push(name)
      continue
    }
    errors.push(
      `${name}: Redrob Launcher cannot read this name. Expected ${stem}-${expected}-<os>-<arch><ext> ` +
        `with <os>-<arch> one of ${LAUNCHER_TOKENS.join(', ')} and <ext> one of ${INSTALLABLE_SUFFIXES.join(', ')}.`
    )
  }

  for (const requirement of requirements) {
    for (const suffix of requirement.suffixes) {
      if (!present.has(`${requirement.token}${suffix}`)) {
        errors.push(
          `missing ${releaseAssetName({ version: expected, token: requirement.token, suffix, stem })}`
        )
      }
    }
  }

  return { installable, companions, errors }
}

/** `linux-x86_64:.AppImage,.deb` -> a Requirement; the CLI's spelling of one. */
export function parseRequirement(spec: string): Requirement {
  const [token, kinds] = spec.split(':')
  if (!token || !kinds)
    throw new Error(`Requirement must read <os>-<arch>:<ext>[,<ext>], got: ${spec}`)
  if (!isLauncherToken(token)) {
    throw new Error(
      `${token} is not a token Redrob Launcher looks for (${LAUNCHER_TOKENS.join(', ')})`
    )
  }
  const suffixes = kinds.split(',').map((kind) => {
    const suffix = kind.startsWith('.') || kind.startsWith('-') ? kind : `.${kind}`
    if (!(INSTALLABLE_SUFFIXES as readonly string[]).includes(suffix)) {
      throw new Error(
        `${kind} is not an extension Redrob Launcher installs (${INSTALLABLE_SUFFIXES.join(', ')})`
      )
    }
    return suffix as InstallableSuffix
  })
  return { token, suffixes }
}
