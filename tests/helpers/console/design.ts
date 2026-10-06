import type { Context, Hono } from 'hono'
import type { z } from 'zod'

import {
  addFileMemberSchema,
  commitSnapshotSchema,
  createCloudFileSchema,
  createKeyGrantsSchema,
  createUploadSchema,
  renameCloudFileSchema,
  updateFileMemberSchema,
  type CloudFile,
  type FileInvite,
  type FileMember,
  type FileRole,
  type PendingDevice
} from '@/app/integrations/console/contract/schemas'

/**
 * Redrob Cloud files, as Console serves them (redrob-console apps/api/src/design): per-file
 * members and roles, wrapped keys per device, view links in X-Redrob-Link, and sealed snapshots
 * moved on presigned links -- here answered by `blobs.mock`.
 *
 * The mock is one signed-in person with one device. Other people and devices are state a test
 * puts in directly: a member, a pending device, a link.
 */
export const BLOB_ORIGIN = 'https://blobs.mock'
export const MOCK_DEVICE_ID = 'device-self'

export interface MockDesignState {
  files: Map<string, CloudFile>
  members: Map<string, FileMember[]>
  invites: Map<string, FileInvite[]>
  /** `${fileId}:${deviceId}:${epoch}` -> wrapped key */
  grants: Map<string, string>
  /** Other members' devices waiting for a file's key. */
  pendingDevices: Map<string, PendingDevice[]>
  /** link token -> file id */
  links: Map<string, string>
  snapshots: Map<string, { revision: number; epoch: number; key: string }>
  uploads: Map<string, { fileId: string; kind: string; size: number; key: string }>
  blobs: Map<string, Uint8Array>
  /** The relay ticket every createFileRelayTicket answers with; tests point it at a relay. */
  relay: { url: string; role: FileRole | null }
  /** ticket -> file id; the mock relay admits each once, into that file's room. */
  relayTickets: Map<string, string>
}

export function mockDesignState(): MockDesignState {
  return {
    files: new Map(),
    members: new Map(),
    invites: new Map(),
    grants: new Map(),
    pendingDevices: new Map(),
    links: new Map(),
    snapshots: new Map(),
    uploads: new Map(),
    blobs: new Map(),
    relay: { url: 'wss://relay.mock/v1/rooms', role: null },
    relayTickets: new Map()
  }
}

const NOW = '2026-10-06T09:00:00.000Z'
let counter = 0
const next = (prefix: string) => `${prefix}-${++counter}`

type Fail = (c: Context, status: 400 | 401 | 403 | 404 | 409 | 412 | 429, error: string) => Response

async function parse<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T> | null> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null))
  return parsed.success ? parsed.data : null
}

const RANK: Record<FileRole, number> = { viewer: 0, commenter: 1, editor: 2, owner: 3 }

