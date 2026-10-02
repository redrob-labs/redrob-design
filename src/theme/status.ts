const statusTheme = {
  slots: {
    text: 'text-[10px] leading-snug'
  },
  variants: {
    tone: {
      neutral: { text: 'text-muted' },
      success: { text: 'text-success' },
      warning: { text: 'text-warning-text' },
      error: { text: 'text-error' }
    }
  },
  defaultVariants: {
    tone: 'neutral' as const
  }
}

export type StatusTheme = typeof statusTheme
export default statusTheme
