import { decodeAttachmentDataUrl } from "@/lib/poju/attachments/decode";
import { MAX_TEXT_EXTRACT_CHARS } from "@/lib/poju/attachments/types";

function truncate(text: string): string {
  const t = text.replace(/\u0000/g, "").trim();
  if (t.length <= MAX_TEXT_EXTRACT_CHARS) return t;
  return `${t.slice(0, MAX_TEXT_EXTRACT_CHARS)}\n\n[…truncated…]`;
}

export async function extractPlainTextFromUtf8(dataUrl: string): Promise<string> {
  const { buffer } = decodeAttachmentDataUrl(dataUrl);
  return truncate(buffer.toString("utf8"));
}

export async function extractTextFromPdf(dataUrl: string): Promise<string> {
  const { buffer } = decodeAttachmentDataUrl(dataUrl);
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text =
      typeof result === "string"
        ? result
        : typeof (result as { text?: unknown })?.text === "string"
          ? (result as { text: string }).text
          : String(result ?? "");
    return truncate(text);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
