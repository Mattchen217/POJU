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
import { COMPANION_WINDOW_DAYS, type CompanionBrief } from "./types";
import {
  buildDailyAnchorSeeds,
  dailyAnchorClosedSetPromptBlock,
  type DailyAnchorClosedHints,
} from "./pregen-daily-anchors";

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
      return `硬要求（${dayLabel} suggestion）：陪伴窗**中段**——须点明检验前段**战略边界**是否还站得住（主路托底？辅路未提前升主？终局/救急未抢跑？）；禁只写空话「分线」；禁拿主张里的具体动作清单当验收表。`;
    }
    if (phase === "late") {
      return `硬要求（${dayLabel} suggestion）：陪伴窗**后段**——须点明收束/复盘**战略边界**，或忌窗末倒计时绑架做急救决定；复盘只问「主辅边界是否松动」，禁复盘/验收主张里的具体作业（次数、日程、表格、某次相处是否完成）。`;
    }
    return `硬要求（${dayLabel} suggestion）：陪伴窗**前段**——宜先立战略边界与分线，少做窗末终局；禁布置主张里的具体作业步骤。`;
  }
  if (locale === "es") {
    if (phase === "mid") {
      return `Obligatorio (${dayLabel} suggestion): ventana media — comprobar si los límites estratégicos tempranos aún aguantan (vía principal / no subir la de respaldo / no decisión de emergencia); prohibido checklist de tareas del claim.`;
    }
    if (phase === "late") {
      return `Obligatorio (${dayLabel} suggestion): ventana tardía — cerrar/revisar límites estratégicos o evitar pánico de cuenta regresiva; prohibido verificar tareas concretas del claim.`;
    }
    return `Obligatorio (${dayLabel} suggestion): ventana temprana — límites estratégicos; prohibido asignar tareas del claim.`;
  }
  if (locale === "fr") {
    if (phase === "mid") {
      return `Exigence (${dayLabel} suggestion) : milieu de fenêtre — tester si les limites stratégiques du début tiennent encore ; interdiction de checklist des tâches du claim.`;
    }
    if (phase === "late") {
      return `Exigence (${dayLabel} suggestion) : fin de fenêtre — resserrer/revoir les limites stratégiques ou éviter la panique ; interdiction de vérifier les tâches concrètes du claim.`;
    }
    return `Exigence (${dayLabel} suggestion) : début de fenêtre — limites stratégiques ; interdiction d'assigner les tâches du claim.`;
  }
  if (phase === "mid") {
    return `Hard (${dayLabel} suggestion): mid window — test whether early *strategic* rails still hold (primary still footing / backup not elevated early / no emergency final call); ban homework checklists from the claim.`;
  }
  if (phase === "late") {
    return `Hard (${dayLabel} suggestion): late window — consolidate/review *strategic* rails or ban countdown kidnap; review = "did rails loosen?", never "did you finish claim homework".`;
  }
  return `Hard (${dayLabel} suggestion): early window — set strategic boundaries; ban assigning concrete claim homework.`;
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
      ? `一次写 1–2 天提醒（喂料有几天就写几天）。报告已有执行策略；**不布置作业、不轮转 means、不验收作业、不回访改旧报告**。每天决策锚五槽：today_is=今日主题 · suitable=适合关注 · suggestion=今天可以做 · unsuitable=今天需要避免 · evidence=今日锚点（决策原则）。`
      : `Write 1–2 day reminders in one shot. Report already has tactics; **no homework, no means rotation, no quizzes, no revisit edits**. Five decision-anchor slots: today_is=theme · suitable=attend · suggestion=can do · unsuitable=avoid · evidence=decision anchor.`,
    "",
    locale === "zh"
      ? `P1/06–09 主张里可能夹着具体动作——那是交付报告存档。日提醒只抽**战略栏杆**与闭集 hints；suitable / unsuitable / suggestion **整类禁止**：布置这些动作、点名次数/日程、或复盘「有没有做完」。流日能量只作可选背景，不作主叙事。`
      : `Concrete actions in P1/06–09 = report archive only. Cards use **strategic rails** + closed-set hints. Face slots must **never** assign those actions or quiz completion. Liuri energy is optional backdrop, not the main narrative.`,
    "",
    locale === "zh"
      ? `today_is（今日主题）：贴合当日决策视角的主题句；2–3 短句；第二人称「你」。禁两日共用万能骨架；**禁**用「适合…/不宜…」起句。`
      : `today_is (theme): strategy-lens theme sentence; 2–3 short sentences; second person. Ban shared skeleton; **ban** suitable/unsuitable voice openings.`,
    locale === "zh"
      ? `suitable（适合关注）/ unsuitable（需要避免）：宏观战略边界与风险；钉死原题+主辅。禁作业步骤、禁 means 轮转。`
      : `suitable (attend) / unsuitable (avoid): macro rails + risk; glued to question + primary/backup. Ban step lists and means rotation.`,
    locale === "zh"
      ? `suggestion（今天可以做）：类型化行动/信息建议（非强制勾选）；吃进该日窗阶段与闭集 hints。两日起句勿复读同一模板。`
      : `suggestion (can do): typed action/info suggestion (not a checklist); absorb window phase + closed-set hints. Ban identical openings.`,
    locale === "zh"
      ? `evidence（今日锚点）：一条可记住的决策原则；可含可选传统视角标注（⟦t:slug|白话⟧）；禁绿/红数字；禁止写成流日能量四段主文。`
      : `evidence (decision anchor): one memorable decision principle; optional tradition mark ⟦t:slug|plain⟧; ban green/red integers; ban liuri-energy-as-main-copy.`,
    "",
    locale === "zh"
      ? `锚定：原题+P1 主辅；删则垮。喂料若为中文轨而输出其他语言：先吃透再母语出稿，禁硬译脚手架。两日 today_is 必须明显不同（各日心智侧重各写）。`
      : `Anchors: question + P1 rails. If rails are Chinese but output is ${langLabel}: absorb then write native — no calque. The two days' today_is must clearly differ (each day's mindset).`,
    "",
    locale === "zh"
      ? `写完自检：①今天_is 有没有误写成「适合/不宜」？②有没有布置或验收主张里的具体动作？③中/后段有没有点到战略边界（而非空话分线/作业表）？④两日 today_is 是否明显不同？过才出 JSON。`
      : `Self-check before JSON: (1) today_is not in suitable/unsuitable voice? (2) no claim-homework assign/quiz? (3) mid/late hits strategic rails (not empty "split threads"/chore list)? (4) two today_is clearly differ?`,
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
  /** Seal-time closed-set from report 06/07/08/09. */
  closedHints?: DailyAnchorClosedHints | null;
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
      ? "P1 主路径战略锚（只取宏观边界；主张里若有具体动作=存档，日更勿布置/勿验收）："
      : "P1 PRIMARY rail (macro boundary only; concrete actions in claim = archive — never assign/quiz):",
    `${locale === "zh" ? "名称" : "name"}: ${input.brief.primary.name}`,
    `${locale === "zh" ? "主张（节选）" : "claim (lead)"}: ${claimLead(input.brief.primary.claim)}`,
    "",
    locale === "zh"
      ? "P1 辅路径战略锚（同上：宏观边界，勿布置/验收具体动作）："
      : "P1 BACKUP rail (same: macro boundary; no homework assign/quiz):",
    `${locale === "zh" ? "名称" : "name"}: ${input.brief.backup.name}`,
    `${locale === "zh" ? "主张（节选）" : "claim (lead)"}: ${claimLead(input.brief.backup.claim)}`,
    input.brief.relation_boundary?.trim()
      ? [
          "",
          locale === "zh"
            ? "关系边界（轻量 · 仍单人流日 · 禁合盘专章）："
            : "Relation boundary (light · single-person dailies · no Match chapter):",
          input.brief.relation_boundary.trim(),
          /无对方盘|without partner chart/i.test(input.brief.relation_boundary)
            ? locale === "zh"
              ? "硬闸 #13：禁臆造对方日主/大运/合盘分数/对方八字专名；只写你侧栏杆 + 可观察现实。"
              : "Hard #13: ban inventing their day-master / luck pillars / dyad scores / partner bazi; your rails + observed reality only."
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");

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
    const anchorSeed = buildDailyAnchorSeeds({
      brief: input.brief,
      closedHints: input.closedHints,
      days: COMPANION_WINDOW_DAYS,
    })[d.dayIndex];
    const anchorRail = anchorSeed
      ? dailyAnchorClosedSetPromptBlock(anchorSeed, locale)
      : "";
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
      anchorRail,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const cross =
    input.days.length >= 2
      ? locale === "zh"
        ? "\n跨日硬要求：两日 today_is 不得近似复读；各吃各日差分与窗阶段；两日 suggestion 起句勿复读同一模板。\n"
        : "\nCross-day hard: the two today_is must not near-clone; each absorbs its own DAY DIFF and window phase; ban identical suggestion openings.\n"
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
      ? "先按 system 自检（today_is 非宜/不宜腔；无作业布置/验收；中后段点战略边界），再只输出 JSON（days 数组）。"
      : "Pass the system self-check (today_is not suitable-voice; no homework assign/quiz; mid/late hits strategic rails), then JSON only (days array).",
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
