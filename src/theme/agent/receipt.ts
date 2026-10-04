const receiptTheme = {
  slots: {
    root: 'mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted',
    item: 'flex items-center gap-1 data-[tone=agree]:text-success data-[tone=differ]:text-warning',
    icon: 'size-3.5 shrink-0',
    label: 'font-medium text-surface tabular-nums',
    sub: 'text-muted'
  }
}

export type ReceiptTheme = typeof receiptTheme
export default receiptTheme
