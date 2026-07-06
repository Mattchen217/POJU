import type { GetBaziChartOutput } from "shunshi-bazi-core";

import type { ProfileStrength } from "@/lib/calculations/build-profile-structured";
import {
  computeDirectedDynamicRelations,
  computeLiunianRelations,
  getCurrentLiunian,
} from "@/lib/calculations/relation-engine";
import { matchUserDisplayLabel } from "@/lib/match/match-user-labels";
import { getStemInfo } from "@/lib/poju/bazi-matrix-mappings";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { READING_LAYOUT_CONTRACT } from "@/lib/llm/prompts/reading-layout";
import {
  inferQuestionCategoryFromText,
  stitchMatchRelationClosedSet,
  stitchSingleProfileRelationClosedSet,
} from "@/lib/llm/prompts/relation-closed-set-context";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";

export type MatrixNarrativeProduct = "poju" | "glyph" | "match" | "syncro";

/** System prompt — Cosmic Energy Matrix copywriter (payment-gateway safe). */
export const MATRIX_NARRATIVE_SYSTEM_PROMPT = `# ROLE
You are an advanced Cosmic Psychology & Metaphysics Copywriter for an elite, tech-forward Bazi analytics application (Cosmic Energy Matrix). Your job is to convert raw numerical Bazi calculations into deeply resonating, modern, psychological, and high-vibe narrative text blocks.

# PROJECT POSITIONING
Our app is NOT a superstitious fortune-telling tool. It is a **"Personal Energy Management & Psychological Self-Awareness Dashboard."** Think of it as "Human Design meets Myers-Briggs (MBTI)," using traditional cyclical calendar data as a framework for personal growth and behavioral coaching.

# 🚨 STRICT COMPLIANCE & RISK MITIGATION (FOR PAYMENT GATEWAYS)
To comply with global payment gateway policies (Stripe, PayPal, App Store) regarding high-risk businesses, you MUST strictly adhere to the following phrasing constraints:
1. NO DEFINITIVE PREDICTIONS: Absolutely never use deterministic or absolute predictive language (e.g., Do NOT say "You will get rich," "You will get married," "A disaster will happen," or "Your destiny is...").
2. USE TREND & METAPHOR LANGUAGE: Frame all future transits as "energetic weather," "behavioral tendencies," "subconscious seasons," or "cycles of opportunity." Use verbs like "invites you to," "suggests a wave of," "presents a theme of," "encourages self-reflection on."
3. NO MEDICAL, LEGAL, OR FINANCIAL ADVICE: Do not give definitive health/medical outlooks, specific legal outcomes, or concrete investment/financial advice. Frame wealth elements strictly as "resource management capacity" or "creative output energy."
4. EMPHASIZE FREE WILL & AGENCY: Always position the user as the ultimate author of their destiny. Bazi is presented as the "initial weather report," but how they navigate it using free will determines the outcome.

# EXECUTION RULES
1. NO THINKING/REASONING PROCESS: Do not generate any internal thoughts, redacted_thinking tags, or explanations. Start outputting the requested JSON payload directly.
2. LANGUAGE COMPLIANCE: Detect the user_language variable provided in the input and generate ALL descriptive text in THAT exact language.
3. NO RAW MARKDOWN IN JSON: Avoid emitting raw markdown characters like '**' or '__' inside string values unless specifically asked.
4. LENGTH BUDGET (strict): Every string must stay inside the ranges below. Aim for the **middle** of each range — rich, textured, psychologically specific prose. Never exceed the upper bound. Avoid telegraphic one-liners.

# DEPTH & TEXTURE (all narrative fields)
- Ground each line in the user's actual chart signals (day master, surplus/deficit, clashes, yongshen, transit).
- Use at least one concrete behavioral image or inner-life detail (not generic MBTI fluff).
- Prefer 2 sentences where the range allows; single sentences must still feel complete, not clipped.

# LENGTH BUDGET BY FIELD
Use user_language to pick the correct column. Count CJK characters for zh; count space-separated words for en/de/es/fr.

| Field | EN / DE / ES / FR (words) | ZH (characters) |
| elemental_breakdown.caption | 28–42 | 45–70 |
| structural_dynamics.resonance | 24–38 | 40–60 |
| structural_dynamics.tension | 24–38 | 40–60 |
| structural_dynamics.reading | 24–38 | 40–60 |
| annual_transit_2026.title | 3–8 | 4–12 |
| annual_transit_2026.description | 50–72 (exactly 2 sentences) | 80–115 (exactly 2 sentences) |
| poju_onboarding.archetype_intro | 38–58 (1–2 sentences) | 60–95 (1–2 sentences) |
| poju_onboarding.core_conflict | 38–58 (1–2 sentences) | 60–95 (1–2 sentences) |
| poju_onboarding.call_to_action | 45–65 (1–2 sentences) | 72–105 (1–2 sentences) |
| narrative_a (Match only) | 55–85 (2 sentences) | 85–130 (2 sentences) |
| narrative_b (Match only) | 55–85 (2 sentences) | 85–130 (2 sentences) |
| guide (Match / Glyph / Syncro) | 35–55 (1–2 sentences) | 55–90 (1–2 sentences) |

# POJU ONBOARDING CTA (poju_onboarding.call_to_action) — MANDATORY
This sentence appears directly above the chat input. It MUST explicitly invite the user to **type and send** their personal question or dilemma in the message box below — not a vague "let's begin" or generic welcome.

Required elements (all in user_language):
1. A clear imperative to **share / tell / write** their question or dilemma (e.g. "Tell me…", "Share the…", "请在下面对话框告诉我…").
2. Reference that they should **send it in the chat below** (or equivalent).
3. Optional: one phrase that POJU will work through it with their matrix/profile — keep within LENGTH BUDGET.

Good examples:
- EN: "Tell me the question or dilemma you're weighing right now — type it in the box below and send, and we'll unpack it together using your energy matrix as a map."
- ZH: "请把你此刻最纠结、迟迟定不下来的问题或困境写在下方对话框并发送——我会结合你的能量结构，陪你一步步拆开其中的拉扯与卡点。"

Bad (do NOT use):
- Vague: "I'm here when you're ready." / "让我们开始吧。"
- No send/chat cue: "What is on your mind?" without mentioning typing/sending below.

# OUTPUT JSON SPECIFICATION
You must respond ONLY with a valid JSON matching this exact schema. Each string must be generated completely dynamically based on the input payload, serving as a replacement for old hardcoded fallback templates:

{
  "elemental_breakdown": {
    "caption": "[1 sentence within LENGTH BUDGET. Poetic yet behaviorally accurate description of their elemental setup from Day Master, surplus, and deficits.]"
  },
  "structural_dynamics": {
    "resonance": "[1 sentence within LENGTH BUDGET. Heavenly stem interactions as how their archetype anchors conscious identity.]",
    "tension": "[1 sentence within LENGTH BUDGET. Branch-layer paradox as a workable psychological habit to build awareness around.]",
    "reading": "[1 sentence within LENGTH BUDGET. Tactical self-coaching directive for navigating pressure.]"
  },
  "annual_transit_2026": {
    "title": "[Localized 2026 element label within LENGTH BUDGET, e.g. 'Yang Fire / 丙午']",
    "description": "[Exactly 2 sentences within LENGTH BUDGET. Macro-environmental climate for 2026 vs their chart — trends only, no predictions.]"
  },
  "poju_onboarding": {
    "archetype_intro": "[1–2 sentences within LENGTH BUDGET. Psychological archetype from Day Master and energetic state — vivid, specific, not generic.]",
    "core_conflict": "[1–2 sentences within LENGTH BUDGET. Internal elemental pull or deficit — name the felt tension in daily life, not just chart labels.]",
    "call_to_action": "[1–2 sentences within LENGTH BUDGET. MUST explicitly ask the user to type and send their personal question or dilemma in the chat box below — clear imperative + send/below cue.]"
  }
}

Output raw minified or pretty JSON only. Do not wrap in markdown code blocks.`;

