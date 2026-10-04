import type { UIMessage } from 'ai'
import { inject, provide, type InjectionKey } from 'vue'

/** Sends a message as the person, the way the composer does. */
export type ChatSend = (text: string) => void

const CHAT_SEND: InjectionKey<ChatSend> = Symbol('chat-send')

/** ChatPanel provides this so cards in the thread can answer for the person. */
export function provideChatSend(send: ChatSend): void {
  provide(CHAT_SEND, send)
}

export function useChatSend(): ChatSend {
  return inject(CHAT_SEND, () => undefined)
}

/** Adds a message Redrob posts without asking a model: Ship, a watched update. */
export type ChatPost = (message: UIMessage) => void

const CHAT_POST: InjectionKey<ChatPost> = Symbol('chat-post')

export function provideChatPost(post: ChatPost): void {
  provide(CHAT_POST, post)
}

export function useChatPost(): ChatPost {
  return inject(CHAT_POST, () => undefined)
}
