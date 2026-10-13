/**
 * Match → Pivot：本地合盘短摘要（非 Match 长报告）。
 * Stage-1 收对方盘后写入 session，供一阶段续跑 / Stage2–3 / 交付条件喂料。
 * 另含：二元收盘门固定文案 / 二选一 action / 轻量辅助检测。
 */

import {
  calculateCompatibilityMatrix,
  type ResonanceMatrix,
  type SynergyType,
} from "@/lib/match/calculate-compatibility";
import {
  extractMatchRelationMechanismAnchors,
  formatRelationMechanismAnchorsForPrompt,
} from "@/lib/llm/prompts/match-relation-mechanism-anchors";
import { deliveryLocaleBucket } from "@/lib/llm/pro/delivery/delivery-locale";
import {
  formatDyadMatrixPackForPrompt,
  type DyadMatrixPack,
} from "@/lib/poju/dyad-matrix-pack";
import type { PivotChartPath } from "@/lib/poju/pivot-chart-path";

export type DyadOfferStatus = "none" | "offered" | "skipped" | "collected";

export type PartnerBaziPresence = "absent" | "present";

export type DyadGateAction = "collect_partner_bazi" | "skip_partner_bazi";

/** System continue after skip/collect — agent treats as system turn (no user bubble). */
export const DYAD_CONTINUE_SYSTEM = "[SYSTEM: dyad_continue]";

/** Fixed short block — keep small for prefix-cache stability. */
export type DyadCompatSummary = {
  partner_bazi: PartnerBaziPresence;
  synergy_type: SynergyType;
  resonance_index: number;
  a_label: string;
  b_label: string;
  strength_keys: string[];
  challenge_keys: string[];
  /** Optional day-master interaction type id from matrix (no prose). */
  day_master_type?: string;
  computed_at: string;
};

export type BuildDyadCompatSummaryInput = {
  profileA: unknown;
  profileB: unknown;
  /** Defaults to now ISO. */
  computed_at?: string;
};

const MAX_KEYS = 4;

function clipKeys(keys: string[], max = MAX_KEYS): string[] {
  return keys.filter((k) => typeof k === "string" && k.trim()).slice(0, max);
}

/**
 * Run Match local matrix and compress to Pivot-safe summary.
 * Does not call Match LLM / does not build full report.
 */
export function buildDyadCompatSummary(
  input: BuildDyadCompatSummaryInput,
): DyadCompatSummary {
  const matrix = calculateCompatibilityMatrix({
    profileA: input.profileA,
    profileB: input.profileB,
  });
  return compressResonanceMatrix(matrix, input.computed_at);
}

export function compressResonanceMatrix(
  matrix: ResonanceMatrix,
  computed_at?: string,
): DyadCompatSummary {
  return {
    partner_bazi: "present",
    synergy_type: matrix.synergy_type,
    resonance_index: matrix.resonance_index,
    a_label: matrix._meta.a_summary,
    b_label: matrix._meta.b_summary,
    strength_keys: clipKeys(matrix.key_insights.strengths),
    challenge_keys: clipKeys(matrix.key_insights.challenges),
    day_master_type: matrix.day_master_interaction?.type,
    computed_at: computed_at ?? new Date().toISOString(),
  };
}

/** Patch when user skips partner birth. */
export function dyadSkipPatch(): {
  dyad_offer_status: DyadOfferStatus;
  partner_bazi: PartnerBaziPresence;
  dyad_compat_summary: null;
  partner_profile_id: null;
  dyad_matrix_pack: null;
  pivot_chart_path: "solo";
  charts_locked_at: string;
} {
  return {
    dyad_offer_status: "skipped",
    partner_bazi: "absent",
    dyad_compat_summary: null,
    partner_profile_id: null,
    dyad_matrix_pack: null,
    pivot_chart_path: "solo",
    charts_locked_at: new Date().toISOString(),
  };
}