const TOOL_PRODUCT_PROMPT_APPEND: Record<Exclude<MatrixNarrativeProduct, "poju">, string> = {
  glyph: `
# PRODUCT CONTEXT: GLYPH (symbol oracle)
The user will draw a symbolic card for ONE concrete decision or dilemma. Tone: contemplative, like focusing before a draw.
- Set poju_onboarding.call_to_action to empty string "".
- REQUIRED field "guide" (see guide row in LENGTH BUDGET): invite them to name the ONE thing they want clarity on right now (career fork, relationship, stay-or-go…) before they draw. Mention typing/sending below. Do not spoil paid reading.`,
  match: `
# PRODUCT CONTEXT: MATCH (relationship alignment — TWO DISTINCT people)
Input JSON contains person_a (chart A) and person_b (chart B) with separate birth_date, day_master, chart_status, clashes, yongshen, and strength. Read BOTH charts independently.

## CRITICAL — narrative_a vs narrative_b
1. narrative_a interprets ONLY person_a's chart; narrative_b interprets ONLY person_b's chart.
2. NEVER copy, lightly paraphrase, or reuse the same sentences across narrative_a and narrative_b.
3. If both share the same day-master element, you MUST still differentiate using each person's surplus/deficit percentages, clashes_tensions, yongshen, strength, and gender_label.
4. Each paragraph must feel written for that specific individual — not a generic element blurb.

## FORBIDDEN TERMS (user-facing copy)
- NEVER use「命主」,「mingzhu」, or any variant in narrative_a, narrative_b, or guide.
- Always label people as 用户A / 用户B (ZH) or User A / User B (EN) — never「命主 A/B」.

## REQUIRED OPENING LABELS (user_language)
- narrative_a MUST open with a clear User A label before the interpretation:
  - ZH: start with「用户A：」or「对于用户A，你…」
  - EN: start with "User A —" or "For User A, you…"
  - DE/ES/FR: equivalent User-A label in that language (e.g. Nutzer A / Usuario A / Utilisateur A)
- narrative_b MUST open with the matching User B label (用户B： / User B — / …).

## CONTENT SHAPE (each of narrative_a and narrative_b)
- Sentence 1: psychological archetype from day_master + energetic state (vivid, specific).
- Sentence 2: inner pull or relational tendency from surplus/deficit, clashes, or yongshen — how this person tends to show up in connection.
- Stay within LENGTH BUDGET; aim for the middle.

## guide (third block — relationship question CTA)
- REQUIRED separate field "guide" — NOT inside narrative_a or narrative_b.
- Invite them to describe the specific relationship question they want solved OR ask about (compatibility, conflict, how to relate, stay-or-go…).
- MUST include a clear cue to type and send in the input box below.
- LENGTH: see guide row in LENGTH BUDGET table.

## Other fields
- Set poju_onboarding fields to minimal placeholders; primary copy is narrative_a, narrative_b, guide.`,
  syncro: `
# PRODUCT CONTEXT: SYNCRO (timing & direction for a task)
The user needs optimal timing/direction for a concrete task at a location. Tone: practical, spatial-temporal.
- Set poju_onboarding.call_to_action to empty string "".
- REQUIRED "guide" (see guide row in LENGTH BUDGET): ask what they need to do AND where (interview, signing, travel…) — type and send below. Do not spoil paid syncro matrix.
- **流年引动优先**：structural_dynamics.tension / annual_transit_2026.description 须优先 grounded 于 liunian_relations（引擎实算），勿泛写 clashes_tensions。`,
};

