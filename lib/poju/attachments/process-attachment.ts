import { estimateDecodedBytes } from "@/lib/poju/attachments/decode";
import { extractPlainTextFromUtf8, extractTextFromPdf } from "@/lib/poju/attachments/extract-text";
import {
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  PDF_TEXT_MIN_CHARS,
  type AttachmentProcessResult,
  type PojuChatAttachment,
} from "@/lib/poju/attachments/types";
import { runVisionBridge } from "@/lib/poju/attachments/vision-bridge";

function isTextLikeMime(mime: string, name: string): boolean {
  const m = mime.toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith("text/")) return true;
  if (m === "application/json" || m === "application/javascript") return true;
  return /\.(txt|md|markdown|json|csv|log)$/i.test(n);
}

function ensureDataUrl(att: PojuChatAttachment): string {
  const raw = att.data_url.trim();
  if (raw.startsWith("data:")) return raw;
  const mime = att.mime || "application/octet-stream";
  return `data:${mime};base64,${raw}`;
}

/**
 * Normalize a client attachment into plain text for the phase LLM.
 * Path A: local text/PDF extract. Path B: MiniMax vision bridge for images / scan PDFs.
 */
export async function processChatAttachment(input: {
  attachment: PojuChatAttachment;
  userText: string;
  locale: string;
  dilemmaHint?: string | null;
  signal?: AbortSignal;
}): Promise<AttachmentProcessResult> {
  const att = input.attachment;
  const dataUrl = ensureDataUrl(att);
  const bytes = estimateDecodedBytes(dataUrl);

  if (att.kind === "image" || (att.mime || "").startsWith("image/")) {
    if (bytes > MAX_IMAGE_BYTES) {
      return { context_text: "", path: "none", error: "image_too_large" };
    }
    try {
      const report = await runVisionBridge({
        userText: input.userText,
        imageDataUrl: dataUrl,
        dilemmaHint: input.dilemmaHint,
        locale: input.locale,
        signal: input.signal,
      });
      return {
        path: "vision",
        context_text: `[附件视觉报告 · ${att.name}]\n${report}`,
      };
    } catch (e) {
      console.error("[attachment] vision bridge failed", e);
      return { context_text: "", path: "none", error: "vision_failed" };
    }
  }

  if (att.kind === "pdf" || (att.mime || "").includes("pdf") || /\.pdf$/i.test(att.name)) {
    if (bytes > MAX_PDF_BYTES) {
      return { context_text: "", path: "none", error: "pdf_too_large" };
    }
    try {
      const extracted = await extractTextFromPdf(dataUrl);
      if (extracted.replace(/\s+/g, "").length >= PDF_TEXT_MIN_CHARS) {
        return {
          path: "text",
          context_text: `[附件文本摘录 · ${att.name}]\n${extracted}`,
        };
      }
      // Scan-like PDF: no reliable page rasterizer in this PR — ask for a clear image.
      return {
        context_text: "",
        path: "none",
        error: "pdf_needs_image",
      };
    } catch (e) {
      console.error("[attachment] pdf extract failed", e);
      return { context_text: "", path: "none", error: "pdf_extract_failed" };
    }
  }

  if (att.kind === "document" || isTextLikeMime(att.mime, att.name)) {
    if (bytes > MAX_PDF_BYTES) {
      return { context_text: "", path: "none", error: "document_too_large" };
    }
    if (!isTextLikeMime(att.mime, att.name)) {
      return { context_text: "", path: "none", error: "document_unsupported" };
    }
    try {
      const text = await extractPlainTextFromUtf8(dataUrl);
      if (!text.trim()) {
        return { context_text: "", path: "none", error: "document_empty" };
      }
      return {
        path: "text",
        context_text: `[附件文本 · ${att.name}]\n${text}`,
      };
    } catch (e) {
      console.error("[attachment] document extract failed", e);
      return { context_text: "", path: "none", error: "document_extract_failed" };
    }
  }

  return { context_text: "", path: "none", error: "unsupported_type" };
}

export function attachmentErrorMessage(code: string | undefined, locale: string): string {
  const zh = locale.toLowerCase().startsWith("zh");
  switch (code) {
    case "image_too_large":
      return zh ? "图片过大（上限 5MB），请压缩后再传。" : "Image is too large (max 5MB).";
    case "pdf_too_large":
    case "document_too_large":
      return zh ? "文件过大（上限 10MB），请压缩后再传。" : "File is too large (max 10MB).";
    case "pdf_needs_image":
      return zh
        ? "这份 PDF 几乎抽不出文字。请改传清晰截图，或可复制文本的 PDF。"
        : "This PDF has little extractable text. Please upload a clear image or a text-selectable PDF.";
    case "document_unsupported":
      return zh
        ? "暂不支持该文档格式，请改传 TXT、MD 或 PDF。"
        : "That document type isn’t supported yet. Please use TXT, MD, or PDF.";
    case "vision_failed":
      return zh ? "审图暂时失败，请稍后重试或换一张更清晰的图。" : "Image review failed. Please retry or use a clearer image.";
    default:
      return zh ? "附件处理失败，请重试或改用文字说明。" : "Couldn’t process the attachment. Please retry or describe in text.";
  }
}
