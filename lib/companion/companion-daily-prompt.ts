/**
 * Companion pair prompt — 1 invoke = 1–2 days.
 *
 * Prefix-cache (INV-1): system = locale-static only; user = stable Brief first,
 * then per-day digests / priors (dynamic at the end). Same job + locale → system
 * byte-stable across all 15 pair fills.
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
  dayLabel: string,
): string {
  if (locale === "zh") {
    if (phase === "mid") {
      return `硬要求（${dayLabel} suggestion）：陪伴窗**中段**——须点明检验前段边界是否还站得住；禁只写通用分线。`;
    }
    if (phase === "late") {
      return `硬要求（${dayLabel} suggestion）：陪伴窗**后段**——须点明收束/复盘或忌倒计时绑架。`;
    }
    return `硬要求（${dayLabel} suggestion）：陪伴窗**前段**——宜先立边界与分线，少做窗末终局。`;
  }
  if (locale === "es") {
    if (phase === "mid") {
      return `Obligatorio (${dayLabel} suggestion): ventana media — comprobar si los límites tempranos aún aguantan.`;
    }
    if (phase === "late") {
      return `Obligatorio (${dayLabel} suggestion): ventana tardía — cerrar/revisar o evitar pánico de cuenta regresiva.`;
    }
    return `Obligatorio (${dayLabel} suggestion): ventana temprana — límites y separar hilos.`;
  }
  if (locale === "fr") {
    if (phase === "mid") {
      return `Exigence (${dayLabel} suggestion) : milieu de fenêtre — tester les limites du début.`;
    }
    if (phase === "late") {
      return `Exigence (${dayLabel} suggestion) : fin de fenêtre — resserrer/revoir ou éviter la panique.`;
    }
    return `Exigence (${dayLabel} suggestion) : début de fenêtre — poser limites et séparer les fils.`;
  }
  if (phase === "mid") {
    return `Hard (${dayLabel} suggestion): mid window — test whether early boundaries still hold.`;
  }
  if (phase === "late") {
    return `Hard (${dayLabel} suggestion): late window — consolidate/review; ban end-window panic.`;
  }
  return `Hard (${dayLabel} suggestion): early window — set boundaries; avoid end-window final calls.`;
}

function priorBlock(priors: string[], locale: CompanionLocale): string {
  if (!priors.length) return "";
  const lines = priors.map((p, i) => `${i + 1}. ${p}`).join("\n");
  if (locale === "zh") {
    return `\n邻日 today_is 指纹（两日均禁止复用；须各自写出本差分心智侧重）：\n${lines}\n`;
  }
  if (locale === "es") {
    return `\nHuellas today_is vecinas (ambos días: no reutilizar; cada uno con su mindset):\n${lines}\n`;
  }
  if (locale === "fr") {
    return `\nEmpreintes today_is voisines (les deux jours : ne pas recycler ; mindset distinct):\n${lines}\n`;
  }
  return `\nNeighbor today_is fingerprints (both days: do not reuse; each must reflect its own mindset):\n${lines}\n`;
}

/** Locale-static system — byte-stable across pair fills for the same locale. */
export function buildCompanionPairSystem(localeRaw: string): string {
  const locale = normalizeCompanionLocale(localeRaw);
  const langLabel = companionOutputLanguageLabel(locale);

  return [
    companionTranslatorPersona(locale),
    "",
    locale === "zh"
      ? `你是「30 日陪伴」决策陪练——基于东方决策智慧做时机与边界提醒，不是算命、不是占卜、不是恐吓运势。`
      : `You are the 30-day companion decision coach — timing and boundary reminders from Eastern decision wisdom. Not fortune-telling, not divination, not scare tactics.`,
    "",
    locale === "zh"
      ? `输出语言（硬）：days[] 内每个对象的五字段必须是${langLabel}。`
      : `Output language (hard): every day's five fields in days[] MUST be in ${langLabel}.`,
    companionNativeVoiceBlock(locale),
    "",
    locale === "zh"
      ? `品牌口径：卖「今天怎么拿捏」；不卖吉凶/改运/宿命。前四段=决策/精力/节奏白话。`
      : `Brand frame: clarity on how to hold today — not luck/destiny. Face slots = decision / energy / pace only.`,
    "",
    locale === "zh"
      ? `一次写 1–2 天提醒（喂料有几天就写几天）。报告已有执行策略；不布置作业、不轮转 means。每天五字段：today_is / suitable / unsuitable / suggestion / evidence。`
      : `Write 1–2 day reminders in one shot (as many as the feed lists). No homework, no means rotation. Five fields per day: today_is / suitable / unsuitable / suggestion / evidence.`,
    "",
    locale === "zh"
      ? `today_is：吃透该日「今日差分」；禁两日共用万能骨架；禁「对齐」与「盖章」同现；2–3 短句。`
      : `today_is: absorb that day's DAY DIFF; ban shared skeleton across the two days; ban alignment/stamp co-occurrence; 2–3 short sentences.`,
    locale === "zh"
      ? `suitable/unsuitable：宏观；钉死原题+P1 主辅。suggestion：态度·时机·边界；吃进该日窗阶段。evidence：能量白话因果链；禁绿/红数字；术语仅 ⟦t:slug|白话⟧。`
      : `suitable/unsuitable: macro; glued to question + P1. suggestion: attitude·timing·boundary; absorb that day's window phase. evidence: plain digest chain; ban green/red integers; terms only ⟦t:slug|plain⟧.`,
    "",
    locale === "zh"
      ? `锚定：原题+P1 主辅；删则垮。喂料若为中文轨而输出其他语言：先吃透再母语出稿，禁硬译脚手架。两日 today_is 必须明显不同。`
      : `Anchors: question + P1 rails. If rails are Chinese but output is ${langLabel}: absorb then write native — no calque. The two days' today_is must clearly differ.`,
    "",
    locale === "zh"
      ? `只输出 JSON（勿 markdown）：`
      : `JSON only (no markdown):`,
    `{"days":[{"day_index":0,"today_is":"...","suitable":"...","unsuitable":"...","suggestion":"...","evidence":"..."},{"day_index":1,"today_is":"...","suitable":"...","unsuitable":"...","suggestion":"...","evidence":"..."}]}`,
    locale === "zh"
      ? `days 数组长度=喂料日数；day_index 必须与喂料一致。`
      : `days length = number of days in the feed; day_index must match the feed.`,
  ].join("\n");
}

