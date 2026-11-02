/**
 * Pipeline v3 · Step3 evidence soft — TERMS-PIPELINE-SPEC-v1 acceptance chain.
 *
 * Dual-layer product rule:
 * - Body / narrative: vernacular only (no traditional jargon).
 * - Evidence: free traditional → code autoMark → model locale polish → code soft.
 *
 * Stages (Lab-visible on call_trace.parsed.stages):
 * 1. bare — model free traditional (from judgment / DeepEvidencePlan)
 * 2. mark — prepareTextForGlossaryRender (autoMark ⟦t:⟧)
 * 3. locale_polish — REAL LLM connective vernacular polish (zh included; no silent identity)
 *    Skip only when product Skip / explicit skip_locale_polish — then Lab shows skipped.
 * 4. soft — toSoftTranslatedPlainText (coined soft labels, plain)
 *
 * art.marked stores mark/locale_polish (⟦t:⟧) for GlossaryText fold UI.
 * Soft plain is for Lab inspect / audit dumps.
 */

import type {
  DeliveryArgument,
  DeliveryArgumentTree,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { buildLabCallTrace, type LabCallTrace } from "@/lib/llm/pro/delivery/lab/call-trace";
import {
  prepareTextForGlossaryRender,
  toSoftTranslatedPlainText,
} from "@/lib/terms/prepare-display-pipeline";
import {
  runEvidenceLocalePolish,
  type EvidenceLocalePolishLlm,
  type EvidenceLocalePolishMeta,
} from "@/lib/llm/pro/delivery/pipeline-v3/evidence-locale-polish";

/** Full closed-set coverage for evidence (same bar as export SoT). */
const EVIDENCE_AUTO_MARK_OPTS = {
  maxPerPara: Number.POSITIVE_INFINITY,
  oncePerText: false,
} as const;

export type EvidenceSoftStageKey = "bare" | "mark" | "locale_polish" | "soft";

export type EvidenceSoftStages = {
  bare: DeliveryArgumentTree;
  mark: DeliveryArgumentTree;
  locale_polish: DeliveryArgumentTree;
  soft: DeliveryArgumentTree;
};

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
    notes: ["evidence_soft:raw_tree"],
  };
}

function mapTreeEvidence(
  tree: DeliveryArgumentTree,
  mapEv: (evidence: string) => string,
): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const [k, args] of Object.entries(tree)) {
    if (!args?.length) continue;
    out[k as DeliverySegmentKey] = args.map((a) => {
      const next: DeliveryArgument = { ...a };
      const raw = a.evidence?.trim();
      if (raw) next.evidence = mapEv(raw);
      return next;
    });
  }
  return out;
}

/**
 * Code-only bare → mark (⟦t:⟧). Soft is applied after locale_polish.
 * Kept for Lab/unit inspection of mark stage without LLM.
 */
export function runEvidenceSoftMarkPipeline(input: {
  key: DeliverySegmentKey;
  plan: DeepEvidencePlan;
  locale: string;
}): {
  bare: DeliveryArgumentTree;
  mark: DeliveryArgumentTree;
  notes: string[];
  evidence: DeliveryArgumentTree;
} {
  const frozen = freezeRawJudgmentAsEvidence({
    key: input.key,
    plan: input.plan,
  });
  const bare = frozen.evidence;
  const locale = input.locale.trim() || "zh";
  const mark = mapTreeEvidence(bare, (ev) =>
    prepareTextForGlossaryRender(ev, locale, EVIDENCE_AUTO_MARK_OPTS),
  );
  return {
    bare,
    mark,
    notes: [
      ...frozen.notes,
      "evidence_soft:code_mark:prepareTextForGlossaryRender",
    ],
    evidence: bare,
  };
}

/**
 * @deprecated Prefer runEvidenceSoftGenerate (real LLM polish).
 * Sync helper used by older tests: locale_polish defaults to mark (identity)
 * unless caller already knows polish was skipped/mocked elsewhere.
 */
