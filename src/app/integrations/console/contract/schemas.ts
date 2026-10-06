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

export const WORKSPACE_ROLES = ['viewer', 'editor', 'admin'] as const

export const workspaceSummarySchema = z.object({
  id,
  name: z.string().min(1).max(200),
  role: z.enum(WORKSPACE_ROLES)
})

export const meSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  email: z.string().email().nullable(),
  workspaces: z.array(workspaceSummarySchema)
})
export type ConsoleAccount = z.infer<typeof meSchema>

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

export const createVersionSchema = z.object({
  kind: z.enum(VERSION_KINDS),
  name: z.string().max(200).nullable(),
  revision: z.number().int().nonnegative(),
  /** The `.fig` bytes, base64. */
  snapshot: z.string().min(1)
})

export const versionSchema = versionSummarySchema.extend({ snapshot: z.string().min(1) })

export const renameVersionSchema = z.object({ name: z.string().max(200).nullable() })

// --------------------------------------------------------------- comments

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

export const createCommentSchema = z.object({
  /** Chosen by the app so offline comments keep their id once synced. */
  id,
  threadId: id.nullable(),
  anchor: commentAnchorSchema,
  text: z.string().min(1).max(10_000),
  createdAt: isoTime
})

export const updateCommentSchema = z
  .object({
    text: z.string().min(1).max(10_000).optional(),
    resolved: z.boolean().optional(),
    anchor: commentAnchorSchema.optional(),
    updatedAt: isoTime
  })
  .refine(
    (value) =>
      value.text !== undefined || value.resolved !== undefined || value.anchor !== undefined,
    {
      message: 'Nothing to update'
    }
  )

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

// ------------------------------------------------------------------ relay

/** The short-lived ticket a client trades for a relay WebSocket. */
export const relayTicketSchema = z.object({
  url: z.string().url(),
  ticket: z.string().min(16),
  expiresAt: isoTime
})