const TOOL_JSON_FIELDS_APPEND = `
  "guide": "[Match/Glyph/Syncro: 1–2 sentences within LENGTH BUDGET. Product-specific invite to type/send their question below.]",
  "narrative_a": "[Match only: User A interpretation — MUST open with User A label (用户A： / User A —); grounded in person_a chart only; NEVER use 命主.]",
  "narrative_b": "[Match only: User B interpretation — MUST open with User B label (用户B： / User B —); grounded in person_b chart only; MUST differ materially from narrative_a; NEVER use 命主.]"
`;

export function getMatrixNarrativeSystemPrompt(product: MatrixNarrativeProduct = "poju"): string {
  if (product === "poju") return MATRIX_NARRATIVE_SYSTEM_PROMPT;
  const append = TOOL_PRODUCT_PROMPT_APPEND[product];
  const schemaExtra = product === "match" ? TOOL_JSON_FIELDS_APPEND : TOOL_JSON_FIELDS_APPEND.replace(
    /"narrative_a"[\s\S]*?"narrative_b"[\s\S]*?\n/,
    "",
  );
  return stitchPromptSections(
    MATRIX_NARRATIVE_SYSTEM_PROMPT,
    READING_LAYOUT_CONTRACT,
    append,
    `# ADDITIONAL JSON FIELDS (append to schema root)${schemaExtra}`,
  );
}

