import { z } from 'zod'

/**
 * The Redrob Console API that Redrob Design calls, as zod schemas. These
 * are the contract: the app validates every response with them, the mock
 * server in tests/helpers/console implements them, and openapi.json is
 * generated from them for the Console team.
 *
 * Conventions: JSON with camelCase fields, `Authorization: Bearer <token>`,
 * failures as `{ "error": "<snake_case_code>" }`, `Retry-After` on 429 and
 * 503, cursor pagination (`?cursor=` returns `{ items, nextCursor }`), and
 * `ETag` with `If-Match` on revisioned writes.
 */

export const CONSOLE_ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'precondition_failed',
  'invalid_request',
  'rate_limited',
  'unavailable'
] as const
export type ConsoleErrorCode = (typeof CONSOLE_ERROR_CODES)[number]

export const errorBodySchema = z.object({ error: z.string().min(1) })

const id = z.string().min(1).max(200)
const isoTime = z.string().datetime({ offset: true })
const cursor = z.string().min(1).nullable()

/** One page of a cursor-paginated list. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: cursor })
}

// ---------------------------------------------------------------- account

/** Console's workspace roles. What someone may do to a shared file is its own role; see `files`. */
export const WORKSPACE_ROLES = ['viewer', 'developer', 'admin'] as const

export const workspaceSummarySchema = z.object({
  id,
  name: z.string().min(1).max(200),
  role: z.enum(WORKSPACE_ROLES)
})

/** P-256 public key, SPKI DER, base64url: what `exportKey('spki')` gives for an ECDH key. */
export const devicePublicKey = z.string().regex(/^[A-Za-z0-9_-]{80,200}$/)

/** This installation, once it has registered the public half of its key pair. */
export const deviceSchema = z.object({
  id,
  publicKey: devicePublicKey,
  createdAt: isoTime,
  updatedAt: isoTime
})
export type ConsoleDevice = z.infer<typeof deviceSchema>

export const meSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  email: z.string().email(),
  /** The workspace this installation was approved into. */
  currentWorkspaceId: id,
  workspaces: z.array(workspaceSummarySchema),
  device: deviceSchema.nullable()
})
export type ConsoleAccount = z.infer<typeof meSchema>

export const registerDeviceSchema = z.object({ publicKey: devicePublicKey })

// -------------------------------------------------------------- workspace

export const SOURCE_KINDS = ['site', 'repository', 'sheet'] as const
export const PRIVACY_LEVELS = ['standard', 'high', 'strict'] as const

export const workspaceSourceSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  kind: z.enum(SOURCE_KINDS),
  /** Where the source lives, for the person to recognise; never fetched by the app. */
  location: z.string().max(2000).nullable()
})

export const workspacePolicySchema = z.object({
  /** When set, every member's Privacy level is locked to it. */
  privacyLevel: z.enum(PRIVACY_LEVELS).nullable()
})

export const workspaceSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  sources: z.array(workspaceSourceSchema),
  policy: workspacePolicySchema
})
export type ConsoleWorkspace = z.infer<typeof workspaceSchema>

/** Design Memory as a workspace keeps it; the same shape the app reads from a file. */
export const workspaceMemorySchema = z.object({
  owner: z.string().min(1).max(200),
  revision: z.number().int().nonnegative(),
  updatedAt: isoTime,
  colors: z.array(
    z.object({
      name: z.string(),
      note: z.string(),
      swatches: z.array(
        z.object({
          token: z.string().min(1),
          hex: z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/)
        })
      )
    })
  ),
  typefaces: z.array(z.object({ family: z.string().min(1), note: z.string() })),
  radii: z.array(z.number().nonnegative()),
  rules: z.array(
    z.object({
      id,
      text: z.string().min(1).max(2000),
      source: z.string(),
      locked: z.boolean().optional()
    })
  ),
  components: z.array(z.string()),
  prices: z.array(z.object({ plan: z.string().min(1), price: z.string().min(1) }))
})
export type ConsoleWorkspaceMemory = z.infer<typeof workspaceMemorySchema>

