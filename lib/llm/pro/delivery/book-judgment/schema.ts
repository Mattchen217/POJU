/**
 * BookJudgmentPack · Zod SoT (Canvas lock 2026-10-29 + 达标改造).
 * Destiny + science dual-track; units keyed by serves_face (+ optional serves_segment).
 */

import { z } from "zod";
import { DECISION_PAGE_IDS } from "@/lib/llm/pro/delivery/page-feed-matrix";
import type { BookJudgmentQuotaTable } from "./quota-from-blueprint";
import { buildBookJudgmentQuotaFromBlueprint } from "./quota-from-blueprint";

export const BOOK_JUDGMENT_PACK_VERSION = 1 as const;

export const BOOK_FACE_IDS = [...DECISION_PAGE_IDS] as const;
export type BookFaceId = (typeof BOOK_FACE_IDS)[number];

export const BookFaceIdSchema = z.enum(
  BOOK_FACE_IDS as unknown as [BookFaceId, ...BookFaceId[]],
);

export const BookJudgmentTrackSchema = z.enum([
  "destiny",
  "science",
  "convergence",
]);
export type BookJudgmentTrack = z.infer<typeof BookJudgmentTrackSchema>;

export const BookJudgmentShotModeSchema = z.enum(["one", "two"]);
export type BookJudgmentShotMode = z.infer<typeof BookJudgmentShotModeSchema>;

export const BookJudgmentSegmentIdSchema = z.enum(["A", "B", "C", "D", "E"]);
export type BookJudgmentSegmentId = z.infer<typeof BookJudgmentSegmentIdSchema>;

export const BookJudgmentUnitSchema = z.object({
  id: z.string().trim().min(1).max(64),
  track: BookJudgmentTrackSchema,
  serves_face: z.array(BookFaceIdSchema).min(1).max(9),
  /** Segment back-ref for face body slots. */
  serves_segment: BookJudgmentSegmentIdSchema.optional(),
  claim: z.string().trim().min(1).max(400),
  anchors: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  caveat: z.string().trim().max(240).optional(),
});
export type BookJudgmentUnit = z.infer<typeof BookJudgmentUnitSchema>;

export const BookJudgmentPackSchema = z.object({
  version: z.literal(BOOK_JUDGMENT_PACK_VERSION),
  locale: z.string().trim().min(1).max(16),
  question_id: z.string().trim().max(128).optional(),
  thesis_ref: z.string().trim().max(128).optional(),
  cfp_hash: z.string().trim().min(1).max(128),
  zfp_hash: z.string().trim().min(1).max(128).nullable(),
  zfpOmitted: z.boolean(),
  shot_mode: BookJudgmentShotModeSchema,
  created_at: z.string().trim().min(1),
  units: z.array(BookJudgmentUnitSchema).min(1).max(120),
  by_face: z.record(z.string(), z.array(z.string().trim().min(1))),
  pattern_hits_used: z.array(z.string().trim().min(1).max(80)).default([]),
  science_tags_used: z.array(z.string().trim().min(1).max(80)).default([]),
});

export type BookJudgmentPack = z.infer<typeof BookJudgmentPackSchema>;

export type BookJudgmentValidateOk = { ok: true; pack: BookJudgmentPack };
export type BookJudgmentValidateFail = {
  ok: false;
  reason: string;
  detail?: string;
};

/** Rebuild by_face from units (canonical). */
export function indexBookJudgmentByFace(
  units: readonly BookJudgmentUnit[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const face of BOOK_FACE_IDS) out[face] = [];
  for (const u of units) {
    for (const face of u.serves_face) {
      if (!out[face]) out[face] = [];
      if (!out[face]!.includes(u.id)) out[face]!.push(u.id);
    }
  }
  return out;
}