export function runEvidenceSoftCodePipeline(input: {
  key: DeliverySegmentKey;
  plan: DeepEvidencePlan;
  locale: string;
  /** When provided, used as locale_polish instead of silent mark identity. */
  locale_polish?: DeliveryArgumentTree;
  polish_note?: string;
}): {
  stages: EvidenceSoftStages;
  notes: string[];
  marked: DeliveryArgumentTree;
  evidence: DeliveryArgumentTree;
} {
  const markedPipe = runEvidenceSoftMarkPipeline(input);
  const locale = input.locale.trim() || "zh";
  const locale_polish = input.locale_polish ?? markedPipe.mark;
  const polishNote =
    input.polish_note ??
    (input.locale_polish
      ? "evidence_soft:locale_polish:provided"
      : "evidence_soft:locale_polish:sync_identity_fallback");

  const soft = mapTreeEvidence(locale_polish, (ev) =>
    toSoftTranslatedPlainText(ev, locale),
  );

  const notes = [
    ...markedPipe.notes,
    polishNote,
    "evidence_soft:code_soft:toSoftTranslatedPlainText",
    "evidence_soft:pipeline:terms-pipeline-spec-v1",
  ];

  return {
    stages: {
      bare: markedPipe.bare,
      mark: markedPipe.mark,
      locale_polish,
      soft,
    },
    notes,
    marked: locale_polish,
    evidence: markedPipe.evidence,
  };
}

export type EvidenceSoftOk = {
  ok: true;
  evidence: DeliveryArgumentTree;
  marked: DeliveryArgumentTree;
  tokens_used: number;
  notes: string[];
  call_trace: LabCallTrace;
  /** @deprecated w-slot feed; code path exposes bare as slotted for Lab dump compat. */
  slotted: DeliveryArgumentTree;
  stages: EvidenceSoftStages;
  locale_polish_meta: EvidenceLocalePolishMeta;
};

export type EvidenceSoftContinue = {
  ok: false;
  needs_more_soft_chunks: true;
  reason: "soft_chunk_continue";
  next_chunk_index: number;
  chunks_total: number;
  soft_partial: DeliveryArgumentTree;
  tokens_used: number;
  notes: string[];
  call_trace: LabCallTrace;
  slotted: DeliveryArgumentTree;
  last_raw_text?: string;
};

export type EvidenceSoftFail = {
  ok: false;
  needs_more_soft_chunks?: false;
  reason: string;
  tokens_used: number;
  notes: string[];
  call_trace?: LabCallTrace;
  slotted?: DeliveryArgumentTree;
  last_raw_text?: string;
};

