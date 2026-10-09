import { copyFileSync, createReadStream, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Connect, Plugin, ResolvedConfig } from 'vite'

/**
 * onnxruntime-web's single-threaded WASM runtime for the AI work-insights classifier. The app sets
 * `ort.env.wasm.wasmPaths` to `/ort/`, so these are copied into `public/ort/` for builds and served
 * from `node_modules` in development. The `.mjs` is the loader onnxruntime imports beside the WASM.
 */
const ORT_FILES = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'] as const
const ORT_SOURCE = 'node_modules/onnxruntime-web/dist'
const ORT_ROUTE = '/ort/'

function contentType(file: string): string {
  return file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript'
}

function serveOrtAssets(root: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? ''
    const file = ORT_FILES.find((name) => pathname === `${ORT_ROUTE}${name}`)
    const path = file ? resolve(root, ORT_SOURCE, file) : null
    if (!file || !path || !existsSync(path)) {
      next()
      return
    }
    res.setHeader('Content-Type', contentType(file))
    res.setHeader('Cache-Control', 'no-cache')
    createReadStream(path).on('error', next).pipe(res)
  }
}

export function ortAssetsPlugin(): Plugin {
  let root = process.cwd()

  return {
    name: 'copy-ort-wasm',
    enforce: 'pre',
    configResolved(config: ResolvedConfig) {
      root = config.root
    },
    buildStart() {
      const destination = resolve(root, 'public', ORT_ROUTE.slice(1))
      for (const file of ORT_FILES) {
        const source = resolve(root, ORT_SOURCE, file)
        if (!existsSync(source)) {
          console.warn(`[copy-ort-wasm] Missing source (run \`bun install\`): ${source}`)
          continue
        }
        mkdirSync(destination, { recursive: true })
        copyFileSync(source, resolve(destination, file))
      }
    },
    configureServer(server) {
      server.middlewares.use(serveOrtAssets(server.config.root))
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveOrtAssets(server.config.root))
    }
  }
}
