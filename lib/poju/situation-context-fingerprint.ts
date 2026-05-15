import type { POJUAgentState } from "@/lib/poju/agent-state";

/** Payload shared by client + `/api/poju/situation-analysis` for deterministic hashing. */
export type SituationFingerprintSource = {
  session_id: string;
  original_question: string;
  agent_v2: POJUAgentState | null | undefined;
  context_collected: Record<string, unknown>;
};

function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      out[k] = sortKeysDeep(o[k]);
    }
    return out;
  }
  return value;
}

/**
 * 语境版本指纹：同一 session 下语境变化 → 新指纹 → 可再次调用 Step 8。
 * 浏览器与 Node（Web Crypto）均可用。
 */
export async function computeSituationContextFingerprint(src: SituationFingerprintSource): Promise<string> {
  const agentSlice = src.agent_v2
    ? {
        current_phase: src.agent_v2.current_phase,
        question_category: src.agent_v2.question_category,
        collection_completeness: Math.round(src.agent_v2.collection_completeness * 1000) / 1000,
        context_collected: sortKeysDeep(src.agent_v2.context_collected),
      }
    : null;

  const canonical = JSON.stringify({
    session_id: src.session_id,
    original_question: String(src.original_question ?? "").trim(),
    agent: agentSlice,
    context_flat: sortKeysDeep(src.context_collected ?? {}),
  });

  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
