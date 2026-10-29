import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import { LAB_STEP_DEFS } from "@/lib/llm/pro/delivery/lab/types";
import {
  ensureLabStepsV3,
  labStepDefsV3,
} from "@/lib/llm/pro/delivery/lab/types-v3";
import { labUsesV3Executor } from "@/lib/llm/pro/delivery/lab/pipeline-stamp";
import { tryStructuredFromBaseAnalysis } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import { labChatPublicSlice } from "@/lib/llm/pro/delivery/lab/pipeline-chat";
import { pipelineNextHint } from "@/lib/llm/pro/delivery/lab/pipeline-cursor";
import { isBookJudgmentPackEnabled } from "@/lib/llm/pro/delivery/book-judgment/flag";
import { bookJudgmentTraceSummary } from "@/lib/llm/pro/delivery/book-judgment/slice";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";

function activeStepDefs(lab: DeliveryLabSession) {
  return labUsesV3Executor(lab.pipeline) ? labStepDefsV3() : LAB_STEP_DEFS;
}

/** Ops API / UI payload — omit bulky base_analysis blob. */
export function labPublicView(lab: DeliveryLabSession) {
  if (labUsesV3Executor(lab.pipeline)) ensureLabStepsV3(lab);
  const structured = tryStructuredFromBaseAnalysis(lab.source.base_analysis);
  const defs = activeStepDefs(lab);
  /** Companion 产物可很大；列表只给摘要，完整在 attempt / 详情里。 */
  const companion = lab.artifacts.companion
    ? {
        delivery_day_key: lab.artifacts.companion.delivery_day_key,
        timezone: lab.artifacts.companion.timezone,
        sealed_at: lab.artifacts.companion.sealed_at,
        brief: lab.artifacts.companion.brief,
        liuri_days: lab.artifacts.companion.liuri_pack?.length ?? 0,
        batch_status: lab.artifacts.companion.batch_status ?? "pending",
        batch_gate: lab.artifacts.companion.batch_gate ?? null,
        output_locale: lab.artifacts.companion.output_locale ?? lab.source.locale,
        days: (lab.artifacts.companion.days ?? []).map((d) => ({
          day_index: d.day_index,
          date_key: d.date_key,
          has_cards: Boolean(d.cards),
          generated_at: d.generated_at ?? null,
          cards: d.cards,
          meta: d.meta,
        })),
      }
    : undefined;
  const pack = lab.artifacts.book_judgment_pack as BookJudgmentPack | null | undefined;
  const zfpHits =
    (
      lab.artifacts.ziwei_fact_pack as
        | { patternHits?: { name: string }[] }
        | null
        | undefined
    )?.patternHits?.map((h) => h.name) ?? [];
  const book_judgment_trace =
    pack && typeof pack === "object"
      ? bookJudgmentTraceSummary(pack, { pattern_hits_available: zfpHits })
      : null;
  return {
    version: lab.version,
    lab_id: lab.lab_id,
    created_at: lab.created_at,
    updated_at: lab.updated_at,
    ops_user: lab.ops_user,
    pipeline: lab.pipeline ?? "legacy",
    cursor_index: lab.cursor_index,
    cursor_step: defs[lab.cursor_index]?.step_key ?? null,
    approved_order: lab.approved_order,
    steps: lab.steps,
    artifacts: {
      ...lab.artifacts,
      /** 完整 liuri_pack 只留服务端；ops JSON 用摘要 + 按日 cards。 */
      ...(companion ? { companion } : {}),
    },
    book_judgment_pack_enabled: isBookJudgmentPackEnabled(),
    book_judgment_trace,
    source: {
      locale: lab.source.locale,
      original_question: lab.source.original_question,
      desired_outcome: lab.source.desired_outcome,
      session_id: lab.source.session_id,
      covered_agenda: lab.source.covered_agenda,
      has_breakthrough_core: lab.source.breakthrough_core != null,
      base_analysis_present: lab.source.base_analysis != null,
      structured_present: Boolean(structured),
      pivot_chart_path: lab.source.pivot_chart_path ?? null,
    },
    step_defs: defs,
    ...(() => {
      if (lab.mode !== "full_pipeline") {
        return { mode: lab.mode ?? "delivery_only" as const };
      }
      const slice = labChatPublicSlice(lab);
      return {
        ...slice,
        pipeline_next_hint: pipelineNextHint(
          slice.pipeline_cursor,
          lab.chat_session,
        ),
        delivery_steps_locked: !lab.pipeline_delivery_unlocked,
      };
    })(),
  };
}

export type LabPublicView = ReturnType<typeof labPublicView>;
