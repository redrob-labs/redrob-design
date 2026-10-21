import type { PreparedImageAttachment } from '@/app/ai/attachment/image/types'

/**
 * The prepared images of a user message, held until the agent transport sends that message.
 *
 * The thread keeps only the message text (images are not stored in it), so the ACP transport
 * takes the pixels from here and sends them to Redrob Code as image blocks. Taking them clears
 * the entry, so a later turn never resends them.
 */
const pending = new Map<string, PreparedImageAttachment[]>()

export function holdMessageImages(messageId: string, images: PreparedImageAttachment[]): void {
  // Only the message being sent is held: a transport that does not take images (the direct
  // model path) leaves nothing behind past the next message.
  pending.clear()
  if (images.length > 0) pending.set(messageId, images)
}

export function takeMessageImages(messageId: string): PreparedImageAttachment[] {
  const images = pending.get(messageId) ?? []
  pending.delete(messageId)
  return images
}
