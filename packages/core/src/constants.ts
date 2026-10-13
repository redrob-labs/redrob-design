import type { Fill, Stroke } from '@redrob-design/scene-graph'
import type { Color } from '@redrob-design/scene-graph/primitives'

export const IS_BROWSER = typeof window !== 'undefined'
export const IS_TAURI = IS_BROWSER && '__TAURI_INTERNALS__' in window

export const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 }
export const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 }
export const DEFAULT_SHADOW_COLOR: Color = { r: 0, g: 0, b: 0, a: 0.25 }
// Overlay colours: the Redrob design system light values (see @redrob-labs/ui tokens.json). The app
// replaces them per theme through EditorState.canvasTheme; headless rendering uses these.
// action-primary #2b52ff
export const SELECTION_COLOR = { r: 0.1686, g: 0.3216, b: 1, a: 1 } satisfies Color
// product-design #c162f4, Redrob Design's product mark
export const COMPONENT_COLOR = { r: 0.7569, g: 0.3843, b: 0.9569, a: 1 } satisfies Color
// accent-pink-3 #ff39ba
export const SNAP_COLOR = { r: 1, g: 0.2235, b: 0.7294, a: 1 } satisfies Color
// action-primary #2b52ff, for comment pins
export const COMMENT_PIN_COLOR = { r: 0.1686, g: 0.3216, b: 1, a: 1 } satisfies Color
// accent-orange-3 #ff9c1b
export const MEASUREMENT_COLOR = { r: 1, g: 0.6118, b: 0.1059, a: 1 } satisfies Color
export const MEASUREMENT_PILL_PADDING_X = 5
export const MEASUREMENT_PILL_HEIGHT = 18
export const MEASUREMENT_PILL_RADIUS = 3
export const MEASUREMENT_TEXT_BASELINE = 4
export const CANVAS_BG_COLOR = { r: 0.96, g: 0.96, b: 0.96, a: 1 } satisfies Color
export const CANVAS_BG_COLOR_DARK = { r: 0.173, g: 0.173, b: 0.173, a: 1 } satisfies Color // #2c2c2c, Figma-ish dark canvas

/**
 * Returns the canvas background to initialize new pages with. Defers
 * to the OS `prefers-color-scheme` so users on a dark desktop don't
 * get a white flash every time they open a document.
 *
 * NOTE: this is deliberately the runtime/new-page path only. The
 * `.fig` serialization path continues to write the static light
 * `CANVAS_BG_COLOR` so files stay portable — a dark-theme user saving
 * a file must not force darkness on recipients.
 */
export function getDefaultCanvasBgColor(): Color {
  if (IS_BROWSER) {
    const params = new URLSearchParams(window.location.search)
    if ('env' in import.meta && import.meta.env.DEV && params.has('test')) {
      return CANVAS_BG_COLOR
    }
  }

  if (
    IS_BROWSER &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return CANVAS_BG_COLOR_DARK
  }
  return CANVAS_BG_COLOR
}

export const SNAP_THRESHOLD_SCREEN_PX = 5

export const RULER_SIZE = 20
// surface-raised #f8f9fb, border-strong #7c8390, ink-muted #686e78 (light)
export const RULER_BG_COLOR = { r: 0.9725, g: 0.9765, b: 0.9843, a: 1 } satisfies Color
export const RULER_TICK_COLOR = { r: 0.4863, g: 0.5137, b: 0.5647, a: 1 } satisfies Color
export const RULER_TEXT_COLOR = { r: 0.4078, g: 0.4314, b: 0.4706, a: 1 } satisfies Color
export const RULER_BADGE_HEIGHT = 14
export const RULER_BADGE_PADDING = 3
export const RULER_BADGE_RADIUS = 2
export const RULER_BADGE_EXCLUSION = 30
export const RULER_TEXT_BASELINE = 0.65
export const RULER_MAJOR_TICK = 0.5
export const RULER_MINOR_TICK = 0.25
export const RULER_HIGHLIGHT_ALPHA = 0.3

export const PEN_HANDLE_RADIUS = 2.5
export const PEN_VERTEX_RADIUS = 3
export const PEN_CLOSE_RADIUS_BOOST = 2
export const PEN_PATH_STROKE_WIDTH = 2
export const PARENT_OUTLINE_ALPHA = 0.5
export const PARENT_OUTLINE_DASH = 4
export const DEFAULT_FONT_FAMILY = 'Inter'
export const DEFAULT_FONT_SIZE = 14
export const DEFAULT_STROKE_MITER_LIMIT = 4
export const LABEL_FONT_SIZE = 11
export const SIZE_FONT_SIZE = 10

