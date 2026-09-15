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
