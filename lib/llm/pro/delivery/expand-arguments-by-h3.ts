/**
 * Narrative sometimes packs several `###` headings into one arguments[i].body.
 * Evidence/mark then only write one evidence for that slot → UI hangs it on the
 * last card after ### split. Expand so each heading is its own argument before
 * evidence runs (1 body ↔ 1 evidence).
 */

import type {
  DeliveryArgument,
  DeliveryArgumentTree,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_SEGMENT_KEYS } from "@/lib/llm/pro/delivery/delivery-schema";
import { splitProseWithH3 } from "@/lib/poju/delivery-report-v2-split";

type BodyChunk = { title: string | null; prose: string };

function chunkBodyByH3(body: string): BodyChunk[] {
  const parts = splitProseWithH3(body);
  if (parts.length === 0) return [];

  const chunks: BodyChunk[] = [];
  let current: BodyChunk | null = null;

  for (const part of parts) {
    if (part.kind === "h3") {
      if (current) chunks.push(current);
      current = { title: part.text.trim() || null, prose: "" };
      continue;
    }
    if (!current) {
      current = { title: null, prose: "" };
    }
    current.prose = current.prose ? `${current.prose}\n\n${part.text}` : part.text;
  }
  if (current) chunks.push(current);
  return chunks;
}

function rebuildBody(chunk: BodyChunk): string {
  const prose = chunk.prose.trim();
  const title = chunk.title?.trim();
  if (title) {
    return prose ? `### ${title}\n\n${prose}` : `### ${title}`;
  }
  return prose;
}

/** One narrative argument → one-or-more (one `###` each when multiple were packed). */
export function expandDeliveryArgumentByH3(arg: DeliveryArgument): DeliveryArgument[] {
  const body = (arg.body ?? "").trim();
  if (!body) return [];

  const chunks = chunkBodyByH3(body);
  const headingCount = chunks.filter((c) => c.title).length;
  if (headingCount <= 1) {
    return [{ body, evidence: arg.evidence }];
  }

  return chunks
    .map((c, i) => {
      const rebuilt = rebuildBody(c).trim();
      if (!rebuilt) return null;
      return {
        body: rebuilt,
        // Rare: evidence already on narrative — keep only on first expanded slot.
        evidence: i === 0 ? arg.evidence : undefined,
      } satisfies DeliveryArgument;
    })
    .filter((a): a is DeliveryArgument => a != null);
}

/** Expand every segment's argument list in place (new tree). */
export function expandDeliveryArgumentTreeByH3(
  tree: DeliveryArgumentTree,
): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const args = tree[k];
    if (!args?.length) continue;
    const expanded = args.flatMap(expandDeliveryArgumentByH3);
    if (expanded.length === 0) continue;
    out[k as DeliverySegmentKey] = expanded;
    if (expanded.length !== args.length) {
      console.warn("[delivery/narrative] expanded multi-### arguments", {
        key: k,
        before: args.length,
        after: expanded.length,
      });
    }
  }
  return out;
}

/** Count non-empty evidence strings vs body slots (for logging / gate). */
export function countEvidenceCoverage(
  narrative: DeliveryArgumentTree,
  evidence: DeliveryArgumentTree,
  key: DeliverySegmentKey,
): { bodies: number; evidences: number; missingIndexes: number[] } {
  const bodies = (narrative[key] ?? []).filter((a) => a.body.trim()).length;
  const evArgs = evidence[key] ?? [];
  const missingIndexes: number[] = [];
  for (let i = 0; i < bodies; i++) {
    const ev = (evArgs[i]?.evidence ?? evArgs[i]?.body ?? "").trim();
    if (!ev) missingIndexes.push(i);
  }
  return {
    bodies,
    evidences: bodies - missingIndexes.length,
    missingIndexes,
  };
}
