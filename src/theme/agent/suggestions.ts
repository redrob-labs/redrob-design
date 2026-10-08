const suggestionsTheme = {
  slots: {
    root: 'flex flex-wrap items-center gap-2',
    label: 'text-[13px] text-muted',
    item: 'h-8 cursor-pointer rounded-full border border-border bg-panel px-3 text-[13px] text-surface outline-none transition-colors hover:border-border-strong hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent'
  }
}

export type SuggestionsTheme = typeof suggestionsTheme
export default suggestionsTheme
