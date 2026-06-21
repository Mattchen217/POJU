import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  auditBaseAnalysisDelivery,
  buildBaseAnalysisRegenHint,
  isBaseAnalysisGateFailure,
} from "@/lib/base-analysis/delivery-gate";
import { buildBaseAnalysisStreamPrompt } from "@/lib/llm/prompts/base-analysis-stream-prompt";
import { applyComplianceSanitize } from "@/lib/llm/sanitize/compliance-terms";
import { openRouterStream } from "@/lib/llm/openrouter-stream";

export type StreamLlmWithGateInput = {
  profileId: string;
  locale: string;
  structured: ProfileStructured;
  output_language: "zh" | "en";
  session_id: string;
  model: string;
  max_tokens?: number;
  onChunk: (chunk: string) => Promise<void>;
  onAttemptStart?: (attempt: number) => Promise<void>;
  signal?: AbortSignal;
};

export type StreamLlmWithGateResult =
  | { ok: true; content: string; attempts: number }
  | { ok: false; error: string; violations: ReturnType<typeof auditBaseAnalysisDelivery>["violations"] };

const MAX_ATTEMPTS = 2;

/**
 * Generate base-analysis markdown with delivery-gate validation.
 * Retries once with regen hint on gate failure; never returns gate-failed content.
 */
export async function streamBaseAnalysisWithDeliveryGate(
  input: StreamLlmWithGateInput,
): Promise<StreamLlmWithGateResult> {
  const { system, user: baseUser } = buildBaseAnalysisStreamPrompt({
    local_data: { structured: input.structured, output_language: input.output_language },
  });

  let userContent = baseUser;
  let lastViolations: ReturnType<typeof auditBaseAnalysisDelivery>["violations"] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let accumulated = "";
    let streamError: string | null = null;

    await input.onAttemptStart?.(attempt);

    await openRouterStream({
      system,
      user: userContent,
      model: input.model,
      max_tokens: input.max_tokens ?? 10_000,
      temperature: attempt === 0 ? 0.7 : 0.45,
      session_id: input.session_id,
      signal: input.signal,
      onChunk: async (chunk) => {
        accumulated += chunk;
        await input.onChunk(chunk);
      },
      onDone: async () => {},
      onError: async (error) => {
        streamError = error;
      },
    });

    if (streamError) {
      return { ok: false, error: streamError, violations: lastViolations };
    }

    const glossed = applyComplianceSanitize(accumulated.trim(), input.locale).text;
    const gate = auditBaseAnalysisDelivery(glossed, input.locale, input.structured);

    if (gate.ok) {
      return { ok: true, content: glossed, attempts: attempt + 1 };
    }

    lastViolations = gate.violations;
    if (!isBaseAnalysisGateFailure(gate.violations)) {
      // Non-blocking warnings only — allow delivery
      return { ok: true, content: glossed, attempts: attempt + 1 };
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      console.warn(
        `[base-analysis/stream] delivery gate attempt ${attempt + 1} failed for ${input.profileId}, regen…`,
        gate.violations.slice(0, 5),
      );
      userContent = baseUser + buildBaseAnalysisRegenHint(gate.violations, input.locale);
    }
  }

  return {
    ok: false,
    error: "delivery_gate_failed",
    violations: lastViolations,
  };
}