/** Patch when partner profile collected + summary + matrix pack built. */
export function dyadCollectedPatch(input: {
  partner_profile_id: string;
  summary: DyadCompatSummary;
  matrix_pack: import("./dyad-matrix-pack").DyadMatrixPack;
}): {
  dyad_offer_status: DyadOfferStatus;
  partner_bazi: PartnerBaziPresence;
  partner_profile_id: string;
  dyad_compat_summary: DyadCompatSummary;
  dyad_matrix_pack: import("./dyad-matrix-pack").DyadMatrixPack;
  pivot_chart_path: "dyad";
  charts_locked_at: string;
} {
  return {
    dyad_offer_status: "collected",
    partner_bazi: "present",
    partner_profile_id: input.partner_profile_id,
    dyad_compat_summary: {
      ...input.summary,
      partner_bazi: "present",
    },
    dyad_matrix_pack: input.matrix_pack,
    pivot_chart_path: "dyad",
    charts_locked_at: new Date().toISOString(),
  };
}

/** Should Stage-1 show the collect/skip gate once? */
export function shouldOfferDyadGate(status: DyadOfferStatus | undefined | null): boolean {
  return status == null || status === "none";
}

type DyadLang = "zh" | "en" | "es" | "fr" | "de";

function dyadLang(locale: string): DyadLang {
  return deliveryLocaleBucket(locale);
}

const GATE_COPY: Record<DyadLang, string> = {
  zh: "你的问题涉及与另一个人的关系（二元议题）。若方便补充对方的出生信息，我们能把两人关系里的边界与节奏校准得更贴你的期望，后续交付也会更聚焦你要的结果。不想或暂时无法提供也完全没问题——我们仍会基于你本人的信息，围绕你的期望给出完整交付。",
  en: "Your question involves a relationship with another person. If you can share their birth details, we can better calibrate the boundaries and pacing in that relationship around your goal, and keep the deliverable focused on what you want. If you prefer not to—or can’t right now—that’s fine. We’ll still work from your information and aim at your desired outcome.",
  es: "Tu pregunta implica una relación con otra persona. Si puedes compartir sus datos de nacimiento, podremos calibrar mejor los límites y el ritmo de esa relación en torno a tu objetivo, y centrar la entrega en lo que quieres. Si prefieres no hacerlo—o no puedes ahora—está bien. Seguiremos con tu información y tu resultado deseado.",
  fr: "Votre question implique une relation avec une autre personne. Si vous pouvez indiquer ses informations de naissance, nous pourrons mieux calibrer les limites et le rythme de cette relation autour de votre objectif, et recentrer la livraison sur ce que vous voulez. Si vous préférez ne pas le faire—ou ne pouvez pas maintenant—ce n’est pas un problème. Nous continuerons avec vos informations et votre résultat souhaité.",
  de: "Ihre Frage betrifft eine Beziehung zu einer anderen Person. Wenn Sie deren Geburtsdaten angeben können, können wir Grenzen und Tempo in dieser Beziehung besser an Ihr Ziel kalibrieren und die Lieferung darauf ausrichten. Wenn Sie das nicht möchten—oder jetzt nicht können—ist das in Ordnung. Wir arbeiten weiter mit Ihren Angaben und Ihrem gewünschten Ergebnis.",
};

const ACTION_LABELS: Record<DyadLang, Record<DyadGateAction, string>> = {
  zh: {
    collect_partner_bazi: "输入对方基础信息",
    skip_partner_bazi: "暂时不输入对方基础信息",
  },
  en: {
    collect_partner_bazi: "Enter their birth details",
    skip_partner_bazi: "Skip for now",
  },
  es: {
    collect_partner_bazi: "Introducir sus datos de nacimiento",
    skip_partner_bazi: "Omitir por ahora",
  },
  fr: {
    collect_partner_bazi: "Saisir leurs informations de naissance",
    skip_partner_bazi: "Passer pour l’instant",
  },
  de: {
    collect_partner_bazi: "Geburtsdaten der anderen Person eingeben",
    skip_partner_bazi: "Vorerst überspringen",
  },
};

export function dyadGateFixedCopy(locale: string): string {
  return GATE_COPY[dyadLang(locale)];
}

export function dyadGateActionLabels(locale: string): [string, string] {
  const pack = ACTION_LABELS[dyadLang(locale)];
  return [pack.collect_partner_bazi, pack.skip_partner_bazi];
}

