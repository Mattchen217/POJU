/**
 * POJU chat column + typography — mobile-first; PC browser overrides in browser-desktop.css.
 */
export const pojuChatColumn = "poju-chat-column mx-auto w-full max-w-3xl";

export const pojuChatMessageList = "poju-chat-message-list flex flex-col gap-8 py-6 md:py-8";

/** Primary message prose (user + assistant). */
export const pojuChatMessageBody =
  "poju-chat-prose text-[1rem] leading-[1.75] tracking-normal text-on-surface [&_p]:m-0 [&_p+p]:mt-4";

export const pojuChatUserBubble =
  "poju-chat-user-bubble w-fit max-w-[min(85%,36rem)] shrink-0 rounded-[1.25rem] bg-surface-container-high px-4 py-3 text-left shadow-sm ring-1 ring-white/5 [overflow-wrap:anywhere] [word-break:normal]";

export const pojuChatAssistantContent = "poju-chat-assistant-content min-w-0 flex-1 max-w-none";

export const pojuChatMessageRow = "poju-chat-message-row flex w-full min-w-0 gap-4";

export const pojuChatAvatar =
  "poju-chat-avatar mt-0.5 flex h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-outline-variant";

export const pojuChatComposerShell =
  "poju-chat-composer flex items-end gap-2 rounded-[1.75rem] border border-outline-variant/40 bg-surface-container/80 p-2 shadow-lg backdrop-blur-xl md:p-2.5";

export const pojuChatComposerInput =
  "poju-chat-composer-input max-h-[200px] min-h-[52px] flex-1 resize-none bg-transparent px-3 py-3.5 text-[1rem] leading-6 text-on-surface placeholder:text-on-surface-variant/50 outline-none";
