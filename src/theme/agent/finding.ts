const findingTheme = {
  slots: {
    root: 'flex max-w-[560px] flex-col gap-1.5 rounded-xl border border-border bg-panel px-3 py-2.5 text-xs data-[state=accepted]:opacity-60 data-[state=dismissed]:opacity-60',
    head: 'flex items-center gap-2',
    severity: [
      'inline-flex shrink-0 items-center gap-1 rounded-full border border-current px-1.5 py-px text-[11px] font-semibold',
      'data-[severity=high]:text-error data-[severity=medium]:text-warning-text data-[severity=low]:text-muted data-[severity=note]:text-brand-ink'
    ],
    severityIcon: 'size-3',
    heading: 'min-w-0 flex-1 text-[13px] leading-5 font-semibold text-surface',
    state: 'shrink-0 text-[11px] text-muted',
    where:
      'inline-flex cursor-pointer items-center gap-1 self-start rounded text-brand-ink hover:underline focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:outline-none',
    whereStatic: 'inline-flex items-center gap-1 self-start text-muted',
    whereIcon: 'size-3 shrink-0',
    detail: 'm-0 leading-5 text-muted',
    suggestion: 'm-0 leading-5 text-surface',
    suggestionLabel: 'block text-[11px] font-medium text-muted',
    actions: 'mt-0.5 flex gap-2'
  }
}

export type FindingTheme = typeof findingTheme
export default findingTheme
