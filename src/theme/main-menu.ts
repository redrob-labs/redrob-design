const mainMenuTheme = {
  slots: {
    trigger:
      'flex h-8 shrink-0 cursor-pointer items-center gap-0.5 self-center rounded-md px-1.5 text-muted transition-colors outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas data-[state=open]:bg-hover data-[state=open]:text-surface',
    mark: 'size-5 rounded-xs',
    chevron: 'size-3',
    content: 'min-w-65',
    subContent: 'min-w-56',
    item: 'min-h-7.5 text-xs',
    lead: 'size-3.5 shrink-0 text-muted',
    chevronRight: 'size-3 text-muted'
  }
}

export type MainMenuTheme = typeof mainMenuTheme
export default mainMenuTheme
