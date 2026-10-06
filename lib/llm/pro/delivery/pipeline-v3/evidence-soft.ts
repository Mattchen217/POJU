/**
 * Pipeline v3 · Step3 evidence soft — wrap traditional judgment → mark connective
 * in the delivery locale → encode `⟦w:⟧` to coined-term `⟦t:⟧`. Does not rewrite page body.
 */

import type {
  DeliveryArgumentTree,
  DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { zipArgumentEvidence } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { runOneMarkArgChunk } from "@/lib/llm/pro/delivery/mark-evidence-call";
import {
  buildMarkEvidencePrompt,
  pickMarkEvidenceInput,
} from "@/lib/llm/pro/delivery/mark-evidence-prompt";
import { encodeConnectiveEvidenceToTerms } from "@/lib/llm/pro/delivery/polish-marked-evidence";
import { wrapBareJudgmentAsWordSlots } from "@/lib/llm/sanitize/term-marking";
import { buildLabCallTrace, type LabCallTrace } from "@/lib/llm/pro/delivery/lab/call-trace";

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
        ? wrapBareJudgmentAsWordSlots(a.evidence)
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
        next[f] = encodeConnectiveEvidenceToTerms(raw, locale);
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

export type EvidenceSoftOk = {
  ok: true;
  evidence: DeliveryArgumentTree;
  marked: DeliveryArgumentTree;
  tokens_used: number;
  notes: string[];
  call_trace: LabCallTrace;
  slotted: DeliveryArgumentTree;
};

export type EvidenceSoftFail = {
  ok: false;
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
  original_question?: string | null;
  session_id?: string;
  timeout_ms?: number;
}): Promise<EvidenceSoftOk | EvidenceSoftFail> {
  const frozen = freezeRawJudgmentAsEvidence({
    key: input.key,
    plan: input.plan,
  });
  const raw = frozen.evidence;
  const slotted = wrapTreeEvidence(raw);
  const markPayload = pickMarkEvidenceInput(slotted, [input.key]);
  const ctx = { original_question: input.original_question ?? null };
  const { system, user } = buildMarkEvidencePrompt(
    markPayload,
    input.locale,
    ctx,
  );

  if (!markPayload[input.key]?.arguments.length) {
    return {
      ok: false,
      reason: "evidence_soft_empty",
      tokens_used: 0,
      notes: frozen.notes,
      slotted,
      call_trace: buildLabCallTrace({
        phase: "evidence_soft",
        system,
        user,
        parsed: slotted,
      }),
    };
  }

  const markedChunk = await runOneMarkArgChunk(
    markPayload,
    input.locale,
    ctx,
    input.session_id,
    undefined,
    input.timeout_ms,
  );

  const traceBase = {
    phase: "evidence_soft",
    system,
    user,
  };

  if (!markedChunk.ok) {
    return {
      ok: false,
      reason: markedChunk.reason,
      tokens_used: markedChunk.tokens_used,
      notes: [...frozen.notes, "evidence_soft:mark_failed"],
      slotted,
      call_trace: buildLabCallTrace({
        ...traceBase,
        parsed: { fail: markedChunk.reason },
      }),
    };
  }

  const zipped = restoreTitles(
    zipArgumentEvidence(raw, markedChunk.value),
    raw,
  );

  try {
    const encodedEvidence = encodeTreeFields(zipped, input.locale, ["evidence"]);
    const bodyWrapped: DeliveryArgumentTree = {};
    for (const [k, args] of Object.entries(raw)) {
      bodyWrapped[k as DeliverySegmentKey] = (args ?? []).map((a) => ({
        ...a,
        body: a.body?.trim() ? wrapBareJudgmentAsWordSlots(a.body) : a.body,
      }));
    }
    const encodedBody = encodeTreeFields(bodyWrapped, input.locale, ["body"]);
    const marked: DeliveryArgumentTree = {};
    for (const [k, args] of Object.entries(encodedEvidence)) {
      const bodies = encodedBody[k as DeliverySegmentKey] ?? [];
      marked[k as DeliverySegmentKey] = (args ?? []).map((a, i) => ({
        ...a,
        body: bodies[i]?.body ?? a.body,
      }));
    }
    return {
      ok: true,
      evidence: raw,
      marked,
      tokens_used: markedChunk.tokens_used,
      notes: [
        ...frozen.notes,
        "evidence_soft:wrap_w_slots",
        "evidence_soft:mark_connective",
        "evidence_soft:encode_t_slots",
      ],
      slotted,
      call_trace: buildLabCallTrace({
        ...traceBase,
        parsed: markedChunk.value,
        raw_text: JSON.stringify(markedChunk.value),
      }),
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      reason,
      tokens_used: markedChunk.tokens_used,
      notes: [...frozen.notes, "evidence_soft:encode_failed"],
      slotted,
      last_raw_text: JSON.stringify(markedChunk.value),
      call_trace: buildLabCallTrace({
        ...traceBase,
        parsed: markedChunk.value,
        raw_text: JSON.stringify(markedChunk.value),
      }),
    };
  }
}
