const settingsTheme = {
  slots: {
    group: 'flex flex-col rounded-lg border border-border bg-panel px-4 pt-3 pb-1',
    groupHeader: 'pb-2',
    groupTitle: 'text-xs font-medium text-muted',
    groupDescription: 'mt-1 text-xs text-muted',
    groupBody: 'flex flex-col divide-y divide-border',
    row: 'flex items-center justify-between gap-6 py-3',
    rowText: 'min-w-0',
    rowTitle: 'block text-[13px] font-semibold text-surface',
    rowDescription: 'mt-0.5 block text-xs text-muted',
    rowControl: 'flex shrink-0 items-center',
    sectionTitle: 'text-[17px] leading-6 font-semibold text-surface',
    sectionDescription: 'mt-1 text-xs text-muted'
  }
}

export type SettingsTheme = typeof settingsTheme
export default settingsTheme