export type CompanionPairDayFeed = {
  dayIndex: number;
  snapshot: AtmosEngineSnapshot;
};

/**
 * User message: stable Brief block first (cacheable prefix within a job),
 * then per-day digests + priors (dynamic tail).
 */
export function buildCompanionPairUser(input: {
  brief: CompanionBrief;
  locale: string;
  days: CompanionPairDayFeed[];
  priorFingerprints?: string[];
}): string {
  const locale = normalizeCompanionLocale(input.locale);
  const langLabel = companionOutputLanguageLabel(locale);
  const q =
    input.brief.original_question?.trim() ||
    (locale === "zh" ? "（未附原题）" : "(no question)");
  const priors = (input.priorFingerprints ?? []).filter((s) => s.trim());

  const stableHead = [
    locale === "zh"
      ? `输出语言：${langLabel}。本枪写 ${input.days.length} 日。`
      : `Output language: ${langLabel}. This invoke covers ${input.days.length} day(s).`,
    "",
    locale === "zh" ? "用户原题（锚定，禁跑题）：" : "User question (anchor):",
    q,
    "",
    locale === "zh"
      ? "P1 主路径战略锚（宏观边界，勿布置其中具体作业）："
      : "P1 PRIMARY rail (macro only — no homework from claim):",
    `${locale === "zh" ? "名称" : "name"}: ${input.brief.primary.name}`,
    `${locale === "zh" ? "主张（节选）" : "claim (lead)"}: ${claimLead(input.brief.primary.claim)}`,
    "",
    locale === "zh" ? "P1 辅路径战略锚：" : "P1 BACKUP rail:",
    `${locale === "zh" ? "名称" : "name"}: ${input.brief.backup.name}`,
    `${locale === "zh" ? "主张（节选）" : "claim (lead)"}: ${claimLead(input.brief.backup.claim)}`,
  ].join("\n");

  const dayBlocks = input.days.map((d) => {
    const digest = buildCompanionEnergyDigest(
      d.snapshot,
      locale === "zh" ? "zh" : "en",
      d.dayIndex,
    );
    const label =
      locale === "zh"
        ? `【日 ${d.dayIndex + 1}/30 · ${d.snapshot.asOf.baziDayDate} · day_index=${d.dayIndex}】`
        : `[Day ${d.dayIndex + 1}/30 · ${d.snapshot.asOf.baziDayDate} · day_index=${d.dayIndex}]`;
    const hard = windowSuggestionHard(
      digest.window_phase,
      locale,
      locale === "zh" ? `第${d.dayIndex + 1}日` : `day ${d.dayIndex + 1}`,
    );
    const ten =
      digest.ten_god_han && digest.ten_god_slug
        ? locale === "zh"
          ? `可选闭集（仅 evidence）：「${digest.ten_god_han}」→ ⟦t:${digest.ten_god_slug}|贴题白话⟧`
          : `Optional evidence mark: 「${digest.ten_god_han}」→ ⟦t:${digest.ten_god_slug}|plain in ${langLabel}⟧`
        : "";
    return [
      label,
      locale === "zh"
        ? "能量白话摘要（勿回写字段名；勿写绿/红数字）："
        : "Plain energy digest (no field names; no green/red numbers):",
      ...digest.summary_lines.map((l, i) => `${i + 1}. ${l}`),
      `(${locale === "zh" ? "禁冲刺" : "block_sprint"}=${digest.block_sprint ? (locale === "zh" ? "是" : "yes") : locale === "zh" ? "否" : "no"}; window_phase=${digest.window_phase})`,
      ten,
      hard,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const cross =
    input.days.length >= 2
      ? locale === "zh"
        ? "\n跨日硬要求：两日 today_is 不得近似复读；各吃各日差分与窗阶段。\n"
        : "\nCross-day hard: the two today_is must not near-clone; each must absorb its own DAY DIFF and window phase.\n"
      : "";

  return [
    stableHead,
    "",
    locale === "zh" ? "—— 以下按日变化（动态尾）——" : "—— Per-day feeds (dynamic tail) ——",
    "",
    dayBlocks.join("\n\n"),
    priorBlock(priors, locale),
    cross,
    locale === "zh"
      ? "先按 system 自检，再只输出 JSON（days 数组）。"
      : "Reason through the checklist, then JSON only (days array).",
  ].join("\n");
}

/** @deprecated Prefer buildCompanionPairSystem + buildCompanionPairUser */
export function buildCompanionDailyPrompt(input: {
  brief: CompanionBrief;
  snapshot: AtmosEngineSnapshot;
  dayIndex: number;
  locale: string;
  priorFingerprints?: string[];
}): { system: string; user: string } {
  return {
    system: buildCompanionPairSystem(input.locale),
    user: buildCompanionPairUser({
      brief: input.brief,
      locale: input.locale,
      days: [{ dayIndex: input.dayIndex, snapshot: input.snapshot }],
      priorFingerprints: input.priorFingerprints,
    }),
  };
}