export async function runEvidenceSoftGenerate(input: {
  key: DeliverySegmentKey;
  plan: DeepEvidencePlan;
  locale: string;
  /** Unused — kept for API compat; soft does not feed the user question. */
  original_question?: string | null;
  session_id?: string;
  timeout_ms?: number;
  /** Attempt-2 acceptance corrective (category · 1+1). */
  acceptance_corrective?: string | null;
  /** Soft-wall: unused on code+LLM path (always one-shot). */
  soft_chunk_index?: number;
  soft_partial?: DeliveryArgumentTree | null;
  /** Product Skip / explicit skip — locale_polish shown as skipped, not fake-ran. */
  skip_locale_polish?: boolean;
  /** Injectable LLM for tests (no network). */
  locale_polish_llm?: EvidenceLocalePolishLlm;
}): Promise<EvidenceSoftOk | EvidenceSoftContinue | EvidenceSoftFail> {
  void input.original_question;
  void input.acceptance_corrective;
  void input.soft_chunk_index;
  void input.soft_partial;

  const hasEvidence = (input.plan.units ?? []).some((u) =>
    String(u.evidence ?? "").trim(),
  );
  if (!hasEvidence) {
    const empty = freezeRawJudgmentAsEvidence({
      key: input.key,
      plan: input.plan,
    });
    return {
      ok: false,
      reason: "evidence_soft_empty",
      tokens_used: 0,
      notes: empty.notes,
      slotted: empty.evidence,
      call_trace: buildLabCallTrace({
        phase: "evidence_soft",
        system: "",
        user: "",
        parsed: {
          pipeline: "terms-pipeline-spec-v1",
          stages: null,
          fail: "evidence_soft_empty",
          stage_keys: ["bare", "mark", "locale_polish", "soft"],
        },
      }),
    };
  }

  try {
    const locale = input.locale.trim() || "zh";
    const markedPipe = runEvidenceSoftMarkPipeline({
      key: input.key,
      plan: input.plan,
      locale,
    });

    const polished = await runEvidenceLocalePolish({
      key: input.key,
      marked: markedPipe.mark,
      locale,
      session_id: input.session_id,
      timeout_ms: input.timeout_ms,
      skip: Boolean(input.skip_locale_polish),
      llm: input.locale_polish_llm,
    });

    if (!polished.ok) {
      return {
        ok: false,
        reason: polished.reason,
        tokens_used: polished.tokens_used,
        notes: [...markedPipe.notes, ...polished.notes],
        slotted: markedPipe.bare,
        last_raw_text: polished.raw_text,
        call_trace: buildLabCallTrace({
          phase: "evidence_soft",
          system: polished.system ?? "",
          user: polished.user ?? "",
          user_feed: JSON.stringify(markedPipe.mark, null, 2),
          result: polished.llm_result,
          raw_text: polished.raw_text ?? null,
          parsed: {
            pipeline: "terms-pipeline-spec-v1",
            locale,
            fail: polished.reason,
            stage_keys: ["bare", "mark", "locale_polish", "soft"] as EvidenceSoftStageKey[],
            stages: {
              bare: markedPipe.bare,
              mark: markedPipe.mark,
              locale_polish: null,
              soft: null,
            },
            locale_polish: polished.meta,
          },
        }),
      };
    }

    const locale_polish = polished.locale_polish;
    const soft = mapTreeEvidence(locale_polish, (ev) =>
      toSoftTranslatedPlainText(ev, locale),
    );

    const notes = [
      ...markedPipe.notes,
      ...polished.notes,
      "evidence_soft:code_soft:toSoftTranslatedPlainText",
      "evidence_soft:pipeline:terms-pipeline-spec-v1",
    ];

    const stages: EvidenceSoftStages = {
      bare: markedPipe.bare,
      mark: markedPipe.mark,
      locale_polish,
      soft,
    };

    const stageSummary = {
      pipeline: "terms-pipeline-spec-v1",
      locale,
      stages,
      stage_keys: ["bare", "mark", "locale_polish", "soft"] as EvidenceSoftStageKey[],
      locale_polish: polished.meta,
      stage_notes: {
        bare: "1 · free traditional (judgment)",
        mark: "2 · code autoMark prepareTextForGlossaryRender",
        locale_polish:
          polished.meta.mode === "skipped"
            ? "3 · locale_polish SKIPPED (explicit skip)"
            : "3 · locale_polish REAL LLM (markers preserved)",
        soft: "4 · code toSoftTranslatedPlainText",
      },
    };

    const system =
      polished.meta.mode === "skipped"
        ? "TERMS-PIPELINE-SPEC-v1 · locale_polish SKIPPED\n" +
          "bare → mark → (skip polish) → toSoftTranslatedPlainText"
        : (polished.system ??
          "TERMS-PIPELINE-SPEC-v1 · bare → mark → locale_polish(LLM) → soft");

    return {
      ok: true,
      evidence: markedPipe.evidence,
      marked: locale_polish,
      tokens_used: polished.meta.tokens_used,
      notes,
      slotted: markedPipe.bare,
      stages,
      locale_polish_meta: polished.meta,
      call_trace: buildLabCallTrace({
        phase: "evidence_soft",
        system,
        user:
          polished.user ??
          JSON.stringify(
            {
              key: input.key,
              locale,
              units: input.plan.units.length,
              skip_locale_polish: Boolean(input.skip_locale_polish),
            },
            null,
            2,
          ),
        user_feed: JSON.stringify(markedPipe.mark, null, 2),
        result: polished.llm_result,
        parsed: stageSummary,
        raw_text: polished.raw_text ?? JSON.stringify(stages.soft, null, 2),
      }),
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      reason,
      tokens_used: 0,
      notes: ["evidence_soft:code_path_failed"],
      call_trace: buildLabCallTrace({
        phase: "evidence_soft",
        system: "",
        user: "",
        parsed: {
          pipeline: "terms-pipeline-spec-v1",
          fail: reason,
          stage_keys: ["bare", "mark", "locale_polish", "soft"],
        },
      }),
    };
  }
}