export const HANDLE_HALF_SIZE = 3

export const LABEL_OFFSET_Y = 8
export const SIZE_PILL_PADDING_X = 6
export const SIZE_PILL_PADDING_Y = 6
export const SIZE_PILL_HEIGHT = 18
export const SIZE_PILL_RADIUS = 4
export const SIZE_PILL_TEXT_OFFSET_Y = 13

export const MARQUEE_FILL_ALPHA = 0.08
export const SELECTION_DASH_ALPHA = 0.6
export const DROP_HIGHLIGHT_ALPHA = 0.8
export const DROP_HIGHLIGHT_STROKE = 2

export const LAYOUT_INDICATOR_STROKE = 2
export const AUTO_LAYOUT_HOVER_TICK_LENGTH = 12
export const AUTO_LAYOUT_HOVER_STRIPE_GAP = 8
export const AUTO_LAYOUT_HOVER_STRIPE_WIDTH = 1
export const AUTO_LAYOUT_HOVER_STROKE_WIDTH = 1.5
export const AUTO_LAYOUT_HOVER_CHILD_DASH = 4
export const AUTO_LAYOUT_HOVER_VALUE_OFFSET = 18
export const AUTO_LAYOUT_HOVER_VALUE_PILL_HEIGHT = 22
export const AUTO_LAYOUT_HOVER_VALUE_PILL_RADIUS = 5
export const AUTO_LAYOUT_HOVER_VALUE_PILL_PADDING_X = 5
export const AUTO_LAYOUT_HOVER_GAP_REGION_TOLERANCE = 12
export const AUTO_LAYOUT_HOVER_TICK_HIT_TOLERANCE = 8
export const AUTO_LAYOUT_HOVER_PADDING_REGION_TOLERANCE = 20
export const AUTO_LAYOUT_PADDING_EDITOR_OFFSET_X = 18
export const AUTO_LAYOUT_PADDING_EDITOR_OFFSET_Y = 36
// accent-sky-3 #2f8dff (padding) and accent-pink-3 #ff39ba (gap)
export const AUTO_LAYOUT_HOVER_BLUE = { r: 0.1843, g: 0.5529, b: 1, a: 0.82 } satisfies Color
export const AUTO_LAYOUT_HOVER_BLUE_FILL = { r: 0.1843, g: 0.5529, b: 1, a: 0.1 } satisfies Color
export const AUTO_LAYOUT_HOVER_MAGENTA = { r: 1, g: 0.2235, b: 0.7294, a: 0.78 } satisfies Color
export const AUTO_LAYOUT_HOVER_MAGENTA_FILL = { r: 1, g: 0.2235, b: 0.7294, a: 0.1 } satisfies Color

export const SECTION_CORNER_RADIUS = 5
export const SECTION_TITLE_HEIGHT = 24
export const SECTION_TITLE_PADDING_X = 8
export const SECTION_TITLE_RADIUS = 5
export const SECTION_TITLE_FONT_SIZE = 12
export const SECTION_TITLE_GAP = 6

export const COMPONENT_SET_DASH = 6
export const COMPONENT_SET_DASH_GAP = 4
export const COMPONENT_SET_BORDER_WIDTH = 1.5
export const COMPONENT_LABEL_FONT_SIZE = 11
export const COMPONENT_LABEL_GAP = 6
export const COMPONENT_LABEL_ICON_SIZE = 10
export const COMPONENT_LABEL_ICON_GAP = 4

export const RULER_TARGET_PIXEL_SPACING = 100
export const RULER_MAJOR_TOLERANCE = 0.01

export const FLASH_COLOR = SELECTION_COLOR
export const FLASH_ATTACK_MS = 200
export const FLASH_HOLD_MS = 400
export const FLASH_RELEASE_MS = 300
export const FLASH_STROKE_WIDTH = 2
export const FLASH_PADDING = 5
export const FLASH_OVERSHOOT = 30
export const FLASH_RADIUS = 4

export const AI_ACTIVE_COLOR = { r: 0.26, g: 0.52, b: 0.96 }
export const AI_DONE_COLOR = { r: 0.16, g: 0.73, b: 0.36 }
export const AI_PULSE_PERIOD_MS = 1500
export const AI_DONE_DURATION_MS = 800

export const TEXT_SELECTION_COLOR = { ...SELECTION_COLOR, a: 0.3 }
export const TEXT_CARET_COLOR = BLACK
export const TEXT_CARET_WIDTH = 1

