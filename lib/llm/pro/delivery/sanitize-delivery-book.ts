/**
 * Phase-4 delivery book sanitize — dual-layer, aligned with base-analysis v2.
 *
 * Evidence: polishEvidenceSegment (mark, don't delete).
 * Narrative body: prepareBodyTextForGlossaryRender (zero markers).
 * Preface / epilogue: single-layer body only (no evidence block).
 * Appendix: keep hard chart facts; only strip out-of-set 神煞 + normalize markers.
 */

import {
  forceRemarkAndFallback,
  polishEvidenceSegment,
} from "@/lib/base-analysis-v2/evidence/evidence-call";
import { prepareBodyTextForGlossaryRender } from "@/lib/llm/sanitize/compliance-terms";
import {
  demoteWuxingMarkers,
  forceSsotPlainInMarkers,
  normalizeTermMarkerIds,
  stripForbiddenShenSha,
} from "@/lib/llm/sanitize/term-marking";
import {
  DELIVERY_SEGMENT_KEYS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";

/** Transition sections: plain narrative only — no 依据块. */
export const DELIVERY_TRANSITION_KEYS = new Set<DeliverySegmentKey>([
  "preface",
  "epilogue",
]);

const EVIDENCE_LEAD_RE =
  /\n*\*\*(?:依据与推理|Evidence\s*&\s*reasoning)[:：]\*\*\s*/i;

function evidenceLeadLabel(locale: string): string {
  return locale.startsWith("zh") ? "**依据与推理:**" : "**Evidence & reasoning:**";
}

function polishEvidenceLayer(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  let out = polishEvidenceSegment(text.trim(), locale);
  // If still mostly bare / fragmented, force mark + plain fallback (base v2).
  if (!/⟦t:/.test(out) || /；\s*；/.test(out) || /^[；;、\s]+$/.test(out)) {
    out = forceRemarkAndFallback(out, locale);
  }
  out = normalizeTermMarkerIds(out, locale);
  out = demoteWuxingMarkers(forceSsotPlainInMarkers(out, locale));
  // Collapse semicolon skeletons left by bad backfills
  out = out
    .replace(/[；;]{2,}/g, "；")
    .replace(/^[；;\s]+|[；;\s]+$/g, "")
    .replace(/\s*[；;]\s*/g, "；");
  return out.trim();
}

function polishBodyLayer(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  return prepareBodyTextForGlossaryRender(text, locale).trim();
}

function polishAppendix(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  // Keep chart facts readable; only kill out-of-set 神煞 + fill marker slots if any.
  const noOut = stripForbiddenShenSha(text);
  return demoteWuxingMarkers(forceSsotPlainInMarkers(normalizeTermMarkerIds(noOut, locale), locale));
}

function splitBodyEvidence(sectionBody: string): { body: string; evidence: string | null } {
  const m = EVIDENCE_LEAD_RE.exec(sectionBody);
  if (!m || m.index == null) {
    return { body: sectionBody.trim(), evidence: null };
  }
  const body = sectionBody.slice(0, m.index).trim();
  const evidence = sectionBody.slice(m.index + m[0].length).trim();
  return { body, evidence: evidence || null };
}

/**
 * Guess segment key from ## title (mirrors parse-delivery lightly).
 */
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
  // parts: [preamble, '## ', 'title\nbody', '## ', 'title\nbody', ...]
  const out: string[] = [];

  // Preamble may include # cover
  if (parts[0]?.trim()) {
    const pre = parts[0];
    // Cover: body-style scrub only (no 命理 expected)
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

    const { body, evidence } = splitBodyEvidence(rest);
    const cleanBody = polishBodyLayer(body, locale);

    if (!key || DELIVERY_TRANSITION_KEYS.has(key as DeliverySegmentKey)) {
      // Transition or unknown: single layer — drop evidence if present
      out.push(`${hashes}${title}\n\n${cleanBody}`);
      continue;
    }

    // Analysis section — keep dual layer; polish evidence with mark-not-delete
    if (evidence != null && evidence.trim() && !/^本段依据待补|^Evidence (for this section )?pending/i.test(evidence)) {
      const cleanEv = polishEvidenceLayer(evidence, locale);
      out.push(
        `${hashes}${title}\n\n${cleanBody}\n\n${evidenceLeadLabel(locale)}\n${cleanEv || evidence.trim()}`,
      );
    } else if (evidence != null && /^本段依据待补|^Evidence/i.test(evidence.trim())) {
      // Drop placeholder evidence rather than ship "待补"
      out.push(`${hashes}${title}\n\n${cleanBody}`);
    } else if (evidence != null) {
      const cleanEv = polishEvidenceLayer(evidence, locale);
      out.push(
        `${hashes}${title}\n\n${cleanBody}\n\n${evidenceLeadLabel(locale)}\n${cleanEv}`,
      );
    } else {
      out.push(`${hashes}${title}\n\n${cleanBody}`);
    }
  }

  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
