import { z } from "zod";

import {
  buildMatchClarificationGateSummary,
} from "@/lib/clarification/distill";
import type {
  ClarificationMessage,
  ClarificationTurnResult,
  MatchClarificationFields,
} from "@/lib/clarification/types";
import { buildMatchClarificationSystemPrompt } from "@/lib/match/clarification/match-clarification-prompt";
import type { MatchPersonFacts } from "@/lib/match/clarification/match-person-facts";
import { openRouterChatCompletion } from "@/lib/llm/openrouter-shared";
import { extractJson, tryParseJsonObject } from "@/lib/llm/phases/phase-transport";
import { sanitizeReplyOptions } from "@/lib/poju/reply-options";
import {
  extractResponseGreedy,
  salvagePhaseResponseText,
} from "@/lib/poju/extract-streaming-response";

const FieldsSchema = z.object({
  relationship_type: z.string().optional(),
  concern_focus: z.string().optional(),
  concrete_matter: z.string().optional(),
});

function mergeFields(
  prior: MatchClarificationFields | null | undefined,
  patch: Partial<MatchClarificationFields>,
): MatchClarificationFields {
  return {
    relationship_type: (patch.relationship_type ?? prior?.relationship_type ?? "").trim(),
    concern_focus: (patch.concern_focus ?? prior?.concern_focus ?? "").trim(),
    concrete_matter: (patch.concrete_matter ?? prior?.concrete_matter ?? "").trim(),
  };
}

function parseFields(raw: Record<string, unknown>): Partial<MatchClarificationFields> {
  const nested =
    raw.fields && typeof raw.fields === "object" && !Array.isArray(raw.fields)
      ? (raw.fields as Record<string, unknown>)
      : raw;
  const parsed = FieldsSchema.safeParse(nested);
  if (!parsed.success) return {};
  return {
    relationship_type: parsed.data.relationship_type?.trim() || undefined,
    concern_focus: parsed.data.concern_focus?.trim() || undefined,
    concrete_matter: parsed.data.concrete_matter?.trim() || undefined,
  };
}

function parseSufficient(raw: Record<string, unknown>): boolean {
  if (typeof raw.understanding_sufficient === "boolean") return raw.understanding_sufficient;
  if (
    raw.understanding &&
    typeof raw.understanding === "object" &&
    !Array.isArray(raw.understanding) &&
    typeof (raw.understanding as { sufficient?: unknown }).sufficient === "boolean"
  ) {
    return Boolean((raw.understanding as { sufficient: boolean }).sufficient);
  }
  return false;
}

/** Concern about strengths/gaps/complement → need concrete contributions before gate. */
function looksLikeComplementarityConcern(focus: string): boolean {
  const t = focus.toLowerCase();
  return (
    /互补|长短板|贡献|带来|能力气质|合不合拍|对得上|对上/.test(focus) ||
    /complement|strength|gap|bring|temperament|line up|line-up/.test(t)
  );
}

/**
 * Options must be draft answers the user can send — drop question-shaped chips.
 * If fewer than 2 remain, return undefined (composer-only).
 */
function filterAnswerShapedOptions(options: string[] | undefined): string[] | undefined {
  if (!options?.length) return undefined;
  const kept = options.filter((opt) => !looksLikeQuestionOption(opt));
  return kept.length >= 2 ? kept.slice(0, 3) : undefined;
}

function looksLikeQuestionOption(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/[？?]/.test(t)) return true;
  if (/^(谁|是否|怎么|怎样|哪|什么|为何|为什么|如何)/.test(t)) return true;
  if (/^(who|what|which|whether|how|why)\b/i.test(t)) return true;
  // "谁…谁…" question pattern — OK if already labeled Match A/B as an answer draft
  if (/谁.+谁/.test(t) && !/match\s*[ab]/i.test(t) && !/^(我|我们|对方|他|她)/.test(t)) {
    return true;
  }
  if (/\bwho\b.+\bwho\b/i.test(t) && !/match\s*[ab]/i.test(t) && !/^(i|we|they|my|our)\b/i.test(t)) {
    return true;
  }
  return false;
}

