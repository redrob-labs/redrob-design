const timelineTheme = {
  slots: {
    root: 'flex flex-col gap-1.5 rounded-xl rounded-tl-md border border-ai-border bg-ai px-3 py-2.5 text-xs',
    step: 'flex items-center gap-2 text-muted data-[state=active]:font-medium data-[state=active]:text-surface data-[state=error]:text-error',
    icon: 'size-3.5 shrink-0',
    spinner: 'size-3.5 shrink-0 animate-spin text-accent motion-reduce:animate-none'
  }
}

export type TimelineTheme = typeof timelineTheme
export default timelineTheme
