import type { TurnReceipt } from '@/app/assistant/turn/usage'
import type { AnswerReceiptItem } from '@/components/ui/agent/types'

export interface ReceiptWords {
  byAuto: string
  yourChoice: string
  free: string
  priceUnknown: string
  private: string
  keptPrivate: (count: number) => string
  factCheck: string
}

/** Prices under a cent still show as a cent, so a paid answer never reads as free. */
export function formatPrice(price: number, locale: string): string {
  const shown = price > 0 && price < 0.01 ? 0.01 : price
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(shown)
}

function priceLabel(price: number | null, words: ReceiptWords, locale: string): string {
  if (price === null) return words.priceUnknown
  if (price === 0) return words.free
  return formatPrice(price, locale)
}

/**
 * The items of one answer's receipt: the AI and who chose it, the price, what
 * was kept private, and Fact check when it ran.
 */
export function receiptItems(
  receipt: TurnReceipt,
  words: ReceiptWords,
  locale: string
): AnswerReceiptItem[] {
  const items: AnswerReceiptItem[] = [
    {
      id: 'model',
      icon: receipt.pinned ? 'pin' : 'auto',
      label: receipt.model,
      sub: receipt.pinned ? (receipt.effort ?? words.yourChoice) : words.byAuto
    },
    {
      id: 'price',
      icon: 'price',
      label: priceLabel(receipt.price, words, locale)
    },
    {
      id: 'privacy',
      icon: 'privacy',
      tone: 'agree',
      label: receipt.keptPrivate > 0 ? words.keptPrivate(receipt.keptPrivate) : words.private
    }
  ]
  if (receipt.factCheckBy) {
    items.push({ id: 'check', icon: 'check', label: words.factCheck, sub: receipt.factCheckBy })
  }
  return items
}
