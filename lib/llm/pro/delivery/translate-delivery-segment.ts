/**
 * P2 Step 5 — per-segment translation (non-zh only).
 * Translates narrative body + mark connective prose; keeps ⟦t:slug|⟧ intact.
 * Tooltip definitions are filled at render via glossOf — never translated here.
 */

import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import { callLLM } from "@/lib/llm/router";
import {
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_TRANSITION_KEYS,
  type DeliveryArgumentTree,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_WRITE_MAX_TOKENS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";

export type TranslateSegmentResult = {
  tree: DeliveryArgumentTree;
  tokens_used: number;
  model: string;
};

function buildSegmentPayload(
  tree: DeliveryArgumentTree,
  paths: readonly DeliverySegmentKey[],
): Record<string, { arguments: Array<{ body: string; evidence?: string }> }> {
  const payload: Record<string, { arguments: Array<{ body: string; evidence?: string }> }> = {};
  for (const k of paths) {
    const args = tree[k];
    if (!args?.length) continue;
    const isTransition = DELIVERY_TRANSITION_KEYS.has(k);
    payload[k] = {
      arguments: args.map((a) =>
        isTransition
          ? { body: a.body }
          : { body: a.body, evidence: a.evidence ?? "" },
      ),
    };
  }
  return payload;
}

function applyTranslatedPayload(
  src: DeliveryArgumentTree,
  parsed: unknown,
  paths: readonly DeliverySegmentKey[],
): DeliveryArgumentTree {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return src;
  const o = parsed as Record<string, unknown>;
  const out: DeliveryArgumentTree = { ...src };
  for (const k of paths) {
    const rows = src[k] ?? [];
    if (!rows.length) continue;
    const raw = o[k];
    const translatedArgs =
      raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as { arguments?: unknown }).arguments)
        ? (raw as { arguments: unknown[] }).arguments
        : Array.isArray(raw)
          ? raw
          : null;
    out[k] = rows.map((a, i) => {
      const t = translatedArgs?.[i];
      if (!t || typeof t !== "object" || Array.isArray(t)) {
        return a;
      }
      const tb = (t as { body?: unknown }).body;
      const te = (t as { evidence?: unknown }).evidence;
      return {
        body: typeof tb === "string" && tb.trim() ? tb.trim() : a.body,
        evidence:
          typeof te === "string"
            ? te.trim() || a.evidence
            : a.evidence,
      };
    });
  }
  return out;
}

/**
 * Translate one or more segments' body (+ evidence for analysis keys).
 * Call per-segment in P3 streaming; assemble may batch all keys.
 */
export async function translateDeliverySegments(
  tree: DeliveryArgumentTree,
  targetLocale: string,
  opts?: {
    paths?: readonly DeliverySegmentKey[];
    session_id?: string;
    signal?: AbortSignal;
  },
): Promise<TranslateSegmentResult> {
  if (targetLocale.startsWith("zh")) {
    return { tree, tokens_used: 0, model: "" };
  }

  const paths = opts?.paths?.length
    ? opts.paths
    : DELIVERY_SEGMENT_KEYS.filter((k) => (tree[k]?.length ?? 0) > 0);

  if (paths.length === 0) {
    return { tree, tokens_used: 0, model: "" };
  }

  const payload = buildSegmentPayload(tree, paths);
  if (Object.keys(payload).length === 0) {
    return { tree, tokens_used: 0, model: "" };
  }

  const system = `You translate POJU delivery segment prose into ${targetLocale}.
Translate:
- body: narrative (keep markdown ### / > / -)
- evidence: connective vernacular BETWEEN markers only

CRITICAL:
- Every ⟦t:<slug>|…⟧ marker must be copied EXACTLY (slug unchanged). Do not invent markers.
- Do not translate tooltip glosses — markers stay as-is; UI fills definitions.
- Zero Chinese 命理 leftovers in readable prose (食神/七杀/日主/干支字面…).
- Fate lexicon ban: 命运 / 命定 / 宿命 / 天注定.

Output strict JSON with the same keys; each value is
{ "arguments": [ { "body": "...", "evidence": "..." } ] }
matching input length (omit evidence for transition-only rows that had none).`;

  const user = `Target locale: ${targetLocale}\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;

  try {
    const result = await callLLM({
      call_type: "main_delivery",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: DELIVERY_WRITE_MAX_TOKENS,
      thinking_effort: "medium",
      timeout_ms: 120_000,
      response_format: "text",
      session_id: opts?.session_id,
      temperature: 0.3,
      max_attempts: deliveryTransportMaxAttempts(),
      signal: opts?.signal,
    });

    const text = result.content?.trim() ?? "";
    let parsed: unknown = null;
    try {
      parsed = extractJson(text);
    } catch {
      return {
        tree,
        tokens_used: result.meta.tokens_used,
        model: result.actual_model,
      };
    }

    return {
      tree: applyTranslatedPayload(tree, parsed, paths),
      tokens_used: result.meta.tokens_used,
      model: result.actual_model,
    };
  } catch (e) {
    if (opts?.signal?.aborted || (e instanceof Error && e.name === "AbortError")) {
      return { tree, tokens_used: 0, model: "" };
    }
    console.error("[delivery/translate] failed", e instanceof Error ? e.message : e);
    return { tree, tokens_used: 0, model: "" };
  }
}

/** Translate full trees (narrative bodies + marked evidence) for assemble. */
export async function translateDeliveryBookTrees(
  narrative: DeliveryArgumentTree,
  markedEvidence: DeliveryArgumentTree,
  targetLocale: string,
  session_id?: string,
): Promise<{
  narrative: DeliveryArgumentTree;
  evidence: DeliveryArgumentTree;
  tokens_used: number;
  model: string;
}> {
  if (targetLocale.startsWith("zh")) {
    return { narrative, evidence: markedEvidence, tokens_used: 0, model: "" };
  }

  // Merge body from narrative + evidence from mark into one tree for a single pass per segment.
  const merged: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const bodies = narrative[k] ?? [];
    const evs = markedEvidence[k] ?? [];
    if (!bodies.length && !evs.length) continue;
    const n = Math.max(bodies.length, evs.length);
    merged[k] = Array.from({ length: n }, (_, i) => ({
      body: bodies[i]?.body ?? "",
      evidence: evs[i]?.evidence ?? bodies[i]?.evidence,
    }));
  }

  // Per-segment calls so P3 can stream without waiting for the whole book.
  let tokens_used = 0;
  let model = "";
  let tree = merged;
  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (!tree[k]?.length) continue;
    const tr = await translateDeliverySegments(tree, targetLocale, {
      paths: [k],
      session_id,
    });
    tree = tr.tree;
    tokens_used += tr.tokens_used;
    if (tr.model) model = tr.model;
  }

  const outNarr: DeliveryArgumentTree = {};
  const outEv: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const rows = tree[k] ?? [];
    if (!rows.length) continue;
    outNarr[k] = rows.map((a) => ({ body: a.body }));
    if (!DELIVERY_TRANSITION_KEYS.has(k)) {
      outEv[k] = rows.map((a) => ({
        body: a.body,
        evidence: a.evidence,
      }));
    }
  }

  return { narrative: outNarr, evidence: outEv, tokens_used, model };
}
