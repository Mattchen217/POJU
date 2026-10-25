/**
 * Match → Pivot：本地合盘短摘要（非 Match 长报告）。
 * Stage-1 收对方盘后写入 session，供一阶段续跑 / Stage2–3 / 交付条件喂料。
 * 另含：二元收盘门固定文案 / 二选一 action / 轻量辅助检测。
 */

import {
  calculateCompatibilityMatrix,
  type ResonanceMatrix,
  type SynergyType,
} from "@/lib/compatibility/calculate-compatibility";
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

/**
 * Model-facing user cue for dyad continue.
 * `formatPhaseMessageHistory` strips `role:system`, so the LLM never saw DYAD_CONTINUE_SYSTEM —
 * only a weak “(Continue…)” stub. This cue is injected into the LLM session only (not persisted
 * as a user bubble) so opening actually resumes with path + partner structure.
 */
export function buildDyadContinueModelUserCue(input: {
  partner_bazi?: PartnerBaziPresence | null;
  pivot_chart_path?: PivotChartPath | null;
  locale?: string;
}): string {
  const zh = !input.locale || input.locale.startsWith("zh");
  const path = input.pivot_chart_path === "dyad" || input.pivot_chart_path === "solo"
    ? input.pivot_chart_path
    : input.partner_bazi === "present"
      ? "dyad"
      : input.partner_bazi === "absent"
        ? "solo"
        : "unset";
  const presence =
    input.partner_bazi === "present" || input.partner_bazi === "absent"
      ? input.partner_bazi
      : path === "dyad"
        ? "present"
        : path === "solo"
          ? "absent"
          : "unknown";

  if (zh) {
    return [
      "【系统续开·二元门已结案】",
      `path=${path} · partner_bazi=${presence}`,
      presence === "present"
        ? "对方出生信息已入库；任务块里有二元/合盘结构锚。请承接原问题继续澄清情况与主期望，可用结构锚轻校准边界，禁止再索要对方生辰，禁止合盘专章。"
        : "用户已跳过对方盘（path=solo · partner_bazi=absent）；禁止臆造对方命理，禁止再索要/暗示还在等对方生辰，禁止再出收集芯片。请承接原问题继续澄清情况与主期望；若三必填已齐则 understanding_sufficient=true 进入理解确认。",
      "若三必填已齐 → understanding_sufficient=true；仍缺则只问一个缺口。输出严格 JSON。",
    ].join("\n");
  }
  return [
    "[SYSTEM CONTINUE · dyad gate closed]",
    `path=${path} · partner_bazi=${presence}`,
    presence === "present"
      ? "Partner birth details are locked in; task block has dyad/structure anchors. Resume clarifying situation + desired outcome; light boundary calibration only — do not re-ask birth details; no Match chapter."
      : "User skipped partner chart (path=solo · partner_bazi=absent); do not invent their chart; do not re-ask birth details or imply we are still waiting for their chart; do not re-offer collect chips. Resume clarifying situation + desired outcome; if the three required fields are filled set understanding_sufficient=true for the confirm gate.",
    "If the three required fields are filled → understanding_sufficient=true; else ask only the one missing gap. Strict JSON only.",
  ].join("\n");
}

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

/**
 * Stage-1 dyad chips decision (S1-D-2).
 * Intentionally ignores understanding_sufficient: rich Case C prompts often
 * complete the three fields in one turn; the gate must still be offered before
 * awaiting_understanding_confirm, and NL "skip chart" must not bypass chips.
 */
export function shouldPresentDyadGate(input: {
  openingTurn: boolean;
  understandingGenerationFailed?: boolean;
  scopeSignal?: string | null;
  dyadOfferStatus?: DyadOfferStatus | null;
  dyadHit: boolean;
}): boolean {
  return (
    input.openingTurn &&
    !input.understandingGenerationFailed &&
    input.scopeSignal !== "out_of_scope" &&
    shouldOfferDyadGate(input.dyadOfferStatus) &&
    input.dyadHit
  );
}

/**
 * After dyad skip/collect: resume understanding confirm that was held for Stage-1 chips.
 * Only when the offer turn had already advanced to confirm (held flag) and fields remain complete.
 */
