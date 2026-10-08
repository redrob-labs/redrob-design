/** ProtectionStatus and the three panels under the composer: Privacy, Memory, Cross-check. */
const agentProtectionTheme = {
  slots: {
    panel: 'flex flex-col gap-3',
    title: 'text-[15px] leading-6 font-semibold text-surface',
    lede: 'text-[13px] leading-5 text-muted',
    foot: 'flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted',
    protection: 'flex items-start gap-3 rounded-lg px-3 py-2.5',
    protectionIcon: 'mt-0.5 size-4.5 shrink-0',
    protectionTitle: 'text-[13px] font-semibold text-surface',
    protectionBody: 'text-xs text-muted',
    protectionLive: 'flex items-center gap-1.5 text-xs text-muted',
    liveDot: 'size-1.5 rounded-full bg-success',
    levels: 'flex flex-col gap-1.5',
    level: 'flex items-start gap-2 rounded-md px-2 py-1.5 text-[13px] data-[state=on]:bg-hover',
    levelName: 'font-semibold text-surface',
    levelDetail: 'text-xs text-muted',
    options: 'flex flex-col gap-1',
    option:
      'flex w-full cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent data-[state=on]:border-accent',
    radio:
      'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong data-[state=on]:border-accent',
    radioDot: 'size-2 rounded-full bg-accent',
    optionLabel: 'block text-[13px] font-semibold text-surface',
    optionDetail: 'block text-xs text-muted',
    check: 'flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0',
    checkName: 'text-[13px] font-semibold text-surface',
    checkText: 'text-xs leading-5 text-muted',
    checkLevels: 'inline-flex w-fit items-center gap-0.5 rounded-md bg-panel-field p-0.5',
    checkLevel:
      'h-7 cursor-pointer rounded-sm px-2.5 text-xs text-muted outline-none transition-colors hover:text-surface focus-visible:ring-2 focus-visible:ring-accent data-[state=on]:bg-panel data-[state=on]:font-semibold data-[state=on]:text-surface data-[state=on]:shadow-sm'
  },
  variants: {
    tone: {
      safe: { protection: 'bg-success-bg', protectionIcon: 'text-success' },
      warn: { protection: 'bg-warning-bg', protectionIcon: 'text-warning' },
      brand: { protection: 'bg-ai', protectionIcon: 'text-accent' },
      plain: { protection: 'bg-panel-field', protectionIcon: 'text-muted' }
    }
  },
  defaultVariants: { tone: 'plain' as const }
}

export type AgentProtectionTheme = typeof agentProtectionTheme
export default agentProtectionTheme
