import {
  LEXICON,
  MANIFEST,
  PROTOTYPES,
  RouteLabeller,
  SentenceEncoder,
  type OrtRuntime,
  type RouteLabel
} from '@redrob-labs/route-labeller'

import { REDROB_CONSOLE_MODEL } from '@redrob-design/core/constants'

import type { FetchFunction } from '@/app/http/types'

/**
 * Route labels for Redrob Auto, computed in this window.
 *
 * Console routes `auto` on the ModelGuide: the request's profession and task, then that cell's best
 * model at its ranked effort. The label comes from here, with @redrob-labs/route-labeller - the same
 * package and model Redrob Cowork and Redrob Office use - and rides on the request as `redrob.route`.
 * Only the two ids and the runners-up leave the machine; the text was going to Console anyway.
 *
 * The labeller starts on words alone, the same pass Console runs on an unlabelled request, and gains
 * its embedding pass once the model (about 140 MB) is fetched from the pinned Hugging Face revision
 * and cached in Cache Storage. Every file is checked against the package's manifest before it is
 * parsed or run, whichever cache it came from. The model runs on onnxruntime-web (WebAssembly).
 */

const CACHE_NAME = 'redrob-route-model'
const LABEL_TIMEOUT_MS = 2_000

let labeller = new RouteLabeller(LEXICON, null, null)
let upgrading: Promise<void> | null = null

async function cachedBytes(url: string, fetchImpl: FetchFunction): Promise<Uint8Array> {
  const cache =
    typeof caches === 'undefined' ? null : await caches.open(CACHE_NAME).catch(() => null)
  const hit = await cache?.match(url)
  if (hit) return new Uint8Array(await hit.arrayBuffer())
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  await cache?.put(url, new Response(bytes.slice())).catch(() => undefined)
  return bytes
}

/** onnxruntime-web, in the shape the labeller calls: one session factory and one tensor type. */
async function wasmRuntime(): Promise<OrtRuntime> {
  const ort = await import('onnxruntime-web')
  ort.env.wasm.numThreads = 1
  return {
    InferenceSession: {
      create: (model, options) => ort.InferenceSession.create(model, options)
    },
    Tensor: ort.Tensor
  }
}

async function upgrade(fetchImpl: FetchFunction): Promise<void> {
  const urls = [MANIFEST.model.url, MANIFEST.tokenizer.url, MANIFEST.dense.url]
  const [modelURL, tokenizerURL, denseURL] = urls
  if (!modelURL || !tokenizerURL || !denseURL)
    throw new Error('the route model manifest names no URLs')
  const [model, tokenizer, dense] = await Promise.all([
    cachedBytes(modelURL, fetchImpl),
    cachedBytes(tokenizerURL, fetchImpl),
    cachedBytes(denseURL, fetchImpl)
  ])
  const encoder = await SentenceEncoder.load(
    { manifest: MANIFEST, model, tokenizer, dense },
    await wasmRuntime()
  )
  labeller = new RouteLabeller(LEXICON, PROTOTYPES, encoder)
}

function startUpgrade(fetchImpl: FetchFunction): Promise<void> {
  upgrading ??= upgrade(fetchImpl).catch((error: unknown) => {
    console.warn('[route-labeller] labelling by words alone:', error)
  })
  return upgrading
}

/**
 * Starts fetching the model at launch rather than on the first request. Until it has arrived, a
 * request is labelled by words alone, which Console routes on its legacy table rather than the
 * ModelGuide - so the sooner the model is here, the sooner Auto routes on the guide.
 */
export function prefetchRouteModel(fetchImpl: FetchFunction): void {
  void startUpgrade(fetchImpl)
}

/** The label for one request's text. Starts the model fetch if launch did not; never throws. */
export async function labelRoute(
  text: string,
  fetchImpl: FetchFunction
): Promise<RouteLabel | null> {
  void startUpgrade(fetchImpl)
  try {
    return await labeller.label(text)
  } catch {
    return null
  }
}

type WirePart = { type?: unknown; text?: unknown }
type WireMessage = { role?: unknown; content?: unknown }
type ChatBody = { model?: unknown; messages?: unknown; redrob?: unknown }

function isChatBody(value: unknown): value is ChatBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function partText(part: WirePart): string {
  return part.type === 'text' && typeof part.text === 'string' ? part.text : ''
}

/** The newest user turn's text, from an OpenAI-format message list. */
function newestUserText(messages: unknown): string {
  if (!Array.isArray(messages)) return ''
  const list: WireMessage[] = messages
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index]
    if (message.role !== 'user') continue
    if (typeof message.content === 'string') return message.content
    if (Array.isArray(message.content)) {
      const parts: WirePart[] = message.content
      return parts.map(partText).join('\n').trim()
    }
  }
  return ''
}

function requestURL(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

/**
 * A fetch for the Redrob provider that adds `redrob.route` to every `auto` chat completion.
 *
 * At the fetch rather than in the AI SDK's provider options, because the request body is the one
 * place the newest user turn and the model are both known. Fails open: a body that is not JSON, a
 * named model, or a labeller that is slow or fails sends the request exactly as it was.
 */
export function labellingFetch(base: FetchFunction): FetchFunction {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!requestURL(input).endsWith('/chat/completions') || typeof init?.body !== 'string') {
      return base(input, init)
    }
    let body: unknown
    try {
      body = JSON.parse(init.body)
    } catch {
      return base(input, init)
    }
    if (!isChatBody(body) || body.model !== REDROB_CONSOLE_MODEL) return base(input, init)
    const text = newestUserText(body.messages)
    if (!text) return base(input, init)

    let timer: ReturnType<typeof setTimeout> | undefined
    const route = await Promise.race([
      labelRoute(text, base),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), LABEL_TIMEOUT_MS)
      })
    ])
    if (timer) clearTimeout(timer)
    if (!route) return base(input, init)
    const redrob = isChatBody(body.redrob) ? body.redrob : {}
    return base(input, { ...init, body: JSON.stringify({ ...body, redrob: { ...redrob, route } }) })
  }
}