export type ACPAgentID = 'redrob-code'

export interface ACPAgentDef {
  id: ACPAgentID
  name: string
  command: string
  args: string[]
  installCommand?: string
}

/** The Redrob Code engine ID. Redrob Design's design-by-prompt loop runs on it. */
export const REDROB_CODE_AGENT_ID = 'redrob-code' as const

/** The Design agent provider ID Redrob Design defaults to. */
export const REDROB_CODE_PROVIDER_ID = `acp:${REDROB_CODE_AGENT_ID}` as const

/** The one supported way to install the Redrob Code engine. */
export const REDROB_CODE_INSTALL_COMMAND = 'curl -fsSL https://code.redrob.ai/install | bash'

/**
 * A minimal environment shape so {@link resolveRedrobCodeCommand} can run both
 * in the browser (fed `import.meta.env`) and under bun/node tests (fed
 * `process.env`) without depending on either global existing.
 */
export type RedrobCodeEnv = Record<string, string | undefined>

export interface RedrobCodeCommand {
  command: string
  args: string[]
  /** Where the command was found, for diagnostics and log lines. */
  source: 'REDROB_CODE_BIN' | 'REDROB_CODE_DEV_ROOT' | 'PATH'
}

/**
 * The engine subcommand that starts the ACP stdio face. `--attach` makes it a thin client of the
 * user's shared daemon (one engine for every Redrob app) instead of an engine of its own. A bare
 * `redrob` opens the interactive TUI and never speaks ACP.
 */
export const REDROB_CODE_ACP_ARGS = ['acp', '--attach'] as const

/**
 * The engine subcommand that finds the user's shared daemon or starts it, and prints its record
 * (url, secret, pid, version) as one JSON line. The model profiles talk to that daemon over
 * `/v1/chat/completions`.
 */
export const REDROB_CODE_SERVICE_ARGS = ['service', 'start', '--json'] as const

/**
 * Locate the Redrob Code engine, mirroring the resolution the standalone engine
 * sidecar used. `REDROB_CODE_BIN` is the packaged-binary override, and
 * `REDROB_CODE_DEV_ROOT` runs a source checkout through bun; otherwise the
 * `redrob` binary is expected on PATH.
 *
 * Every form appends the {@link REDROB_CODE_ACP_ARGS} subcommand: the engine
 * only speaks the Agent Client Protocol over stdio under `redrob acp`. Without
 * it the bare `redrob` invocation launches the interactive TUI instead, so the
 * ACP handshake never starts.
 *
 * Kept pure (env passed in) so the ACP wiring can be unit-tested without a live
 * engine or any host environment.
 */
export function resolveRedrobCodeCommand(
  env: RedrobCodeEnv = {},
  subcommand: readonly string[] = REDROB_CODE_ACP_ARGS
): RedrobCodeCommand {
  const bin = env.REDROB_CODE_BIN?.trim()
  if (bin) return { command: bin, args: [...subcommand], source: 'REDROB_CODE_BIN' }

  const devRoot = env.REDROB_CODE_DEV_ROOT?.trim()
  if (devRoot) {
    return {
      command: env.REDROB_CODE_BUN?.trim() || 'bun',
      args: ['run', `${devRoot}/packages/redrob/src/index.ts`, ...subcommand],
      source: 'REDROB_CODE_DEV_ROOT'
    }
  }

  return { command: 'redrob', args: [...subcommand], source: 'PATH' }
}

/** The invocation that finds or starts the user's shared engine daemon ({@link REDROB_CODE_SERVICE_ARGS}). */
export function resolveRedrobCodeServiceCommand(env: RedrobCodeEnv = {}): RedrobCodeCommand {
  return resolveRedrobCodeCommand(env, REDROB_CODE_SERVICE_ARGS)
}

/**
 * What to tell someone when the Redrob Code engine cannot be found or started.
 *
 * Redrob Code is the only engine Redrob Design runs on, so a missing engine is a
 * setup problem to fix, not a reason to quietly run another provider.
 */
