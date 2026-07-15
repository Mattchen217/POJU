/**
 * Matrix welcome LLM path removed (PART 2) — front-of-paywall must be template-only.
 * Callers should use ensureProfileMatrixList / buildMatrixDisplayData.
 */

import type {
  MatrixNarrativeProduct,
  MatrixNarrativeResponse,
} from "@/lib/llm/prompts/matrix-narrative-prompt";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

export type MatrixNarrativeApiResult = {
  ok: boolean;
  narrative?: MatrixNarrativeResponse;
  product?: MatrixNarrativeProduct;
  model?: string;
  tokens_used?: number;
  latency_ms?: number;
  error?: string;
};

/** @deprecated PART 2 — always throws; matrix welcome is template-only. */
export async function requestMatrixNarrative(input: {
  matrix_payload: PojuMatrixPayload;
  matrix_payload_b?: PojuMatrixPayload;
  locale: string;
  product?: MatrixNarrativeProduct;
  signal?: AbortSignal;
}): Promise<MatrixNarrativeResponse> {
  console.warn("[fallback] requestMatrixNarrative called — LLM path removed; use template ensureProfileMatrixList", {
    product: input.product ?? "poju",
    locale: input.locale,
  });
  throw new Error(
    "matrix_narrative_removed: welcome copy is template-only — use ensureProfileMatrixList",
  );
}
