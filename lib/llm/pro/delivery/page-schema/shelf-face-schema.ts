/**
 * Shelf-face zod. Generation still emits v1 segment JSON.
 * The reader face groups those segments: 06 holds principles + 06-C, 08 holds risk + close.
 */

import { z } from "zod";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DeliveryPageSchemaByKey } from "@/lib/llm/pro/delivery/page-schema/types";

const optionalBody = z.string().trim().optional();

export const ShelfFace01Schema = z.object({
  page: z.literal("01"),
  brief: DeliveryPageSchemaByKey.decision_brief.optional(),
});

export const ShelfFace02Schema = z.object({
  page: z.literal("02"),
  situation: DeliveryPageSchemaByKey.situation_analysis.optional(),
  patterns: DeliveryPageSchemaByKey.personal_decision_patterns.optional(),
});

export const ShelfFace04Schema = z.object({
  page: z.literal("04"),
  bottleneck: DeliveryPageSchemaByKey.bottleneck_analysis.optional(),
});

export const ShelfFace05Schema = z.object({
  page: z.literal("05"),
  options: DeliveryPageSchemaByKey.strategic_options.optional(),
  strategy: DeliveryPageSchemaByKey.recommended_strategy.optional(),
});

export const ShelfFace06Schema = z.object({
  page: z.literal("06"),
  principles: DeliveryPageSchemaByKey.execution_guidance.optional(),
  retune: DeliveryPageSchemaByKey.self_regulation.optional(),
});

export const ShelfFace07Schema = z.object({
  page: z.literal("07"),
  body: optionalBody,
});

export const ShelfFace08Schema = z.object({
  page: z.literal("08"),
  risk: DeliveryPageSchemaByKey.validation_risk.optional(),
  close: DeliveryPageSchemaByKey.validation_close.optional(),
});

export const ShelfFace03Schema = z.object({
  page: z.literal("03"),
  body: optionalBody,
});

export const SHELF_FACE_SCHEMAS = {
  "01": ShelfFace01Schema,
  "02": ShelfFace02Schema,
  "04": ShelfFace04Schema,
  "05": ShelfFace05Schema,
  "06": ShelfFace06Schema,
  "07": ShelfFace07Schema,
  "08": ShelfFace08Schema,
  "03": ShelfFace03Schema,
} as const;

export function shelfFaceSchema(pageId: DecisionPageId) {
  return SHELF_FACE_SCHEMAS[pageId];
}
