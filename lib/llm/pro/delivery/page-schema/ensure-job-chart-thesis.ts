/**
 * Job-scoped chart thesis ensure (idempotent) + runtime cache.
 *
 * Cross-job cache key = structured_fingerprint + as_of_day + question_category.
 * Never cache on structured fingerprint alone (would stale cycle_rhythm).
 */

import type { FinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";
import { tryStructuredFromBaseAnalysis } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { buildChartThesisFromStructured } from "@/lib/llm/pro/delivery/thesis";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import { applyAgendaDepth } from "@/lib/llm/pro/delivery/thesis/apply-agenda-depth";
import { fingerprintThesisStructured } from "@/lib/llm/pro/delivery/thesis/fingerprint";
import {
  ensureChartThesis,
  loadChartThesisFingerprintCache,
  saveChartThesisFingerprintCache,
} from "@/lib/llm/pro/delivery/dispatch/task-store";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { coerceBirthInfo } from "@/lib/ziwei/lab-ziwei";
import { buildZiweiFactPack, type ZiweiPatternHit } from "@/lib/ziwei/fact-pack";

function agendaSummaryFromInput(input: FinalDeliveryJobInput): string {
  const parts: string[] = [];
  const q = input.agent_v2?.original_question?.trim();
  if (q) parts.push(q);
  const covered = input.covered_agenda;
  if (Array.isArray(covered)) {
    for (const a of covered.slice(0, 8)) {
      const label = typeof a?.label === "string" ? a.label.trim() : "";
      const answer = typeof a?.answer === "string" ? a.answer.trim() : "";
      if (label || answer) parts.push([label, answer].filter(Boolean).join("："));
    }
  }
  return parts.join("\n").slice(0, 1200);
}

function resolveStructuredForThesis(base: unknown) {
  return (
    tryStructuredFromBaseAnalysis(base) ??
    normalizeBaseAnalysisInput(base).structured ??
    null
  );
}

function asOfDayUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/** Resolve ZFP patternHits for production thesis (same birth path as Lab when possible). */
async function resolvePatternHitsForJob(
  input: FinalDeliveryJobInput,
): Promise<ZiweiPatternHit[]> {
  const profileId = input.agent_v2?.selected_profile_id?.trim() || null;
  let birth = null as ReturnType<typeof coerceBirthInfo>;
  if (profileId) {
    try {
      const stored = await getStoredProfile(profileId);
      birth =
        coerceBirthInfo(stored?.birth_info) ??
        coerceBirthInfo(stored?.user_profile?.birth) ??
        null;
    } catch (e) {
      console.warn("[delivery/thesis] getStoredProfile for ZFP failed", {
        profileId,
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }
  if (!birth && isRecord(input.base_analysis)) {
    const ba = input.base_analysis;
    birth =
      coerceBirthInfo(ba.birth_info) ??
      coerceBirthInfo(ba.birth) ??
      (isRecord(ba.user_profile) ? coerceBirthInfo(ba.user_profile.birth) : null);
  }
  if (!birth) return [];
  try {
    const pack = buildZiweiFactPack(birth);
    return pack.patternHits ?? [];
  } catch (e) {
    console.warn("[delivery/thesis] buildZiweiFactPack failed", {
      err: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

/**
 * Build once per job. Cross-job reuse only when structured + as_of_day + category match.
 */
export async function ensureJobChartThesis(
  job_id: string,
  input: FinalDeliveryJobInput,
): Promise<ChartThesis | null> {
  return ensureChartThesis(job_id, async () => {
    const structured = resolveStructuredForThesis(input.base_analysis);
    if (!structured) {
      console.warn("[delivery/thesis] skip — no structured (once)", {
        job_id,
        base_type: input.base_analysis == null ? "null" : typeof input.base_analysis,
      });
      return null;
    }
    const agenda = agendaSummaryFromInput(input);
    const fingerprint = fingerprintThesisStructured(structured);
    const question_category = input.agent_v2?.question_category ?? null;
    const as_of = new Date();
    const as_of_day = asOfDayUtc(as_of);

    const fpCached = await loadChartThesisFingerprintCache(fingerprint, {
      as_of_day,
      question_category,
    });
    if (fpCached) {
      const thesis = applyAgendaDepth(fpCached, agenda || null);
      console.info("[delivery/thesis] runtime cache hit", {
        job_id,
        fingerprint,
        as_of_day,
        question_category,
      });
      return thesis;
    }

    const patternHits = await resolvePatternHitsForJob(input);
    const frozen = buildChartThesisFromStructured(structured, null, {
      question_category,
      as_of,
      patternHits,
    });
    await saveChartThesisFingerprintCache(frozen);
    const thesis = applyAgendaDepth(frozen, agenda || null);
    console.info("[delivery/thesis] judgment-core built", {
      job_id,
      fingerprint: thesis.structured_fingerprint,
      as_of_day: thesis.as_of_day,
      dims: thesis.dimensions.length,
      patternHits_n: patternHits.length,
    });
    return thesis;
  });
}
