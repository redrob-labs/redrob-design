/*
 * Windows: flat 46x40 caption buttons flush with the bar's top-right corner, as Windows draws them
 * (Tauri has no caption-button overlay, so the app draws them). Linux: 24px circles, as GNOME does.
 */
const windowControlsTheme = {
  slots: {
    root: 'flex shrink-0 items-center',
    button:
      'flex shrink-0 cursor-pointer items-center justify-center text-muted transition-colors outline-none hover:text-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
    close:
      'flex shrink-0 cursor-pointer items-center justify-center text-muted transition-colors outline-none hover:bg-error hover:text-on-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
    icon: 'size-4'
  },
  variants: {
    platform: {
      windows: {
        root: '-mr-2 self-stretch',
        button: 'h-10 w-11.5 hover:bg-hover',
        close: 'h-10 w-11.5',
        icon: 'size-3.5'
      },
      linux: {
        root: 'gap-2 self-center pl-2',
        button: 'size-6 rounded-full bg-hover text-surface hover:bg-border',
        close: 'size-6 rounded-full bg-hover text-surface',
        icon: 'size-3.5'
      }
    }
  },
  defaultVariants: {
    platform: 'linux' as const
  }
}

export type WindowControlsTheme = typeof windowControlsTheme
export default windowControlsTheme
