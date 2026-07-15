/**
 * Generate base-analysis markdown with delivery-gate validation.
 * Prefer surgical repair (keep good draft) over full regeneration.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  auditBaseAnalysisDelivery,
  buildBaseAnalysisRegenHint,
  isBaseAnalysisGateFailure,
} from "@/lib/base-analysis/delivery-gate";
import { repairViolationsOnly } from "@/lib/base-analysis/repair-violations";
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
  /** Called before a full stream attempt (0 = first draft, 1 = last-resort full regen). */
  onAttemptStart?: (attempt: number) => Promise<void>;
  /** Called when starting a surgical repair (0-based repair index). */
  onRepairStart?: (repairIndex: number) => Promise<void>;
  signal?: AbortSignal;
};

export type StreamLlmWithGateResult =
  | { ok: true; content: string; attempts: number; repairs: number }
  | {
      ok: false;
      error: string;
      violations: ReturnType<typeof auditBaseAnalysisDelivery>["violations"];
      attempts?: number;
      repairs?: number;
    };

const MAX_REPAIRS = 2;
const MAX_FULL_GENERATIONS = 2; // 1 first draft + 1 last-resort regen

async function generateOnce(
  input: StreamLlmWithGateInput,
  system: string,
  userContent: string,
  attempt: number,
): Promise<{ text: string; error: string | null }> {
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

  return { text: accumulated.trim(), error: streamError };
}

/**
 * Stream narrative → sanitize → gate.
 * On critical fail: repairViolationsOnly up to 2× (cheap) before one full regen.
 */
export async function streamBaseAnalysisWithDeliveryGate(
  input: StreamLlmWithGateInput,
): Promise<StreamLlmWithGateResult> {
  const { system, user: baseUser } = buildBaseAnalysisStreamPrompt({
    local_data: { structured: input.structured, output_language: input.output_language },
  });

  let userContent = baseUser;
  let lastViolations: ReturnType<typeof auditBaseAnalysisDelivery>["violations"] = [];
  let totalRepairs = 0;
  let fullGens = 0;

  for (let fullAttempt = 0; fullAttempt < MAX_FULL_GENERATIONS; fullAttempt++) {
    const gen = await generateOnce(input, system, userContent, fullAttempt);
    fullGens += 1;

    if (gen.error) {
      return {
        ok: false,
        error: gen.error,
        violations: lastViolations,
        attempts: fullGens,
        repairs: totalRepairs,
      };
    }

    let draft = applyComplianceSanitize(gen.text, input.locale).text;
    let gate = auditBaseAnalysisDelivery(draft, input.locale, input.structured);

    if (gate.ok || !isBaseAnalysisGateFailure(gate.violations)) {
      return {
        ok: true,
        content: draft,
        attempts: fullGens,
        repairs: totalRepairs,
      };
    }

    lastViolations = gate.violations;

    // Surgical repair before throwing away a good first draft.
    for (let r = 0; r < MAX_REPAIRS; r++) {
      console.warn(
        `[base-analysis/stream] gate fail → surgical repair ${r + 1}/${MAX_REPAIRS} for ${input.profileId}`,
        gate.violations.slice(0, 5),
      );
      await input.onRepairStart?.(r);
      const repaired = await repairViolationsOnly({
        text: draft,
        violations: gate.violations,
        locale: input.locale,
        session_id: input.session_id,
        signal: input.signal,
      });
      totalRepairs += 1;

      if (!repaired.ok) {
        console.warn("[fallback] surgical repair failed", {
          profile_id: input.profileId,
          reason: repaired.error,
          repair_index: r,
        });
        break;
      }

      draft = applyComplianceSanitize(repaired.text, input.locale).text;
      // Replace streamed draft with repaired full text (caller should have cleared via onRepairStart).
      await input.onChunk(draft);
      gate = auditBaseAnalysisDelivery(draft, input.locale, input.structured);

      if (gate.ok || !isBaseAnalysisGateFailure(gate.violations)) {
        return {
          ok: true,
          content: draft,
          attempts: fullGens,
          repairs: totalRepairs,
        };
      }
      lastViolations = gate.violations;
    }

    // Last resort: full regen once with hint.
    if (fullAttempt < MAX_FULL_GENERATIONS - 1) {
      console.warn(
        `[base-analysis/stream] repairs exhausted → full regen for ${input.profileId}`,
        lastViolations.slice(0, 5),
      );
      userContent = baseUser + buildBaseAnalysisRegenHint(lastViolations, input.locale);
    }
  }

  return {
    ok: false,
    error: "delivery_gate_failed",
    violations: lastViolations,
    attempts: fullGens,
    repairs: totalRepairs,
  };
}
