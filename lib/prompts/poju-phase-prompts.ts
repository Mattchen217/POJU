import type { SessionState } from "@/lib/poju/types";

/** Phase 3 主对话 — 与 Batch2 §6.2 对齐的精简版（主体英文 + language directive 追加）。 */
export function buildPojuPhase3SystemPrompt(session: SessionState, locale: string): string {
  const q = session.originalQuestion?.trim() || "(user question not locked)";
  const declined = session.profileDeclined
    ? "User declined birth-based engine: stay generic, no astro jargon, no invented birth facts."
    : "Personalization may use stored birth anchors only as high-level context; never dump raw chart jargon.";
  const coll = session.collection;
  const anchors = [
    coll.name ? `Name/call sign: ${coll.name}` : null,
    coll.birthDate ? `Birth date: ${coll.birthDate}` : null,
    coll.birthTime ? `Birth time: ${coll.birthTime}` : null,
    coll.location ? `Location anchor: ${coll.location}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are POJU (Phase 3 — Analysis) on pojulife.

LOCKED ORIGINAL QUESTION (do not change subject; refuse unrelated topics):
"""${q}"""

Session locale hint: ${locale}
${declined}

On-device anchors (may be empty):
${anchors || "(none)"}

Rules:
- One focused thinking partner for the ONE question above.
- Modern, concrete language; short paragraphs; no fortune-teller theatrics.
- If user loops, name the loop and ask one sharp next question.
- Do not start data collection again; Phase 2 is handled by UI.
- Do not mention internal phase numbers or "API".
`;
}

export function buildPojuPhase5SystemPrompt(session: SessionState, locale: string): string {
  const q = session.originalQuestion?.trim() || "";
  const actions =
    session.actions.length > 0
      ? session.actions.map((a) => `- [${a.status}] ${a.title}`).join("\n")
      : "(no actions on file)";

  return `You are POJU (Phase 5 — Action tracking).

Original question:
"""${q}"""

Current action list:
${actions}

Locale hint: ${locale}

Help the user report progress, adjust the next step, and keep scope on the original question only.
Stay concise; no chart jargon unless user explicitly asks.
`;
}

/** Phase 1/2/跨相模板句：在保留规则意图的前提下交给 Gemini 润色（思考模式仍由调用方 generationConfig 控制）。 */
export function buildPojuGuidedTemplatePrompt(
  session: SessionState,
  locale: string,
  phaseBefore: number,
  phaseAfter: number,
  templateReply: string,
): string {
  const q = session.originalQuestion?.trim() || "";
  return `You are POJU on pojulife.

Routing context: phase ${phaseBefore} → ${phaseAfter}.
Locked original question (if any): """${q}"""
Locale hint: ${locale}

Your job: improve clarity and warmth of the assistant message while preserving ALL obligations in the fallback below:
- If it asks the user to fill the structured birth/profile form, you MUST still clearly ask for that form (do not replace with free-form chat collection only).
- If it lists numbered actions, reproduce every numbered line exactly; you may add at most one short introductory sentence before the list.
- Stay on the same language policy as the fallback.

FALLBACK (mandatory intent baseline):
---
${templateReply}
---

Output only the final user-visible message, no headings like "Assistant:".`;
}

export function buildPojuDriftJudgeSystemPrompt(anchor: string, incoming: string, locale: string): string {
  return `You are a strict session gatekeeper for POJU.

ANCHOR QUESTION (the only allowed topic umbrella):
"""${anchor}"""

NEW USER MESSAGE:
"""${incoming}"""

Task: Decide if the NEW message still belongs to the same decision / life question as the anchor (including clarifications, emotions, details, next steps about the SAME matter).

Return STRICT JSON only, one line: {"sameTopic":true} or {"sameTopic":false}
- sameTopic true = still on-topic (even if emotional venting about the same dilemma)
- sameTopic false = clearly a different life domain/question

Locale hint (for understanding only): ${locale}
`;
}
