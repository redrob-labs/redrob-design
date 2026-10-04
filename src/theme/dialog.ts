export default {
  slots: {
    overlay:
      'fixed inset-0 z-40 bg-scrim duration-(--duration-slow) data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out',
    content:
      'fixed top-1/2 left-1/2 z-50 flex max-h-[min(90vh,48rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-lg outline-none duration-(--duration-slow) data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-[0.98] data-[state=open]:ease-entrance data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-[0.98] data-[state=closed]:ease-exit',
    header: 'flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3',
    heading: 'min-w-0',
    title:
      'text-[17px] leading-6 font-semibold tracking-[-0.008em] text-surface data-[visually-hidden=true]:sr-only',
    description: 'text-xs text-muted',
    close:
      'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent text-muted hover:bg-hover hover:text-surface',
    body: 'min-h-0 flex-1 overflow-y-auto p-4',
    footer: 'flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3'
  },
  variants: {
    size: {
      sm: { content: 'w-[min(24rem,92vw)]' },
      md: { content: 'w-[min(32rem,94vw)]' },
      lg: { content: 'w-[min(46rem,94vw)]' },
      wide: { content: 'w-[min(56.25rem,96vw)]' },
      xl: { content: 'w-[min(64rem,96vw)]' }
    },
    height: {
      auto: {},
      tall: { content: 'h-[min(75vh,48rem)]' },
      full: { content: 'h-[min(90vh,56rem)]' }
    }
  }
} as const
