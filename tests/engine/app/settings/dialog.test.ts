import { beforeEach, describe, expect, test } from 'bun:test'

import {
  SETTINGS_NAVIGATION,
  openSettingsDialog,
  resolveSettingsSection,
  settingsDialogFocus,
  settingsDialogOpen,
  settingsDialogSection
} from '@/app/settings/dialog'

describe('settings dialog sections', () => {
  beforeEach(() => {
    settingsDialogOpen.value = false
    settingsDialogSection.value = 'general'
    settingsDialogFocus.value = null
  })

  test('navigation lists six sections in three groups', () => {
    expect(SETTINGS_NAVIGATION.map((group) => [group.id, group.sections])).toEqual([
      ['preferences', ['general']],
      ['connections', ['mcp', 'storage', 'cloud']],
      ['account', ['usage', 'diagnostics']]
    ])
  })

  test('models and keys now live in Agents and MCP', () => {
    expect(resolveSettingsSection('ai')).toEqual({ section: 'mcp', focus: 'models' })
    openSettingsDialog('ai')
    expect(settingsDialogOpen.value).toBe(true)
    expect(settingsDialogSection.value).toBe('mcp')
    expect(settingsDialogFocus.value).toBe('models')
  })

  test('media keys now live in Storage', () => {
    expect(resolveSettingsSection('media')).toEqual({ section: 'storage', focus: 'image-services' })
  })

  test('opening without a section keeps the last one and clears focus', () => {
    openSettingsDialog('usage')
    settingsDialogOpen.value = false
    settingsDialogFocus.value = 'models'
    openSettingsDialog()
    expect(settingsDialogSection.value).toBe('usage')
    expect(settingsDialogFocus.value).toBeNull()
  })
})
