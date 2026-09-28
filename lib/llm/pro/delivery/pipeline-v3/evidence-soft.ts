/**
 * Pipeline v3 · Step3 evidence soft — passthrough Phase A / mark later.
 * Until mark is re-enabled as soft-term encode, freeze raw judgment as "marked".
 */

import type {
  DeliveryArgumentTree,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";

export function freezeRawJudgmentAsEvidence(input: {
  key: DeliverySegmentKey;
  plan: DeepEvidencePlan;
}): {
  evidence: DeliveryArgumentTree;
  marked: DeliveryArgumentTree;
  notes: string[];
} {
  const evidence: DeliveryArgumentTree = {
    [input.key]: input.plan.units.map((u) => {
      const professional = String(u.evidence ?? "").trim();
      return {
        body: String(u.unit_claim ?? u.path ?? "").trim() || u.path,
        evidence: professional || undefined,
        title: u.path,
      };
    }),
  };
  return {
    evidence,
    marked: evidence,
    notes: [
      "evidence_soft:raw_freeze",
      "coined_terms:deferred_until_prompt_once_pass",
    ],
  };
}
