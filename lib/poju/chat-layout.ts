/**
 * POJU chat column + typography aligned with ChatGPT / Gemini (16px body, ~1.75 line-height, ~48rem column).
 */
export const pojuChatColumn = "mx-auto w-full max-w-3xl";

export const pojuChatMessageList = "flex flex-col gap-8 py-6 md:py-8";

/** Primary message prose (user + assistant). */
export const pojuChatMessageBody =
  "text-[1rem] leading-[1.75] tracking-normal text-on-surface [&_p]:m-0 [&_p+p]:mt-4";

export const pojuChatUserBubble =
  "w-fit max-w-[min(85%,36rem)] shrink-0 rounded-[1.25rem] bg-surface-container-high px-4 py-3 text-left shadow-sm ring-1 ring-white/5 [overflow-wrap:anywhere] [word-break:normal]";

export const pojuChatAssistantContent = "min-w-0 flex-1 max-w-none";

export const pojuChatComposerShell =
  "flex items-end gap-2 rounded-[1.75rem] border border-outline-variant/40 bg-surface-container/80 p-2 shadow-lg backdrop-blur-xl md:p-2.5";

export const pojuChatComposerInput =
  "max-h-[200px] min-h-[52px] flex-1 resize-none bg-transparent px-3 py-3.5 text-[1rem] leading-6 text-on-surface placeholder:text-on-surface-variant/50 outline-none";
