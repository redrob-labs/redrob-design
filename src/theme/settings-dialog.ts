const settingsDialogTheme = {
  slots: {
    header: 'border-b-0 px-5 pt-5 pb-2',
    nav: 'flex w-56 shrink-0 flex-col gap-4 overflow-y-auto px-3 pt-2 pb-4',
    navGroup: 'flex flex-col gap-0.5',
    navHeading: 'px-2.5 pb-1 text-xs font-medium text-muted',
    navItem:
      'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-surface transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent data-[state=active]:bg-hover data-[state=active]:font-semibold',
    navIcon: 'size-4 shrink-0 text-muted',
    body: 'min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-5',
    footer: 'justify-between bg-canvas px-5'
  }
}

export type SettingsDialogTheme = typeof settingsDialogTheme
export default settingsDialogTheme