export function registerDesignFiles(options: {
  app: Hono
  authed: Hono
  state: MockDesignState
  self: () => { id: string; email: string; name: string }
  authorized: (c: Context) => boolean
  fail: Fail
}): void {
  const { app, authed, state, self, authorized, fail } = options

  function roleOf(c: Context, fileId: string): FileRole | null {
    const link = c.req.header('x-redrob-link')
    if (link) return state.links.get(link) === fileId ? 'viewer' : null
    if (!authorized(c)) return null
    return state.members.get(fileId)?.find((member) => member.userId === self().id)?.role ?? null
  }

  function access(c: Context, fileId: string, minimum: FileRole): FileRole | Response {
    const link = c.req.header('x-redrob-link')
    if (!link && !authorized(c)) return fail(c, 401, 'unauthorized')
    if (link && !state.links.has(link)) return fail(c, 401, 'unauthorized')
    const role = roleOf(c, fileId)
    if (!role || !state.files.has(fileId)) return fail(c, 404, 'not_found')
    if (RANK[role] < RANK[minimum]) return fail(c, 403, 'forbidden')
    return role
  }

  const withRole = (file: CloudFile, role: FileRole): CloudFile => ({ ...file, role })

  // Routes a view link may reach: registered on the open app, checked here.
  app.get('/design/files/:fileId', (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'viewer')
    if (role instanceof Response) return role
    const file = state.files.get(fileId)
    return file ? c.json(withRole(file, role)) : fail(c, 404, 'not_found')
  })
  app.get('/design/files/:fileId/snapshot', (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'viewer')
    if (role instanceof Response) return role
    const snapshot = state.snapshots.get(fileId)
    if (!snapshot) return fail(c, 404, 'not_found')
    const blob = state.blobs.get(snapshot.key)
    return c.json({
      revision: snapshot.revision,
      size: blob?.byteLength ?? 0,
      epoch: snapshot.epoch,
      url: `${BLOB_ORIGIN}/${snapshot.key}`,
      expiresAt: NOW
    })
  })
  app.post('/design/files/:fileId/relay-ticket', (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'viewer')
    if (role instanceof Response) return role
    const ticket = `${next('ticket')}-${fileId}-0123456789abcdef`
    state.relayTickets.set(ticket, fileId)
    return c.json(
      {
        url: state.relay.url,
        ticket,
        expiresAt: NOW,
        role: state.relay.role ?? role,
        peerId: next('peer-assigned')
      },
      201
    )
  })

  authed.post('/design/files', async (c) => {
    const request = await parse(c, createCloudFileSchema)
    if (!request) return fail(c, 400, 'invalid_request')
    if (state.files.has(request.id)) return fail(c, 409, 'conflict')
    const file: CloudFile = {
      id: request.id,
      encryptedName: request.encryptedName,
      role: 'owner',
      keyEpoch: 1,
      snapshotRevision: 0,
      createdAt: NOW,
      updatedAt: NOW
    }
    const me = self()
    state.files.set(file.id, file)
    state.members.set(file.id, [
      { userId: me.id, email: me.email, name: me.name, role: 'owner', addedAt: NOW }
    ])
    state.grants.set(`${file.id}:${MOCK_DEVICE_ID}:1`, request.keyGrant.wrappedKey)
    return c.json(file, 201)
  })
  authed.get('/design/files', (c) => {
    const items = [...state.files.values()]
      .map((file) => {
        const role = state.members.get(file.id)?.find((member) => member.userId === self().id)?.role
        return role ? withRole(file, role) : null
      })
      .filter((file) => file !== null)
    return c.json({ items, nextCursor: null })
  })
  authed.patch('/design/files/:fileId', async (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'editor')
    if (role instanceof Response) return role
    const request = await parse(c, renameCloudFileSchema)
    const file = state.files.get(fileId)
    if (!request || !file) return fail(c, 400, 'invalid_request')
    const renamed = { ...file, encryptedName: request.encryptedName }
    state.files.set(fileId, renamed)
    return c.json(withRole(renamed, role))
  })
  authed.delete('/design/files/:fileId', (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'owner')
    if (role instanceof Response) return role
    state.files.delete(fileId)
    return c.body(null, 204)
  })

  const roster = (fileId: string) => ({
    members: state.members.get(fileId) ?? [],
    invites: state.invites.get(fileId) ?? []
  })

  authed.get('/design/files/:fileId/members', (c) => {
    const role = access(c, c.req.param('fileId'), 'viewer')
    if (role instanceof Response) return role
    return c.json(roster(c.req.param('fileId')))
  })
  authed.post('/design/files/:fileId/members', async (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'editor')
    if (role instanceof Response) return role
    const request = await parse(c, addFileMemberSchema)
    if (!request) return fail(c, 400, 'invalid_request')
    const invite: FileInvite = {
      id: next('invite'),
      email: request.email,
      role: request.role,
      createdAt: NOW
    }
    state.invites.set(fileId, [...(state.invites.get(fileId) ?? []), invite])
    return c.json({ member: null, invite }, 201)
  })
  authed.patch('/design/files/:fileId/members/:userId', async (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'owner')
    if (role instanceof Response) return role
    const request = await parse(c, updateFileMemberSchema)
    if (!request) return fail(c, 400, 'invalid_request')
    const members = (state.members.get(fileId) ?? []).map((member) =>
      member.userId === c.req.param('userId') ? { ...member, role: request.role } : member
    )
    state.members.set(fileId, members)
    return c.json(roster(fileId))
  })
  authed.delete('/design/files/:fileId/members/:userId', (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'owner')
    if (role instanceof Response) return role
    state.members.set(
      fileId,
      (state.members.get(fileId) ?? []).filter((member) => member.userId !== c.req.param('userId'))
    )
    return c.body(null, 204)
  })
  authed.delete('/design/files/:fileId/invites/:inviteId', (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'editor')
    if (role instanceof Response) return role
    state.invites.set(
      fileId,
      (state.invites.get(fileId) ?? []).filter((invite) => invite.id !== c.req.param('inviteId'))
    )
    return c.body(null, 204)
  })

  authed.get('/design/files/:fileId/keys', (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'viewer')
    if (role instanceof Response) return role
    const file = state.files.get(fileId)
    const grants = [...state.grants.entries()]
      .filter(([id]) => id.startsWith(`${fileId}:${MOCK_DEVICE_ID}:`))
      .map(([id, wrappedKey]) => ({
        epoch: Number(id.split(':')[2]),
        wrappedKey,
        grantedByDeviceId: MOCK_DEVICE_ID
      }))
    return c.json({ keyEpoch: file?.keyEpoch ?? 1, grants })
  })
  authed.get('/design/files/:fileId/pending-devices', (c) => {
    const role = access(c, c.req.param('fileId'), 'editor')
    if (role instanceof Response) return role
    return c.json(state.pendingDevices.get(c.req.param('fileId')) ?? [])
  })
  authed.post('/design/files/:fileId/grants', async (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'editor')
    if (role instanceof Response) return role
    const request = await parse(c, createKeyGrantsSchema)
    if (!request) return fail(c, 400, 'invalid_request')
    const pending = state.pendingDevices.get(fileId) ?? []
    let granted = 0
    for (const grant of request.grants) {
      const id = `${fileId}:${grant.deviceId}:${grant.epoch}`
      if (!pending.some((device) => device.deviceId === grant.deviceId) || state.grants.has(id))
        continue
      state.grants.set(id, grant.wrappedKey)
      granted += 1
    }
    state.pendingDevices.set(
      fileId,
      pending.filter((device) => !state.grants.has(`${fileId}:${device.deviceId}:1`))
    )
    return c.json({ granted })
  })

  authed.get('/design/files/:fileId/link', (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'viewer')
    if (role instanceof Response) return role
    const enabled = [...state.links.values()].includes(fileId)
    return c.json({ enabled, createdAt: enabled ? NOW : null })
  })
  authed.post('/design/files/:fileId/link', (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'editor')
    if (role instanceof Response) return role
    for (const [token, id] of state.links) if (id === fileId) state.links.delete(token)
    const token = `rrl_${next('link')}-0123456789abcdef`
    state.links.set(token, fileId)
    return c.json({ token, createdAt: NOW }, 201)
  })
  authed.delete('/design/files/:fileId/link', (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'editor')
    if (role instanceof Response) return role
    for (const [token, id] of state.links) if (id === fileId) state.links.delete(token)
    return c.body(null, 204)
  })

  authed.post('/design/files/:fileId/uploads', async (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'editor')
    if (role instanceof Response) return role
    const request = await parse(c, createUploadSchema)
    if (!request) return fail(c, 400, 'invalid_request')
    const uploadId = next('upload')
    const key = `files/${fileId}/${request.kind}s/${uploadId}`
    state.uploads.set(uploadId, { fileId, kind: request.kind, size: request.size, key })
    return c.json(
      {
        uploadId,
        upload: {
          url: `${BLOB_ORIGIN}/${key}`,
          method: 'PUT',
          headers: { 'content-type': 'application/octet-stream', 'x-amz-tagging': 'state=pending' },
          expiresAt: NOW
        }
      },
      201
    )
  })
  authed.put('/design/files/:fileId/snapshot', async (c) => {
    const fileId = c.req.param('fileId')
    const role = access(c, fileId, 'editor')
    if (role instanceof Response) return role
    const request = await parse(c, commitSnapshotSchema)
    const upload = request ? state.uploads.get(request.uploadId) : undefined
    if (!request || !upload || upload.fileId !== fileId || upload.kind !== 'snapshot') {
      return fail(c, 404, 'not_found')
    }
    if (state.blobs.get(upload.key)?.byteLength !== upload.size)
      return fail(c, 400, 'invalid_request')
    const current = state.snapshots.get(fileId)?.revision ?? 0
    if (request.baseRevision !== current) return fail(c, 409, 'conflict')
    const revision = current + 1
    state.snapshots.set(fileId, { revision, epoch: request.epoch, key: upload.key })
    state.uploads.delete(request.uploadId)
    const file = state.files.get(fileId)
    if (file) state.files.set(fileId, { ...file, snapshotRevision: revision })
    return c.json({ revision, size: upload.size, epoch: request.epoch })
  })
}

/** Answers presigned storage links: PUT stores the bytes, GET returns them. */
export async function answerBlob(
  state: MockDesignState,
  url: URL,
  init?: RequestInit
): Promise<Response> {
  const key = decodeURIComponent(url.pathname.slice(1))
  if (init?.method === 'PUT') {
    const body = init.body instanceof Blob ? new Uint8Array(await init.body.arrayBuffer()) : null
    if (!body) return new Response(null, { status: 400 })
    state.blobs.set(key, body)
    return new Response(null, { status: 200 })
  }
  const blob = state.blobs.get(key)
  if (!blob) return new Response(null, { status: 404 })
  const copy = new Uint8Array(blob.byteLength)
  copy.set(blob)
  return new Response(copy, { status: 200, headers: { 'content-length': String(blob.byteLength) } })
}
