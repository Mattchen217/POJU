/**
 * Phase-4 delivery book sanitize — dual-layer.
 *
 * Evidence: mark-fill only (normalize + SSOT soft slots). No sanitizeNonMarkerSegment,
 * no forceRemarkAndFallback / 【】 delete-path — marking is done by a dedicated LLM step.
 * Narrative body: prepareBodyTextForGlossaryRender (zero markers).
 * Preface / epilogue: single-layer body only.
 */

import { prepareBodyTextForGlossaryRender } from "@/lib/llm/sanitize/compliance-terms";
import {
  demoteWuxingMarkers,
  forceSsotPlainInMarkers,
  normalizeTermMarkerIds,
  stripForbiddenShenSha,
} from "@/lib/llm/sanitize/term-marking";
import { polishMarkedEvidenceText } from "@/lib/llm/pro/delivery/polish-marked-evidence";
import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_TRANSITION_KEYS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";

/** @deprecated Import from delivery-schema — re-export for existing callers. */
export { DELIVERY_TRANSITION_KEYS };

const EVIDENCE_LEAD_RE =
  /\n*\*\*(?:依据与推理|Evidence\s*&\s*reasoning)[:：]\*\*\s*/gi;

function evidenceLeadLabel(locale: string): string {
  return locale.startsWith("zh") ? "**依据与推理:**" : "**Evidence & reasoning:**";
}

function polishEvidenceLayer(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  return polishMarkedEvidenceText(text, locale);
}

function polishBodyLayer(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  return prepareBodyTextForGlossaryRender(text, locale).trim();
}

function polishAppendix(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const noOut = stripForbiddenShenSha(text);
  return demoteWuxingMarkers(forceSsotPlainInMarkers(normalizeTermMarkerIds(noOut, locale), locale));
}

/**
 * Section body may contain multiple argument pairs:
 *   body1 + **依据:** + ev1 + body2 + **依据:** + ev2
 */
function polishArgumentPairs(sectionBody: string, locale: string, dropEvidence: boolean): string {
  const lead = evidenceLeadLabel(locale);
  const parts = sectionBody.split(EVIDENCE_LEAD_RE);
  if (parts.length === 1) {
    return polishBodyLayer(sectionBody, locale);
  }

  const out: string[] = [];
  // parts[0] = first body; then alternating evidence, body, evidence...
  for (let i = 0; i < parts.length; i++) {
    const chunk = (parts[i] ?? "").trim();
    if (!chunk) continue;
    if (i % 2 === 0) {
      const cleanBody = polishBodyLayer(chunk, locale);
      if (cleanBody) out.push(cleanBody);
    } else if (!dropEvidence) {
      if (/^本段依据待补|^Evidence (for this section )?pending/i.test(chunk)) continue;
      const cleanEv = polishEvidenceLayer(chunk, locale);
      if (cleanEv) out.push(`${lead}\n${cleanEv}`);
    }
  }
  return out.join("\n\n");
}

function keyFromHeading(title: string): DeliverySegmentKey | "cover" | "toc" | "appendix" | null {
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

/**
 * Dual-layer sanitize for the delivery book.
 * Does **not** call sanitizeDeliveryText / sanitizeNonMarkerSegment on evidence.
 */
export function sanitizeDeliveryBookMarkdown(fullText: string, locale: string): string {
  if (!fullText?.trim()) return fullText ?? "";

  const parts = fullText.split(/^(##\s+)/m);
  const out: string[] = [];

  if (parts[0]?.trim()) {
    const pre = parts[0];
    out.push(polishBodyLayer(pre, locale) || pre.trimEnd());
  }

  for (let i = 1; i < parts.length; i += 2) {
    const hashes = parts[i] ?? "## ";
    const chunk = parts[i + 1] ?? "";
    const nl = chunk.indexOf("\n");
    const title = (nl >= 0 ? chunk.slice(0, nl) : chunk).trim();
    const rest = (nl >= 0 ? chunk.slice(nl + 1) : "").trim();
    const key = keyFromHeading(title);

    if (key === "appendix") {
      out.push(`${hashes}${title}\n\n${polishAppendix(rest, locale)}`);
      continue;
    }

    if (key === "toc") {
      out.push(`${hashes}${title}\n\n${rest}`);
      continue;
    }

    const dropEvidence =
      !key || DELIVERY_TRANSITION_KEYS.has(key as DeliverySegmentKey);
    const polished = polishArgumentPairs(rest, locale, dropEvidence);
    out.push(`${hashes}${title}\n\n${polished}`);
  }

  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
