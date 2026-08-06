/**
 * Shared pure JSON tools for all POJU phases.
 * No phase control flow — extract / repair / parse / salvage only.
 */
import { auditDeliveredText, repairChatTermMarkers, sanitizeChatResponse, stripForbiddenShenSha } from "@/lib/llm/sanitize/compliance-terms";
import { salvagePhaseResponseText } from "@/lib/poju/extract-streaming-response";
import { getPojuEmptyGenerationMessage, getPojuServiceBusyMessage, isPojuFailurePlaceholderMessage } from "@/lib/llm/poju-service-busy-message";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { RelationLabel } from "@/lib/calculations/relation-engine";
import {
  isUnderstandingFieldFilled,
  parseCoreDilemmaPatch,
  parseDesiredDirectionPatch,
  resolveCoreDilemmaRaw,
  resolveDesiredDirectionRaw,
} from "@/lib/poju/agent-state";

export type PhaseResponseResolveContext = {
  locale?: string;
  phase_name?: string;
  call_type?: string;
  model?: string;
  finish_reason?: string | null;
  provider?: string | null;
  raw_length?: number;
  use_fallback?: boolean;
  structured?: ProfileStructured | null;
  audit_relations?: RelationLabel[];
};

/** Strip fences / prose wrappers; return innermost JSON object substring when present. */
export function extractJson(raw: string): string {
  let s = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
}

/** Normalize common LLM JSON drift (quotes, colons, spaced keys, trailing commas). */
export function tolerantJsonRepair(s: string): string {
  return s
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, '"')
    .replace(/：/g, ":")
    .replace(/，/g, ",")
    .replace(/"([^"]*?)\s+([^"]*?)"(\s*:)/g, (_, a, b, c) => `"${a}${b}"${c}`)
    .replace(/,(\s*[}\]])/g, "$1");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function grabSalvageStringField(text: string, keyAliases: string[]): string | undefined {
  for (const k of keyAliases) {
    const key = escapeRegExp(k);
    const re = new RegExp(
      `["'「」]?${key}["'「」]?\\s*[:：]\\s*["'「」]((?:[^"'「」\\\\]|\\\\.)*)["'「」]`,
      "i",
    );
    const m = text.match(re);
    if (m?.[1]?.trim()) {
      return m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim();
    }
  }
  return undefined;
}

function extractNestedJsonBlock(text: string, containerAliases: string[]): string | null {
  for (const key of containerAliases) {
    const re = new RegExp(`["'「」]?${escapeRegExp(key)}["'「」]?\\s*[:：]\\s*\\{`, "i");
    const m = re.exec(text);
    if (!m || m.index === undefined) continue;
    const braceStart = text.indexOf("{", m.index);
    if (braceStart < 0) continue;
    let depth = 0;
    for (let i = braceStart; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) return text.slice(braceStart, i + 1);
      }
    }
    if (depth > 0) return text.slice(braceStart);
  }
  return null;
}

export function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const attempts = [
    raw,
    raw.replace(/,(\s*[}\]])/g, "$1"),
    tolerantJsonRepair(raw),
    tolerantJsonRepair(raw.replace(/,(\s*[}\]])/g, "$1")),
  ];
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* next */
    }
  }
  return null;
}

const DILEMMA_CONTAINER_KEYS = ["core_dilemma", "coredilemma", "困境", "核心困境"];
const DIRECTION_CONTAINER_KEYS = ["desired_direction", "desireddirection", "行动", "期望方向", "目标方向"];

