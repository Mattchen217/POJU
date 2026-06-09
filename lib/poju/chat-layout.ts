/**
 * POJU chat layout tokens — typography/sizing driven by poju-chat-pwa.css (.poju-chat-shell).
 * Claude-like: ~48rem column, 18px body on desktop, card-style message blocks.
 */
export const pojuChatColumn = "poju-chat-column mx-auto w-full max-w-[42rem] md:max-w-[48rem]";

export const pojuChatMessageList = "poju-chat-message-list flex flex-col gap-8 md:gap-12 py-6 md:py-10";

/** Primary message prose (user + assistant). Font size set in CSS, not Tailwind utilities. */
export const pojuChatMessageBody =
  "poju-chat-prose tracking-normal text-on-surface [&_p]:m-0 [&_p+p]:mt-4 md:[&_p+p]:mt-5";

export const pojuChatUserBubble =
  "poju-chat-user-bubble w-fit max-w-[min(92%,36rem)] shrink-0 rounded-2xl bg-white/[0.06] px-4 py-3.5 text-left ring-1 ring-white/[0.08] [overflow-wrap:anywhere] [word-break:normal] md:max-w-[min(88%,40rem)] md:px-5 md:py-4";

/** Claude-style assistant response card (dark theme). */
export const pojuChatAssistantCard =
  "poju-chat-assistant-card w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-4 md:px-6 md:py-5";

export const pojuChatAssistantContent = "poju-chat-assistant-content min-w-0 flex-1 max-w-none";

export const pojuChatMessageRow = "poju-chat-message-row flex w-full min-w-0 gap-3 md:gap-0";

export const pojuChatAvatar =
  "poju-chat-avatar mt-0.5 flex h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-outline-variant md:hidden";

export const pojuChatComposerShell =
  "poju-chat-composer flex items-end gap-1.5 rounded-[1.625rem] border border-white/[0.12] bg-[#18181b] p-2 shadow-[0_1px_4px_rgba(0,0,0,0.35)] md:gap-2 md:p-2.5";

export const pojuChatComposerInput =
  "poju-chat-composer-input max-h-[200px] min-h-[48px] flex-1 resize-none bg-transparent px-3 py-3 text-on-surface placeholder:text-on-surface-variant/45 outline-none md:min-h-[52px] md:px-4 md:py-3.5";
