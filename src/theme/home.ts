const homeTheme = {
  slots: {
    root: 'flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-canvas text-surface',
    wash: 'bg-linear-to-b from-product-wash via-product-wash/40 to-canvas [[data-theme=dark]_&]:from-product-wash/45 [[data-theme=dark]_&]:via-product-wash/10',
    inner: 'mx-auto flex w-full max-w-[1120px] flex-col px-4 pt-7 pb-10 sm:px-10',
    brief: 'mx-auto flex w-full max-w-[760px] flex-col gap-4 pt-10 pb-12',
    title:
      'text-center text-[32px] leading-10 font-semibold tracking-[-0.01em] text-surface sm:text-[40px] sm:leading-12',
    lede: 'mx-auto max-w-[560px] text-center text-[15px] leading-6 text-muted text-pretty',
    drop: 'rounded-2xl transition-shadow data-[drag=true]:ring-2 data-[drag=true]:ring-accent data-[drag=true]:ring-offset-4 data-[drag=true]:ring-offset-canvas',
    chip: 'flex h-7 max-w-60 items-center gap-1.5 rounded-md border border-border bg-canvas pr-1 pl-2 text-xs text-surface',
    chipName: 'min-w-0 truncate',
    chipRemove:
      'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent',
    suggestions: 'justify-center',
    sectionHead: 'mb-4 flex flex-wrap items-center gap-2',
    sectionTitle: 'mr-auto text-[17px] leading-6 font-semibold text-surface',
    viewToggle: 'flex rounded-md border border-border p-0.5',
    viewButton:
      'flex size-8 cursor-pointer items-center justify-center rounded-sm text-muted outline-none transition-colors hover:text-surface focus-visible:ring-2 focus-visible:ring-accent data-[state=on]:bg-hover data-[state=on]:text-surface sm:size-7',
    grid: 'grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]',
    card: 'group min-w-0 cursor-pointer rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
    thumb:
      'flex aspect-[26/15] items-center justify-center overflow-hidden rounded-lg border border-border bg-panel-field transition-colors group-hover:border-border-strong',
    cardName: 'mt-2.5 truncate text-[13px] font-semibold text-surface',
    cardMeta: 'mt-0.5 truncate text-xs text-muted',
    list: 'overflow-hidden rounded-lg border border-border bg-panel',
    row: 'flex min-h-14 w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 text-left outline-none last:border-b-0 hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
    foot: 'mt-10 flex flex-wrap items-center justify-center gap-1.5 border-t border-border pt-5 text-[13px] text-muted',
    footLink:
      'cursor-pointer rounded text-accent underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent'
  }
}

export type HomeTheme = typeof homeTheme
export default homeTheme