/** Reject pure 「科学维N」 label shells / 空壳学科标签. */
export function isWeakScienceAnchor(anchor: string): boolean {
  const t = anchor.trim();
  if (!t || t.length < 2) return true;
  if (/^科学维\s*\d+/i.test(t)) return true;
  if (/^科学维\s*\d+\s*\//i.test(t)) return true;
  if (/^sci(ence)?[_\s-]?\d+(\s*\/|$)/i.test(t)) return true;
  if (/^维\s*\d+$/i.test(t)) return true;
  if (/^(结构轴|axis)\s*\d*$/i.test(t)) return true;
  return false;
}

/**
 * 可执行手段句（语义类 · 不靠单字黑名单）→ 批断包 FAIL。
 * 类别：宜/祈使 · 小时块/周内交付 · 低承诺小样 · 红灯停损退回 ·
 * 最小可收费样貌 · 停下来改节奏 · 试点摊任务。
 * 豁免：忌神/用神/喜神邻接「宜」。
 */
const PACK_MEANS_SEMANTIC_RES: readonly RegExp[] = [
  // 宜 / 攻守祈使
  /(?:^|[，,；;。.\s、])宜(?![忌神用喜])/,
  /宜用|宜退|宜把|宜将|宜以|宜守|宜进|宜藏|宜避|以静制动|守势探路/,
  // 小时块 / 周内交付 / 时窗操作
  /小时块|\d+\s*小时(?:完整)?块|(?:四|4)\s*小时完整块|完整块连续|固定\s*\d+\s*小时/,
  /\d+\s*周内|四周任务|摊成[^。；;]{0,8}周|试点摊/,
  // 低承诺小样 / 可收费最小样貌 / 小成品
  /低承诺(?:交换|小样)?|小样验证|做一个[^。；;]{0,16}(?:小样|验证)|最小样|可收费验证|最小可收费|小成品|能直接使用/,
  // 红灯停损 / 退回 / 改节奏 / 近步操作句
  /红灯信号|红灯则|停下并退回|停下来改|退回观察|近步原则|停在可逆/,
  // 其它落地处方壳
  /低承诺交换|拿给人用|递给[^。；;]{0,12}人|把样品|样品拿给|(?:兼职|灵活)?试水|加重筹码|全职(?:投入|跳入|加码)|冒进全职|更符合[^。；;]{0,40}|静润降温|延迟回应|不急于表态|再加大投入|此为[^。；;]{0,16}仪轨|可操作步骤|执行清单|今晚可|只给反馈不付费|primary_toolkit|backup_toolkit/,
];

export function claimHasMeansPrescription(claim: string): boolean {
  const t = claim.trim();
  if (!t) return false;
  return PACK_MEANS_SEMANTIC_RES.some((re) => re.test(t));
}

function trackCovers(
  unitTrack: BookJudgmentTrack,
  preferred: "destiny" | "science" | "convergence" | "any",
): boolean {
  if (preferred === "any") return true;
  if (unitTrack === preferred) return true;
  if (unitTrack === "convergence") return true;
  return false;
}

/**
 * Dual-track + density + segment coverage gate (quota from blueprint).
 */
export function validateBookJudgmentPack(
  raw: unknown,
  quota: BookJudgmentQuotaTable = buildBookJudgmentQuotaFromBlueprint(),
): BookJudgmentValidateOk | BookJudgmentValidateFail {
  const parsed = BookJudgmentPackSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "schema",
      detail: parsed.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  let pack = parsed.data;
  const by_face = indexBookJudgmentByFace(pack.units);
  pack = { ...pack, by_face };

  const ids = new Set(pack.units.map((u) => u.id));
  if (ids.size !== pack.units.length) {
    return { ok: false, reason: "duplicate_unit_id" };
  }

  const tracks = new Set(pack.units.map((u) => u.track));
  const hasDestiny = tracks.has("destiny") || tracks.has("convergence");
  const hasScience = tracks.has("science") || tracks.has("convergence");
  if (!hasDestiny) {
    return { ok: false, reason: "missing_destiny_track" };
  }
  if (!hasScience) {
    return { ok: false, reason: "missing_science_track" };
  }

  if (pack.units.length < quota.total_min_units) {
    return {
      ok: false,
      reason: "under_density",
      detail: `units=${pack.units.length} < total_min_units=${quota.total_min_units}`,
    };
  }

  for (const faceQuota of quota.faces) {
    const face = faceQuota.faceId;
    const list = by_face[face] ?? [];
    if (list.length === 0) {
      return { ok: false, reason: "empty_face", detail: `by_face[${face}] empty` };
    }
    for (const id of list) {
      if (!ids.has(id)) {
        return {
          ok: false,
          reason: "orphan_face_index",
          detail: `${face}→${id}`,
        };
      }
    }
    const faceUnits = pack.units.filter((u) => list.includes(u.id));
    if (faceUnits.length < faceQuota.min_units) {
      return {
        ok: false,
        reason: "face_under_density",
        detail: `face ${face} units=${faceUnits.length} < min=${faceQuota.min_units}`,
      };
    }
    const faceTracks = new Set(faceUnits.map((u) => u.track));
    const faceDestiny =
      faceTracks.has("destiny") || faceTracks.has("convergence");
    const faceScience =
      faceTracks.has("science") || faceTracks.has("convergence");
    if (!faceDestiny) {
      return {
        ok: false,
        reason: "face_missing_destiny",
        detail: `by_face[${face}] has no destiny|convergence`,
      };
    }
    if (!faceScience) {
      return {
        ok: false,
        reason: "face_missing_science",
        detail: `by_face[${face}] has no science|convergence`,
      };
    }
    const destinyCount = faceUnits.filter(
      (u) => u.track === "destiny" || u.track === "convergence",
    ).length;
    const scienceCount = faceUnits.filter(
      (u) => u.track === "science" || u.track === "convergence",
    ).length;
    if (destinyCount < faceQuota.min_destiny) {
      return {
        ok: false,
        reason: "face_missing_destiny",
        detail: `face ${face} destiny-like=${destinyCount} < ${faceQuota.min_destiny}`,
      };
    }
    if (scienceCount < faceQuota.min_science) {
      return {
        ok: false,
        reason: "face_missing_science",
        detail: `face ${face} science-like=${scienceCount} < ${faceQuota.min_science}`,
      };
    }

    for (const slot of faceQuota.segment_slots) {
      if (!slot.needs_unit) continue;
      const bySeg = faceUnits.filter((u) => u.serves_segment === slot.segmentId);
      if (bySeg.length > 0) {
        const okTrack = bySeg.some((u) =>
          trackCovers(u.track, slot.preferred_track),
        );
        if (!okTrack && slot.preferred_track !== "any") {
          return {
            ok: false,
            reason: "segment_track_mismatch",
            detail: `face ${face} seg ${slot.segmentId} needs track≈${slot.preferred_track}`,
          };
        }
        continue;
      }
      // Fallback: preferred_track unit on face without serves_segment
      const fallback = faceUnits.filter((u) =>
        trackCovers(u.track, slot.preferred_track),
      );
      if (!fallback.length) {
        return {
          ok: false,
          reason: "segment_uncovered",
          detail: `face ${face} seg ${slot.segmentId}「${slot.label}」无 unit`,
        };
      }
    }
  }

  for (const u of pack.units) {
    if (claimHasMeansPrescription(u.claim)) {
      return {
        ok: false,
        reason: "means_prescription",
        detail: `unit ${u.id}（${u.track}）claim 含宜/手段/可操作步骤：「${u.claim.slice(0, 80)}」`,
      };
    }
    if (u.track !== "science" && u.track !== "convergence") continue;
    for (const a of u.anchors) {
      if (isWeakScienceAnchor(a)) {
        return {
          ok: false,
          reason: "weak_science_anchor",
          detail: `unit ${u.id} anchor「${a}」禁止纯科学维N标签`,
        };
      }
    }
  }

  if (!pack.zfpOmitted && pack.pattern_hits_used.length === 0) {
    return {
      ok: false,
      reason: "missing_pattern_hits",
      detail: "zfpOmitted=false requires pattern_hits_used",
    };
  }

  return { ok: true, pack };
}

/**
 * @deprecated Canvas 达标改造：禁止顺推硬塞过闸。保留仅供测试/诊断，generate/gate 不得调用。
 */
export function softRepairFaceDualTrack(
  units: readonly BookJudgmentUnit[],
): BookJudgmentUnit[] {
  return units.map((u) => ({
    ...u,
    serves_face: [...u.serves_face] as BookJudgmentUnit["serves_face"],
    anchors: [...u.anchors],
  }));
}
