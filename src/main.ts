// Adopt legacy `open-pencil:` localStorage keys before any store reads them.
import '@/app/storage/legacy-prefix-migration'
import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import './app.css'
import { startInsights } from '@/app/ai/insights/service'
import { prefetchRouteModelForRedrob } from '@/app/ai/model-guide'
import { preloadFonts } from '@/app/editor/fonts'
import { IS_TAURI } from '@/constants'

import App from './App.vue'
import router from './router'

preloadFonts()
const head = createHead()
createApp(App).use(router).use(head).mount('#app')
// Redrob Auto routes on the Model Guide once the on-device labeller's model is here
prefetchRouteModelForRedrob()
// Design's part of the Redrob Console's AI work insights: labels only, never content
startInsights()

if (!IS_TAURI) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
    return undefined
  })
}
