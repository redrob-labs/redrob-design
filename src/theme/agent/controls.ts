/** ComposerMode, ModelPicker and ComposerStatus, the controls around the composer. */
const agentControlsTheme = {
  slots: {
    mode: 'inline-flex h-8 items-center gap-0.5 rounded-md bg-panel-field p-0.5',
    modeItem:
      'flex h-7 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-[13px] text-muted outline-none transition-colors hover:text-surface focus-visible:ring-2 focus-visible:ring-accent data-[state=on]:bg-panel data-[state=on]:font-semibold data-[state=on]:text-surface data-[state=on]:shadow-sm',
    modeIcon: 'size-3.5 shrink-0',
    pickerTrigger:
      'flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] text-surface outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-hover',
    pickerTriggerValue: 'min-w-0 truncate font-medium',
    pickerContent:
      'z-50 flex w-[22rem] flex-col rounded-lg border border-border bg-panel p-1.5 shadow-lg outline-none',
    pickerHeading: 'px-2 pt-1.5 pb-1 text-xs font-medium text-muted',
    pickerOption:
      'flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 data-[state=on]:bg-hover',
    pickerPlace:
      'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-panel-field text-[11px] font-semibold text-muted tabular-nums',
    pickerText: 'min-w-0 flex-1',
    pickerName: 'block text-[13px] font-semibold text-surface',
    pickerMeta: 'block text-xs text-muted',
    pickerWhy: 'mt-0.5 block text-xs text-muted',
    pickerCheck: 'mt-0.5 size-4 shrink-0 text-accent',
    pickerEffort: 'flex flex-wrap gap-1 border-t border-border px-2 pt-2 pb-1',
    pickerEffortItem:
      'h-7 cursor-pointer rounded-md border border-border px-2 text-xs text-surface outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent data-[state=on]:border-accent data-[state=on]:font-semibold',
    pickerFoot: 'border-t border-border px-2 pt-2 pb-1 text-xs text-muted',
    status: 'flex flex-wrap items-center gap-1 px-1',
    statusItem:
      'flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-muted outline-none transition-colors hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-hover data-[state=open]:text-surface',
    statusIcon:
      'size-3.5 shrink-0 data-[tone=safe]:text-success data-[tone=on]:text-accent data-[tone=warn]:text-warning',
    statusName: 'hidden sm:inline',
    statusValue: 'font-medium text-surface',
    statusBars: 'flex items-end gap-px',
    statusBar: 'w-0.5 rounded-full bg-border-strong data-[on=true]:bg-success',
    statusLive: 'size-1.5 rounded-full bg-success',
    statusPanel:
      'z-50 w-[24rem] rounded-lg border border-border bg-panel p-4 shadow-lg outline-none'
  }
}

export type AgentControlsTheme = typeof agentControlsTheme
export default agentControlsTheme
