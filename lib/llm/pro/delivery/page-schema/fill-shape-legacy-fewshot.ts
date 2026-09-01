/**
 * Legacy fill few-shot (Gate 0 rollback path only).
 * Imports narrative mock fixture — must NOT be used when shape mode is skeleton.
 *
 * fill-prompt.ts must never import ./mock-fixture directly (CI asserts that).
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_PAGE_SCHEMA_MOCK_V1 } from "./mock-fixture";

const FEW_SHOT_BY_KEY: Partial<Record<DeliverySegmentKey, unknown>> = {
  direct_answer: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.direct_answer,
  foundation: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.foundation,
  science_action: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.science_action,
  metaphysics_action: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.metaphysics_action,
  thirty_day: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.thirty_day,
  risk_guard: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.risk_guard,
  signals_close: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.signals_close,
};

export function legacyFillFewShotForKey(key: DeliverySegmentKey): unknown | null {
  return FEW_SHOT_BY_KEY[key] ?? null;
}
