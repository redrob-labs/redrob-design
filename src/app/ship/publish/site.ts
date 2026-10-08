import { useLocalStorage } from '@vueuse/core'

/**
 * The public address the publish bucket is served from (a website endpoint,
 * CDN or custom domain). Redrob uploads to the bucket; the person makes it
 * public, so Redrob never changes bucket policies.
 */
export const publishSiteURL = useLocalStorage('redrob-design:publish:site-url', '', {
  writeDefaults: false
})

export type SiteURLResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'not-https' }

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

/**
 * Checks a public site URL: https (http only on this computer, for local
 * MinIO), no credentials, query or fragment, and no trailing slash.
 */
export function normalizePublicSiteURL(raw: string): SiteURLResult {
  const value = raw.trim()
  if (!value) return { ok: false, reason: 'empty' }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback(url.hostname))) {
    return { ok: false, reason: 'not-https' }
  }
  if (url.username || url.password || url.search || url.hash)
    return { ok: false, reason: 'invalid' }
  return { ok: true, url: `${url.origin}${url.pathname.replace(/\/+$/, '')}` }
}

/** The saved site URL when it is valid, else null. */
export function currentPublicSiteURL(): string | null {
  const result = normalizePublicSiteURL(publishSiteURL.value)
  return result.ok ? result.url : null
}
