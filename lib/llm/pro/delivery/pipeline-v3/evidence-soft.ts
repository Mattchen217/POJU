/**
 * Pipeline v3 · Step3 evidence soft — wrap traditional judgment → mark connective
 * in the delivery locale → encode `⟦w:⟧` to coined-term `⟦t:⟧`. Does not rewrite page body.
 *
 * Args are chunked (DELIVERY_SOFT_ARGS_PER_CALL) into **independent invokes** so high-effort
 * connective does not burn ~12k reasoning tokens on a whole page in one 285s wall.
 */

import type {
  DeliveryArgumentTree,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { zipArgumentEvidence } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { runOneMarkArgChunk } from "@/lib/llm/pro/delivery/mark-evidence-call";
import { pickMarkEvidenceInput } from "@/lib/llm/pro/delivery/mark-evidence-prompt";
import { stripElementCycleParentheticalSlots } from "@/lib/llm/pro/delivery/mark-evidence-opaque";
import { encodeConnectiveEvidenceToTerms } from "@/lib/llm/pro/delivery/polish-marked-evidence";
import { wrapBareJudgmentAsWordSlots } from "@/lib/llm/sanitize/term-marking";
import { buildLabCallTrace, type LabCallTrace } from "@/lib/llm/pro/delivery/lab/call-trace";
import {
  chunkDeliveryArgPayload,
  DELIVERY_SOFT_ARGS_PER_CALL,
} from "@/lib/llm/pro/delivery/delivery-tasks";

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

function wrapTreeEvidence(tree: DeliveryArgumentTree): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const [k, args] of Object.entries(tree)) {
    if (!args?.length) continue;
    out[k as DeliverySegmentKey] = args.map((a) => ({
      ...a,
      evidence: a.evidence?.trim()
        ? stripElementCycleParentheticalSlots(
            wrapBareJudgmentAsWordSlots(a.evidence),
          )
        : a.evidence,
    }));
  }
  return out;
}

function encodeTreeFields(
  tree: DeliveryArgumentTree,
  locale: string,
  fields: readonly ("body" | "evidence")[],
): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const [k, args] of Object.entries(tree)) {
    if (!args?.length) continue;
    out[k as DeliverySegmentKey] = args.map((a) => {
      const next = { ...a };
      for (const f of fields) {
        const raw = next[f]?.trim();
        if (!raw) continue;
        next[f] = encodeConnectiveEvidenceToTerms(raw, locale, {
          makeup: "fail",
          store: "slug_only",
        });
      }
      return next;
    });
  }
  return out;
}

function restoreTitles(
  zipped: DeliveryArgumentTree,
  raw: DeliveryArgumentTree,
): DeliveryArgumentTree {
  const out: DeliveryArgumentTree = {};
  for (const [k, args] of Object.entries(zipped)) {
    const src = raw[k as DeliverySegmentKey] ?? [];
    out[k as DeliverySegmentKey] = (args ?? []).map((a, i) => ({
      ...a,
      ...(src[i]?.title ? { title: src[i]!.title } : {}),
    }));
  }
  return out;
}

function mergeSoftPartial(
  prior: DeliveryArgumentTree | undefined,
  chunkMarked: DeliveryArgumentTree,
  key: DeliverySegmentKey,
): DeliveryArgumentTree {
  const priorArgs = prior?.[key] ?? [];
  const nextArgs = chunkMarked[key] ?? [];
  return {
    [key]: [...priorArgs, ...nextArgs],
  };
}

