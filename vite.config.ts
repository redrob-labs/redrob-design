import process from 'node:process'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

import packageJson from './package.json'
import { AUTOMATION_HTTP_PORT } from './packages/core/src/constants'
import { devAutomationRoute } from './src/app/automation/bridge/portless-route'
import { createRedrobAliases } from './vite/aliases'
import { localAutomationToken, redrobAutomationPlugin } from './vite/automation'
import { copyCanvasKitAssetsPlugin } from './vite/canvaskit-assets'
import { redrobPwaPlugin } from './vite/pwa'
import { rawMarkdownPlugin } from './vite/raw-markdown'
import { createDevServerOptions } from './vite/server'

const host = process.env.TAURI_DEV_HOST
const automationRoute = devAutomationRoute(process.env.PORTLESS_URL, AUTOMATION_HTTP_PORT)

// Bake Redrob Code engine resolution into the webview bundle. Vite only exposes
// `VITE_*` keys on `import.meta.env` by default, and Tauri production webviews
// cannot read the host process env — so without this, `ACP_AGENTS` falls back
// to PATH `redrob` even when `REDROB_CODE_DEV_ROOT` is set for the desktop
// process. Prefer explicit `VITE_*` overrides, then the unprefixed host keys
// used by cloud/dev launchers.
const redrobCodeDevRoot =
  process.env.VITE_REDROB_CODE_DEV_ROOT || process.env.REDROB_CODE_DEV_ROOT || ''
// Shell capabilities allowlist `cmd: "bun"` by bare name. An absolute
// `REDROB_CODE_BUN` from the host would fail the Tauri spawn scope check, so
// collapse path-shaped values to the allowlisted command and rely on PATH.
const redrobCodeBunRaw =
  process.env.VITE_REDROB_CODE_BUN || process.env.REDROB_CODE_BUN || ''
const redrobCodeBun = redrobCodeBunRaw.includes('/') || redrobCodeBunRaw.includes('\\')
  ? 'bun'
  : redrobCodeBunRaw
const redrobCodeBin = process.env.VITE_REDROB_CODE_BIN || process.env.REDROB_CODE_BIN || ''

// Promote onto `process.env.VITE_*` BEFORE Vite snapshots `import.meta.env`.
// Defining individual `import.meta.env.VITE_*` member expressions does not
// populate a copied `import.meta.env` object (see ambientRedrobCodeEnv), so
// the env-plugin path is what actually reaches ACP_AGENTS.
if (redrobCodeDevRoot) process.env.VITE_REDROB_CODE_DEV_ROOT = redrobCodeDevRoot
if (redrobCodeBun) process.env.VITE_REDROB_CODE_BUN = redrobCodeBun
if (redrobCodeBin) process.env.VITE_REDROB_CODE_BIN = redrobCodeBin

export default defineConfig(async ({ command }) => ({
  resolve: {
    alias: createRedrobAliases(__dirname)
  },
  define: {
    __REDROB_APP_VERSION__: JSON.stringify(packageJson.version),
    __REDROB_LOCAL_AUTOMATION_TOKEN__: JSON.stringify(localAutomationToken(command)),
    __REDROB_LOCAL_AUTOMATION_URL__: JSON.stringify(automationRoute.browserURL),
    __REDROB_LOCAL_AUTOMATION_HTTP_URL__: JSON.stringify(
      automationRoute.browserURL.replace(/^ws/, 'http')
    )
  },
  plugins: [
    rawMarkdownPlugin(),
    copyCanvasKitAssetsPlugin(),
    tailwindcss(),
    Icons({ compiler: 'vue3' }),
    Components({ resolvers: [IconsResolver({ prefix: 'icon' })] }),
    redrobAutomationPlugin(command, host),
    vue(),
    redrobPwaPlugin()
  ],
  clearScreen: false,
  build: {
    chunkSizeWarningLimit: 2500
  },
  server: createDevServerOptions(host)
}))
