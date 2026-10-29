/**
 * BookJudgmentPack · Zod SoT (Canvas lock 2026-10-29).
 * Destiny + science dual-track; units keyed by serves_face.
 */

import { z } from "zod";
import { DECISION_PAGE_IDS } from "@/lib/llm/pro/delivery/page-feed-matrix";

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

export const BookJudgmentUnitSchema = z.object({
  id: z.string().trim().min(1).max(64),
  track: BookJudgmentTrackSchema,
  serves_face: z.array(BookFaceIdSchema).min(1).max(9),
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
  units: z.array(BookJudgmentUnitSchema).min(1).max(80),
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

/**
 * Dual-track + coverage gate.
 * - Must have destiny and science (or convergence covering both roles).
 * - by_face must cover every face 01–08+03 with ≥1 unit.
 * - When zfpOmitted=false, pattern_hits_used must be non-empty.
 */
export function validateBookJudgmentPack(
  raw: unknown,
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
  // Prefer explicit both tracks; convergence may stand in for either side.
  if (!tracks.has("destiny") && !tracks.has("science") && !tracks.has("convergence")) {
    return { ok: false, reason: "missing_dual_track" };
  }

  for (const face of BOOK_FACE_IDS) {
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
