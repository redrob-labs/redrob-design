const changesTheme = {
  slots: {
    root: 'overflow-hidden rounded-xl border border-border bg-panel text-xs',
    head: 'flex items-baseline gap-3 border-b border-border px-3 py-2',
    heading: 'min-w-0 flex-1 truncate text-[13px] font-semibold text-surface',
    count: 'shrink-0 text-muted tabular-nums',
    body: 'flex flex-col',
    item: 'border-b border-border px-3 py-2 last:border-b-0',
    where: 'mb-1 flex items-baseline gap-2',
    kind: [
      'shrink-0 rounded-full bg-hover px-2 py-0.5 text-[11px] font-semibold text-muted',
      'data-[kind=added]:bg-success-bg data-[kind=added]:text-success',
      'data-[kind=removed]:bg-error-bg data-[kind=removed]:text-error',
      'data-[kind=changed]:bg-accent/10 data-[kind=changed]:text-brand-ink'
    ],
    label: 'min-w-0 truncate font-medium text-surface',
    line: 'mb-0.5 flex items-baseline gap-2 leading-5 last:mb-0',
    before: 'text-muted line-through decoration-border-strong',
    after: 'text-surface',
    tag: 'w-8 shrink-0 text-[11px] font-semibold text-muted no-underline',
    note: 'mt-1 ml-10 text-muted',
    foot: 'flex justify-end gap-2 border-t border-border bg-panel-secondary px-3 py-2'
  }
}

export type ChangesTheme = typeof changesTheme
export default changesTheme
