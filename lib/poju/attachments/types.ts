export type AttachmentKind = "image" | "document" | "pdf";

/** Wire payload from client → /api/poju/chat (and IndexedDB message meta). */
export type PojuChatAttachment = {
  name: string;
  kind: AttachmentKind;
  mime: string;
  /** data URL (`data:...;base64,...`) or raw base64 */
  data_url: string;
};

export type AttachmentProcessResult = {
  /** Plain text injected into the user turn for the phase LLM */
  context_text: string;
  path: "text" | "vision" | "none";
  error?: string;
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_EXTRACT_CHARS = 80_000;
/** Minimum extracted chars to treat a PDF as text-native (else vision/scan path). */
export const PDF_TEXT_MIN_CHARS = 80;
