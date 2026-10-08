const statTheme = {
  slots: {
    root: 'flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-panel px-4 py-3',
    label: 'text-xs text-muted',
    value: 'text-[22px] leading-7 font-semibold text-surface tabular-nums',
    detail: 'text-xs text-muted'
  }
}

export type StatTheme = typeof statTheme
export default statTheme
