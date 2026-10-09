import { MANIFEST } from '@redrob-labs/work-labeller'
import type { OrtRuntime, WorkClassifier, WorkModelManifest } from '@redrob-labs/work-labeller'
import { shallowRef } from 'vue'

/** Where the webview finds onnxruntime-web's WASM files; `vite/ort-assets.ts` serves them. */
export const ORT_WASM_PATH = '/ort/'

/** A failed download is tried again after these delays, then every two hours. */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const

export type WorkModelState =
  | { status: 'unavailable' }
  | { status: 'absent' }
  | { status: 'downloading'; percent: number }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'failed'; reason: string; retryAt: number }

export type DownloadFile = { name: string; url: string; sha256: string }
export type DownloadProgress = { file: string; received: number; total: number | null }

export type WorkModelDeps = {
  /** Only the desktop app downloads: the release assets send no CORS headers. */
  isDesktop: boolean
  /** Runs `download_verified`; resolves with the revision's folder. */
  download: (
    request: { revision: string; files: DownloadFile[] },
    onProgress: (progress: DownloadProgress) => void
  ) => Promise<string>
  readFile: (directory: string, name: string) => Promise<Uint8Array>
  loadRuntime: () => Promise<OrtRuntime>
  createClassifier: (
    files: { model: Uint8Array; tokenizer: Uint8Array },
    ort: OrtRuntime
  ) => Promise<WorkClassifier>
  now?: () => number
  setTimer?: (run: () => void, ms: number) => void
  manifest?: WorkModelManifest
}

function reasonOf(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.slice(0, 200)
}

/**
 * The work classifier's model, downloaded on first use.
 *
 * Nothing happens until `request()`, which the chat calls after a Redrob chat finishes, so the
 * download never competes with start-up or a streaming answer. There is no prompt: Settings shows
 * the state. The browser build never downloads and labels sessions structurally only.
 */
export function createWorkModel(deps: WorkModelDeps) {
  const manifest = deps.manifest ?? MANIFEST
  const now = deps.now ?? Date.now
  const setTimer = deps.setTimer ?? ((run, ms) => void setTimeout(run, ms))
  const state = shallowRef<WorkModelState>(
    deps.isDesktop ? { status: 'absent' } : { status: 'unavailable' }
  )
  let classifier: WorkClassifier | null = null
  let failures = 0
  let running: Promise<void> | null = null

  function files(): DownloadFile[] {
    return [manifest.model, manifest.tokenizer].map(({ file, url, sha256 }) => ({
      name: file,
      url,
      sha256
    }))
  }

  async function run(): Promise<void> {
    const progress = new Map<string, DownloadProgress>()
    state.value = { status: 'downloading', percent: 0 }
    try {
      const directory = await deps.download(
        { revision: manifest.revision, files: files() },
        (event) => {
          progress.set(event.file, event)
          let received = 0
          let total = 0
          for (const entry of progress.values()) {
            received += entry.received
            total += entry.total ?? entry.received
          }
          // Held under 100 until the model has loaded.
          const percent = total > 0 ? Math.min(99, Math.floor((received / total) * 100)) : 0
          state.value = { status: 'downloading', percent }
        }
      )
      state.value = { status: 'loading' }
      const [model, tokenizer, ort] = await Promise.all([
        deps.readFile(directory, manifest.model.file),
        deps.readFile(directory, manifest.tokenizer.file),
        deps.loadRuntime()
      ])
      // Hashed again against the manifest before anything is parsed.
      classifier = await deps.createClassifier({ model, tokenizer }, ort)
      failures = 0
      state.value = { status: 'ready' }
    } catch (error) {
      const delay = RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)]
      failures += 1
      const retryAt = now() + delay
      state.value = { status: 'failed', reason: reasonOf(error), retryAt }
      setTimer(() => void request(), delay)
    }
  }

  /** Starts the download in the background if it is needed and due. */
  function request(): Promise<void> {
    if (!deps.isDesktop || classifier) return Promise.resolve()
    if (running) return running
    const current = state.value
    if (current.status === 'failed' && now() < current.retryAt) return Promise.resolve()
    running = run().finally(() => {
      running = null
    })
    return running
  }

  return {
    state,
    request,
    classifier: (): WorkClassifier | null => classifier
  }
}

export type WorkModel = ReturnType<typeof createWorkModel>