/** Map chip text → action id (locale-aware). */
export function matchDyadGateAction(
  optionText: string,
  locale: string,
): DyadGateAction | null {
  const t = optionText.trim();
  if (!t) return null;
  for (const lang of Object.keys(ACTION_LABELS) as DyadLang[]) {
    const pack = ACTION_LABELS[lang];
    if (t === pack.collect_partner_bazi) return "collect_partner_bazi";
    if (t === pack.skip_partner_bazi) return "skip_partner_bazi";
  }
  // Also accept current locale only (redundant but cheap).
  const pack = ACTION_LABELS[dyadLang(locale)];
  if (t === pack.collect_partner_bazi) return "collect_partner_bazi";
  if (t === pack.skip_partner_bazi) return "skip_partner_bazi";
  return null;
}

/**
 * Light assist — does NOT sole-decide. Looks for a concrete second person + relational stake.
 */
export function heuristicDyadSpecificOther(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 8) return false;
  // Generic interpersonal without a specific other → no.
  if (
    /什么样的人|找什么样|和谁合作|what kind of (person|partner)|qué tipo de/i.test(t) &&
    !/(他|她|女友|男友|老婆|老公|伴侣|前任|老板|合伙人|同学|女朋友|男朋友|wife|husband|girlfriend|boyfriend|partner|boss|ex\b)/i.test(
      t,
    )
  ) {
    return false;
  }
  const hasSpecificOther =
    /(女友|男友|女朋友|男朋友|老婆|老公|妻子|丈夫|伴侣|前任|对象|老板|合伙人|同事|同学|朋友|她|他|girlfriend|boyfriend|wife|husband|partner|spouse|boss|coworker|colleague|ex[- ]?(boyfriend|girlfriend|wife|husband)?)/i.test(
      t,
    );
  const hasRelationalStake =
    /(结婚|领证|离婚|分手|复合|相处|关系|身份|宽限期|合伙|半薪|股权|要不要|该不该|合不合|marry|marriage|divorce|break.?up|relationship|visa|partner(ship)?|equity)/i.test(
      t,
    );
  return hasSpecificOther && hasRelationalStake;
}

/** Model flag OR (assist AND model not explicitly false). */
export function resolveDyadSpecificOther(input: {
  modelFlag?: boolean | null;
  userText?: string;
}): boolean {
  if (input.modelFlag === true) return true;
  if (input.modelFlag === false) return false;
  return heuristicDyadSpecificOther(input.userText ?? "");
}

/** Short-circuit free reply → fixed copy + two actions. */
export function buildDyadGateTurn(locale: string): {
  response: string;
  options: [string, string];
  dyad_offer_status: "offered";
} {
  return {
    response: dyadGateFixedCopy(locale),
    options: dyadGateActionLabels(locale),
    dyad_offer_status: "offered",
  };
}

/** True when session has an explicit dyad gate outcome (skip or collect). */
export function hasSessionDyadSignal(input: {
  partner_bazi?: PartnerBaziPresence | null;
  dyad_compat_summary?: DyadCompatSummary | null;
}): boolean {
  return input.partner_bazi != null || input.dyad_compat_summary != null;
}

/**
 * Delivery page-feed block (`dyad_relation_structure`).
 * Empty when the session never hit the Stage-1 dyad gate.
 * Dyad path: short summary + matrix pack slice (not Match chapter wall).
 */
export function resolveDyadRelationStructureFeed(input: {
  partner_bazi?: PartnerBaziPresence | null;
  dyad_compat_summary?: DyadCompatSummary | null;
  pivot_chart_path?: PivotChartPath | null;
  dyad_matrix_pack?: DyadMatrixPack | null;
}): string {
  if (!hasSessionDyadSignal(input) && input.pivot_chart_path !== "dyad") return "";
  const summaryBlock = formatDyadCompatForPrompt(input.dyad_compat_summary ?? null, {
    partner_bazi: input.partner_bazi ?? input.dyad_compat_summary?.partner_bazi,
  });
  if (
    (input.pivot_chart_path === "dyad" || input.partner_bazi === "present") &&
    input.dyad_matrix_pack
  ) {
    // Delivery / Companion: compact only — full matrix_json is Call A sized.
    const matrixBlock = formatDyadMatrixPackForPrompt(input.dyad_matrix_pack, {
      mode: "compact",
    });
    return [summaryBlock, matrixBlock].filter(Boolean).join("\n\n");
  }
  return summaryBlock;
}

