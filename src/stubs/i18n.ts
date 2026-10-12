/**
 * i18n stub — stands in for `@redrob-design/vue`'s i18n surface.
 *
 * The real package resolves locale-aware message catalogues (10 languages) via
 * nanostores. This slice only needs the component contracts, so each message
 * group is exposed as a Vue `computed` ref holding the English defaults, and
 * `params(...)` templates become plain functions. Shapes match what the ported
 * components destructure and call (`ai.value.modelsTitle`, `files.closeTab({…})`).
 *
 * To reconnect to the full app, replace this module with the real
 * `@redrob-design/vue` export; the component call sites do not change.
 */
import { computed, type ComputedRef } from 'vue'
import { atom } from 'nanostores'

/** Active UI locale. Fixed to English in the slice; the real store is writable. */
export const locale = atom<'en' | 'ko' | 'hi'>('en')

/** `params('… {x} …')` builds a function; here it just interpolates named slots. */
type Params = (values: Record<string, string | number>) => string

function tmpl(template: string): Params {
  return (values) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
}

const menuMessages = {
  mainMenu: 'Menu',
  backToHome: 'Back to home',
  settings: 'Settings',
  help: 'Help',
  searchCommands: 'Search commands',
  minimizeWindow: 'Minimise',
  maximizeWindow: 'Maximise',
  restoreWindow: 'Restore',
  closeWindow: 'Close'
}

const filesMessages = {
  homeTab: 'Home',
  newTab: 'New tab',
  closeTab: tmpl('Close {name}')
}

const commonMessages = {
  back: 'Back',
  cancel: 'Cancel',
  supported: 'Supported',
  unsupported: 'Unsupported',
  unavailable: 'Unavailable',
  tokens: 'tokens'
}

const collaborationMessages = {
  connected: 'Connected'
}

const credentialsMessages = {
  savedReplace: 'Saved — enter a new key to replace it',
  getAPIKey: 'Get an API key'
}

const aiMessages = {
  modelsTitle: 'Models',
  modelsDescription: 'Connect the AI models this workspace can use.',
  addModel: 'Add model',
  editModel: 'Edit model',
  deleteModel: 'Delete model',
  deleteModelDescription: 'This removes the model profile. This cannot be undone.',
  saveModel: 'Save',
  modelName: 'Name',
  modelID: 'Model',
  customModel: 'Custom model…',
  customModelID: 'Custom model ID',
  provider: 'Provider',
  baseURL: 'Base URL',
  apiType: 'API type',
  apiKey: 'API key',
  completions: 'Completions',
  responses: 'Responses',
  modelConfiguration: 'Model',
  connectionSettings: 'Connection',
  modelEditorDescription: 'Configure a model profile.',
  modelAssignments: 'Role assignments',
  modelAssignmentsDescription: 'Pick which model handles each kind of work.',
  modelAgentConnection: 'Agent connection',
  modelNeedsCredential: 'Needs a key',
  modelCapabilities: 'Capabilities',
  modelCapabilitiesDetected: 'Detected from the model catalog.',
  modelCapabilitiesManual: 'Set these for a custom model.',
  modelCapabilityTools: 'Tools',
  modelCapabilityVision: 'Vision',
  modelCapabilityToolsShort: 'Tools',
  modelCapabilityVisionShort: 'Vision',
  advancedModelSettings: 'Advanced',
  harnessThinkingLevel: 'Thinking level',
  harnessThinkingOff: 'Off',
  harnessThinkingMinimal: 'Minimal',
  harnessThinkingLow: 'Low',
  harnessThinkingMedium: 'Medium',
  harnessThinkingHigh: 'High',
  harnessThinkingExtraHigh: 'Extra high',
  harnessToolPermissions: 'Tool permissions',
  harnessPermissionReads: 'Allow reads',
  harnessPermissionEdits: 'Allow edits',
  harnessPermissionAll: 'Allow all',
  reasoningEffort: 'Reasoning effort',
  reasoningEffortPlaceholder: 'e.g. medium',
  reasoningEffortDescription: 'How much the model deliberates before answering.',
  outputLimit: 'Output limit',
  outputLimitAutomatic: 'Automatic',
  connectRedrobCancel: 'Cancel',
  describeCreateOrChange: 'Describe what to create or change.',
  openProviderSettingsAction: 'Open provider settings',
  chatRequestFailed: 'The request failed.',
  visionModelUnavailable: 'This model cannot read images.',
  chatAuthenticationFailed: 'Authentication failed.',
  chatForbidden: 'Access was refused.',
  chatInsufficientCredit: 'Not enough credit.',
  chatModelNotFound: 'That model was not found.',
  chatNetworkFailed: 'The network request failed.',
  chatOutputLimit: 'The output limit was reached.',
  chatRateLimited: 'Rate limited — try again shortly.',
  // Model Guide dialog
  modelGuideOpen: 'Model Guide',
  modelGuideTitle: 'Model Guide',
  modelGuideDescription: 'The ranked picks Redrob Auto routes on.',
  modelGuideLoading: 'Loading…',
  modelGuideUnavailable: 'The guide is unavailable right now.',
  modelGuideProfession: 'Profession',
  modelGuideTask: 'Task',
  modelGuideLanguage: 'Language',
  modelGuideLanguageEn: 'English',
  modelGuideLanguageKo: 'Korean',
  modelGuideLanguageHi: 'Hindi',
  modelGuideEdition: tmpl('As of {date}')
}

