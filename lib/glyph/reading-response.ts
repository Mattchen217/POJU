import type { FullReading } from "@/types/oracle";

export const GLYPH_SAFETY_FALLBACK: FullReading = {
  wind_category_blurb:
    "I see weight in this question - more than the words can hold. Before we look at the glyph, I want to make sure you're safe right now.",
  classical_voice:
    "The Oracle was made for sincere questions about life direction. What you're carrying might need something more immediate than this conversation can offer.",
  meaning_for_question:
    "You don't have to face this alone. People trained to listen - really listen - are available right now.",
  hidden_tension: "Immediate safety support matters more than interpretation right now.",
  your_moment: "Please pause and reach out now. You do not need to carry this alone.",
  exploration: {
    text: "If possible, text one trusted person right now with: I need support tonight. Then contact a local helpline.",
    timeframe: "today",
    duration_estimate: "5 minutes",
    is_solo: false,
  },
  reflection_question: "Who can help you stay safe in the next hour?",
};

const DANGER_KEYWORDS_EN = [
  "suicide",
  "kill myself",
  "end it all",
  "want to die",
  "hurt myself",
  "self-harm",
  "self harm",
  "cutting",
  "kill her",
  "kill him",
  "kill them",
  "hurt someone",
  "attack",
  "revenge against",
  "steal",
  "illegal drugs",
  "fraud",
  "hack into",
];

const DANGER_KEYWORDS_ZH = ["自杀", "想死", "不想活", "伤害自己", "杀她", "杀他", "报复", "盗窃", "违法"];

export function detectDangerousGlyphQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  return [
    ...DANGER_KEYWORDS_EN.map((k) => lower.includes(k)),
    ...DANGER_KEYWORDS_ZH.map((k) => question.includes(k)),
  ].some(Boolean);
}

export function createInvalidInputReading(question: string, locale: string): FullReading {
  const q = question.trim() || "(empty input)";
  const message =
    locale === "zh"
      ? `我收到了你的输入「${q}」，但目前无法识别为一个可解读的真实问题。请用一两句话清楚描述你当下真实的处境与困惑后再试。`
      : `I received your input "${q}", but I cannot parse it as a real, interpretable life question. Please rewrite it in one or two clear sentences about your actual situation and dilemma, then try again.`;
  return {
    wind_category_blurb: message,
    classical_voice: "",
    meaning_for_question: "",
    hidden_tension: "",
    your_moment: "",
    exploration: { text: "", timeframe: "today", duration_estimate: "5 minutes", is_solo: true },
    reflection_question: "",
    invalid_input: true,
  };
}

export function isInvalidInputStyleReading(r: Record<string, unknown>): boolean {
  const all = `${String(r.wind_category_blurb ?? "")}\n${String(r.meaning_for_question ?? "")}\n${String(r.classical_voice ?? "")}`.toLowerCase();
  return (
    all.includes("cannot understand the question you entered") ||
    all.includes("please re-enter your question") ||
    all.includes("please enter a real question") ||
    all.includes("无法理解") ||
    all.includes("请输入真实问题")
  );
}