/**
 * Companion Brief 轻量关系边界（单人流日不变；有 dyad 信号时一行栏杆）。
 * Empty when gate never hit.
 * path=dyad：可从 matrix pack 抽 1–2 条栏杆；仍不开双人流日。
 */
export function formatCompanionRelationBoundary(input: {
  partner_bazi?: PartnerBaziPresence | null;
  dyad_compat_summary?: DyadCompatSummary | null;
  pivot_chart_path?: PivotChartPath | null;
  dyad_matrix_pack?: DyadMatrixPack | null;
  locale?: string;
}): string {
  if (!hasSessionDyadSignal(input) && input.pivot_chart_path !== "dyad") return "";
  const zh = !input.locale || input.locale.startsWith("zh");
  const presence =
    input.partner_bazi ??
    input.dyad_compat_summary?.partner_bazi ??
    (input.dyad_compat_summary || input.pivot_chart_path === "dyad" ? "present" : "absent");
  if (presence === "absent" || (!input.dyad_compat_summary && input.pivot_chart_path !== "dyad")) {
    return zh
      ? "关系边界：本题涉二元议题但无对方盘——日提醒只钉你侧主辅栏杆与可观察现实；禁臆造对方命理。"
      : "Relation boundary: dyad topic without partner chart — daily cards stay on your rails + observed reality; never invent their chart.";
  }
  const s = input.dyad_compat_summary;
  const matrix = input.dyad_matrix_pack?.matrix;
  const railBits: string[] = [];
  if (s?.synergy_type) railBits.push(s.synergy_type);
  if (s) {
    const keys = [...s.strength_keys.slice(0, 1), ...s.challenge_keys.slice(0, 1)].filter(Boolean);
    if (keys.length) railBits.push(keys.join("/"));
  }
  if (matrix?.key_insights) {
    const strength = matrix.key_insights.strengths?.[0];
    const challenge = matrix.key_insights.challenges?.[0];
    if (strength) railBits.push(String(strength).slice(0, 24));
    if (challenge) railBits.push(String(challenge).slice(0, 24));
  }
  const rail = railBits.slice(0, 3).join(" · ");
  return zh
    ? `关系边界：有对方盘结构锚${rail ? `（${rail}）` : ""}——日提醒仍单人流日，只用锚校准你侧边界，不开合盘专章；三人及以上勿扩写。`
    : `Relation boundary: partner structure anchor${rail ? ` (${rail})` : ""} — single-person dailies; calibrate your rails only, no Match chapter; refuse 3+ party charts.`;
}

/**
 * Prompt block for Stage-1 / Stage2–3 / delivery.
 * Absent → hard note; present → short structure + mechanism anchors.
 */
export function formatDyadCompatForPrompt(
  summary: DyadCompatSummary | null | undefined,
  opts?: { partner_bazi?: PartnerBaziPresence },
): string {
  const presence =
    opts?.partner_bazi ??
    summary?.partner_bazi ??
    (summary ? "present" : "absent");

  if (presence === "absent" || !summary) {
    return [
      "## partner_bazi=absent",
      "仅当事人八字与用户自述中的对方角色/行为（若有）。",
      "禁止臆造对方命理、日主、大运或合盘分数。",
      "总纲不变：围绕用户期望给出可达方案。",
    ].join("\n");
  }

  const anchorSource = {
    synergy_type: summary.synergy_type,
    resonance_index: summary.resonance_index,
    strengths: summary.strength_keys,
    challenges: summary.challenge_keys,
  };
  const anchors = extractMatchRelationMechanismAnchors(anchorSource);

  return [
    "## partner_bazi=present",
    `A=${summary.a_label}`,
    `B=${summary.b_label}`,
    `synergy_type=${summary.synergy_type}`,
    `resonance_index=${summary.resonance_index}`,
    summary.day_master_type ? `day_master_type=${summary.day_master_type}` : "",
    summary.strength_keys.length
      ? `strength_keys=${summary.strength_keys.join(",")}`
      : "",
    summary.challenge_keys.length
      ? `challenge_keys=${summary.challenge_keys.join(",")}`
      : "",
    formatRelationMechanismAnchorsForPrompt(anchors),
    "用法：结构锚校准你侧边界/型人适配；禁止翻版合盘专章；总纲仍是期望达成。",
  ]
    .filter(Boolean)
    .join("\n");
}