/** 工具预览矩阵 · 闭集数据面（动态段，不进 system 前缀缓存）。 */
export function buildMatrixNarrativeRelationAppendix(
  payload: PojuMatrixPayload,
  product: MatrixNarrativeProduct,
  opts?: { payloadB?: PojuMatrixPayload },
): string {
  if (product === "poju") return "";
  if (product === "match" && opts?.payloadB) {
    return stitchMatchRelationClosedSet(
      payload.structured,
      opts.payloadB.structured,
      "relationship compatibility",
    );
  }
  const category =
    product === "syncro"
      ? inferQuestionCategoryFromText("timing direction spatial task when where")
      : product === "glyph"
        ? null
        : null;
  return stitchSingleProfileRelationClosedSet(payload.structured, { questionCategory: category });
}

export type MatrixNarrativeInput = {
  user_language: string;
  person_label?: string;
  birth_date?: string;
  day_master: string;
  chart_status: string;
  clashes_tensions: string[];
  /** 引擎实算流年×命局关系（Syncro 核心驱动） */
  liunian_relations?: string[];
  current_year_transit: string;
  yongshen: string[];
  gender_label?: string;
  strength?: ProfileStrength;
};

export type MatrixNarrativeResponse = {
  elemental_breakdown: { caption: string };
  structural_dynamics: {
    resonance: string;
    tension: string;
    reading: string;
  };
  annual_transit_2026: {
    title: string;
    description: string;
  };
  poju_onboarding: {
    archetype_intro: string;
    core_conflict: string;
    call_to_action: string;
  };
  /** Tool preview CTA (glyph/match/syncro) */
  guide?: string;
  /** Match: Person A interpretation */
  narrative_a?: string;
  /** Match: Person B interpretation */
  narrative_b?: string;
};

function localeToUserLanguage(locale: string): string {
  const base = locale.split("-")[0]?.toLowerCase() ?? "en";
  if (["en", "zh", "de", "es", "fr"].includes(base)) return base;
  return "en";
}

function strengthLabel(strength: ProfileStrength, locale: string): string {
  if (locale.startsWith("zh")) {
    if (strength === "strong") return "身旺";
    if (strength === "weak") return "身弱";
    return "中和";
  }
  if (strength === "strong") return "Strong";
  if (strength === "weak") return "Weak";
  return "Balanced";
}

function extractClashes(chart?: GetBaziChartOutput): string[] {
  const xc = chart?.八字?.刑冲合会 as { 天干?: string[]; 地支?: string[] } | undefined;
  const out: string[] = [];
  if (xc?.天干?.length) out.push(...xc.天干.map(String));
  if (xc?.地支?.length) out.push(...xc.地支.map(String));
  return out;
}

export function buildMatrixNarrativeInput(
  payload: PojuMatrixPayload,
  chart: GetBaziChartOutput | undefined,
  locale: string,
): MatrixNarrativeInput {
  const { structured, wuxing_scores, strength, day_master_en } = payload;
  const sorted = [...wuxing_scores].sort((a, b) => b.pct - a.pct);
  const dominant = sorted[0];
  const deficit = sorted[sorted.length - 1];
  const dmStem = structured.pillars_detail?.day.stem ?? structured.day_master.charAt(0);
  const dmInfo = getStemInfo(dmStem);
  const dmHan = dmInfo?.han ?? dmStem;

  const chartStatus = `${strengthLabel(strength, locale)} / ${dominant?.element ?? "—"} Surplus (${dominant?.pct ?? 0}%) / ${deficit?.element ?? "—"} Deficit (${deficit?.pct ?? 0}%)`;

  const transitYear = payload.display?.annual_transit.year ?? new Date().getFullYear();
  const transitGz = payload.display?.annual_transit.ganzhi ?? "—";
  const transitStem = payload.display?.annual_transit.stem_en ?? "—";

  const yongshen =
    structured.bazi_enrichment?.yongshen_analysis.elements_en ??
    structured.bazi_enrichment?.yongshen_analysis.elements_han?.map(String) ??
    [];

  const birth = payload.user_profile.birth;
  const pad = (n: number) => String(n).padStart(2, "0");
  const birthDate = `${birth.year}-${pad(birth.month)}-${pad(birth.day)}`;

  const liunian = getCurrentLiunian();
  const directedRelations = computeDirectedDynamicRelations(structured, liunian, null);
  const liunianRelations = (
    directedRelations.length > 0
      ? directedRelations
      : computeLiunianRelations(structured, liunian)
  ).map((r) => r.han);

  return {
    user_language: localeToUserLanguage(locale),
    birth_date: birthDate,
    day_master: `${day_master_en} (${dmHan})`,
    chart_status: chartStatus,
    clashes_tensions: extractClashes(chart),
    liunian_relations: liunianRelations,
    current_year_transit: `${transitYear} · ${transitGz} (${transitStem}) · 流年引动: ${
      liunianRelations.length ? liunianRelations.join("；") : "（引擎未算出 — 勿编造关系词）"
    }`,
    yongshen,
    gender_label: structured.bazi_enrichment?.gender_label,
    strength,
  };
}