// ------------------------------------------------------------------ feeds

const effortSchema = z.object({ label: z.string(), level: z.number().int(), of: z.number().int() })

export const leaderboardFeedSchema = z.object({
  name: z.string().min(1),
  edition: z.string().min(1),
  note: z.string(),
  publishedAt: isoTime,
  picks: z
    .array(
      z.object({
        id,
        model: z.string().min(1),
        short: z.string().optional(),
        harness: z.string().min(1),
        effort: effortSchema,
        efforts: z
          .array(
            effortSchema.extend({
              monthly: z.number().nonnegative().optional(),
              place: z.number().int().optional()
            })
          )
          .optional(),
        why: z.string().optional(),
        monthly: z.number().nonnegative().optional()
      })
    )
    .min(1)
    .max(20),
  /** Currency rates against USD, for monthly figures in local money. */
  rates: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().positive())
})
export type LeaderboardFeed = z.infer<typeof leaderboardFeedSchema>

export const modelRatesFeedSchema = z.object({
  publishedAt: isoTime,
  /** Matched by model id substring, most specific first. */
  rates: z
    .array(
      z.object({
        match: z.string().min(1),
        inputPerMillion: z.number().nonnegative(),
        outputPerMillion: z.number().nonnegative()
      })
    )
    .max(500)
})
export type ModelRatesFeed = z.infer<typeof modelRatesFeedSchema>

// ---------------------------------------------------------------- watches

export const createWatchSchema = z.object({
  documentId: id,
  pageId: id,
  sourceIds: z.array(id).min(1).max(20)
})

export const watchSchema = createWatchSchema.extend({ id, createdAt: isoTime })
export type ConsoleWatch = z.infer<typeof watchSchema>

export const watchChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text-replace'), from: z.string().min(1), to: z.string() }),
  z.object({ kind: z.literal('token-value'), token: z.string().min(1), value: z.string().min(1) }),
  z.object({
    kind: z.literal('price'),
    plan: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1)
  })
])
export type WatchChange = z.infer<typeof watchChangeSchema>

export const watchEventSchema = z.object({
  id,
  watchId: id,
  sourceId: id,
  /** What moved, in the source's words, for the thread message. */
  summary: z.string().max(500),
  at: isoTime,
  change: watchChangeSchema
})
export type WatchEvent = z.infer<typeof watchEventSchema>

// --------------------------------------------------------------- versions

/** A version as the app shows it, once its name is opened. Console's shape is fileVersionSummarySchema. */

export const VERSION_KINDS = ['auto', 'named'] as const

export const versionSummarySchema = z.object({
  id,
  documentId: id,
  kind: z.enum(VERSION_KINDS),
  name: z.string().max(200).nullable(),
  createdAt: isoTime,
  /** The document revision this snapshot was taken at. */
  revision: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
  createdBy: z.object({ id, name: z.string() })
})
export type ConsoleVersionSummary = z.infer<typeof versionSummarySchema>

// --------------------------------------------------------------- comments

/** A comment as the app holds it, once opened. Console's shape is fileCommentSchema. */

export const commentAnchorSchema = z.object({
  /** The layer the pin is attached to; null for a pin on the canvas itself. */
  nodeId: id.nullable(),
  /** Offset from the layer's top-left, or canvas position without a layer. */
  x: z.number(),
  y: z.number(),
  pageId: id
})

export const commentSchema = z.object({
  id,
  documentId: id,
  /** The first comment of the thread; null for the first comment itself. */
  threadId: id.nullable(),
  anchor: commentAnchorSchema,
  author: z.object({ id, name: z.string() }),
  text: z.string().min(1).max(10_000),
  resolved: z.boolean(),
  createdAt: isoTime,
  updatedAt: isoTime
})
export type ConsoleComment = z.infer<typeof commentSchema>

