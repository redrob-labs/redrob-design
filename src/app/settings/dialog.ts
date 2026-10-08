import { ref } from 'vue'

/** The Settings destinations, as the approved prototype groups them, plus Redrob Cloud. */
export type SettingsSection = 'general' | 'mcp' | 'storage' | 'cloud' | 'usage' | 'diagnostics'

/**
 * Names older callers still use. `ai` (models and keys) now lives in Agents and
 * MCP, and `media` (stock photos and vectorize) in Storage.
 */
export type LegacySettingsSection = 'ai' | 'media'

/** A group inside a section that the dialog scrolls into view when it opens. */
export type SettingsFocus = 'models' | 'image-services'

export interface SettingsNavigationGroup {
  id: 'preferences' | 'connections' | 'account'
  sections: SettingsSection[]
}

export const SETTINGS_NAVIGATION: readonly SettingsNavigationGroup[] = [
  { id: 'preferences', sections: ['general'] },
  { id: 'connections', sections: ['mcp', 'storage', 'cloud'] },
  { id: 'account', sections: ['usage', 'diagnostics'] }
]

export const settingsDialogOpen = ref(false)
export const settingsDialogSection = ref<SettingsSection>('general')
export const settingsDialogFocus = ref<SettingsFocus | null>(null)

/** Maps any section name, old or new, to where it lives now. */
export function resolveSettingsSection(section: SettingsSection | LegacySettingsSection): {
  section: SettingsSection
  focus: SettingsFocus | null
} {
  if (section === 'ai') return { section: 'mcp', focus: 'models' }
  if (section === 'media') return { section: 'storage', focus: 'image-services' }
  return { section, focus: null }
}

export function openSettingsDialog(section?: SettingsSection | LegacySettingsSection): void {
  if (section) {
    const resolved = resolveSettingsSection(section)
    settingsDialogSection.value = resolved.section
    settingsDialogFocus.value = resolved.focus
  } else {
    settingsDialogFocus.value = null
  }
  settingsDialogOpen.value = true
}
