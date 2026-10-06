import type { z } from 'zod'

import {
  createCommentSchema,
  createVersionSchema,
  createWatchSchema,
  commentSchema,
  leaderboardFeedSchema,
  libraryRevisionSchema,
  librarySummarySchema,
  meSchema,
  modelRatesFeedSchema,
  pageSchema,
  publishLibraryRevisionSchema,
  relayTicketSchema,
  renameVersionSchema,
  updateCommentSchema,
  versionSchema,
  versionSummarySchema,
  watchEventSchema,
  watchSchema,
  workspaceMemorySchema,
  workspaceSchema
} from './schemas'

export type ConsoleMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface ConsoleRoute {
  method: ConsoleMethod
  /** OpenAPI path template, e.g. `/workspaces/{workspaceId}`. */
  path: string
  operationId: string
  summary: string
  /** Public feeds need no sign-in; everything else takes the session token. */
  auth: 'public' | 'bearer'
  query?: Record<string, { description: string; required?: boolean }>
  body?: z.ZodType
  response: z.ZodType | null
  /** The response carries an ETag, and writes to it take If-Match. */
  revisioned?: boolean
  /** Status of a successful response. */
  status?: 200 | 201 | 204
}

const cursorQuery = { cursor: { description: 'Opaque cursor from the previous page' } }

