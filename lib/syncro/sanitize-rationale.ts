import { auditSyncroText, sanitizeSyncroText } from "@/lib/syncro/sanitize-output";

/** @deprecated Use sanitizeSyncroText — audit-only, no mutation. */
export function sanitizeSyncroRationale(text: string, locale: string): string {
  return sanitizeSyncroText(text, locale);
}

export { auditSyncroText };