/** The main hook. Returns each message group as a reactive computed ref. */
export function useI18n() {
  return {
    ai: computed(() => aiMessages),
    menu: computed(() => menuMessages),
    files: computed(() => filesMessages),
    common: computed(() => commonMessages),
    collaboration: computed(() => collaborationMessages),
    credentials: computed(() => credentialsMessages)
  }
}

/** `useI18n().menu` is also read directly (not via `.value`) in some templates. */
export const menu = menuMessages

export function useInsightsMessages(): ComputedRef<typeof insightsMessages> {
  return computed(() => insightsMessages)
}

const insightsMessages = {
  title: 'AI work insights',
  description:
    'Labels each Redrob AI session on this device. Only labels and counts are sent to your workspace console, never your messages.',
  modelLabel: 'Work model',
  absent: 'Not downloaded. It downloads in the background after your next Redrob chat.',
  downloading: tmpl('Downloading, {percent}%'),
  loading: 'Loading',
  ready: 'Ready',
  failed: tmpl('Download failed: {reason}. It will try again later.'),
  unavailable: 'Not used in the browser. Sessions are labeled without the kind of work.'
}

const shipMessages = {
  shipOpen: 'Ship is already open in this thread.',
  ready: 'Ready to ship.',
  open: tmpl('{count} open items'),
  openOne: '1 open item',
  empty: 'Nothing to ship yet.'
}
export function useShipMessages(): ComputedRef<typeof shipMessages> {
  return computed(() => shipMessages)
}

const threadMessages = {
  progressLabel: 'Working',
  stepReading: 'Reading',
  stepWorking: 'Working',
  stepAnswering: 'Answering',
  stepTool: tmpl('Using {tool}'),
  continue: 'Continue',
  continuePrompt: 'Continue.',
  clearThread: 'Clear'
}
export function useThreadMessages(): ComputedRef<typeof threadMessages> {
  return computed(() => threadMessages)
}

const notificationMessages = {
  chatInitializationFailed: tmpl('Could not start the chat: {error}')
}
export function useNotificationMessages(): ComputedRef<typeof notificationMessages> {
  return computed(() => notificationMessages)
}

/** Formats a keyboard shortcut for display (`MOD` -> the platform modifier). */
export function formatShortcut(shortcut: string): string {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
  return shortcut.replace('MOD', isMac ? '⌘' : 'Ctrl').replace(/\+/g, isMac ? '' : '+')
}

/** The `v-test-id` directive stub — sets a data-test-id attribute. */
export const vTestId = {
  mounted(el: HTMLElement, binding: { value: string }) {
    el.setAttribute('data-test-id', binding.value)
  }
}

/**
 * Menu model types — the app's menu tree, reproduced from the ported menu
 * components' usage. A `MenuEntry` is either a separator or an action node; an
 * action node may carry a shortcut, a checkbox binding, or nested sub-items.
 */
export interface MenuSeparatorNode {
  separator: true
}

export interface MenuActionNode {
  label: string
  shortcut?: string
  disabled?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  action?: () => void
  sub?: MenuEntry[]
}

export type MenuEntry = MenuSeparatorNode | MenuActionNode

/** A top-level menu group as the main menu renders it. */
export interface MenuGroup {
  id: string
  label: string
  items: MenuEntry[]
}
