import { z } from 'zod'

import {
  addFileMemberSchema,
  addedFileMemberSchema,
  cloudFileSchema,
  commitSnapshotSchema,
  committedSnapshotSchema,
  createCloudFileSchema,
  createKeyGrantsSchema,
  createUploadSchema,
  createdFileLinkSchema,
  createdKeyGrantsSchema,
  fileKeysSchema,
  fileLinkSchema,
  fileMembersSchema,
  fileRelayTicketSchema,
  pendingDeviceSchema,
  renameCloudFileSchema,
  snapshotSchema,
  updateFileMemberSchema,
  uploadSchema,
  createCommentSchema,
  createVersionSchema,
  createWatchSchema,
  commentSchema,
  leaderboardFeedSchema,
  libraryRevisionSchema,
  librarySummarySchema,
  deviceSchema,
  meSchema,
  modelRatesFeedSchema,
  registerDeviceSchema,
  pageSchema,
  publishLibraryRevisionSchema,
  renameVersionSchema,
  updateCommentSchema,
  versionSchema,
  versionSummarySchema,
  watchEventSchema,
  watchSchema,
  workspaceMemorySchema,
  workspaceSchema
} from './schemas'

export type ConsoleMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ConsoleRoute {
  method: ConsoleMethod
  /** OpenAPI path template, e.g. `/workspaces/{workspaceId}`. */
  path: string
  operationId: string
  summary: string
  /**
   * Public feeds need no sign-in; everything else takes the session token. `bearer-or-link` also
   * answers a view link's token in X-Redrob-Link, for the routes a link may read.
   */
  auth: 'public' | 'bearer' | 'bearer-or-link'
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
    path: '/design/me',
    operationId: 'getMe',
    summary: 'Who this installation is signed in as, its workspaces, and its device key.',
    auth: 'bearer',
    response: meSchema
  },
  {
    method: 'PUT',
    path: '/design/devices/current',
    operationId: 'registerDevice',
    summary: "Register this installation's public key, or replace it.",
    auth: 'bearer',
    body: registerDeviceSchema,
    response: deviceSchema
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
  },
  // ------------------------------------------------------------ cloud files
  {
    method: 'POST',
    path: '/design/files',
    operationId: 'createCloudFile',
    summary: 'Share a file: Console keeps its sealed name and this device’s wrapped key.',
    auth: 'bearer',
    body: createCloudFileSchema,
    response: cloudFileSchema,
    status: 201
  },
  {
    method: 'GET',
    path: '/design/files',
    operationId: 'listCloudFiles',
    summary: 'Files shared with this person, most recently changed first.',
    auth: 'bearer',
    query: cursorQuery,
    response: pageSchema(cloudFileSchema)
  },
  {
    method: 'GET',
    path: '/design/files/{fileId}',
    operationId: 'getCloudFile',
    summary: 'A shared file and the caller’s role on it.',
    auth: 'bearer-or-link',
    response: cloudFileSchema
  },
  {
    method: 'PATCH',
    path: '/design/files/{fileId}',
    operationId: 'renameCloudFile',
    summary: 'Rename a shared file. Editors and owners.',
    auth: 'bearer',
    body: renameCloudFileSchema,
    response: cloudFileSchema
  },
  {
    method: 'DELETE',
    path: '/design/files/{fileId}',
    operationId: 'deleteCloudFile',
    summary: 'Delete a shared file and everything stored for it. Owners only.',
    auth: 'bearer',
    response: null,
    status: 204
  },
  {
    method: 'GET',
    path: '/design/files/{fileId}/members',
    operationId: 'listFileMembers',
    summary: 'Who has access, and who is invited.',
    auth: 'bearer',
    response: fileMembersSchema
  },
  {
    method: 'POST',
    path: '/design/files/{fileId}/members',
    operationId: 'addFileMember',
    summary: 'Share with an address. Editors and owners.',
    auth: 'bearer',
    body: addFileMemberSchema,
    response: addedFileMemberSchema,
    status: 201
  },
  {
    method: 'PATCH',
    path: '/design/files/{fileId}/members/{userId}',
    operationId: 'updateFileMember',
    summary: 'Change someone’s role. Owners only.',
    auth: 'bearer',
    body: updateFileMemberSchema,
    response: fileMembersSchema
  },
  {
    method: 'DELETE',
    path: '/design/files/{fileId}/members/{userId}',
    operationId: 'removeFileMember',
    summary: 'Remove someone, or leave.',
    auth: 'bearer',
    response: null,
    status: 204
  },
  {
    method: 'DELETE',
    path: '/design/files/{fileId}/invites/{inviteId}',
    operationId: 'revokeFileInvite',
    summary: 'Withdraw an invite.',
    auth: 'bearer',
    response: null,
    status: 204
  },
  {
    method: 'GET',
    path: '/design/files/{fileId}/keys',
    operationId: 'getFileKeys',
    summary: 'This device’s wrapped copies of the file key.',
    auth: 'bearer',
    response: fileKeysSchema
  },
  {
    method: 'GET',
    path: '/design/files/{fileId}/pending-devices',
    operationId: 'listPendingDevices',
    summary: 'Members’ devices still waiting for the file key. Editors and owners.',
    auth: 'bearer',
    response: z.array(pendingDeviceSchema)
  },
  {
    method: 'POST',
    path: '/design/files/{fileId}/grants',
    operationId: 'createKeyGrants',
    summary: 'Hand the file key, wrapped, to pending devices.',
    auth: 'bearer',
    body: createKeyGrantsSchema,
    response: createdKeyGrantsSchema
  },
  {
    method: 'GET',
    path: '/design/files/{fileId}/link',
    operationId: 'getFileLink',
    summary: 'Whether the file has a live view link.',
    auth: 'bearer',
    response: fileLinkSchema
  },
  {
    method: 'POST',
    path: '/design/files/{fileId}/link',
    operationId: 'createFileLink',
    summary: 'Make a new view link, retiring the old one.',
    auth: 'bearer',
    response: createdFileLinkSchema,
    status: 201
  },
  {
    method: 'DELETE',
    path: '/design/files/{fileId}/link',
    operationId: 'revokeFileLink',
    summary: 'Turn the view link off.',
    auth: 'bearer',
    response: null,
    status: 204
  },
  {
    method: 'POST',
    path: '/design/files/{fileId}/uploads',
    operationId: 'createUpload',
    summary: 'A presigned link to upload one sealed snapshot or version.',
    auth: 'bearer',
    body: createUploadSchema,
    response: uploadSchema,
    status: 201
  },
  {
    method: 'GET',
    path: '/design/files/{fileId}/snapshot',
    operationId: 'getSnapshot',
    summary: 'The current sealed snapshot, as a short-lived download link.',
    auth: 'bearer-or-link',
    response: snapshotSchema
  },
  {
    method: 'PUT',
    path: '/design/files/{fileId}/snapshot',
    operationId: 'commitSnapshot',
    summary: 'Commit an uploaded snapshot if nobody has since its base revision.',
    auth: 'bearer',
    body: commitSnapshotSchema,
    response: committedSnapshotSchema
  },
  {
    method: 'POST',
    path: '/design/files/{fileId}/relay-ticket',
    operationId: 'createFileRelayTicket',
    summary: 'A one-use ticket for the file’s collaboration room.',
    auth: 'bearer-or-link',
    response: fileRelayTicketSchema,
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
