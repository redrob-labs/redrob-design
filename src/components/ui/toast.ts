import { twMerge } from 'tailwind-merge'
import { tv } from 'tailwind-variants'

export type ToastVariant = 'default' | 'warning' | 'error'

const toast = tv({
  base: 'flex max-w-sm items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs shadow-md duration-(--duration-base) ease-entrance data-[state=closed]:ease-exit data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-top-1 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-1 data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform data-[swipe=move]:translate-y-[var(--reka-toast-swipe-move-y)]',
  variants: {
    tone: {
      default: 'bg-accent text-on-accent',
      // The warning wash is translucent; layer it on an opaque panel so the canvas does not show through.
      warning:
        'border border-warning-border bg-panel bg-linear-to-r from-warning-bg to-warning-bg text-warning-text',
      error: 'bg-error text-panel'
    }
  },
  defaultVariants: { tone: 'default' }
})

export function useToastUI(options?: { tone?: ToastVariant; ui?: { base?: string } }) {
  return {
    base: twMerge(toast(options), options?.ui?.base)
  }
}