// -------------------------------------------------------------- libraries

export const librarySummarySchema = z.object({
  libraryId: id,
  name: z.string().min(1).max(200),
  latestRevisionId: id,
  publishedAt: isoTime,
  assetCount: z.number().int().nonnegative()
})

export const libraryRevisionSchema = z.object({
  summary: librarySummarySchema,
  revisionId: id,
  /** The serialized revision (`serializeLibraryRevision`), base64. */
  payload: z.string().min(1)
})
export type ConsoleLibraryRevision = z.infer<typeof libraryRevisionSchema>

export const publishLibraryRevisionSchema = z.object({
  /** Chosen by the app, which builds the revision; it is also inside the payload. */
  revisionId: id,
  name: z.string().min(1).max(200),
  publishedAt: isoTime,
  assetCount: z.number().int().nonnegative(),
  /** The revision this publish replaces; null for the first publish. */
  parentRevisionId: id.nullable(),
  payload: z.string().min(1)
})

// ------------------------------------------------------------ cloud files

/**
 * Ciphertext and wrapped keys, base64url. Console stores them without being able to read them:
 * every name, snapshot, version and comment of a cloud file is sealed by the app first.
 */
const ciphertext = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[A-Za-z0-9_-]+$/)

/** What someone may do to one shared file. Separate from their workspace role. */
export const FILE_ROLES = ['viewer', 'commenter', 'editor', 'owner'] as const
export type FileRole = (typeof FILE_ROLES)[number]
/** What an invite can grant; ownership is only handed over by changing a member's role. */
export const INVITE_ROLES = ['viewer', 'commenter', 'editor'] as const
export type InviteRole = (typeof INVITE_ROLES)[number]

export const cloudFileSchema = z.object({
  id,
  encryptedName: ciphertext(4096),
  role: z.enum(FILE_ROLES),
  keyEpoch: z.number().int().positive(),
  snapshotRevision: z.number().int().nonnegative(),
  createdAt: isoTime,
  updatedAt: isoTime
})
export type CloudFile = z.infer<typeof cloudFileSchema>

/** Chosen by the app, so the name and key can be sealed to the file before Console has it. */
export const cloudFileId = z.string().regex(/^dfl_[0-9a-f]{32}$/)

export const createCloudFileSchema = z.object({
  id: cloudFileId,
  encryptedName: ciphertext(4096),
  keyGrant: z.object({ wrappedKey: ciphertext(1024) })
})

export const renameCloudFileSchema = z.object({ encryptedName: ciphertext(4096) })

export const fileMemberSchema = z.object({
  userId: id,
  email: z.string().email(),
  name: z.string().min(1).max(200),
  role: z.enum(FILE_ROLES),
  addedAt: isoTime
})
export type FileMember = z.infer<typeof fileMemberSchema>

export const fileInviteSchema = z.object({
  id,
  email: z.string().email(),
  role: z.enum(INVITE_ROLES),
  createdAt: isoTime
})
export type FileInvite = z.infer<typeof fileInviteSchema>

export const fileMembersSchema = z.object({
  members: z.array(fileMemberSchema),
  invites: z.array(fileInviteSchema)
})
export type FileMembers = z.infer<typeof fileMembersSchema>

export const addFileMemberSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(INVITE_ROLES)
})

/** Exactly one is set: a member when the address has an account, else an invite. */
export const addedFileMemberSchema = z.object({
  member: fileMemberSchema.nullable(),
  invite: fileInviteSchema.nullable()
})

export const updateFileMemberSchema = z.object({ role: z.enum(FILE_ROLES) })

export const fileKeysSchema = z.object({
  keyEpoch: z.number().int().positive(),
  grants: z.array(
    z.object({
      epoch: z.number().int().positive(),
      wrappedKey: ciphertext(1024),
      grantedByDeviceId: id.nullable()
    })
  )
})

