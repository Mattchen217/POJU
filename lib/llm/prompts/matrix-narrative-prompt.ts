import type { GetBaziChartOutput } from "shunshi-bazi-core";

import type { ProfileStrength } from "@/lib/calculations/build-profile-structured";
import { getStemInfo } from "@/lib/poju/bazi-matrix-mappings";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

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

# OUTPUT JSON SPECIFICATION
You must respond ONLY with a valid JSON matching this exact schema. Each string must be generated completely dynamically based on the input payload, serving as a replacement for old hardcoded fallback templates:

{
  "elemental_breakdown": {
    "caption": "[Replace static template. Generate a poetic yet behaviorally accurate 1-sentence description of their current elemental setup based on their Day Master, surplus, and deficits.]"
  },
  "structural_dynamics": {
    "resonance": "[Analyze the input heavenly stem interactions/clashes in 1 elegant sentence. Frame it as how their archetype anchors their conscious surface identity. Do not use raw technical code-speak.]",
    "tension": "[Analyze the input branch-layer combinations, clashes, or hidden harmonies in 1 sentence. Frame it as a workable psychological paradox or behavioral habit to build awareness around.]",
    "reading": "[Provide a tactical 1-sentence self-coaching behavioral directive on how they can consciously channel this systemic blueprint when navigating pressure.]"
  },
  "annual_transit_2026": {
    "title": "[The localized native name of the 2026 Element, e.g., 'Yang Fire / 丙午']",
    "description": "[A masterful 2-sentence macro-environmental analysis of how the 2026 transit energy interacts with their specific chart balance. Frame the year's elements as a changing seasonal climate inviting them to lean into specific alignment paths, entirely avoiding absolute event predictions.]"
  },
  "poju_onboarding": {
    "archetype_intro": "[A powerful 1-sentence psychological archetype introduction tailored to their Day Master and energetic state.]",
    "core_conflict": "[A 1-sentence description of their current internal elemental pull or deficit. Explain why they might feel an analytical or emotional tug-of-war right now in daily life.]",
    "call_to_action": "[A comforting, philosophical open-ended invitation asking them to share the current personal growth challenge, career alignment question, or decision they are weighing so you can unwrap perspectives together.]"
  }
}

Output raw minified or pretty JSON only. Do not wrap in markdown code blocks.`;

export type MatrixNarrativeInput = {
  user_language: string;
  day_master: string;
  chart_status: string;
  clashes_tensions: string[];
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

  return {
    user_language: localeToUserLanguage(locale),
    day_master: `${day_master_en} (${dmHan})`,
    chart_status: chartStatus,
    clashes_tensions: extractClashes(chart),
    current_year_transit: `${transitYear} · ${transitGz} (${transitStem})`,
    yongshen,
    gender_label: structured.bazi_enrichment?.gender_label,
    strength,
  };
}

export function buildMatrixNarrativeUserMessage(input: MatrixNarrativeInput): string {
  return JSON.stringify(input, null, 2);
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`Missing or invalid field: ${key}`);
  }
  return v.trim();
}

export function parseMatrixNarrativeResponseText(text: string): MatrixNarrativeResponse {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) raw = fence[1].trim();

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const eb = parsed.elemental_breakdown as Record<string, unknown> | undefined;
  const sd = parsed.structural_dynamics as Record<string, unknown> | undefined;
  const at = parsed.annual_transit_2026 as Record<string, unknown> | undefined;
  const po = parsed.poju_onboarding as Record<string, unknown> | undefined;

  if (!eb || !sd || !at || !po) {
    throw new Error("Response missing required top-level sections");
  }

  return {
    elemental_breakdown: {
      caption: requireString(eb, "caption"),
    },
    structural_dynamics: {
      resonance: requireString(sd, "resonance"),
      tension: requireString(sd, "tension"),
      reading: requireString(sd, "reading"),
    },
    annual_transit_2026: {
      title: requireString(at, "title"),
      description: requireString(at, "description"),
    },
    poju_onboarding: {
      archetype_intro: requireString(po, "archetype_intro"),
      core_conflict: requireString(po, "core_conflict"),
      call_to_action: requireString(po, "call_to_action"),
    },
  };
}
