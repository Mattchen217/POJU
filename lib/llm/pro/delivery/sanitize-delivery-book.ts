/**
 * Phase-4 delivery book sanitize.
 *
 * Diagnosis policy: **pass-through** — no strip / soft-replace / delete of markers
 * or 命理 terms. Merge layout (`##` / `**依据与推理:**`) is left intact so we can
 * judge raw model output + frontend layout first. Re-introduce selective polish later.
 */

import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_TRANSITION_KEYS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";

/** @deprecated Import from delivery-schema — re-export for existing callers. */
export { DELIVERY_TRANSITION_KEYS };

/**
 * Identity sanitize for the delivery book (diagnosis).
 * Does not call prepareBodyTextForGlossaryRender / polishMarkedEvidenceText /
 * rewriteMarkersWithSsotSoft / stripForbiddenShenSha.
 */
export function sanitizeDeliveryBookMarkdown(fullText: string, _locale: string): string {
  if (!fullText?.trim()) return fullText ?? "";
  return fullText.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** Heading → segment key helper (kept for tests / callers). */
export function deliveryKeyFromHeading(
  title: string,
): DeliverySegmentKey | "cover" | "toc" | "appendix" | null {
  const t = title.trim();
  if (/^目录$|^contents$/i.test(t)) return "toc";
  if (/附录|appendix/i.test(t)) return "appendix";
  if (/序言|preface/i.test(t)) return "preface";
  if (/结语|epilogue/i.test(t)) return "epilogue";
  if (/能量结构|第一部分|Part I/i.test(t)) return "energy";
  if (/处境|第二部分|Part II/i.test(t)) return "situation";
  if (/抉择|第三部分|Part III/i.test(t)) return "crossroads";
  if (/现代行动|第四部分|Part IV/i.test(t)) return "action";
  if (/调频|第五部分|Part V/i.test(t)) return "retune";
  if (/节奏|第六部分|Part VI/i.test(t)) return "rhythm";
  if (/觉察|第七部分|Part VII/i.test(t)) return "awareness";
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (t.includes(k)) return k;
  }
  return null;
}