export function buildMatrixNarrativeUserMessage(
  input: MatrixNarrativeInput,
  opts?: { inputB?: MatrixNarrativeInput; product?: MatrixNarrativeProduct },
): string {
  if (opts?.product === "match" && opts.inputB) {
    const lang = input.user_language;
    const localeHint = lang === "zh" ? "zh" : lang === "de" ? "de" : lang === "es" ? "es" : lang === "fr" ? "fr" : "en";
    return JSON.stringify(
      {
        product: "match",
        person_a: { label: matchUserDisplayLabel("A", localeHint), ...input },
        person_b: { label: matchUserDisplayLabel("B", localeHint), ...opts.inputB },
      },
      null,
      2,
    );
  }
  if (opts?.product && opts.product !== "poju") {
    return JSON.stringify({ product: opts.product, ...input }, null, 2);
  }
  return JSON.stringify(input, null, 2);
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`Missing or invalid field: ${key}`);
  }
  return v.trim();
}

const FIELD_MAX_CHARS: Record<string, number> = {
  "elemental_breakdown.caption": 360,
  "structural_dynamics.resonance": 320,
  "structural_dynamics.tension": 320,
  "structural_dynamics.reading": 320,
  "annual_transit_2026.title": 48,
  "annual_transit_2026.description": 520,
  "poju_onboarding.archetype_intro": 420,
  "poju_onboarding.core_conflict": 420,
  "poju_onboarding.call_to_action": 480,
  guide: 200,
  narrative_a: 520,
  narrative_b: 520,
};

function clampNarrativeField(text: string, fieldKey: string): string {
  const max = FIELD_MAX_CHARS[fieldKey];
  if (!max || text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastStop = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("。"), slice.lastIndexOf("!"), slice.lastIndexOf("！"), slice.lastIndexOf("?"), slice.lastIndexOf("？"));
  if (lastStop > max * 0.55) return slice.slice(0, lastStop + 1).trim();
  return slice.trimEnd() + "…";
}

function stripModelReasoningArtifacts(text: string): string {
  return text
    .replace(/[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, "")
    .trim();
}

function extractJsonObjectSubstring(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function unwrapMatrixNarrativeJson(text: string): string {
  let raw = stripModelReasoningArtifacts(text);
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) raw = fence[1].trim();
  const start = raw.indexOf("{");
  if (start > 0) raw = raw.slice(start);
  return raw;
}

function matrixNarrativeJsonCandidates(text: string): string[] {
  const cleaned = stripModelReasoningArtifacts(text);
  const unwrapped = unwrapMatrixNarrativeJson(cleaned);
  const candidates = [
    cleaned,
    unwrapped,
    salvageTruncatedMatrixNarrativeJson(cleaned),
    salvageTruncatedMatrixNarrativeJson(unwrapped),
    extractJsonObjectSubstring(cleaned) ?? "",
    extractJsonObjectSubstring(unwrapped) ?? "",
  ].filter((s) => s.length > 0);
  return [...new Set(candidates)];
}

/** Close truncated model JSON so partial matrix-narrative payloads can still parse. */
function salvageTruncatedMatrixNarrativeJson(raw: string): string {
  let text = unwrapMatrixNarrativeJson(raw);
  if (!text.startsWith("{")) return text;

  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
  }
  if (inString) text += '"';

  text = text.replace(/,\s*"[^"\\]*(?:\\.[^"\\]*)*"\s*:\s*$/, "");
  text = text.replace(/,\s*"[^"\\]*$/, "");
  text = text.replace(/,\s*$/, "");

  let braces = 0;
  let brackets = 0;
  inString = false;
  escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }

  while (brackets > 0) {
    text += "]";
    brackets--;
  }
  while (braces > 0) {
    text += "}";
    braces--;
  }

  return text;
}

