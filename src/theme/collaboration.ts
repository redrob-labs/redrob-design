const collaborationTheme = {
  slots: {
    avatar:
      'flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-ink-light',
    peerAvatar: 'cursor-pointer transition-all',
    shareButton:
      'flex h-8 cursor-pointer items-center gap-1.5 rounded-md border-none px-3 text-xs font-semibold transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent',
    presenceTrigger:
      'flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-panel/70 px-3 shadow-md backdrop-blur-xl outline-none select-none active:bg-hover focus-visible:ring-1 focus-visible:ring-accent',
    presenceDot: 'size-2 rounded-full bg-success',
    presenceContent:
      'z-50 w-56 rounded-lg border border-border bg-material p-3 shadow-md backdrop-blur-xl reduce-transparency:bg-panel reduce-transparency:backdrop-blur-none',
    peerRow:
      'flex cursor-pointer items-center gap-2 rounded-md px-0.5 py-0.5 outline-none select-none active:bg-hover focus-visible:ring-1 focus-visible:ring-accent',
    disconnect:
      'mt-3 flex h-7 w-full cursor-pointer items-center justify-center rounded border border-border bg-transparent text-xs text-muted outline-none select-none active:bg-hover focus-visible:ring-1 focus-visible:ring-accent'
  },
  variants: {
    following: {
      true: { avatar: 'ring-2 ring-ink-light/40' },
      false: {}
    },
    bordered: {
      true: { avatar: 'border-2 border-panel' },
      false: {}
    },
    connection: {
      idle: { shareButton: 'bg-accent text-on-accent hover:bg-accent-hover' },
      joining: {
        shareButton:
          'animate-pulse border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
      },
      connected: {
        shareButton: 'bg-success-bg text-ink-light hover:bg-success-bg-hover'
      }
    },
    size: {
      sm: { avatar: 'size-6' },
      md: { avatar: 'size-7' }
    }
  },
  compoundVariants: [
    {
      following: true,
      bordered: true,
      class: { avatar: 'border-ink-light' }
    }
  ],
  defaultVariants: {
    following: false,
    bordered: false,
    connection: 'idle' as const,
    size: 'sm' as const
  }
}

export type CollaborationTheme = typeof collaborationTheme
export default collaborationTheme
