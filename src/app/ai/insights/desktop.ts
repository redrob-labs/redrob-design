import { createWorkClassifier } from '@redrob-labs/work-labeller'
import type { OrtRuntime } from '@redrob-labs/work-labeller'

import { IS_TAURI } from '@redrob-design/core/constants'

import { ORT_WASM_PATH, type DownloadProgress, type WorkModelDeps } from '@/app/ai/insights/model'

/** Emitted by `download_verified` in `desktop/src/insights/mod.rs`. */
const PROGRESS_EVENT = 'insights-model-progress'

type ProgressPayload = { revision: string; file: string; received: number; total: number | null }

function isProgressPayload(value: unknown): value is ProgressPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'file' in value &&
    typeof value.file === 'string' &&
    'received' in value &&
    typeof value.received === 'number' &&
    'total' in value &&
    (value.total === null || typeof value.total === 'number')
  )
}

async function loadRuntime(): Promise<OrtRuntime> {
  const ort = await import('onnxruntime-web/wasm')
  ort.env.wasm.wasmPaths = ORT_WASM_PATH
  // One thread: more need a cross-origin isolated page (COOP/COEP), which Design does not serve.
  ort.env.wasm.numThreads = 1
  return ort
}

/** The work model's dependencies in the app: Rust downloads, the fs plugin reads, WASM runs it. */
export function appWorkModelDeps(): WorkModelDeps {
  return {
    isDesktop: IS_TAURI,
    async download(request, onProgress) {
      const [{ invoke }, { listen }] = await Promise.all([
        import('@tauri-apps/api/core'),
        import('@tauri-apps/api/event')
      ])
      const unlisten = await listen<unknown>(PROGRESS_EVENT, ({ payload }) => {
        if (!isProgressPayload(payload)) return
        const progress: DownloadProgress = {
          file: payload.file,
          received: payload.received,
          total: payload.total
        }
        onProgress(progress)
      })
      try {
        return await invoke<string>('download_verified', { request })
      } finally {
        unlisten()
      }
    },
    async readFile(directory, name) {
      const [{ readFile }, { join }] = await Promise.all([
        import('@tauri-apps/plugin-fs'),
        import('@tauri-apps/api/path')
      ])
      return readFile(await join(directory, name))
    },
    loadRuntime,
    createClassifier: (files, ort) => createWorkClassifier(files, ort, { threads: 1 })
  }
}
