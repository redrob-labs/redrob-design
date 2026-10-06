import { appPreferences, type CanvasRenderingMode } from '@/app/settings/preferences/store'
import { IS_BROWSER } from '@/constants'

export type SceneRendererMode = CanvasRenderingMode
/**
 * `default` uses the Redrob Cloud relay when signed in and peer-to-peer
 * otherwise; `relay` and `p2p` force one; `test` is the dev-only local relay.
 */
export type CollaborationTransportMode = 'default' | 'test' | 'relay' | 'p2p'

const TRANSPORT_MODES: readonly CollaborationTransportMode[] = ['default', 'test', 'relay', 'p2p']

function transportMode(value: string | null): CollaborationTransportMode {
  return TRANSPORT_MODES.find((mode) => mode === value) ?? 'default'
}

export interface AppRuntimeConfig {
  test: boolean
  navigationBenchmark: boolean
  recentFiles: boolean
  showChrome: boolean
  showRulers: boolean
  sceneRenderer: SceneRendererMode
  sceneRendererOverride: boolean
  collaborationTransport: CollaborationTransportMode
  collaborationRelayURL: string | null
}

export function parseAppRuntimeConfig(
  search: string,
  preferredRenderer: SceneRendererMode = 'retained'
): AppRuntimeConfig {
  const params = new URLSearchParams(search)
  const renderer = params.get('renderer')
  const sceneRenderer =
    renderer === 'tiled' || renderer === 'retained' ? renderer : preferredRenderer
  return {
    test: params.has('test'),
    navigationBenchmark: params.has('navigation-benchmark'),
    recentFiles: params.has('recent-files'),
    showChrome: !params.has('no-chrome'),
    showRulers: !params.has('no-rulers'),
    sceneRenderer,
    sceneRendererOverride: renderer === 'tiled' || renderer === 'retained',
    collaborationTransport: transportMode(params.get('collabTransport')),
    collaborationRelayURL: params.get('collabRelay')
  }
}

export const appRuntimeConfig = parseAppRuntimeConfig(
  IS_BROWSER ? window.location.search : '',
  appPreferences.value.rendering.canvasMode
)
