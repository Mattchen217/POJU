import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_SECTION_HEADINGS,
  type DeliverySegmentKey,
  type DeliveryTextTree,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { demoteWuxingMarkers, forceSsotPlainInMarkers } from "@/lib/llm/sanitize/term-marking";

function evidenceLeadLabel(locale: string): string {
  return locale.startsWith("zh") ? "**依据与推理:**" : "**Evidence & reasoning:**";
}

/**
 * Merge narrative + evidence into 6-section dual-layer markdown.
 * Contract: ## A · … heading, body, then **依据与推理:** + evidence.
 */
export function mergeDeliveryToMarkdown(
  narrative: DeliveryTextTree,
  evidence: DeliveryTextTree,
  locale: string,
): string {
  const zh = locale.startsWith("zh");
  const lead = evidenceLeadLabel(locale);
  const parts: string[] = [];

  for (const k of DELIVERY_SEGMENT_KEYS) {
    const heading = zh
      ? `## ${DELIVERY_SECTION_HEADINGS[k].zh}`
      : `## ${DELIVERY_SECTION_HEADINGS[k].en}`;
    parts.push(heading);

    const body = (narrative[k] ?? "").trim().replace(/\n{2,}/g, "\n");
    const ev = (evidence[k] ?? "").trim().replace(/\s*\n+\s*/g, "");
    if (body) {
      parts.push(body);
      parts.push(`${lead}\n${ev || (zh ? "本段依据待补。" : "Evidence pending.")}`);
    }
  }

  const raw = parts.join("\n\n");
  return demoteWuxingMarkers(forceSsotPlainInMarkers(raw, locale));
}

export function listDeliverySectionKeys(): readonly DeliverySegmentKey[] {
  return DELIVERY_SEGMENT_KEYS;
}
