/**
 * Shelf-face zod — face-native segment schemas (01–08).
 * Generation emits one JSON per face; no v1 paper fold wrappers.
 */

import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import {
  FACE_PAGE_SCHEMAS,
  Face01Schema,
  Face02Schema,
  Face03Schema,
  Face04Schema,
  Face05Schema,
  Face06Schema,
  Face07Schema,
  Face08Schema,
} from "@/lib/llm/pro/delivery/page-schema/face-types";

export const ShelfFace01Schema = Face01Schema;
export const ShelfFace02Schema = Face02Schema;
export const ShelfFace04Schema = Face04Schema;
export const ShelfFace05Schema = Face05Schema;
export const ShelfFace06Schema = Face06Schema;
export const ShelfFace07Schema = Face07Schema;
export const ShelfFace08Schema = Face08Schema;
export const ShelfFace03Schema = Face03Schema;

export const SHELF_FACE_SCHEMAS = FACE_PAGE_SCHEMAS;

export function shelfFaceSchema(pageId: DecisionPageId) {
  return SHELF_FACE_SCHEMAS[pageId];
}
