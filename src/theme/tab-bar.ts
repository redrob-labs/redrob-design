const tabBarTheme = {
  slots: {
    root: 'scrollbar-none flex h-10 shrink-0 items-end gap-1 overflow-x-auto border-b border-border bg-canvas px-2',
    list: 'flex h-full min-w-0 items-end gap-0.5',
    trigger:
      'group/tab flex h-8 max-w-56 min-w-0 cursor-pointer touch-manipulation items-center gap-2 rounded-t-md px-3 text-[13px] transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
    icon: 'size-3.5 shrink-0',
    label: 'min-w-0 flex-1 truncate',
    close:
      'flex size-6 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded text-muted transition-opacity group-hover/tab:opacity-100 hover:bg-hover hover:text-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:size-4',
    closeIcon: 'size-3',
    newAction:
      'flex size-8 shrink-0 cursor-pointer touch-manipulation items-center justify-center self-center rounded-md text-muted transition-colors hover:bg-hover hover:text-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    newIcon: 'size-3.5',
    end: 'ml-auto flex shrink-0 items-center gap-2 self-center',
    search:
      'flex h-7 w-60 shrink-0 cursor-pointer touch-manipulation items-center gap-2 self-center rounded-md border border-border bg-panel px-2 text-xs text-muted transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    searchIcon: 'size-3.5 shrink-0',
    searchLabel: 'min-w-0 flex-1 truncate text-left',
    searchKbd: 'rounded-xs border border-border px-1 text-[11px] leading-4 text-muted'
  },
  variants: {
    active: {
      true: {
        trigger: 'bg-panel font-medium text-surface',
        close: 'opacity-100'
      },
      false: {
        trigger: 'text-muted hover:bg-hover hover:text-surface',
        close: 'opacity-0'
      }
    }
  },
  defaultVariants: {
    active: false
  }
}

export type TabBarTheme = typeof tabBarTheme
export default tabBarTheme
