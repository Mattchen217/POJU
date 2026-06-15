import type { MatrixNarrativeResponse } from "@/lib/llm/prompts/matrix-narrative-prompt";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

export type MatrixNarrativeApiResult = {
  ok: boolean;
  narrative?: MatrixNarrativeResponse;
  model?: string;
  tokens_used?: number;
  latency_ms?: number;
  error?: string;
};

/** Browser-only: fetch LLM narrative for Energy Matrix (fast DeepSeek, no thinking). */
export async function requestMatrixNarrative(input: {
  matrix_payload: PojuMatrixPayload;
  locale: string;
  signal?: AbortSignal;
}): Promise<MatrixNarrativeResponse> {
  if (typeof window === "undefined") {
    throw new Error("requestMatrixNarrative is browser-only");
  }

  const res = await fetch("/api/poju/matrix-narrative", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      matrix_payload: input.matrix_payload,
      locale: input.locale,
    }),
    signal: input.signal,
  });

  const payload = (await res.json().catch(() => ({}))) as MatrixNarrativeApiResult;

  if (!res.ok || !payload.ok || !payload.narrative) {
    throw new Error(payload.error || `Matrix narrative failed (${res.status})`);
  }

  return payload.narrative;
}