export type EvidenceSoftOk = {
  ok: true;
  evidence: DeliveryArgumentTree;
  marked: DeliveryArgumentTree;
  tokens_used: number;
  notes: string[];
  call_trace: LabCallTrace;
  slotted: DeliveryArgumentTree;
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
  /** Unused for prompt — kept for API compat; soft does not feed the user question. */
  original_question?: string | null;
  session_id?: string;
  timeout_ms?: number;
  /** Attempt-2 acceptance corrective (category · 1+1). */
  acceptance_corrective?: string | null;
  /** Soft-wall: which arg-chunk to run this invoke (0-based). */
  soft_chunk_index?: number;
  /** Prior chunks' marked connective (args concatenated in order). */
  soft_partial?: DeliveryArgumentTree | null;
}): Promise<EvidenceSoftOk | EvidenceSoftContinue | EvidenceSoftFail> {
  const frozen = freezeRawJudgmentAsEvidence({
    key: input.key,
    plan: input.plan,
  });
  const raw = frozen.evidence;
  const slotted = wrapTreeEvidence(raw);
  const markPayload = pickMarkEvidenceInput(slotted, [input.key]);
  const ctx = {
    original_question: null,
    acceptance_corrective: input.acceptance_corrective ?? null,
  };

  if (!markPayload[input.key]?.arguments.length) {
    return {
      ok: false,
      reason: "evidence_soft_empty",
      tokens_used: 0,
      notes: frozen.notes,
      slotted,
      call_trace: buildLabCallTrace({
        phase: "evidence_soft",
        system: "",
        user: "",
        parsed: slotted,
      }),
    };
  }

  const chunks = chunkDeliveryArgPayload(
    markPayload,
    DELIVERY_SOFT_ARGS_PER_CALL,
  );
  const chunkIndex = Math.max(0, input.soft_chunk_index ?? 0);
  if (chunkIndex >= chunks.length) {
    return {
      ok: false,
      reason: `soft_chunk_oob:${chunkIndex}/${chunks.length}`,
      tokens_used: 0,
      notes: frozen.notes,
      slotted,
    };
  }

  const chunk = chunks[chunkIndex]!;
  const markedChunk = await runOneMarkArgChunk(
    chunk,
    input.locale,
    ctx,
    input.session_id,
    undefined,
    input.timeout_ms,
    { makeup: "fail" },
  );

  const traceBase = {
    phase: "evidence_soft",
    system: markedChunk.system,
    user: markedChunk.user,
    result: markedChunk.llm,
  };

  if (!markedChunk.ok) {
    const rawDump =
      markedChunk.raw_text?.trim() ||
      (markedChunk.last_parsed != null
        ? JSON.stringify(markedChunk.last_parsed)
        : undefined);
    return {
      ok: false,
      reason: markedChunk.reason,
      tokens_used: markedChunk.tokens_used,
      notes: [
        ...frozen.notes,
        `evidence_soft:mark_failed:c${chunkIndex}/${chunks.length}`,
      ],
      slotted,
      last_raw_text: rawDump,
      call_trace: buildLabCallTrace({
        ...traceBase,
        parsed: markedChunk.last_parsed ?? { fail: markedChunk.reason },
        raw_text: rawDump,
      }),
    };
  }

  const soft_partial = mergeSoftPartial(
    input.soft_partial ?? undefined,
    markedChunk.value,
    input.key,
  );
  const next = chunkIndex + 1;
  const notes = [
    ...frozen.notes,
    `evidence_soft:mark_connective:c${chunkIndex}/${chunks.length}`,
  ];

  if (next < chunks.length) {
    return {
      ok: false,
      needs_more_soft_chunks: true,
      reason: "soft_chunk_continue",
      next_chunk_index: next,
      chunks_total: chunks.length,
      soft_partial,
      tokens_used: markedChunk.tokens_used,
      notes,
      slotted,
      last_raw_text: markedChunk.raw_text ?? JSON.stringify(markedChunk.value),
      call_trace: buildLabCallTrace({
        ...traceBase,
        parsed: markedChunk.value,
        raw_text: markedChunk.raw_text ?? JSON.stringify(markedChunk.value),
      }),
    };
  }

  const zipped = restoreTitles(zipArgumentEvidence(raw, soft_partial), raw);

  try {
    const encodedEvidence = encodeTreeFields(zipped, input.locale, ["evidence"]);
    return {
      ok: true,
      evidence: raw,
      marked: encodedEvidence,
      tokens_used: markedChunk.tokens_used,
      notes: [
        ...notes,
        "evidence_soft:wrap_w_slots",
        "evidence_soft:encode_t_slots",
      ],
      slotted,
      call_trace: buildLabCallTrace({
        ...traceBase,
        parsed: soft_partial,
        raw_text: markedChunk.raw_text ?? JSON.stringify(soft_partial),
      }),
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      reason,
      tokens_used: markedChunk.tokens_used,
      notes: [...notes, "evidence_soft:encode_failed"],
      slotted,
      last_raw_text: JSON.stringify(soft_partial),
      call_trace: buildLabCallTrace({
        ...traceBase,
        parsed: soft_partial,
        raw_text: markedChunk.raw_text ?? JSON.stringify(soft_partial),
      }),
    };
  }
}
