/**
 * Generate base-analysis markdown with delivery-gate validation.
 * Prefer surgical line-repair (keep good draft) over full regeneration.
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
  /**
   * Loud fail when line-repair cannot apply — caller should annotate UI
   * "本次为整篇重生成（补丁未命中）" before full regen.
   */
  onRepairFail?: (info: {
    reason: string;
    detail?: string;
    repairIndex: number;
  }) => Promise<void>;
  signal?: AbortSignal;
};

export type StreamLlmWithGateResult =
  | {
      ok: true;
      content: string;
      attempts: number;
      repairs: number;
      /** True when a full regen ran after repair miss. */
      regenerated_after_repair_miss?: boolean;
    }
  | {
      ok: false;
      error: string;
      violations: ReturnType<typeof auditBaseAnalysisDelivery>["violations"];
      attempts?: number;
      repairs?: number;
      regenerated_after_repair_miss?: boolean;
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
 * On critical fail: line-repair up to 2× (cheap) before one full regen (loud).
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
  let regeneratedAfterRepairMiss = false;

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
        regenerated_after_repair_miss: regeneratedAfterRepairMiss,
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
        regenerated_after_repair_miss: regeneratedAfterRepairMiss,
      };
    }

    lastViolations = gate.violations;

    // Surgical line-repair before throwing away a good first draft.
    let repairMiss = false;
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
        profile_id: input.profileId,
      });
      totalRepairs += 1;

      if (!repaired.ok) {
        console.error(
          "[repair] patch application FAILED — falling back to full regeneration",
          {
            profile_id: input.profileId,
            reason: repaired.error,
            detail: repaired.detail,
            repair_index: r,
            violations: gate.violations.slice(0, 5),
          },
        );
        await input.onRepairFail?.({
          reason: repaired.error,
          detail: repaired.detail,
          repairIndex: r,
        });
        repairMiss = true;
        break;
      }

      draft = applyComplianceSanitize(repaired.text, input.locale).text;
      await input.onChunk(draft);
      gate = auditBaseAnalysisDelivery(draft, input.locale, input.structured);

      if (gate.ok || !isBaseAnalysisGateFailure(gate.violations)) {
        return {
          ok: true,
          content: draft,
          attempts: fullGens,
          repairs: totalRepairs,
          regenerated_after_repair_miss: regeneratedAfterRepairMiss,
        };
      }
      lastViolations = gate.violations;
    }

    // Last resort: full regen once with hint (never silent).
    if (fullAttempt < MAX_FULL_GENERATIONS - 1) {
      if (repairMiss) regeneratedAfterRepairMiss = true;
      console.error(
        `[base-analysis/stream] repairs exhausted → full regen for ${input.profileId}` +
          (repairMiss ? " (补丁未命中 — 本次为整篇重生成)" : ""),
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
    regenerated_after_repair_miss: regeneratedAfterRepairMiss,
  };
}
