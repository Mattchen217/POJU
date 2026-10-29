/**
 * Face slice from BookJudgmentPack + page fact feed (shared with body).
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { formatPageSliceFeed } from "@/lib/llm/pro/delivery/page-slice-feed";
import type { DeepEvidencePlan, DeepEvidenceUnit } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import type { BookFaceId, BookJudgmentPack, BookJudgmentUnit } from "./schema";
import { BOOK_FACE_IDS } from "./schema";

export type BookJudgmentFaceSlice = {
  faceId: BookFaceId;
  units: BookJudgmentUnit[];
  /** Prompt block: pack units only (no reinvent). */
  pack_block: string;
  /** PageFeedMatrix fact projection (CFP/ZFP). */
  fact_block: string | null;
};

export function unitsForFace(
  pack: BookJudgmentPack,
  faceId: string,
): BookJudgmentUnit[] {
  const ids = new Set(pack.by_face[faceId] ?? []);
  return pack.units.filter((u) => ids.has(u.id));
}

export function formatBookJudgmentPackBlock(
  pack: BookJudgmentPack,
  faceId: string,
): string {
  const units = unitsForFace(pack, faceId);
  if (!units.length) return "";
  return [
    `## 本页批断包切片（serves_face=${faceId} · 只阐述/装配 · 禁再发明批断 · 禁再锁主辅）`,
    `shot_mode=${pack.shot_mode} · zfpOmitted=${pack.zfpOmitted}`,
    JSON.stringify(
      units.map((u) => ({
        id: u.id,
        track: u.track,
        claim: u.claim,
        anchors: u.anchors,
        ...(u.caveat ? { caveat: u.caveat } : {}),
      })),
      null,
      2,
    ),
    "D 锚必须能回指上列 unit id；格局名/科学锚只能抄 pack+事实切片。",
  ].join("\n");
}

export function sliceBookJudgmentForFace(input: {
  pack: BookJudgmentPack;
  faceId: BookFaceId | string;
  chartText?: string | null;
  ziwei?: ZiweiFactPack | null;
  question?: string | null;
  topic?: string | null;
}): BookJudgmentFaceSlice | null {
  const faceId = input.faceId as BookFaceId;
  if (!(BOOK_FACE_IDS as readonly string[]).includes(faceId)) return null;
  const units = unitsForFace(input.pack, faceId);
  const fact_block = formatPageSliceFeed({
    key: faceId,
    chartText: input.chartText,
    ziwei: input.ziwei,
    question: input.question,
    topic: input.topic,
    withAllowlistHeader: true,
  });
  return {
    faceId,
    units,
    pack_block: formatBookJudgmentPackBlock(input.pack, faceId),
    fact_block,
  };
}

/** Convert pack units for a face into DeepEvidencePlan so body/polish keep working. */
export function deepEvidencePlanFromBookPack(
  pack: BookJudgmentPack,
  page: DeliverySegmentKey | BookFaceId,
): DeepEvidencePlan | null {
  const units = unitsForFace(pack, page);
  if (!units.length) return null;
  const mapped: DeepEvidenceUnit[] = units.map((u, i) => {
    const evidence =
      u.track === "science"
        ? `【科学】${u.claim}`
        : u.track === "destiny"
          ? `【命理】${u.claim}`
          : `【交汇】${u.claim}`;
    return {
      path: `book[${i}].${u.id}`,
      chart_anchors: [...u.anchors],
      evidence,
      unit_claim: u.claim,
      calc_cite: `pack:${u.id}`,
      ...(u.track === "science"
        ? { science_evidence: u.claim }
        : { metaphysics_evidence: u.claim }),
    };
  });
  return { page: page as DeliverySegmentKey, units: mapped };
}

export function bookJudgmentTraceSummary(pack: BookJudgmentPack): {
  shot_mode: string;
  unit_counts: { destiny: number; science: number; convergence: number; total: number };
  by_face_coverage: Record<string, number>;
  zfpOmitted: boolean;
  pattern_hits_used: string[];
  science_tags_used: string[];
} {
  const unit_counts = { destiny: 0, science: 0, convergence: 0, total: pack.units.length };
  for (const u of pack.units) unit_counts[u.track] += 1;
  const by_face_coverage: Record<string, number> = {};
  for (const face of BOOK_FACE_IDS) {
    by_face_coverage[face] = (pack.by_face[face] ?? []).length;
  }
  return {
    shot_mode: pack.shot_mode,
    unit_counts,
    by_face_coverage,
    zfpOmitted: pack.zfpOmitted,
    pattern_hits_used: [...pack.pattern_hits_used],
    science_tags_used: [...pack.science_tags_used],
  };
}
