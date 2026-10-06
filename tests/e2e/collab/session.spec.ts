import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { WebSocketServer, type WebSocket } from 'ws'

import { CanvasHelper } from '#tests/helpers/canvas'
import { routeConsoleToMock } from '#tests/helpers/console/route'
import { createMockConsole, type MockConsole } from '#tests/helpers/console/server'
import { openSettingsFromMenu } from '#tests/helpers/menu'

/**
 * A ticketed relay in the shape of Redrob Console's: each ticket admits one connection into the
 * room of the file it was issued for, and frames go to the others in that room unchanged. It
 * records every binary payload, which is all the relay ever sees of the document.
 */
async function startRelay(tickets: Map<string, string>) {
  const rooms = new Map<string, Set<WebSocket>>()
  const payloads: Buffer[] = []
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  server.on('connection', (socket, request) => {
    const ticket = new URL(request.url ?? '/', 'ws://relay').searchParams.get('ticket') ?? ''
    const fileId = tickets.get(ticket)
    if (!fileId) {
      socket.close(4000, 'unauthorized')
      return
    }
    tickets.delete(ticket)
    const room = rooms.get(fileId) ?? new Set<WebSocket>()
    rooms.set(fileId, room)
    room.add(socket)
    let senderId: string | null = null
    socket.on('message', (data, isBinary) => {
      const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
      if (isBinary) payloads.push(bytes)
      else senderId ??= (JSON.parse(bytes.toString()) as { senderId?: string }).senderId ?? null
      for (const peer of room) {
        if (peer !== socket && peer.readyState === peer.OPEN) peer.send(bytes, { binary: isBinary })
      }
    })
    socket.on('close', () => {
      room.delete(socket)
      if (!senderId) return
      const leave = JSON.stringify({ v: 1, type: 'leave', senderId })
      for (const peer of room) if (peer.readyState === peer.OPEN) peer.send(leave)
    })
  })
  await new Promise<void>((resolve) => {
    server.once('listening', () => resolve())
  })
  const address = server.address()
  if (typeof address === 'string' || address === null) throw new Error('Test relay unavailable')
  return {
    url: `ws://127.0.0.1:${address.port}/v1/rooms`,
    payloads,
    close: () =>
      new Promise<void>((resolve) => {
        for (const room of rooms.values()) for (const socket of room) socket.terminate()
        server.close(() => resolve())
      })
  }
}

type Peer = { context: BrowserContext; page: Page }

async function openApp(browser: Browser, mock: MockConsole): Promise<Peer> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await routeConsoleToMock(page, mock)
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  return { context, page }
}

async function signIn(page: Page) {
  await openSettingsFromMenu(page)
  await page.getByTestId('settings-section-cloud').click()
  const panel = page.getByTestId('settings-cloud-panel')
  await panel.getByRole('button', { name: 'Sign in with Redrob Console' }).click()
  await expect(panel.locator('[data-slot="cloud-account"]')).toHaveText(
    'Signed in as Jane Designer.',
    { timeout: 20_000 }
  )
  await page.keyboard.press('Escape')
}

const nodeName = (page: Page, id: string) =>
  page.evaluate((nodeId) => window.redrobDesign?.getStore?.().graph.getNode(nodeId)?.name, id)

test('a shared file is edited live through the relay, end-to-end encrypted, and a view link only watches', async ({
  browser
}) => {
  test.setTimeout(120_000)
  const mock = createMockConsole()
  mock.state.pendingPolls = 0
  const relay = await startRelay(mock.state.design.relayTickets)
  mock.state.design.relay.url = relay.url
  const peers: Peer[] = []
  try {
    const owner = await openApp(browser, mock)
    peers.push(owner)
    await signIn(owner.page)

    const nodeId = await owner.page.evaluate(() => {
      const store = window.redrobDesign?.getStore?.()
      if (!store) throw new Error('store not exposed')
      store.state.documentName = 'Launch plan'
      return store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        name: 'Secret pricing card',
        x: 160,
        y: 140,
        width: 120,
        height: 80
      }).id
    })

    await owner.page.getByTestId('collab-share-button').click()
    await owner.page.getByTestId('collab-share-file').click()
    await expect(owner.page.getByTestId('collab-members')).toContainText('You')
    await expect
      .poll(() => owner.page.evaluate(() => window.redrobDesign?.test?.collab?.status()))
      .toBe('live')

    await owner.page.getByTestId('collab-view-link').click()
    await expect.poll(() => mock.state.design.links.size).toBe(1)
    const link = await owner.page.evaluate(() => navigator.clipboard.readText()).catch(() => null)
    const viewLink =
      link ??
      (await owner.page.evaluate(async () => {
        const files = await import('/src/app/cloud/files/index.ts' as string)
        const store = window.redrobDesign?.getStore?.()
        const binding = store ? files.cloudBindingOf(store) : null
        return binding ? files.createViewLink(binding) : ''
      }))
    expect(viewLink).toContain('#')

    // Someone with only the link, signed out, in another browser.
    const viewer = await openApp(browser, mock)
    peers.push(viewer)
    await viewer.page.getByTestId('collab-share-button').click()
    await viewer.page.getByTestId('collab-open-input').fill(viewLink)
    await viewer.page.getByTestId('collab-open-button').click()
    await expect.poll(() => nodeName(viewer.page, nodeId)).toBe('Secret pricing card')
    await expect
      .poll(() => viewer.page.evaluate(() => window.redrobDesign?.getStore?.().state.viewOnly))
      .toBe(true)
    await expect
      .poll(() => viewer.page.evaluate(() => window.redrobDesign?.test?.collab?.status()))
      .toBe('live')

    // The owner's edit reaches the viewer live.
    await owner.page.evaluate((id) => {
      window.redrobDesign?.getStore?.().updateNode(id, { name: 'Edited by the owner' })
    }, nodeId)
    await expect.poll(() => nodeName(viewer.page, nodeId)).toBe('Edited by the owner')

    // A change made on the viewer's side goes nowhere.
    await viewer.page.evaluate((id) => {
      window.redrobDesign?.getStore?.().updateNode(id, { name: 'Changed by the viewer' })
    }, nodeId)
    await viewer.page.waitForTimeout(1000)
    expect(await nodeName(owner.page, nodeId)).toBe('Edited by the owner')

    // Presence: the owner sees the viewer's cursor.
    await viewer.page.evaluate(() => {
      const store = window.redrobDesign?.getStore?.()
      if (store)
        window.redrobDesign?.test?.collab?.updateCursor(420, 260, store.state.currentPageId)
    })
    await expect
      .poll(() =>
        owner.page.evaluate(() => window.redrobDesign?.getStore?.().state.remoteCursors.length)
      )
      .toBe(1)

    // The relay forwarded the document and never saw it.
    expect(relay.payloads.length).toBeGreaterThan(0)
    for (const payload of relay.payloads) {
      expect(payload.includes(Buffer.from('Edited by the owner'))).toBe(false)
      expect(payload.includes(Buffer.from('Secret pricing card'))).toBe(false)
    }
    // Nor did the bucket.
    for (const blob of mock.state.design.blobs.values()) {
      expect(Buffer.from(blob).includes(Buffer.from('Secret pricing card'))).toBe(false)
    }

    await viewer.context.close()
    peers.splice(peers.indexOf(viewer), 1)
    await expect
      .poll(() =>
        owner.page.evaluate(() => window.redrobDesign?.getStore?.().state.remoteCursors.length)
      )
      .toBe(0)
  } finally {
    for (const peer of peers) await peer.context.close()
    await relay.close()
  }
})
