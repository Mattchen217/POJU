import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  auditBaseAnalysisDelivery,
  BASE_ANALYSIS_GATE_ERROR,
  type BaseAnalysisGateResult,
} from "@/lib/base-analysis/delivery-gate";

/** Throws if text fails the shared base-analysis delivery gate. */
export function assertBaseAnalysisDeliveryGate(
  text: string,
  locale: string,
  structured: ProfileStructured,
): BaseAnalysisGateResult {
  const result = auditBaseAnalysisDelivery(text, locale, structured);
  if (!result.ok) {
    const summary = result.violations
      .slice(0, 5)
      .map((v) => v.label)
      .join(", ");
    throw new Error(`${BASE_ANALYSIS_GATE_ERROR}: ${summary}`);
  }
  return result;
}