export function redrobCodeMissingMessage(reason?: string): string {
  return [
    'Redrob Design runs on the Redrob Code engine, and it could not be started.',
    reason,
    `Install the engine with "${REDROB_CODE_INSTALL_COMMAND}", or point REDROB_CODE_BIN at the binary.`
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
}

/**
 * Map Vite `VITE_*` build embeds (and plain overrides) onto the Redrob Code
 * env keys {@link resolveRedrobCodeCommand} understands.
 *
 * Exported for unit tests: Tauri production webviews must not rely on
 * `'env' in import.meta`, which stays false even when Vite inlined
 * `import.meta.env` into the bundle.
 */
export function redrobCodeEnvFromMeta(meta: RedrobCodeEnv): RedrobCodeEnv {
  return {
    REDROB_CODE_BIN: meta.REDROB_CODE_BIN ?? meta.VITE_REDROB_CODE_BIN,
    REDROB_CODE_DEV_ROOT: meta.REDROB_CODE_DEV_ROOT ?? meta.VITE_REDROB_CODE_DEV_ROOT,
    REDROB_CODE_BUN: meta.REDROB_CODE_BUN ?? meta.VITE_REDROB_CODE_BUN
  }
}

/**
 * The ambient environment used to resolve the built-in Redrob Code command at
 * module load. Reads `import.meta.env` (Vite build-time / renderer) first, then
 * `process.env` (bun/node), so an override configured either way is honored.
 *
 * Important: access `import.meta.env` directly. Guarding with
 * `'env' in import.meta` fails in Tauri production webviews — Vite inlines the
 * env object, but the runtime `import.meta` object has no `env` property — so
 * `VITE_REDROB_CODE_DEV_ROOT` would be ignored and the agent would fall back to
 * spawning `redrob` from PATH.
 */
function ambientRedrobCodeEnv(): RedrobCodeEnv {
  const env: RedrobCodeEnv = {}
  // Read `import.meta.env` defensively: Vite's ambient type declares `env` as
  // always present, but a Tauri production webview's runtime `import.meta` has
  // no `env` property — and Node loading this module via vite.config also has
  // no `env` — so the value is genuinely nullable at runtime.
  const metaRecord = import.meta as unknown
  const meta = (metaRecord as { env?: RedrobCodeEnv }).env
  if (meta) Object.assign(env, redrobCodeEnvFromMeta(meta))
  // Direct member reads so Vite `define` replacements of
  // `import.meta.env.VITE_REDROB_CODE_*` are honored. Copying the env object
  // alone can miss keys that were only inlined as member-expression replaces.
  // Always go through the nullable `meta` object — never bare
  // `import.meta.env.VITE_*` — so loading this file from vite.config (where
  // `import.meta.env` is undefined) does not throw.
  if (meta) {
    const defined = redrobCodeEnvFromMeta({
      VITE_REDROB_CODE_BIN: meta.VITE_REDROB_CODE_BIN,
      VITE_REDROB_CODE_DEV_ROOT: meta.VITE_REDROB_CODE_DEV_ROOT,
      VITE_REDROB_CODE_BUN: meta.VITE_REDROB_CODE_BUN
    })
    env.REDROB_CODE_BIN ??= defined.REDROB_CODE_BIN
    env.REDROB_CODE_DEV_ROOT ??= defined.REDROB_CODE_DEV_ROOT
    env.REDROB_CODE_BUN ??= defined.REDROB_CODE_BUN
  }
  const proc = typeof process === 'undefined' ? undefined : (process.env as RedrobCodeEnv)
  if (proc) {
    env.REDROB_CODE_BIN ??= proc.REDROB_CODE_BIN
    env.REDROB_CODE_DEV_ROOT ??= proc.REDROB_CODE_DEV_ROOT
    env.REDROB_CODE_BUN ??= proc.REDROB_CODE_BUN
  }
  return env
}

const REDROB_CODE_COMMAND = resolveRedrobCodeCommand(ambientRedrobCodeEnv())

/** `redrob service start --json` resolved against the same ambient environment as the ACP command. */
export const REDROB_CODE_SERVICE_COMMAND: RedrobCodeCommand =
  resolveRedrobCodeServiceCommand(ambientRedrobCodeEnv())

export const ACP_AGENTS: ACPAgentDef[] = [
  {
    id: REDROB_CODE_AGENT_ID,
    name: 'Redrob Code',
    command: REDROB_CODE_COMMAND.command,
    args: REDROB_CODE_COMMAND.args,
    installCommand: REDROB_CODE_INSTALL_COMMAND
  }
]

/**
 * Where a model request goes. There are two, and both are the engine: `engine` is Redrob Code's
 * OpenAI-compatible route (`/v1/chat/completions` on the user's shared daemon), for the model
 * profiles (design, review, fast, vision); `acp:redrob-code` is the engine's agent over ACP, for the
 * design-by-prompt loop. No direct provider: the engine holds the credentials, picks the provider
 * and masks personal details, once, for every Redrob app.
 */
export type AIProviderID = 'engine' | `acp:${ACPAgentID}`

export interface ModelOption {
  id: string
  name: string
  tag?: string
  capabilities?: readonly ('tools' | 'vision')[]
  recommendedMaxOutputTokens?: number
}

export interface AIProviderDef {
  id: AIProviderID
  name: string
  keyPlaceholder: string
  keyURL: string
  models: ModelOption[]
  defaultModel: string
  supportsCustomBaseURL?: boolean
  supportsCustomModel?: boolean
}

/**
 * Redrob Console's API base. Not a model endpoint any more (models go through the engine); the
 * app still talks to the Console for the device sign-in flow and for AI work labels.
 */
export const REDROB_CONSOLE_API_BASE = 'https://console.redrob.ai/api/backend/v1'

/**
 * The wire model id for the engine's own Console route (`redrob/auto`). The engine lists every
 * other model it can reach at `GET /api/model`; this one is always there once the user is signed in.
 */
export const ENGINE_AUTO_MODEL = 'redrob/auto'

/** Cowork's name for the engine's OpenAI face, used in the app's own copy. */
export const ENGINE_PROVIDER_ID: AIProviderID = 'engine'

export const AI_PROVIDERS: AIProviderDef[] = [
  {
    id: ENGINE_PROVIDER_ID,
    name: 'Redrob Code',
    keyPlaceholder: '',
    keyURL: 'https://console.redrob.ai',
    defaultModel: ENGINE_AUTO_MODEL,
    models: [{ id: ENGINE_AUTO_MODEL, name: 'Redrob Auto', capabilities: ['tools', 'vision'] }],
    supportsCustomModel: true
  }
]

/** Redrob Code is the only engine the design-by-prompt loop runs on, so the Design role defaults to it. */
export const DEFAULT_AI_PROVIDER: AIProviderID = REDROB_CODE_PROVIDER_ID
export const DEFAULT_AI_MODEL =
  AI_PROVIDERS.find((provider) => provider.id === DEFAULT_AI_PROVIDER)?.defaultModel ?? ''

export const AUTOMATION_HTTP_PORT = 7600

export const GOOGLE_FONTS_API_KEY = 'AIzaSyD1tYDR_dUEiV-Tw1vksEhZbUytgKW5pc8'

export const CJK_FALLBACK_FAMILIES_MACOS = [
  'PingFang SC',
  'PingFang TC',
  'Hiragino Sans',
  'Apple SD Gothic Neo',
  'Heiti SC',
  'Heiti TC'
]

export const CJK_FALLBACK_FAMILIES_WINDOWS = [
  'Microsoft YaHei',
  'Microsoft YaHei UI',
  'Microsoft JhengHei',
  'Yu Gothic',
  'Malgun Gothic',
  'SimHei',
  'SimSun'
]

export const CJK_FALLBACK_FAMILIES_LINUX = [
  'Noto Sans CJK SC',
  'Noto Sans CJK TC',
  'Noto Sans CJK JP',
  'Noto Sans CJK KR',
  'WenQuanYi Micro Hei',
  'Droid Sans Fallback'
]

export const CJK_GOOGLE_FONTS = ['Noto Sans SC', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans KR']

export const DEFAULT_SHAPE_FILL: Fill = {
  type: 'SOLID',
  color: { r: 0.83, g: 0.83, b: 0.83, a: 1 },
  opacity: 1,
  visible: true
}

export const DEFAULT_FRAME_FILL: Fill = {
  type: 'SOLID',
  color: { r: 1, g: 1, b: 1, a: 1 },
  opacity: 1,
  visible: true
}

export const SECTION_DEFAULT_FILL: Fill = {
  type: 'SOLID',
  color: { r: 0.37, g: 0.37, b: 0.37, a: 1 },
  opacity: 1,
  visible: true
}

export const SECTION_DEFAULT_STROKE: Stroke = {
  color: { r: 0.55, g: 0.55, b: 0.55, a: 1 },
  weight: 1,
  opacity: 1,
  visible: true,
  align: 'INSIDE'
}

export const ZOOM_DIVISOR = 50
export const ZOOM_SCALE_MIN = 0.75
export const ZOOM_SCALE_MAX = 1.25

export const PEN_CLOSE_THRESHOLD = 8
export const ROTATION_SNAP_DEGREES = 15
export const CORNER_ROTATE_ZONE = 16
export const HANDLE_HIT_RADIUS = 6
export const DEFAULT_TEXT_WIDTH = 200
export const DEFAULT_TEXT_HEIGHT = 24
export const AUTO_LAYOUT_BREAK_THRESHOLD = 8
