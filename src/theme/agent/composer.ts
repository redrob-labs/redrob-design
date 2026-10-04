const composerTheme = {
  slots: {
    root: 'flex flex-col gap-2',
    box: 'flex flex-col rounded-xl border border-border-strong bg-panel shadow-sm transition-colors focus-within:border-accent',
    context: 'flex flex-wrap gap-1.5 px-3 pt-3',
    input:
      'block w-full resize-none overflow-y-auto bg-transparent px-3.5 pt-3 pb-1 text-[14px] leading-6 text-surface outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60',
    bar: 'flex items-center gap-1.5 px-2 pt-1 pb-2',
    leading: 'flex items-center gap-0.5',
    tools: 'ml-auto flex min-w-0 items-center gap-1',
    iconButton:
      'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40',
    send: 'flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-accent px-2.5 text-[13px] font-semibold text-on-accent transition-colors outline-none hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:cursor-not-allowed disabled:opacity-40',
    stop: 'flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-strong bg-panel px-2.5 text-[13px] font-semibold text-surface transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent',
    icon: 'size-4'
  }
}

export type ComposerTheme = typeof composerTheme
export default composerTheme