export const pendingDeviceSchema = z.object({
  deviceId: id,
  userId: id,
  publicKey: devicePublicKey
})
export type PendingDevice = z.infer<typeof pendingDeviceSchema>

export const createKeyGrantsSchema = z.object({
  grants: z
    .array(
      z.object({ deviceId: id, epoch: z.number().int().positive(), wrappedKey: ciphertext(1024) })
    )
    .min(1)
    .max(100)
})

export const createdKeyGrantsSchema = z.object({ granted: z.number().int().nonnegative() })

export const fileLinkSchema = z.object({ enabled: z.boolean(), createdAt: isoTime.nullable() })
export const createdFileLinkSchema = z.object({
  token: z.string().min(16).max(200),
  createdAt: isoTime
})

export const UPLOAD_KINDS = ['snapshot', 'version'] as const

export const createUploadSchema = z.object({
  kind: z.enum(UPLOAD_KINDS),
  size: z.number().int().positive()
})

export const uploadSchema = z.object({
  uploadId: id,
  upload: z.object({
    url: z.string().url(),
    method: z.literal('PUT'),
    headers: z.record(z.string(), z.string()),
    expiresAt: isoTime
  })
})
export type CloudUpload = z.infer<typeof uploadSchema>

export const snapshotSchema = z.object({
  revision: z.number().int().positive(),
  size: z.number().int().nonnegative(),
  epoch: z.number().int().positive(),
  url: z.string().url(),
  expiresAt: isoTime
})

export const commitSnapshotSchema = z.object({
  uploadId: id,
  baseRevision: z.number().int().nonnegative(),
  epoch: z.number().int().positive()
})

export const committedSnapshotSchema = z.object({
  revision: z.number().int().positive(),
  size: z.number().int().nonnegative(),
  epoch: z.number().int().positive()
})

export const fileRelayTicketSchema = z.object({
  url: z.string().url(),
  ticket: z.string().min(16),
  expiresAt: isoTime,
  role: z.enum(FILE_ROLES),
  peerId: z.string().min(8).max(200)
})
export type FileRelayTicket = z.infer<typeof fileRelayTicketSchema>

// ----------------------------------------------- sealed versions and comments

const author = z.object({ id: id.nullable(), name: z.string() })

export const fileVersionSummarySchema = z.object({
  id,
  fileId: id,
  kind: z.enum(VERSION_KINDS),
  encryptedName: ciphertext(4096).nullable(),
  revision: z.number().int().nonnegative(),
  epoch: z.number().int().positive(),
  size: z.number().int().nonnegative(),
  createdBy: author,
  createdAt: isoTime
})
export type FileVersionSummary = z.infer<typeof fileVersionSummarySchema>

export const fileVersionSchema = fileVersionSummarySchema.extend({
  url: z.string().url(),
  expiresAt: isoTime
})

export const createFileVersionSchema = fileVersionSummarySchema
  .pick({ kind: true, encryptedName: true, revision: true, epoch: true })
  .extend({ uploadId: id })

export const renameFileVersionSchema = z.object({ encryptedName: ciphertext(4096).nullable() })

/** The text and the pin, sealed together; null once deleted. */
export const fileCommentSchema = z.object({
  id,
  fileId: id,
  threadId: id.nullable(),
  author,
  ciphertext: ciphertext(20_000).nullable(),
  epoch: z.number().int().positive(),
  resolved: z.boolean(),
  deleted: z.boolean(),
  createdAt: isoTime,
  updatedAt: isoTime
})
export type FileComment = z.infer<typeof fileCommentSchema>

const commentId = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/)

export const createFileCommentSchema = z.object({
  id: commentId,
  threadId: commentId.nullable(),
  ciphertext: ciphertext(20_000),
  epoch: z.number().int().positive(),
  createdAt: isoTime
})

export const updateFileCommentSchema = z.object({
  ciphertext: ciphertext(20_000).optional(),
  epoch: z.number().int().positive().optional(),
  resolved: z.boolean().optional()
})
