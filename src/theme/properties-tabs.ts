const propertiesTabsTheme = {
  slots: {
    list: 'flex h-10 shrink-0 items-center gap-1 border-b border-border px-2',
    trigger:
      'relative flex h-full cursor-pointer items-center gap-1.5 px-2.5 text-[13px] text-muted outline-none transition-colors hover:text-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-surface data-[state=active]:after:bg-accent',
    icon: 'size-3.5',
    badge:
      'ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-on-accent tabular-nums'
  }
}

export type PropertiesTabsTheme = typeof propertiesTabsTheme
export default propertiesTabsTheme
