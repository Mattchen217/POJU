/**
 * Face-native delivery page schemas (01–08).
 * Field names = DECISION_PAGE_SCHEMAS segment duties (EN keys).
 * New books emit these shapes — no primary/backup on face 01.
 */

import { z } from "zod";
import {
  DECISION_PAGE_IDS,
  type DecisionPageId,
} from "@/lib/llm/pro/delivery/page-feed-matrix";

const NonEmpty = z.string().trim().min(1);

const FaceChromeSchema = z.object({
  page_title: z.string().trim().max(56).optional().default(""),
  page_subtitle: z.string().trim().max(80).optional().default(""),
  face: z.enum(DECISION_PAGE_IDS),
});

/** 01 · 本题断语 · dualTrack=pointer */
export const Face01Schema = z.object({
  page: z.literal("01"),
  ...FaceChromeSchema.shape,
  face: z.literal("01"),
  main_recommendation: NonEmpty.max(480),
  conditions: NonEmpty.max(720),
  not_choosing: NonEmpty.max(480),
  /** Pointer only — no chart facts. */
  evidence_pointer: NonEmpty.max(240),
});
export type Face01 = z.infer<typeof Face01Schema>;

/** 02 · 为何如此 · dualTrack=abc */
export const Face02Schema = z.object({
  page: z.literal("02"),
  ...FaceChromeSchema.shape,
  face: z.literal("02"),
  destiny_reason: NonEmpty.max(1200),
  science_mechanism: NonEmpty.max(1200),
  convergence: NonEmpty.max(720),
  /** Short checkable anchors; ≤6 lines preferred. */
  verifiable_anchors: z.array(NonEmpty.max(160)).min(1).max(8),
});
export type Face02 = z.infer<typeof Face02Schema>;

/** 04 · 真正卡点 · dualTrack=fold */
export const Face04Schema = z.object({
  page: z.literal("04"),
  ...FaceChromeSchema.shape,
  face: z.literal("04"),
  bottleneck_name: NonEmpty.max(160),
  manifestation: NonEmpty.max(960),
  if_force_through: z.string().trim().max(720).optional().default(""),
  evidence_fold: NonEmpty.max(1200),
});
export type Face04 = z.infer<typeof Face04Schema>;

/** 05 · 路径排序 · dualTrack=fold */
export const Face05Schema = z.object({
  page: z.literal("05"),
  ...FaceChromeSchema.shape,
  face: z.literal("05"),
  first_choice: NonEmpty.max(720),
  second_choice: NonEmpty.max(720),
  caution_choice: NonEmpty.max(720),
  switch_or_stop: NonEmpty.max(720),
  contrast: z.string().trim().max(320).optional().default(""),
});
export type Face05 = z.infer<typeof Face05Schema>;

/** 06 · 怎么落地 · dualTrack=reality */
export const Face06Schema = z.object({
  page: z.literal("06"),
  ...FaceChromeSchema.shape,
  face: z.literal("06"),
  near_step_principle: NonEmpty.max(960),
  stage_climate: NonEmpty.max(720),
  self_retune: NonEmpty.max(720),
  rhythm_note: NonEmpty.max(480),
});
export type Face06 = z.infer<typeof Face06Schema>;

/** 07 · 场域与关系 · dualTrack=abc · topic-gated */
export const Face07Schema = z.object({
  page: z.literal("07"),
  ...FaceChromeSchema.shape,
  face: z.literal("07"),
  field_judgment: NonEmpty.max(960),
  relation_interaction: NonEmpty.max(960),
  evidence_fold: NonEmpty.max(1200),
  align_with_01_05: z.string().trim().max(480).optional().default(""),
});
export type Face07 = z.infer<typeof Face07Schema>;

/** 08 · 自检清单 · dualTrack=reality */
export const Face08Schema = z.object({
  page: z.literal("08"),
  ...FaceChromeSchema.shape,
  face: z.literal("08"),
  red_lights: z.array(NonEmpty.max(240)).min(1).max(8),
  review_questions: z.array(NonEmpty.max(240)).min(1).max(8),
  when_to_rerun: NonEmpty.max(480),
});
export type Face08 = z.infer<typeof Face08Schema>;

/** 03 · 盘面附录 · dualTrack=appendix */
export const Face03Schema = z.object({
  page: z.literal("03"),
  ...FaceChromeSchema.shape,
  face: z.literal("03"),
  bazi_slice: NonEmpty.max(1600),
  /** Omit / empty when ziwei unstable — do not invent palaces. */
  ziwei_slice: z.string().trim().max(1600).optional().default(""),
  contrast: z.string().trim().max(320).optional().default(""),
});
export type Face03 = z.infer<typeof Face03Schema>;

