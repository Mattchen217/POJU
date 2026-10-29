/**
 * Face slice from BookJudgmentPack + page fact feed (shared with body).
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { formatPageSliceFeed } from "@/lib/llm/pro/delivery/page-slice-feed";
import type { DeepEvidencePlan, DeepEvidenceUnit } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import type { BookFaceId, BookJudgmentPack, BookJudgmentUnit } from "./schema";
import { BOOK_FACE_IDS } from "./schema";
import type { BookJudgmentQuotaTable } from "./quota-from-blueprint";
import { buildBookJudgmentQuotaFromBlueprint } from "./quota-from-blueprint";

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
        serves_segment: u.serves_segment,
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

export type BookJudgmentFaceTraceRow = {
  faceId: string;
  destiny: number;
  science: number;
  convergence: number;
  total: number;
  missing_destiny: boolean;
  missing_science: boolean;
  under_density: boolean;
  segment_coverage: number;
  segment_needed: number;
};

export function bookJudgmentTraceSummary(
  pack: BookJudgmentPack,
  opts?: {
    quota?: BookJudgmentQuotaTable;
    pattern_hits_available?: string[];
  },
): {
  shot_mode: string;
  unit_counts: { destiny: number; science: number; convergence: number; total: number };
  by_face_coverage: Record<string, number>;
  face_matrix: BookJudgmentFaceTraceRow[];
  zfpOmitted: boolean;
  pattern_hits_used: string[];
  pattern_hits_available: string[];
  pattern_hits_unused: string[];
  science_tags_used: string[];
  quota_total_min: number;
  under_density: boolean;
} {
  const quota = opts?.quota ?? buildBookJudgmentQuotaFromBlueprint();
  const unit_counts = { destiny: 0, science: 0, convergence: 0, total: pack.units.length };
  for (const u of pack.units) unit_counts[u.track] += 1;
  const by_face_coverage: Record<string, number> = {};
  const face_matrix: BookJudgmentFaceTraceRow[] = [];
  for (const faceQuota of quota.faces) {
    const face = faceQuota.faceId;
    const units = unitsForFace(pack, face);
    by_face_coverage[face] = units.length;
    /** Exclusive track counts (= JSON unit.track；d+s+c === face total). */
    const destiny = units.filter((u) => u.track === "destiny").length;
    const science = units.filter((u) => u.track === "science").length;
    const convergence = units.filter((u) => u.track === "convergence").length;
    const destinyLike = destiny + convergence;
    const scienceLike = science + convergence;
    const needed = faceQuota.segment_slots.filter((s) => s.needs_unit);
    let covered = 0;
    for (const slot of needed) {
      const hit =
        units.some((u) => u.serves_segment === slot.segmentId) ||
        units.some((u) => {
          if (slot.preferred_track === "any") return true;
          if (u.track === slot.preferred_track) return true;
          if (u.track === "convergence") return true;
          return false;
        });
      if (hit) covered += 1;
    }
    face_matrix.push({
      faceId: face,
      destiny,
      science,
      convergence,
      total: units.length,
      missing_destiny: destinyLike < faceQuota.min_destiny,
      missing_science: scienceLike < faceQuota.min_science,
      under_density: units.length < faceQuota.min_units,
      segment_coverage: covered,
      segment_needed: needed.length,
    });
  }
  const available = opts?.pattern_hits_available ?? [];
  const used = [...pack.pattern_hits_used];
  const unused = available.filter((n) => !used.includes(n));
  return {
    shot_mode: pack.shot_mode,
    unit_counts,
    by_face_coverage,
    face_matrix,
    zfpOmitted: pack.zfpOmitted,
    pattern_hits_used: used,
    pattern_hits_available: available,
    pattern_hits_unused: unused,
    science_tags_used: [...pack.science_tags_used],
    quota_total_min: quota.total_min_units,
    under_density: pack.units.length < quota.total_min_units,
  };
}
