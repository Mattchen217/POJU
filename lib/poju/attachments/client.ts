import {
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  type AttachmentKind,
  type PojuChatAttachment,
} from "@/lib/poju/attachments/types";

export type ComposerAttachmentLocal = PojuChatAttachment & {
  previewUrl?: string;
};

export function isLikelyMobileClient(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  return navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua);
}

export function acceptForAttachKind(kind: AttachmentKind, mobile: boolean): string {
  if (kind === "image") {
    return mobile ? "image/*" : "image/png,image/jpeg,image/webp,image/heic,image/gif";
  }
  if (kind === "pdf") return "application/pdf,.pdf";
  return mobile
    ? ".txt,.md,.json,text/plain,text/markdown,application/json"
    : ".txt,.md,.json,.doc,.docx,text/plain,text/markdown,application/json";
}

function kindFromFile(file: File): AttachmentKind | null {
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic)$/i.test(name)) return "image";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    /\.(txt|md|markdown|json|csv)$/i.test(name)
  ) {
    return "document";
  }
  // Allow docx pick but server may reject unsupported binary docs
  if (/\.(docx?|rtf|odt)$/i.test(name)) return "document";
  return null;
}

export function validateAttachmentFile(file: File): { ok: true; kind: AttachmentKind } | { ok: false; error: string } {
  const kind = kindFromFile(file);
  if (!kind) return { ok: false, error: "unsupported_type" };
  if (kind === "image" && file.size > MAX_IMAGE_BYTES) return { ok: false, error: "image_too_large" };
  if (kind !== "image" && file.size > MAX_PDF_BYTES) return { ok: false, error: "file_too_large" };
  return { ok: true, kind };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export async function fileToComposerAttachment(file: File): Promise<ComposerAttachmentLocal> {
  const v = validateAttachmentFile(file);
  if (!v.ok) throw new Error(v.error);
  const data_url = await readFileAsDataUrl(file);
  return {
    name: file.name,
    kind: v.kind,
    mime: file.type || "application/octet-stream",
    data_url,
    previewUrl: v.kind === "image" ? data_url : undefined,
  };
}

export function attachmentClientErrorMessage(code: string, locale: string): string {
  const zh = locale.toLowerCase().startsWith("zh");
  switch (code) {
    case "image_too_large":
      return zh ? "图片过大（上限 5MB）" : "Image too large (max 5MB)";
    case "file_too_large":
      return zh ? "文件过大（上限 10MB）" : "File too large (max 10MB)";
    case "unsupported_type":
      return zh ? "暂不支持该文件类型" : "Unsupported file type";
    case "attach_locked":
      return zh ? "请先用文字说明你的问题" : "Please describe your question in text first";
    default:
      return zh ? "无法添加附件" : "Couldn’t add attachment";
  }
}

/** Extract image/file from a paste event. */
export function filesFromClipboard(e: ClipboardEvent): File[] {
  const out: File[] = [];
  const items = e.clipboardData?.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) out.push(f);
      }
    }
  }
  const files = e.clipboardData?.files;
  if (files) {
    for (let i = 0; i < files.length; i++) out.push(files[i]);
  }
  return out;
}