function extractResponseText(content: string, parsed: Record<string, unknown> | null): string {
  if (parsed && typeof parsed.response === "string" && parsed.response.trim()) {
    return parsed.response.trim();
  }
  const salvaged = salvagePhaseResponseText(content).trim();
  if (salvaged) return salvaged;
  return extractResponseGreedy(content).trim();
}

export type RunMatchClarificationTurnInput = {
  locale: string;
  messages: ClarificationMessage[];
  prior_fields?: MatchClarificationFields | null;
  person_a?: MatchPersonFacts | null;
  person_b?: MatchPersonFacts | null;
  /** User just left the understanding gate via「补充」and sent new text. */
  after_gate_supplement?: boolean;
};

export async function runMatchClarificationTurn(
  input: RunMatchClarificationTurnInput,
): Promise<ClarificationTurnResult> {
  const system = buildMatchClarificationSystemPrompt({
    locale: input.locale,
    person_a: input.person_a,
    person_b: input.person_b,
  });
  const history = input.messages
    .filter((m) => m.content.trim())
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.trim(),
    }));

  if (history.length === 0) {
    history.push({
      role: "user",
      content:
        input.locale.startsWith("zh")
          ? "我想做双人契合分析，请先帮我把问题问清楚。"
          : "I want a two-person fit analysis — please help clarify my question first.",
    });
  }

  if (input.after_gate_supplement && history.length > 0) {
    const last = history[history.length - 1];
    if (last?.role === "user") {
      const note = input.locale.startsWith("zh")
        ? "【系统】用户在理解确认后补充/修正。合并进 fields（有变更就覆盖）。禁止复读上一轮闸门总结。按 MATCH 真算原则判断：信息已够支撑测算则 sufficient=true；仍缺关键缺口则只问一个问题。"
        : "[system] User is adding/correcting after the understanding gate. Merge into fields (overwrite when changed). Do not repeat the previous gate summary. Per MATCH calc principles: if enough to calculate, sufficient=true; if a real gap remains, ask exactly one question.";
      last.content = `${note}\n\n${last.content}`;
    }
  }

  const completion = await openRouterChatCompletion({
    messages: [{ role: "system", content: system }, ...history],
    temperature: 0.55,
    max_tokens: 4096,
    reasoning_effort: "medium",
    json_mode: true,
    call_type: "chat_flash",
    phase_name: "match_clarify",
  });

  const rawContent = completion.text?.trim() ?? "";
  let parsed: Record<string, unknown> | null = null;
  try {
    const extracted = extractJson(rawContent) || rawContent;
    parsed = tryParseJsonObject(extracted);
  } catch {
    parsed = null;
  }

  const response = extractResponseText(rawContent, parsed);
  const rawOptions = parsed ? sanitizeReplyOptions(parsed.options) : undefined;
  const options = filterAnswerShapedOptions(rawOptions);
  const patch = parsed ? parseFields(parsed) : {};
  const fields = mergeFields(input.prior_fields, patch);

  let understanding_sufficient = parsed ? parseSufficient(parsed) : false;
  // Enforce hard standard: need type + focus
  if (!fields.relationship_type || !fields.concern_focus) {
    understanding_sufficient = false;
  }
  // Complementarity concerns need concrete "what each brings"
  if (understanding_sufficient && looksLikeComplementarityConcern(fields.concern_focus)) {
    if (fields.concrete_matter.trim().length < 4) {
      understanding_sufficient = false;
    }
  }

  const result: ClarificationTurnResult = {
    response:
      response ||
      (input.locale.startsWith("zh")
        ? "我想先确认一下——你们目前是什么关系？伴侣、合作伙伴，还是别的？"
        : "Quick check — what’s your relationship right now: partners, collaborators, or something else?"),
    options,
    understanding_sufficient,
    fields,
  };

  if (understanding_sufficient) {
    result.summary_for_confirm = buildMatchClarificationGateSummary(fields, input.locale);
    // Gate turn: short ack in response; UI shows summary + UnderstandingGateActions
    result.response = input.locale.startsWith("zh")
      ? "好的，我先帮你核对一下理解。"
      : "Got it — let me play that back for you to confirm.";
    result.options = undefined;
  }

  return result;
}
