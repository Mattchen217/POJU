/**
 * Pipeline v3 · Step3 evidence soft — TERMS-PIPELINE-SPEC-v1 code path.
 *
 * Dual-layer product rule:
 * - Body / narrative: vernacular only (no traditional jargon).
 * - Evidence: free traditional → code autoMark → (locale polish if needed) → code soft.
 *
 * Stages (Lab-visible on call_trace.parsed.stages):
 * 1. bare — model free traditional (from judgment / DeepEvidencePlan)
 * 2. mark — prepareTextForGlossaryRender (autoMark)
 * 3. locale_polish — vernacular locale polish when still needed; zh = identity.
 *    Markers already carry SSOT soft in the delivery locale via prepareText.
 *    Full model connective rewrite is no longer the soft job (wave2).
 * 4. soft — toSoftTranslatedPlainText (coined soft labels, plain)
 *
 * art.marked stores mark/locale_polish (⟦t:⟧) for GlossaryText fold UI.
 * Soft plain is for Lab inspect / audit dumps.
 *
 * Chunk soft-wall (soft_chunk_*) is retained for API compat but unused:
 * the code path finishes all args in one invoke.
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

function isZhLocale(locale: string): boolean {
  return locale.trim().toLowerCase().startsWith("zh");
}

/**
 * Pure code pipeline — Lab + production share this SoT.
 * Returns all four stages so Delivery Lab can dump live bare→mark→polish→soft.
 */
export function runEvidenceSoftCodePipeline(input: {
  key: DeliverySegmentKey;
  plan: DeepEvidencePlan;
  locale: string;
}): {
  stages: EvidenceSoftStages;
  notes: string[];
  marked: DeliveryArgumentTree;
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

  // Stage 3: model locale polish "if still needed".
  // prepareText already fills SSOT soft inside ⟦t:⟧ for the delivery locale.
  // zh: identity. non-zh: keep marked (no connective LLM; wave2 stops marker-emit soft job).
  const locale_polish = mark;
  const polishNote = isZhLocale(locale)
    ? "evidence_soft:locale_polish:identity_zh"
    : "evidence_soft:locale_polish:ssot_soft_in_markers";

  const soft = mapTreeEvidence(locale_polish, (ev) =>
    toSoftTranslatedPlainText(ev, locale),
  );

  const notes = [
    ...frozen.notes,
    "evidence_soft:code_mark:prepareTextForGlossaryRender",
    polishNote,
    "evidence_soft:code_soft:toSoftTranslatedPlainText",
    "evidence_soft:pipeline:terms-pipeline-spec-v1",
  ];

  return {
    stages: { bare, mark, locale_polish, soft },
    notes,
    /** GlossaryText fold UI needs ⟦t:⟧ markers. */
    marked: locale_polish,
    evidence: bare,
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
  /** Soft-wall: unused on code path (always one-shot). */
  soft_chunk_index?: number;
  soft_partial?: DeliveryArgumentTree | null;
}): Promise<EvidenceSoftOk | EvidenceSoftContinue | EvidenceSoftFail> {
  void input.original_question;
  void input.session_id;
  void input.timeout_ms;
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
        },
      }),
    };
  }

  try {
    const ran = runEvidenceSoftCodePipeline({
      key: input.key,
      plan: input.plan,
      locale: input.locale,
    });

    const stageSummary = {
      pipeline: "terms-pipeline-spec-v1",
      locale: input.locale,
      stages: ran.stages,
      stage_keys: ["bare", "mark", "locale_polish", "soft"] as EvidenceSoftStageKey[],
    };

    return {
      ok: true,
      evidence: ran.evidence,
      marked: ran.marked,
      tokens_used: 0,
      notes: ran.notes,
      slotted: ran.stages.bare,
      stages: ran.stages,
      call_trace: buildLabCallTrace({
        phase: "evidence_soft",
        system:
          "TERMS-PIPELINE-SPEC-v1 code soft path — no LLM marker emit.\n" +
          "bare (free traditional) → prepareTextForGlossaryRender → locale_polish → toSoftTranslatedPlainText",
        user: JSON.stringify(
          {
            key: input.key,
            locale: input.locale,
            units: input.plan.units.length,
          },
          null,
          2,
        ),
        user_feed: JSON.stringify(ran.stages.bare, null, 2),
        parsed: stageSummary,
        raw_text: JSON.stringify(ran.stages.soft, null, 2),
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
        parsed: { pipeline: "terms-pipeline-spec-v1", fail: reason },
      }),
    };
  }
}