/** Map legacy JSON keys (situation/meaning/wisdom/actions) into current UI schema. */
export function normalizeLegacyReadingShape(raw: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = { ...raw };
  if (typeof o.wind_category_blurb !== "string" || !String(o.wind_category_blurb).trim()) {
    if (typeof o.situation === "string" && o.situation.trim()) o.wind_category_blurb = o.situation;
  }
  if (typeof o.classical_voice !== "string" || !String(o.classical_voice).trim()) {
    if (typeof o.wisdom === "string" && o.wisdom.trim()) o.classical_voice = o.wisdom;
  }
  if (typeof o.meaning_for_question !== "string" || !String(o.meaning_for_question).trim()) {
    if (typeof o.synthesis === "string" && o.synthesis.trim()) o.meaning_for_question = o.synthesis;
    else if (typeof o.meaning === "string" && o.meaning.trim()) o.meaning_for_question = o.meaning;
  }
  if (typeof o.synthesis !== "string" || !String(o.synthesis).trim()) {
    if (typeof o.meaning_for_question === "string" && o.meaning_for_question.trim()) {
      o.synthesis = o.meaning_for_question;
    }
  }
  const actions = Array.isArray(o.actions) ? o.actions.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
  if (typeof o.hidden_tension !== "string" || !String(o.hidden_tension).trim()) {
    if (actions[1]) o.hidden_tension = actions[1];
    else if (actions[0]) o.hidden_tension = actions[0];
    else if (typeof o.meaning_for_question === "string" && o.meaning_for_question.trim()) {
      o.hidden_tension =
        "The pressure in your question is real; hold it without forcing a single clean story yet.";
    }
  }
  if (typeof o.your_moment !== "string" || !String(o.your_moment).trim()) {
    if (actions[0]) o.your_moment = actions[0];
    else if (typeof o.revisit_timing === "string" && o.revisit_timing.trim()) o.your_moment = o.revisit_timing;
    else if (typeof o.wind_category_blurb === "string" && o.wind_category_blurb.trim()) {
      o.your_moment = "Stay with one small next step rather than solving the whole horizon today.";
    }
  }
  if (typeof o.reflection_question !== "string" || !String(o.reflection_question).trim()) {
    const refs = Array.isArray(o.reflections) ? o.reflections : [];
    if (refs.length > 0) o.reflection_question = String(refs[0] ?? "").trim();
    else if (typeof o.revisit_timing === "string" && o.revisit_timing.trim()) {
      o.reflection_question = "What would you want to remember about how you felt at the end of this reading?";
    }
  }
  const explorationTextFallback =
    (actions[2] as string | undefined) ||
    (actions[1] as string | undefined) ||
    (actions[0] as string | undefined) ||
    (typeof o.revisit_timing === "string" ? o.revisit_timing : "");
  if (!o.exploration || typeof o.exploration !== "object" || o.exploration === null) {
    if (explorationTextFallback) {
      o.exploration = {
        text: explorationTextFallback,
        timeframe: "today",
        duration_estimate: "5 minutes",
        is_solo: true,
      };
    }
  } else {
    const ex = o.exploration as Record<string, unknown>;
    if (!String(ex.text ?? "").trim() && explorationTextFallback) {
      ex.text = explorationTextFallback;
      if (!ex.timeframe) ex.timeframe = "today";
      if (!ex.duration_estimate) ex.duration_estimate = "5 minutes";
      if (typeof ex.is_solo !== "boolean") ex.is_solo = true;
      o.exploration = ex;
    }
  }
  return o;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return "";
}

/** Glyph v5 JSON — legacy keys, English aliases, dual-view field mapping. */
export function normalizeGlyphReadingShape(raw: Record<string, unknown>): Record<string, unknown> {
  const o = normalizeLegacyReadingShape(raw);

  let dual = asRecord(o.命理双视角);
  if (!dual) {
    dual =
      asRecord(o.dual_view) ??
      asRecord(o.dualView) ??
      asRecord(o.dual_perspective) ??
      asRecord(o.bazi_glyph_dual_view);
    if (dual) o.命理双视角 = dual;
  }

  dual = asRecord(o.命理双视角);
  if (dual) {
    o.命理双视角 = {
      ...dual,
      命理看此事: pickString(
        dual.命理看此事,
        dual["命理看此事"],
        dual.bazi_view,
        dual.from_bazi,
        dual.chart_view,
        dual.personality_view,
      ),
      签文看此事: pickString(
        dual.签文看此事,
        dual["签文看此事"],
        dual.glyph_view,
        dual.sign_view,
        dual.from_glyph,
        dual.from_sign,
      ),
      两者印证或冲突: pickString(
        dual.两者印证或冲突,
        dual["两者印证或冲突"],
        dual.resonance,
        dual.synthesis,
        dual.conflict,
        dual.alignment,
      ),
    };
  }

  return o;
}

export function validateAndFinalizeReading(
  reading: Record<string, unknown>,
  opts: { question: string; locale: string },
): FullReading {
  let r = normalizeLegacyReadingShape(reading) as unknown as FullReading & { invalid_input?: boolean };

  if (isInvalidInputStyleReading(r as unknown as Record<string, unknown>)) {
    r = createInvalidInputReading(opts.question, opts.locale);
  }

  if (
    !r.wind_category_blurb ||
    (!r.invalid_input &&
      (!r.classical_voice ||
        !r.meaning_for_question ||
        !r.hidden_tension ||
        !r.your_moment ||
        !r.exploration?.text ||
        !r.reflection_question))
  ) {
    throw new Error("LLM response missing required fields");
  }

  if (!r.invalid_input) {
    const tf = r.exploration?.timeframe;
    if (tf !== "today" && tf !== "tonight" && tf !== "within_24h" && tf !== "this_week") {
      r.exploration = { ...r.exploration, timeframe: "today" };
    }
    r.exploration = {
      text: r.exploration?.text ?? "",
      timeframe: r.exploration?.timeframe ?? "today",
      duration_estimate: r.exploration?.duration_estimate ?? "5 minutes",
      is_solo: r.exploration?.is_solo ?? true,
    };
  }

  return r;
}

export function formatReadingApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}