function parseMatrixNarrativeJson(text: string): Record<string, unknown> {
  let lastError: unknown;
  for (const candidate of matrixNarrativeJsonCandidates(text)) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Model output is not valid JSON");
}

export function parseMatrixNarrativeResponseText(
  text: string,
  product: MatrixNarrativeProduct = "poju",
): MatrixNarrativeResponse {
  const parsed = parseMatrixNarrativeJson(text);
  const eb = parsed.elemental_breakdown as Record<string, unknown> | undefined;
  const sd = parsed.structural_dynamics as Record<string, unknown> | undefined;
  const at = parsed.annual_transit_2026 as Record<string, unknown> | undefined;
  const po = parsed.poju_onboarding as Record<string, unknown> | undefined;

  if (!eb || !sd || !at || !po) {
    throw new Error("Response missing required top-level sections");
  }

  const optionalString = (obj: Record<string, unknown>, key: string): string | undefined => {
    const v = obj[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };

  const guideRaw = optionalString(parsed, "guide");
  const guide = guideRaw ? clampNarrativeField(guideRaw, "guide") : undefined;
  const narrative_aRaw = optionalString(parsed, "narrative_a");
  const narrative_bRaw = optionalString(parsed, "narrative_b");
  const narrative_a = narrative_aRaw ? clampNarrativeField(narrative_aRaw, "narrative_a") : undefined;
  const narrative_b = narrative_bRaw ? clampNarrativeField(narrative_bRaw, "narrative_b") : undefined;
  const callToActionRaw = optionalString(po, "call_to_action");

  if (product === "match" && (!narrative_a || !narrative_b)) {
    throw new Error("Match narrative requires narrative_a and narrative_b");
  }
  if (
    product === "match" &&
    narrative_a &&
    narrative_b &&
    narrative_a.replace(/\s+/g, "") === narrative_b.replace(/\s+/g, "")
  ) {
    throw new Error("Match narrative_a and narrative_b must not be identical");
  }
  if (product !== "poju" && !guide && !callToActionRaw) {
    throw new Error("Tool narrative requires guide or call_to_action");
  }

  const archetypeIntro =
    product === "match"
      ? (optionalString(po, "archetype_intro") ?? narrative_a ?? "")
      : requireString(po, "archetype_intro");
  const coreConflict =
    product === "match"
      ? (optionalString(po, "core_conflict") ?? narrative_b ?? "")
      : requireString(po, "core_conflict");

  return {
    elemental_breakdown: {
      caption: clampNarrativeField(requireString(eb, "caption"), "elemental_breakdown.caption"),
    },
    structural_dynamics: {
      resonance: clampNarrativeField(requireString(sd, "resonance"), "structural_dynamics.resonance"),
      tension: clampNarrativeField(requireString(sd, "tension"), "structural_dynamics.tension"),
      reading: clampNarrativeField(requireString(sd, "reading"), "structural_dynamics.reading"),
    },
    annual_transit_2026: {
      title: clampNarrativeField(requireString(at, "title"), "annual_transit_2026.title"),
      description: clampNarrativeField(requireString(at, "description"), "annual_transit_2026.description"),
    },
    poju_onboarding: {
      archetype_intro: clampNarrativeField(archetypeIntro, "poju_onboarding.archetype_intro"),
      core_conflict: clampNarrativeField(coreConflict, "poju_onboarding.core_conflict"),
      call_to_action: clampNarrativeField(
        guide ?? callToActionRaw ?? "",
        "poju_onboarding.call_to_action",
      ),
    },
    guide,
    narrative_a,
    narrative_b,
  };
}
