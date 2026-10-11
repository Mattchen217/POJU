/**
 * Companion daily prompt — liuri × P1 primary/backup strategic rails (macro).
 * Output language = site locale; native-speaker / high-school bar (delivery-aligned).
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";

import { buildCompanionEnergyDigest } from "./energy-digest";
import {
  companionNativeVoiceBlock,
  companionOutputLanguageLabel,
  companionTranslatorPersona,
  normalizeCompanionLocale,
  type CompanionLocale,
} from "./locale-voice";
import type { CompanionBrief } from "./types";

function claimLead(claim: string, max = 480): string {
  const t = claim.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function windowSuggestionHard(
  phase: "early" | "mid" | "late",
  locale: CompanionLocale,
): string {
  if (locale === "zh") {
    if (phase === "mid") {
      return "硬要求（suggestion）：本日记属陪伴窗**中段**——suggestion 必须点明「检验前段边界是否还站得住」或等价意思；禁止只写通用分线句、无视中段职责。";
    }
    if (phase === "late") {
      return "硬要求（suggestion）：本日记属陪伴窗**后段**——suggestion 必须点明收束/复盘或忌倒计时绑架；禁止只写前段「先立边界」腔。";
    }
    return "硬要求（suggestion）：本日记属陪伴窗**前段**——suggestion 宜强调先立边界与分线，少做窗末终局选择。";
  }
  if (locale === "es") {
    if (phase === "mid") {
      return "Obligatorio (suggestion): ventana media — debes nombrar comprobar si los límites tempranos aún aguantan; prohibido consejo genérico que ignore el tramo medio.";
    }
    if (phase === "late") {
      return "Obligatorio (suggestion): ventana tardía — nombrar cerrar/revisar o evitar pánico de cuenta regresiva; prohibido tono de «solo poner límites» del tramo inicial.";
    }
    return "Obligatorio (suggestion): ventana temprana — poner límites y separar hilos; evitar decisiones finales de fin de ventana.";
  }
  if (locale === "fr") {
    if (phase === "mid") {
      return "Exigence (suggestion) : milieu de fenêtre — nommer le test des limites du début ; interdit conseil générique qui ignore le milieu.";
    }
    if (phase === "late") {
      return "Exigence (suggestion) : fin de fenêtre — nommer resserrer/revoir ou éviter la panique compte à rebours ; interdit ton « juste poser des limites » du début.";
    }
    return "Exigence (suggestion) : début de fenêtre — poser limites et séparer les fils ; éviter les décisions finales de fin de fenêtre.";
  }
  if (phase === "mid") {
    return "Hard (suggestion): mid window — must name testing whether early boundaries still hold; ban generic thread-sorting that ignores mid duty.";
  }
  if (phase === "late") {
    return "Hard (suggestion): late window — must name consolidate/review or ban end-window panic calls; ban early-window \"just set boundaries\" tone.";
  }
  return "Hard (suggestion): early window — favor setting boundaries and separating threads; avoid end-window final calls.";
}

function priorBlock(priors: string[], locale: CompanionLocale): string {
  if (!priors.length) return "";
  const lines = priors.map((p, i) => `${i + 1}. ${p}`).join("\n");
  if (locale === "zh") {
    return `\n邻日 today_is 指纹（禁止复用句式/骨架；须写出本差分的心智侧重）：\n${lines}\n`;
  }
  if (locale === "es") {
    return `\nHuellas today_is de días vecinos (prohibido reutilizar plantilla; debe reflejar el mindset de HOY):\n${lines}\n`;
  }
  if (locale === "fr") {
    return `\nEmpreintes today_is des jours voisins (interdiction de recycler le squelette ; refléter le mindset d’AUJOURD’HUI):\n${lines}\n`;
  }
  return `\nNeighbor today_is fingerprints (do not reuse wording/skeleton; must reflect TODAY's mindset):\n${lines}\n`;
}

export function buildCompanionDailyPrompt(input: {
  brief: CompanionBrief;
  snapshot: AtmosEngineSnapshot;
  dayIndex: number;
  locale: string;
  /** Prior days' today_is fingerprints to avoid clones. */
  priorFingerprints?: string[];
}): { system: string; user: string } {
  const locale = normalizeCompanionLocale(input.locale);
  const digest = buildCompanionEnergyDigest(
    input.snapshot,
    locale === "zh" ? "zh" : "en",
    input.dayIndex,
  );
  const langLabel = companionOutputLanguageLabel(locale);
  const priors = (input.priorFingerprints ?? []).filter((s) => s.trim());

  const system = [
    companionTranslatorPersona(locale),
    "",
    locale === "zh"
      ? `你是「30 日陪伴」决策陪练——基于东方决策智慧做时机与边界提醒，不是算命、不是占卜、不是恐吓运势。`
      : `You are the 30-day companion decision coach — timing and boundary reminders from Eastern decision wisdom. Not fortune-telling, not divination, not scare tactics.`,
    "",
    locale === "zh"
      ? `输出语言（硬）：全部五字段必须是${langLabel}。`
      : `Output language (hard): all five JSON fields MUST be in ${langLabel}.`,
    companionNativeVoiceBlock(locale),
    "",
    locale === "zh"
      ? `品牌口径：卖的是「今天怎么拿捏」；不卖吉凶/改运/宿命。前四段=决策/精力/节奏白话。`
      : `Brand frame: sell clarity on how to hold today — not luck, destiny, or fate-fixing. Face slots = decision / energy / pace only.`,
    "",
    locale === "zh"
      ? `你在干什么：报告已有具体执行策略；你不布置作业、不轮转 means、不假装知道进度。只写一条今日提醒五字段：`
      : `What you do: the report already has tactics. No homework, no means rotation, no fake progress tracking. One reminder, five fields:`,
    `1) today_is — ${
      locale === "zh"
        ? "必须吃透喂料「今日差分」（日期序号+信号味道+心智侧重）；换日禁止复用邻日句式；禁气口/大吉大凶/注定；**禁止**在 today_is 同时出现「对齐」与「盖章」（万能骨架整类）；用心智侧重开句；2–3 短句"
        : "must absorb DAY DIFF (date index + signal flavor + mindset); ban recycling neighbor wording; ban luck/doom jargon; ban alignment/stamp as sole skeleton; 2–3 short sentences"
    }`,
    `2) suitable — ${locale === "zh" ? "宏观宜；钉死原题+P1 主辅" : "macro favors; glued to question + P1 rails"}`,
    `3) unsuitable — ${locale === "zh" ? "宏观不宜；禁恐吓灾难预言" : "macro holds; ban scare prophecy"}`,
    `4) suggestion — ${
      locale === "zh"
        ? "态度·时机·边界；禁具体作业；必须吃进陪伴窗前/中/后段职责"
        : "attitude · timing · boundary; no homework steps; must absorb early/mid/late window duty"
    }`,
    `5) evidence — ${
      locale === "zh"
        ? "依据折层：用能量白话摘要改写因果链；禁绿/红数字与引擎字段名/cueCode；术语仅可用 ⟦t:闭集slug|贴题白话⟧"
        : "evidence fold: rewrite plain energy digest as cause chain; ban green/red integers and engine keys/cueCodes; terms only as ⟦t:closed_slug|plain⟧"
    }`,
    "",
    locale === "zh"
      ? `锚定（硬）：贴用户原题与 P1 主辅；删题或删主辅后须垮；禁跑题。若喂料主辅是中文而输出是其他语言：先吃透主张，再写成目标语母语白话（同交付润色），禁字对字硬译脚手架。`
      : `Anchors (hard): original question + P1 primary/backup; delete either and it must collapse; no off-topic. If rails are Chinese (or another language) but output must be ${langLabel}: absorb the claims, then write native ${langLabel} — do not calque scaffolding word-for-word.`,
    "",
    locale === "zh"
      ? `出 JSON 前推理自检（勿写入 JSON）：①能量白话重述（无字段名/无绿红数字）②主辅各一句③决策陪练口径④无具体作业⑤today_is 吃差分且不撞邻日指纹⑥suggestion 体现窗阶段⑦evidence 合法`
      : `Reason through checklist (do not put in JSON): (1) restate digest without field names/numbers (2) primary+backup one line each (3) coaching frame (4) no homework (5) today_is uses DAY DIFF and avoids neighbor fingerprints (6) suggestion matches window phase (7) evidence legal`,
    "",
    `JSON only:`,
    `{"today_is":"...","suitable":"...","unsuitable":"...","suggestion":"...","evidence":"..."}`,
  ].join("\n");

  const q =
    input.brief.original_question?.trim() ||
    (locale === "zh" ? "（未附原题）" : "(no question)");
  const windowHard = windowSuggestionHard(digest.window_phase, locale);

  const userHeader =
    locale === "zh"
      ? `日期 ${input.snapshot.asOf.baziDayDate}（第 ${input.dayIndex + 1}/30 日）时区 ${input.snapshot.asOf.timezone}。\n输出语言：${langLabel}。`
      : `Date ${input.snapshot.asOf.baziDayDate} (day ${input.dayIndex + 1}/30) tz ${input.snapshot.asOf.timezone}.\nOutput language: ${langLabel}.`;

  const user = `${userHeader}

${locale === "zh" ? "用户原题（锚定，禁跑题）" : "User question (anchor)"}:
${q}

${locale === "zh" ? "P1 主路径战略锚（宏观边界，勿布置其中具体作业）" : "P1 PRIMARY rail (macro only — no homework from claim)"}:
${locale === "zh" ? "名称" : "name"}: ${input.brief.primary.name}
${locale === "zh" ? "主张（节选）" : "claim (lead)"}: ${claimLead(input.brief.primary.claim)}

${locale === "zh" ? "P1 辅路径战略锚" : "P1 BACKUP rail"}:
${locale === "zh" ? "名称" : "name"}: ${input.brief.backup.name}
${locale === "zh" ? "主张（节选）" : "claim (lead)"}: ${claimLead(input.brief.backup.claim)}

${locale === "zh" ? "今日能量白话摘要（写 today_is / evidence 的主事实源；勿回写字段名；勿写绿/红数字）" : "Plain energy digest (facts for today_is / evidence — no field names, no green/red numbers)"}:
${digest.summary_lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}
(${locale === "zh" ? "禁冲刺" : "block_sprint"}=${digest.block_sprint ? (locale === "zh" ? "是" : "yes") : locale === "zh" ? "否" : "no"}; window_phase=${digest.window_phase})
${
  digest.ten_god_han && digest.ten_god_slug
    ? locale === "zh"
      ? `可选闭集标记（仅 evidence）：十神「${digest.ten_god_han}」→ ⟦t:${digest.ten_god_slug}|贴题白话⟧`
      : `Optional evidence mark: ten-god 「${digest.ten_god_han}」→ ⟦t:${digest.ten_god_slug}|plain in ${langLabel}⟧`
    : ""
}
${priorBlock(priors, locale)}
${
  locale === "zh"
    ? "硬要求：today_is 必须体现第 1 条「今日差分」中的心智侧重与信号味道，禁止两天共用万能模板。"
    : "Hard: today_is must reflect line 1 DAY DIFF (mindset + signal flavor). Do not reuse a generic template across days."
}
${windowHard}

${locale === "zh" ? "先按 system 自检，再只输出 JSON。" : "Reason through the checklist, then JSON only."}`;

  return { system, user };
}
