import { REDROB_CONSOLE_API_BASE } from '@redrob-design/core/constants'

/**
 * Where each half of Redrob Cloud lives.
 *
 * Console keeps money, workspaces, feeds and watches. Shared files, comments, versions,
 * libraries and the collaboration relay live in the Redrob Chat API under `/design`
 * (same paths and shapes as `contract/routes.ts`), so only the base differs.
 *
 * Dev and staging builds point elsewhere with `VITE_REDROB_CHAT_API_BASE` and
 * `VITE_REDROB_AUTH_ISSUER`; an empty issuer turns redrob-auth sign-in off, which leaves
 * the Console device sign-in as the only path.
 */
export const REDROB_CHAT_API_BASE_DEFAULT = 'https://chat-prod.redrob.ai'
export const REDROB_AUTH_ISSUER_DEFAULT = 'https://auth.redrob.io'

function envString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export const REDROB_CHAT_API_BASE = stripSlash(
  envString(import.meta.env.VITE_REDROB_CHAT_API_BASE) || REDROB_CHAT_API_BASE_DEFAULT
)

/** `''` when sign-in through redrob-auth is switched off for this build. */
export const REDROB_AUTH_ISSUER = stripSlash(
  envString(import.meta.env.VITE_REDROB_AUTH_ISSUER) ?? REDROB_AUTH_ISSUER_DEFAULT
)

export { REDROB_CONSOLE_API_BASE }

/** Paths served by the chat API's design backend rather than by Console. */
export function isDesignPath(path: string): boolean {
  return path === '/design' || path.startsWith('/design/')
}

/** `wss://<chat-api-host>/relay`: the relay runs inside the chat API process. */
export function relayURLFor(chatBase: string = REDROB_CHAT_API_BASE): string {
  const url = new URL(chatBase)
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
  url.pathname = '/relay'
  url.search = ''
  url.hash = ''
  return url.toString()
}