function salvageUnderstandingPatches(cleaned: string): {
  core_dilemma?: Record<string, unknown>;
  desired_direction?: Record<string, unknown>;
} {
  const out: {
    core_dilemma?: Record<string, unknown>;
    desired_direction?: Record<string, unknown>;
  } = {};

  const dilemmaBlock = extractNestedJsonBlock(cleaned, DILEMMA_CONTAINER_KEYS);
  if (dilemmaBlock) {
    const nested = tryParseJsonObject(dilemmaBlock);
    const patch = parseCoreDilemmaPatch(nested ?? dilemmaBlock);
    if (patch) out.core_dilemma = patch;
  }

  const directionBlock = extractNestedJsonBlock(cleaned, DIRECTION_CONTAINER_KEYS);
  if (directionBlock) {
    const nested = tryParseJsonObject(directionBlock);
    const patch = parseDesiredDirectionPatch(nested ?? directionBlock);
    if (patch) out.desired_direction = patch;
  }

  const flatDilemma = {
    concrete_event: grabSalvageStringField(cleaned, [
      "concrete_event",
      "concreteevent",
      "具体事件",
      "事件",
    ]),
    stakes: grabSalvageStringField(cleaned, ["stakes", "利害", "在意", "在乎", "代价"]),
    sticking_point: grabSalvageStringField(cleaned, [
      "sticking_point",
      "stickingpoint",
      "stickingpoint",
      "卡点",
      "过不去",
    ]),
  };
  const flatDilemmaPatch = parseCoreDilemmaPatch(flatDilemma);
  if (flatDilemmaPatch) {
    out.core_dilemma = { ...out.core_dilemma, ...flatDilemmaPatch };
  }

  const flatDirection = {
    wants: grabSalvageStringField(cleaned, [
      "wants",
      "w蚂蚁",
      "想要",
      "期望",
      "方向",
      "希望",
    ]),
    priority: grabSalvageStringField(cleaned, ["priority", "优先", "优先级", "最在意"]),
  };
  const flatDirectionPatch = parseDesiredDirectionPatch(flatDirection);
  if (flatDirectionPatch) {
    out.desired_direction = { ...out.desired_direction, ...flatDirectionPatch };
  }

  return out;
}

export function parsePhaseJson(rawText: string): Record<string, unknown> {
  const fenced = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const cleaned = extractJson(rawText);

  const direct = tryParseJsonObject(cleaned);
  if (direct) return direct;

  const grab = (re: RegExp) => fenced.match(re)?.[1] ?? cleaned.match(re)?.[1];
  const response = (() => {
    const m =
      cleaned.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/) ??
      fenced.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    return m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\t/g, "\t") : "";
  })();
  const sufficientRaw = grab(/"sufficient"\s*:\s*(true|false)/);
  const understandingSufficientRaw = grab(/"understanding_sufficient"\s*:\s*(true|false)/);
  const suggestedRaw = grab(/"suggested_phase"\s*:\s*(null|"[a-z_]+")/);
  const salvaged: Record<string, unknown> = { response, _parse_failed: true };
  if (understandingSufficientRaw != null) {
    salvaged.understanding_sufficient = understandingSufficientRaw === "true";
  }
  if (sufficientRaw != null) {
    salvaged.understanding = { sufficient: sufficientRaw === "true", missing: "" };
  }
  if (suggestedRaw != null) {
    salvaged.suggested_phase = suggestedRaw === "null" ? null : suggestedRaw.replace(/"/g, "");
  }

  const understanding = salvageUnderstandingPatches(fenced);
  if (understanding.core_dilemma && Object.keys(understanding.core_dilemma).length > 0) {
    salvaged.core_dilemma = understanding.core_dilemma;
  }
  if (understanding.desired_direction && Object.keys(understanding.desired_direction).length > 0) {
    salvaged.desired_direction = understanding.desired_direction;
  }

  return salvaged;
}

/** JSON salvage — preserve recovered control fields; only strip unsafe breakthrough updates. */
export function guardParseFailedFields(parsed: Record<string, unknown>): Record<string, unknown> {
  if (parsed._parse_failed !== true) return parsed;
  return {
    ...parsed,
    breakthrough_core_updates: null,
    core_dilemma: parsed.core_dilemma,
    desired_direction: parsed.desired_direction,
    understanding_sufficient:
      typeof parsed.understanding_sufficient === "boolean" ? parsed.understanding_sufficient : undefined,
    understanding: parsed.understanding ?? { sufficient: false, missing: "" },
    suggested_phase: parsed.suggested_phase ?? null,
  };
}

export function isPhaseParseFailed(parsed: Record<string, unknown>): boolean {
  return parsed._parse_failed === true;
}

/** Parse phase JSON; sanitize `response` when locale provided (output-side gloss tokens). */
export function getPhaseResponseFallback(locale?: string): string {
  return getPojuServiceBusyMessage(locale);
}

export function getPhaseEmptyGenerationFallback(locale?: string): string {
  return getPojuEmptyGenerationMessage(locale);
}