export const FACE_PAGE_SCHEMAS = {
  "01": Face01Schema,
  "02": Face02Schema,
  "04": Face04Schema,
  "05": Face05Schema,
  "06": Face06Schema,
  "07": Face07Schema,
  "08": Face08Schema,
  "03": Face03Schema,
} as const;

export type FacePageData =
  | Face01
  | Face02
  | Face04
  | Face05
  | Face06
  | Face07
  | Face08
  | Face03;

export function facePageSchema(pageId: DecisionPageId) {
  return FACE_PAGE_SCHEMAS[pageId];
}

/** Segment field keys per face (for prompt shape + UI). */
export const FACE_SEGMENT_FIELDS: Record<
  DecisionPageId,
  readonly { key: string; segmentId: string }[]
> = {
  "01": [
    { key: "main_recommendation", segmentId: "A" },
    { key: "conditions", segmentId: "B" },
    { key: "not_choosing", segmentId: "C" },
    { key: "evidence_pointer", segmentId: "D" },
  ],
  "02": [
    { key: "destiny_reason", segmentId: "A" },
    { key: "science_mechanism", segmentId: "B" },
    { key: "convergence", segmentId: "C" },
    { key: "verifiable_anchors", segmentId: "D" },
  ],
  "04": [
    { key: "bottleneck_name", segmentId: "A" },
    { key: "manifestation", segmentId: "B" },
    { key: "if_force_through", segmentId: "C" },
    { key: "evidence_fold", segmentId: "D" },
  ],
  "05": [
    { key: "first_choice", segmentId: "A" },
    { key: "second_choice", segmentId: "B" },
    { key: "caution_choice", segmentId: "C" },
    { key: "switch_or_stop", segmentId: "D" },
    { key: "contrast", segmentId: "E" },
  ],
  "06": [
    { key: "near_step_principle", segmentId: "A" },
    { key: "stage_climate", segmentId: "B" },
    { key: "self_retune", segmentId: "C" },
    { key: "rhythm_note", segmentId: "D" },
  ],
  "07": [
    { key: "field_judgment", segmentId: "A" },
    { key: "relation_interaction", segmentId: "B" },
    { key: "evidence_fold", segmentId: "C" },
    { key: "align_with_01_05", segmentId: "D" },
  ],
  "08": [
    { key: "red_lights", segmentId: "A" },
    { key: "review_questions", segmentId: "B" },
    { key: "when_to_rerun", segmentId: "C" },
  ],
  "03": [
    { key: "bazi_slice", segmentId: "A" },
    { key: "ziwei_slice", segmentId: "B" },
    { key: "contrast", segmentId: "C" },
  ],
};

/** Empty JSON shape for fill skeleton / prompt. */
export function faceFillShapeSkeleton(pageId: DecisionPageId): Record<string, unknown> {
  const base = { page: pageId, face: pageId, page_title: "", page_subtitle: "" };
  switch (pageId) {
    case "01":
      return {
        ...base,
        main_recommendation: "",
        conditions: "",
        not_choosing: "",
        evidence_pointer: "",
      };
    case "02":
      return {
        ...base,
        destiny_reason: "",
        science_mechanism: "",
        convergence: "",
        verifiable_anchors: [""],
      };
    case "04":
      return {
        ...base,
        bottleneck_name: "",
        manifestation: "",
        if_force_through: "",
        evidence_fold: "",
      };
    case "05":
      return {
        ...base,
        first_choice: "",
        second_choice: "",
        caution_choice: "",
        switch_or_stop: "",
        contrast: "",
      };
    case "06":
      return {
        ...base,
        near_step_principle: "",
        stage_climate: "",
        self_retune: "",
        rhythm_note: "",
      };
    case "07":
      return {
        ...base,
        field_judgment: "",
        relation_interaction: "",
        evidence_fold: "",
        align_with_01_05: "",
      };
    case "08":
      return {
        ...base,
        red_lights: [""],
        review_questions: [""],
        when_to_rerun: "",
      };
    case "03":
      return {
        ...base,
        bazi_slice: "",
        ziwei_slice: "",
        contrast: "",
      };
  }
}

/** True when payload looks like a face-native page (not v1 paper). */
export function isFaceNativePage(data: unknown): data is FacePageData {
  if (!data || typeof data !== "object") return false;
  const page = (data as { page?: unknown }).page;
  return typeof page === "string" && (DECISION_PAGE_IDS as readonly string[]).includes(page);
}

/** Reject legacy primary/backup on new-book face JSON. */
export function faceJsonHasLegacyPrimaryBackup(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return "primary" in o || "backup" in o || "primary_toolkit" in o || "backup_toolkit" in o;
}
