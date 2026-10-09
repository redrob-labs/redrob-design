const windowControlsTheme = {
  slots: {
    root: 'flex shrink-0 items-center gap-1 self-center pl-1',
    button:
      'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent',
    close:
      'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors outline-none hover:bg-error hover:text-on-accent focus-visible:ring-2 focus-visible:ring-accent',
    icon: 'size-4'
  }
}

export type WindowControlsTheme = typeof windowControlsTheme
export default windowControlsTheme
