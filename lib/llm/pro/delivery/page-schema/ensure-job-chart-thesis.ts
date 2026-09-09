/**
 * Job-scoped chart thesis ensure (idempotent) + chart-fingerprint judgment-core cache.
 */

import type { FinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";
import { tryStructuredFromBaseAnalysis } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import { buildChartThesisFromStructured } from "@/lib/llm/pro/delivery/thesis";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import { applyAgendaDepth } from "@/lib/llm/pro/delivery/thesis/apply-agenda-depth";
import { fingerprintThesisStructured } from "@/lib/llm/pro/delivery/thesis/fingerprint";
import {
  ensureChartThesis,
  loadChartThesisFingerprintCache,
  saveChartThesisFingerprintCache,
} from "@/lib/llm/pro/delivery/dispatch/task-store";

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

/**
 * Build once per job. Judgment core reused across jobs when structured fingerprint matches.
 */
export async function ensureJobChartThesis(
  job_id: string,
  input: FinalDeliveryJobInput,
): Promise<ChartThesis | null> {
  return ensureChartThesis(job_id, async () => {
    const structured = tryStructuredFromBaseAnalysis(input.base_analysis);
    if (!structured) {
      console.warn("[delivery/thesis] skip — no structured", { job_id });
      return null;
    }
    const agenda = agendaSummaryFromInput(input);
    const fingerprint = fingerprintThesisStructured(structured);
    const fpCached = await loadChartThesisFingerprintCache(fingerprint);
    if (fpCached && fpCached.structured_fingerprint === fingerprint) {
      const thesis = applyAgendaDepth(fpCached, agenda || null);
      console.info("[delivery/thesis] judgment-core cache hit", {
        job_id,
        fingerprint,
      });
      return thesis;
    }
    const thesis = buildChartThesisFromStructured(structured, agenda || null);
    await saveChartThesisFingerprintCache(thesis);
    console.info("[delivery/thesis] judgment-core built", {
      job_id,
      fingerprint: thesis.structured_fingerprint,
      dims: thesis.dimensions.length,
    });
    return thesis;
  });
}
