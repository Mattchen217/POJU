/**
 * Phase-4 delivery book sanitize — dual-layer.
 *
 * Evidence: word-slot encode + autoMark fallback + SSOT soft (tooltip = glossOf at render).
 * Narrative body: prepareBodyTextForGlossaryRender (zero markers / zero gold).
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
  DELIVERY_SECTION_HEADINGS,
  DELIVERY_TRANSITION_KEYS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  deliveryEvidenceLeadLabel,
  deliveryEvidencePendingDetectRe,
} from "@/lib/llm/pro/delivery/delivery-locale";
import {
  DELIVERY_V2_EVIDENCE_LABEL_RE,
  splitEvidenceThenBody,
} from "@/lib/poju/delivery-report-v2-split";

/** @deprecated Import from delivery-schema — re-export for existing callers. */
export { DELIVERY_TRANSITION_KEYS };

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
 *
 * Odd split chunks are `evidence + following body` (same as UI splitSectionBlocks) —
 * never polish the whole odd chunk as evidence (that flattens next body into the fold).
 */
function polishArgumentPairs(sectionBody: string, locale: string, dropEvidence: boolean): string {
  const lead = deliveryEvidenceLeadLabel(locale);
  const parts = sectionBody.split(DELIVERY_V2_EVIDENCE_LABEL_RE);
  if (parts.length === 1) {
    return polishBodyLayer(sectionBody, locale);
  }

  const out: string[] = [];
  const firstBody = polishBodyLayer(parts[0] ?? "", locale);
  if (firstBody) out.push(firstBody);

  const pendingRe = deliveryEvidencePendingDetectRe();
  for (let i = 1; i < parts.length; i++) {
    const chunk = (parts[i] ?? "").trim();
    if (!chunk) continue;
    const { evidence, body } = splitEvidenceThenBody(chunk);
    if (!dropEvidence && evidence) {
      if (!pendingRe.test(evidence)) {
        const cleanEv = polishEvidenceLayer(evidence, locale);
        if (cleanEv) out.push(`${lead}\n${cleanEv}`);
      }
    }
    const cleanBody = polishBodyLayer(body, locale);
    if (cleanBody) out.push(cleanBody);
  }
  return out.join("\n\n");
}

function keyFromHeading(title: string): DeliverySegmentKey | "cover" | "toc" | "appendix" | null {
  const t = title.trim();
  if (!t) return null;
  if (/^目录$|^contents$|^índice$|^inhalt$|^sommaire$/i.test(t)) return "toc";
  if (/附录|appendix|apéndice|anhang|annexe/i.test(t)) return "appendix";

  const lower = t.toLowerCase();
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const h = DELIVERY_SECTION_HEADINGS[k];
    for (const label of [h.zh, h.en, h.es, h.de, h.fr]) {
      if (t === label || t.includes(label)) return k;
      if (label && lower.includes(label.toLowerCase())) return k;
    }
  }

  if (/序言|preface|sobre este informe|über diesen bericht|à propos de ce rapport/i.test(t)) {
    return "preface";
  }
  if (/结语|epilogue|sigue por tu cuenta|geh deinen eigenen weg|avancez par vous-même/i.test(t)) {
    return "epilogue";
  }
  if (/能量结构|第一部分|Part I\b/i.test(t)) return "energy";
  if (/处境|第二部分|Part II\b/i.test(t)) return "situation";
  if (/抉择|第三部分|Part III\b/i.test(t)) return "crossroads";
  if (/现代行动|第四部分|Part IV\b/i.test(t)) return "action";
  if (/调频|第五部分|Part V\b/i.test(t)) return "retune";
  if (/节奏|第六部分|Part VI\b/i.test(t)) return "rhythm";
  if (/觉察|第七部分|Part VII\b/i.test(t)) return "awareness";
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (lower.includes(k)) return k;
  }
  return null;
}

/** Heading → segment key helper (kept for tests / callers). */
export function deliveryKeyFromHeading(
  title: string,
): DeliverySegmentKey | "cover" | "toc" | "appendix" | null {
  return keyFromHeading(title);
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

    // Only drop evidence for known transitions. Unknown titles KEEP evidence
    // (never strip on failed heading match — that wiped EN books mid-complete).
    const dropEvidence =
      key != null && DELIVERY_TRANSITION_KEYS.has(key as DeliverySegmentKey);
    const polished = polishArgumentPairs(rest, locale, dropEvidence);
    out.push(`${hashes}${title}\n\n${polished}`);
  }

  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
