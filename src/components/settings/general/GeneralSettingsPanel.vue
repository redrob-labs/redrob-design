<script setup lang="ts">
import { computed } from 'vue'
import { type Locale, shortcutPlatform, useI18n } from '@redrob-design/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { recoveryEnabled, setRecoveryEnabled } from '@/app/document/recovery/preferences'
import { setSnappingPreference } from '@/app/settings/preferences/apply'
import { appPreferences } from '@/app/settings/preferences/store'
import { type AppTheme, useAppTheme } from '@/app/shell/theme'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import RenderingSettingsSection from '@/components/settings/general/RenderingSettingsSection.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSectionHeader from '@/components/settings/layout/SettingsSectionHeader.vue'

const { availableLocales, locale, localeLabels, setLocale, settings } = useI18n()
const store = useEditorStore()
const { theme, setTheme } = useAppTheme()

const language = computed<Locale>({
  get: () => locale.value,
  set: setLocale
})

const languageOptions = availableLocales.map((value) => ({
  value,
  label: localeLabels[value]
}))

const themeOptions = computed(() => [
  { value: 'auto', label: settings.value.themeSystem },
  { value: 'light', label: settings.value.themeLight },
  { value: 'dark', label: settings.value.themeDark }
])

function isAppTheme(value: string): value is AppTheme {
  return value === 'auto' || value === 'light' || value === 'dark'
}

const themeModel = computed({
  get: () => theme.value,
  set: (value: string) => {
    if (isAppTheme(value)) setTheme(value)
  }
})

const autosave = computed({
  get: () => store.state.autosaveEnabled,
  set: (enabled: boolean) => {
    store.state.autosaveEnabled = enabled
  }
})

const preserveUnsavedWork = computed({
  get: () => recoveryEnabled.value,
  set: setRecoveryEnabled
})

const snapToGeometry = computed({
  get: () => appPreferences.value.editing.snapping.geometry,
  set: (enabled: boolean) => setSnappingPreference('geometry', enabled)
})

const snapToObjects = computed({
  get: () => appPreferences.value.editing.snapping.objects,
  set: (enabled: boolean) => setSnappingPreference('objects', enabled)
})

const snapToPixelGrid = computed({
  get: () => appPreferences.value.editing.snapping.pixelGrid,
  set: (enabled: boolean) => setSnappingPreference('pixelGrid', enabled)
})

const themeControlUI = { root: 'rounded-md p-1', item: 'h-7 flex-none px-3 text-xs' }

const snappingModifier = shortcutPlatform() === 'mac' ? 'Control' : 'Ctrl'
</script>

<template>
  <section class="flex flex-col gap-4" data-test-id="settings-general-panel">
    <SettingsSectionHeader>{{ settings.general }}</SettingsSectionHeader>

    <SettingsGroup :heading="settings.appearance">
      <SettingsRow :heading="settings.theme" :description="settings.themeDescription">
        <SegmentedControl
          v-model="themeModel"
          :options="themeOptions"
          :label="settings.theme"
          :ui="themeControlUI"
          data-test-id="settings-theme"
        />
      </SettingsRow>
      <SettingsRow
        :heading="settings.language"
        :description="settings.interfaceLanguageDescription"
      >
        <AppSelect
          v-model="language"
          :label="settings.language"
          :options="languageOptions"
          class="w-50"
          data-test-id="settings-language"
        />
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup :heading="settings.files">
      <SettingsRow :heading="settings.autosave" :description="settings.autosaveDescription">
        <AppSwitch v-model="autosave" :label="settings.autosave" data-test-id="settings-autosave" />
      </SettingsRow>
      <SettingsRow
        :heading="settings.keepUnsavedWorkSafe"
        :description="settings.keepUnsavedWorkSafeDescription"
      >
        <AppSwitch
          v-model="preserveUnsavedWork"
          :label="settings.keepUnsavedWorkSafe"
          data-test-id="settings-recovery-enabled"
        />
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup
      :heading="settings.canvas"
      :description="settings.canvasSnappingHint({ key: snappingModifier })"
    >
      <SettingsRow
        :heading="settings.snapToOtherLayers"
        :description="settings.snapToOtherLayersDescription"
      >
        <AppSwitch
          v-model="snapToObjects"
          :label="settings.snapToOtherLayers"
          data-test-id="settings-snap-objects"
        />
      </SettingsRow>
      <SettingsRow
        :heading="settings.snapToPixelGrid"
        :description="settings.snapToPixelGridShortDescription"
      >
        <AppSwitch
          v-model="snapToPixelGrid"
          :label="settings.snapToPixelGrid"
          data-test-id="settings-snap-pixel-grid"
        />
      </SettingsRow>
      <SettingsRow
        :heading="settings.snapToGeometry"
        :description="settings.snapToPointsDescription"
      >
        <AppSwitch
          v-model="snapToGeometry"
          :label="settings.snapToGeometry"
          data-test-id="settings-snap-geometry"
        />
      </SettingsRow>
      <RenderingSettingsSection />
    </SettingsGroup>
  </section>
</template>
