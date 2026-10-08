import { tv } from 'tailwind-variants'

export const tooltip = tv({
  slots: {
    content: 'z-50 rounded-sm bg-surface px-2 py-1 text-[11px] font-medium text-panel shadow-md'
  }
})

interface TooltipUI {
  content?: string
}

export function useTooltipUI(ui?: TooltipUI) {
  const cls = tooltip()
  return {
    content: cls.content({ class: ui?.content })
  }
}