export function shouldResumeUnderstandingConfirmAfterDyad(input: {
  held?: boolean | null;
  dyadOfferStatus?: DyadOfferStatus | null;
  phase?: string | null;
  understandingComplete: boolean;
}): boolean {
  if (!input.held) return false;
  if (input.dyadOfferStatus !== "skipped" && input.dyadOfferStatus !== "collected") {
    return false;
  }
  if (input.phase !== "opening") return false;
  return input.understandingComplete;
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
 * Skip-path UX (#12): after Case C Skip, understanding confirm / chips must not
 * read as "still waiting for partner chart". Solo note is user-visible.
 */
export function shouldAnnotateUnderstandingWithSkipPath(input: {
  dyadOfferStatus?: DyadOfferStatus | null;
  partner_bazi?: PartnerBaziPresence | null;
  pivot_chart_path?: PivotChartPath | null;
}): boolean {
  if (input.dyadOfferStatus === "skipped") return true;
  // Skip patch always locks solo + absent together.
  return input.partner_bazi === "absent" && input.pivot_chart_path === "solo";
}

/** User-visible solo / skip-path line for understanding confirm (ZH/EN + locale bucket). */
export function dyadSkipPathUnderstandingNote(locale: string): string {
  const lang = deliveryLocaleBucket(locale);
  if (lang === "zh") {
    return "你已选择暂不提供对方盘——接下来我们按你本人的信息继续（solo 路径）。确认理解后不会再索要对方生辰，也不会再出现「输入对方信息」芯片。";
  }
  if (lang === "es") {
    return "Elegiste continuar sin su carta: seguiremos solo con tu información (ruta solo). Al confirmar no volveremos a pedir sus datos de nacimiento ni chips de recogida.";
  }
  if (lang === "fr") {
    return "Vous avez choisi de continuer sans leur thème : nous poursuivons avec vos seules informations (chemin solo). Après confirmation, plus de demande de naissance ni de puces de collecte.";
  }
  if (lang === "de") {
    return "Sie setzen ohne deren Chart fort — wir arbeiten nur mit Ihren Angaben (Solo-Pfad). Nach der Bestätigung fragen wir nicht erneut nach Geburtsdaten und zeigen keine Sammel-Chips.";
  }
  return "You've chosen to continue without their chart — we'll work from your information only (solo path). Confirming won't ask for their birth details again or re-offer collect chips.";
}

/** True when composer must not show collect/skip chips (path already locked). */
export function dyadGateChipsLocked(status: DyadOfferStatus | undefined | null): boolean {
  return status === "skipped" || status === "collected";
}


/**
 * Light assist — looks for a concrete second person + relational stake.
 * Case C: NL "skip chart / 先不填对方盘" counts as stake when a specific other is named
 * (otherwise rich EN prompts that omit "partnership/equity" can miss the gate).
 */
export function heuristicDyadSpecificOther(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 8) return false;
  // Generic interpersonal without a specific other → no.
  const namedOther =
    /(他|她|女友|男友|老婆|老公|伴侣|前任|老板|合伙人|联合创始人|同学|女朋友|男朋友|wife|husband|girlfriend|boyfriend|partner|boss|co[\s-]?founder|cofounder|ex\b)/i;
  if (
    /什么样的人|找什么样|和谁合作|what kind of (person|partner)|qué tipo de/i.test(t) &&
    !namedOther.test(t)
  ) {
    return false;
  }
  const hasSpecificOther =
    /(女友|男友|女朋友|男朋友|老婆|老公|妻子|丈夫|伴侣|前任|对象|老板|合伙人|联合创始人|同事|同学|朋友|她|他|girlfriend|boyfriend|wife|husband|partner|spouse|boss|co[\s-]?founder|cofounder|coworker|colleague|ex[- ]?(boyfriend|girlfriend|wife|husband)?)/i.test(
      t,
    );
  const hasRelationalStake =
    /(结婚|领证|离婚|分手|复合|相处|关系|身份|宽限期|合伙|半薪|股权|要不要|该不该|合不合|marry|married|marrying|marriage|divorce|break.?up|relationship|visa|partner(ship)?|equity|fundrais|fundraising|split|runway|\braise\b|seed(\s+round)?|break-?even|cadence)/i.test(
      t,
    );
  // Case C NL skip — user already framed a dyad topic but declines partner chart.
  // Allow "skip entering/providing/inputting his birth chart" and loose skip…chart
  // when a specific other is already named (hasSpecificOther AND below).
  const skipPartnerChart =
    /(skip\s+(?:(?:entering|providing|inputting|adding)\s+)?(?:(?:his|her|their|the\s+partner'?s?|partner)\s+)?(?:birth\s*)?(chart|details|info|data)|skip.{0,40}(?:birth\s*)?chart|don'?t\s+(enter|add|provide|input).{0,24}(birth|chart)|no\s+partner\s+(chart|bazi)|先不(填|提供|输入).{0,12}(对方|他|她).{0,8}(盘|八字|生辰)|暂时不(填|输入).{0,12}对方|不填对方)/i.test(
      t,
    );
  return hasSpecificOther && (hasRelationalStake || skipPartnerChart);
}

/**
 * Dyad hit for Stage-1 gate (S1-D-2 / Case C).
 * Model `true` forces the gate. Model `false` must NOT veto a strong heuristic hit —
 * rich partnership prompts often mis-label as personal-only / "skip chart" and would
 * otherwise jump to understanding with path still unset.
 * Generic interpersonal ("what kind of partner") stays false via heuristic.
 */
export function resolveDyadSpecificOther(input: {
  modelFlag?: boolean | null;
  userText?: string;
  /** Extra scan text (e.g. original_question) when the latest user line is short. */
  assistText?: string;
}): boolean {
  if (input.modelFlag === true) return true;
  const blob = [input.userText, input.assistText]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join("\n");
  return heuristicDyadSpecificOther(blob);
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
