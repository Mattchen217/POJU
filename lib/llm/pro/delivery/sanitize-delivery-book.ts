/**
 * Phase-4 delivery book sanitize — dual-layer.
 *
 * Evidence: word-slot encode + autoMark fallback + SSOT soft (tooltip = glossOf at render).
 * Narrative body: prepareBodyTextForGlossaryRender (zero markers / zero gold).
 * Transition sections (historically preface/epilogue): single-layer body only.
 * New 9-page book has empty DELIVERY_TRANSITION_KEYS — all pages keep dual-layer evidence.
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
import {
  parsePojuStructPayloads,
  stripPojuStructFences,
  encodePojuStruct,
  formatStructFallbackMarkdown,
} from "@/lib/llm/pro/delivery/poju-struct-blocks";
import {
  detectDeliveryDedupIssues,
  logDeliveryDedupFindings,
  softDemoteNurtureRepetition,
} from "@/lib/llm/pro/delivery/delivery-dedup";

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

  if (/能量底座|黄金直答|序言|preface|关于这份报告|第一部分|Part I\b/i.test(t)) {
    return "energy_base";
  }
  if (/先天潜能|十神|处境|第二部分|Part II\b/i.test(t)) return "talent_map";
  if (/天赋助力|神煞|能量阶段|抉择|第三部分|Part III\b/i.test(t)) return "spirit_gifts";
  if (/宏观周期|战略窗口|第四部分|Part IV\b/i.test(t)) return "macro_cycle";
  if (/科学实操|现代行动|第五部分|Part V\b/i.test(t)) return "science_action";
  if (/玄学实操|调频|retune|第六部分|Part VI\b/i.test(t)) return "metaphysics_action";
  if (/30\s*天|双轨|节奏|第七部分|Part VII\b/i.test(t)) return "thirty_day";
  if (/避坑|红线|预警|觉察|第八部分|Part VIII\b/i.test(t)) return "risk_guard";
  if (/正向信号|收尾|结语|epilogue|独立走|第九部分|Part IX\b/i.test(t)) {
    return "signals_close";
  }
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

/** Soft-strip return-hook marketing from P9 close (one-shot product). */
function stripReturnHooks(text: string): string {
  return text
    .replace(
      /[^\n。.!?]{0,40}(?:随时回来|回来追踪|回来汇报|下次再来|欢迎回来|come\s+back\s+any\s*time|come\s+back\s+and\s+(?:check|update)|return\s+to\s+(?:track|check\s+in))[^\n。.!?]*[。.!?]?\s*/gi,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Dual-layer sanitize for the delivery book.
 * Does **not** call sanitizeDeliveryText / sanitizeNonMarkerSegment on evidence.
 * Preserves ```poju-struct fences (Layer 3 code structures).
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

    const structs = parsePojuStructPayloads(rest);
    const withoutStructs = stripPojuStructFences(rest);
    const dropEvidence =
      key != null && DELIVERY_TRANSITION_KEYS.has(key as DeliverySegmentKey);
    let polished = polishArgumentPairs(withoutStructs, locale, dropEvidence);
    if (key === "signals_close") {
      polished = stripReturnHooks(polished);
    }

    const structBlocks = structs
      .map((p) => `${encodePojuStruct(p)}\n\n${formatStructFallbackMarkdown(p, locale)}`)
      .join("\n\n");
    const body = [structBlocks, polished].filter(Boolean).join("\n\n");
    out.push(`${hashes}${title}\n\n${body}`);
  }

  let assembled = out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  const dedupFindings = detectDeliveryDedupIssues(assembled);
  logDeliveryDedupFindings(dedupFindings);
  if (dedupFindings.some((f) => f.kind === "nurture_axis" && f.count >= 3)) {
    assembled = softDemoteNurtureRepetition(assembled);
  }
  return assembled;
}