/** Every Console endpoint Redrob Design calls. */
export const CONSOLE_ROUTES = [
  {
    method: 'GET',
    path: '/me',
    operationId: 'getMe',
    summary: 'The signed-in account and the workspaces it belongs to.',
    auth: 'bearer',
    response: meSchema
  },
  {
    method: 'GET',
    path: '/workspaces/{workspaceId}',
    operationId: 'getWorkspace',
    summary: 'A workspace: its sources and the policy every member follows.',
    auth: 'bearer',
    response: workspaceSchema
  },
  {
    method: 'GET',
    path: '/workspaces/{workspaceId}/memory',
    operationId: 'getWorkspaceMemory',
    summary: 'The workspace Design Memory every model reads before it draws.',
    auth: 'bearer',
    response: workspaceMemorySchema,
    revisioned: true
  },
  {
    method: 'GET',
    path: '/feeds/leaderboard',
    operationId: 'getLeaderboardFeed',
    summary: 'The Redrob Leaderboard picks for designing screens and layouts.',
    auth: 'public',
    response: leaderboardFeedSchema
  },
  {
    method: 'GET',
    path: '/feeds/model-rates',
    operationId: 'getModelRatesFeed',
    summary: 'List prices per million tokens, for answer receipts.',
    auth: 'public',
    response: modelRatesFeedSchema
  },
  {
    method: 'POST',
    path: '/watches',
    operationId: 'createWatch',
    summary: 'Watch workspace sources on behalf of a shipped page.',
    auth: 'bearer',
    body: createWatchSchema,
    response: watchSchema,
    status: 201
  },
  {
    method: 'DELETE',
    path: '/watches/{watchId}',
    operationId: 'deleteWatch',
    summary: 'Stop watching.',
    auth: 'bearer',
    response: null,
    status: 204
  },
  {
    method: 'GET',
    path: '/watches/events',
    operationId: 'listWatchEvents',
    summary: 'Changes in watched sources since a cursor, oldest first.',
    auth: 'bearer',
    query: {
      since: { description: 'Cursor from the previous call; omit for events from now on' },
      ...cursorQuery
    },
    response: pageSchema(watchEventSchema)
  },
  {
    method: 'GET',
    path: '/documents/{documentId}/versions',
    operationId: 'listVersions',
    summary: 'Saved versions of a document, newest first.',
    auth: 'bearer',
    query: cursorQuery,
    response: pageSchema(versionSummarySchema)
  },
  {
    method: 'POST',
    path: '/documents/{documentId}/versions',
    operationId: 'createVersion',
    summary: 'Save a version. If-Match carries the last version list ETag the client saw.',
    auth: 'bearer',
    body: createVersionSchema,
    response: versionSummarySchema,
    revisioned: true,
    status: 201
  },
  {
    method: 'GET',
    path: '/documents/{documentId}/versions/{versionId}',
    operationId: 'getVersion',
    summary: 'One version with its snapshot.',
    auth: 'bearer',
    response: versionSchema
  },
  {
    method: 'PATCH',
    path: '/documents/{documentId}/versions/{versionId}',
    operationId: 'renameVersion',
    summary: 'Name a version, which also keeps it past retention.',
    auth: 'bearer',
    body: renameVersionSchema,
    response: versionSummarySchema,
    revisioned: true
  },
  {
    method: 'DELETE',
    path: '/documents/{documentId}/versions/{versionId}',
    operationId: 'deleteVersion',
    summary: 'Delete a version.',
    auth: 'bearer',
    response: null,
    status: 204
  },
  {
    method: 'GET',
    path: '/documents/{documentId}/comments',
    operationId: 'listComments',
    summary: 'Every comment on a document, including resolved ones.',
    auth: 'bearer',
    query: {
      ...cursorQuery,
      updatedSince: { description: 'Only comments changed after this time' }
    },
    response: pageSchema(commentSchema)
  },
  {
    method: 'POST',
    path: '/documents/{documentId}/comments',
    operationId: 'createComment',
    summary: 'Add a comment or a reply. Repeating the same id is idempotent.',
    auth: 'bearer',
    body: createCommentSchema,
    response: commentSchema,
    revisioned: true,
    status: 201
  },
  {
    method: 'PATCH',
    path: '/documents/{documentId}/comments/{commentId}',
    operationId: 'updateComment',
    summary: 'Edit, move, resolve or reopen a comment.',
    auth: 'bearer',
    body: updateCommentSchema,
    response: commentSchema,
    revisioned: true
  },
  {
    method: 'DELETE',
    path: '/documents/{documentId}/comments/{commentId}',
    operationId: 'deleteComment',
    summary: 'Delete a comment and, for the first comment, its thread.',
    auth: 'bearer',
    response: null,
    status: 204
  },
  {
    method: 'POST',
    path: '/relay/{roomId}/ticket',
    operationId: 'createRelayTicket',
    summary: 'A short-lived ticket for the collaboration relay WebSocket of one room.',
    auth: 'bearer',
    response: relayTicketSchema,
    status: 201
  },
  {
    method: 'GET',
    path: '/workspaces/{workspaceId}/libraries',
    operationId: 'listLibraries',
    summary: 'Component libraries published to the workspace.',
    auth: 'bearer',
    query: cursorQuery,
    response: pageSchema(librarySummarySchema)
  },
  {
    method: 'GET',
    path: '/workspaces/{workspaceId}/libraries/{libraryId}/revisions/{revisionId}',
    operationId: 'getLibraryRevision',
    summary: 'A library revision; `latest` names the newest.',
    auth: 'bearer',
    response: libraryRevisionSchema,
    revisioned: true
  },
  {
    method: 'POST',
    path: '/workspaces/{workspaceId}/libraries/{libraryId}/revisions',
    operationId: 'publishLibraryRevision',
    summary:
      'Publish a revision. If-Match carries the latest revision ETag; If-None-Match: * for a new library.',
    auth: 'bearer',
    body: publishLibraryRevisionSchema,
    response: libraryRevisionSchema,
    revisioned: true,
    status: 201
  }
] as const satisfies readonly ConsoleRoute[]

export type ConsoleOperationId = (typeof CONSOLE_ROUTES)[number]['operationId']

export function consoleRoute(operationId: ConsoleOperationId): ConsoleRoute {
  for (const route of CONSOLE_ROUTES) if (route.operationId === operationId) return route
  throw new Error(`Unknown Console operation ${operationId}`)
}

/** `/workspaces/{workspaceId}` with `{ workspaceId: 'w1' }` → `/workspaces/w1`. */
export function routePath(route: ConsoleRoute, params: Record<string, string> = {}): string {
  return route.path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value: string | undefined = Object.hasOwn(params, name) ? params[name] : undefined
    if (value === undefined) throw new Error(`Missing ${name} for ${route.operationId}`)
    return encodeURIComponent(value)
  })
}
