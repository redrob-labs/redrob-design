#!/usr/bin/env bun
/**
 * Build the Tauri v2 update feed (`latest.json`) from the fragments a release produced.
 *
 * The updater plugin fetches ONE json document and picks the entry for the running platform, so the
 * feed can only be assembled after every platform job has finished -- which is why this is its own
 * step rather than part of any single build job.
 *
 * Each build job writes a FRAGMENT naming its own platform, the published file name, and the
 * signature the bundler produced. Fragments rather than name-matching over a directory, because the
 * CDN publish step renames bundles to `redrob-design-<arch>-<version>.<ext>`: the feed has to carry
 * the published URL, so the job that knows the published name is the job that states it.
 *
 * A fragment without a signature is dropped. An entry the app cannot verify hands it an update it
 * must reject, which is worse than that platform having no update available.
 *
 * Usage: bun scripts/build-updater-feed.ts <fragments-dir> <version> <base-url> <output-path>
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Tauri's platform keys are `<os>-<arch>`, not the Rust target triples the build jobs use. */
export const UPDATER_PLATFORMS = ['darwin-aarch64', 'darwin-x86_64', 'linux-x86_64', 'windows-x86_64'] as const

export type UpdaterPlatform = (typeof UPDATER_PLATFORMS)[number]

export interface UpdaterFragment {
  platform: string
  /** File name as published, not as the bundler wrote it. */
  file: string
  /** Base64 minisign signature, as read from the bundler's `.sig`. */
  signature: string
}

export interface UpdaterFeed {
  version: string
  pub_date: string
  platforms: Record<string, { signature: string; url: string }>
}

export interface FeedInput {
  fragments: UpdaterFragment[]
  version: string
  /** Where the files are published; a trailing slash is tolerated. */
  baseUrl: string
  publishedAt: Date
}

export function updaterFeed(input: FeedInput): { feed: UpdaterFeed; skipped: string[] } {
  const platforms: Record<string, { signature: string; url: string }> = {}
  const skipped: string[] = []
  const base = input.baseUrl.replace(/\/+$/, '')

  for (const fragment of input.fragments) {
    const platform = fragment.platform?.trim()
    const file = fragment.file?.trim()
    const signature = fragment.signature?.trim()
    if (!platform || !file || !signature) {
      if (platform) skipped.push(platform)
      continue
    }
    if (!(UPDATER_PLATFORMS as readonly string[]).includes(platform)) {
      throw new Error(
        `${platform} is not a Tauri updater platform key. Expected one of: ${UPDATER_PLATFORMS.join(', ')}.`,
      )
    }
    platforms[platform] = { signature, url: `${base}/${file}` }
  }

  if (Object.keys(platforms).length === 0) {
    throw new Error(
      'No signed update artefacts were found, so a feed would advertise an update no platform can install.',
    )
  }

  return {
    feed: {
      // The plugin compares against the app's own semver, which carries no leading v.
      version: input.version.replace(/^v/, ''),
      pub_date: input.publishedAt.toISOString(),
      platforms,
    },
    skipped,
  }
}

if (import.meta.main) {
  const [fragmentsDir, version, baseUrl, output] = process.argv.slice(2)
  if (!fragmentsDir || !version || !baseUrl || !output) {
    throw new Error('Usage: bun scripts/build-updater-feed.ts <fragments-dir> <version> <base-url> <output-path>')
  }

  const entries = await readdir(fragmentsDir, { recursive: true, withFileTypes: true })
  const fragments: UpdaterFragment[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.updater.json')) continue
    const raw = await readFile(join(entry.parentPath ?? fragmentsDir, entry.name), 'utf8')
    fragments.push(JSON.parse(raw) as UpdaterFragment)
  }

  const { feed, skipped } = updaterFeed({ fragments, version, baseUrl, publishedAt: new Date() })
  await writeFile(output, `${JSON.stringify(feed, null, 2)}\n`)
  console.log(`Update feed for ${feed.version} covers: ${Object.keys(feed.platforms).join(', ')}.`)
  const missing = UPDATER_PLATFORMS.filter((platform) => !(platform in feed.platforms))
  if (missing.length > 0) console.log(`::warning::No signed artefact for: ${missing.join(', ')}.`)
  if (skipped.length > 0) console.log(`::warning::Fragments without a signature: ${skipped.join(', ')}.`)
}