export function hasSalvagedUnderstandingFields(parsed: Record<string, unknown>): boolean {
  const dilemma = parseCoreDilemmaPatch(resolveCoreDilemmaRaw(parsed));
  const direction = parseDesiredDirectionPatch(resolveDesiredDirectionRaw(parsed));
  const candidates = [
    dilemma?.concrete_event,
    dilemma?.stakes,
    dilemma?.sticking_point,
    direction?.wants,
    direction?.priority,
  ];
  return candidates.some((v) => isUnderstandingFieldFilled(v));
}

/** Opening turn is usable when JSON parsed cleanly, or salvage recovered understanding/response field. */
export function isPhaseOpeningPayloadUsable(
  parsed: Record<string, unknown>,
  response: string,
): boolean {
  if (isPojuFailurePlaceholderMessage(response)) return false;
  if (!response.trim()) return false;
  if (!isPhaseParseFailed(parsed)) return true;
  if (parsed._prose_salvaged === true) return hasSalvagedUnderstandingFields(parsed);
  if (hasSalvagedUnderstandingFields(parsed)) return true;
  const jsonSalvagedResponse =
    typeof parsed.response === "string" && parsed.response.trim() === response.trim();
  return jsonSalvagedResponse;
}

export function getPhaseParseFailureFallback(locale?: string): string {
  return getPhaseEmptyGenerationFallback(locale);
}

/** Parse phase JSON; sanitize `response` when locale provided (output-side gloss tokens). */
export function parsePhaseResult(
  rawText: string,
  options?: { locale?: string; logContext?: PhaseResponseResolveContext },
): {
  parsed: Record<string, unknown>;
  response: string;
  salvaged: boolean;
} {
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  if (!cleaned) return { parsed: {}, response: "", salvaged: false };

  const sanitizeResponse = (raw: string): string => {
    if (!options?.locale || !raw.trim()) return raw;
    let audited = repairChatTermMarkers(raw, options.locale);
    audited = sanitizeChatResponse(audited, options.locale);
    const hits = auditDeliveredText(audited, options.locale, undefined, { quiet: true }).filter((v) =>
      v.label.startsWith("out_of_set"),
    );
    if (hits.length) {
      audited = stripForbiddenShenSha(audited);
      console.warn("[chat] 集外神煞已剥离:", hits.map((h) => h.label));
    }
    return audited;
  };

  let parsed: Record<string, unknown> = {};
  let jsonParsed = false;
  try {
    parsed = guardParseFailedFields(parsePhaseJson(rawText));
    jsonParsed = !isPhaseParseFailed(parsed);
  } catch {
    parsed = {};
  }

  const salvagedRaw = salvagePhaseResponseText(rawText).trim();
  let response = "";
  if (typeof parsed.response === "string" && parsed.response.trim()) {
    response = sanitizeResponse(parsed.response);
  } else if (salvagedRaw) {
    response = sanitizeResponse(salvagedRaw);
    if (!jsonParsed) {
      parsed._prose_salvaged = true;
      logPhaseSalvage(rawText, options?.logContext, salvagedRaw.startsWith("{") ? "partial_json" : "prose");
    }
  }

  if (isPhaseParseFailed(parsed) && !response.trim()) {
    // Defer to resolvePhaseResponse — broken JSON uses empty-generation copy, not busy fallback.
  }

  if (typeof parsed.response === "string") parsed.response = response;
  else if (response) parsed.response = response;

  return { parsed, response, salvaged: !jsonParsed && Boolean(salvagedRaw) };
}

/** Log when salvage extracts user-visible text from broken / prose output. */
export function logPhaseSalvage(
  rawText: string,
  ctx: PhaseResponseResolveContext | undefined,
  mode: "prose" | "partial_json",
): void {
  const preview = rawText.replace(/\s+/g, " ").trim().slice(0, 400);
  console.warn(
    "[phase-transport] phase response salvaged",
    JSON.stringify({
      mode,
      phase: ctx?.phase_name ?? "—",
      call_type: ctx?.call_type ?? "—",
      provider: ctx?.provider ?? "—",
      finish_reason: ctx?.finish_reason ?? "—",
      raw_preview: preview,
    }),
  );
}

