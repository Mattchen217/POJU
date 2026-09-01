/**
 * P0-2 · 大运对本案「攻守松紧」（本地确定性）
 *
 * 相对用神五行 + 可选题型，给出 favor / caution / mixed，供 inventory、P2/P5/P6 引用。
 * 非日期点位；不发明流年故事。
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { resolveCurrentDaYunStep } from "@/lib/base-analysis/core-judgments";
import { STEMS, type HeavenlyStem, type WuXing } from "@/lib/match/data/stems-branches";

export type DayunStance = "favor" | "caution" | "mixed" | "unknown";

export type DayunPolarity = {
  stance: DayunStance;
  ganzhi: string | null;
  step: number | null;
  /** 可进 chart_anchors */
  chart_token: string;
  note: string;
};

const GENERATES: Record<WuXing, WuXing> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

function isStem(s: string): s is HeavenlyStem {
  return s in STEMS;
}

function stemWuxing(stem: string): WuXing | null {
  const ch = stem.trim().charAt(0);
  return isStem(ch) ? STEMS[ch].wuxing : null;
}

function elementFromAny(raw: string): WuXing | null {
  const t = raw.trim();
  if (/[木火土金水]/.test(t)) {
    const m = t.match(/[木火土金水]/);
    return (m?.[0] as WuXing) ?? null;
  }
  return stemWuxing(t);
}

function topicHint(category: string | null | undefined): string {
  switch (category) {
    case "relationship":
    case "interpersonal":
    case "family":
      return "关系题宜看这步对续航/边界的松紧";
    case "wealth":
      return "财富题宜看这步对资源回流是顺还是耗";
    case "career":
    case "decision":
      return "事业/决策题宜看这步推进窗口是松还是紧";
    default:
      return "对本案节奏：先判攻守松紧再写手段";
  }
}

/**
 * 当前大运步相对用神的攻守极性。
 */
export function buildDayunPolarity(
  structured: ProfileStructured,
  questionCategory?: string | null,
  nowYear = new Date().getFullYear(),
): DayunPolarity {
  const step = resolveCurrentDaYunStep(structured.da_yun, nowYear);
  const hint = topicHint(questionCategory);

  if (step == null || !structured.da_yun?.[step]) {
    return {
      stance: "unknown",
      ganzhi: null,
      step: null,
      chart_token: "大运步·不明",
      note: `当前大运步不明，宜守。${hint}`,
    };
  }

  const ganzhi = structured.da_yun[step]!.ganzhi;
  const dayunWx = stemWuxing(ganzhi);
  const yongWx = elementFromAny(structured.yong_shen);

  if (!dayunWx) {
    return {
      stance: "mixed",
      ganzhi,
      step,
      chart_token: `大运${ganzhi}·平稳`,
      note: `气候平稳，宜守中带进。${hint}`,
    };
  }

  if (yongWx && (dayunWx === yongWx || GENERATES[dayunWx] === yongWx)) {
    return {
      stance: "favor",
      ganzhi,
      step,
      chart_token: `大运${ganzhi}·补给偏顺`,
      note: `补给侧偏顺，可择机推进（非日期点）。${hint}`,
    };
  }

  if (yongWx && GENERATES[yongWx] === dayunWx) {
    return {
      stance: "caution",
      ganzhi,
      step,
      chart_token: `大运${ganzhi}·偏耗泄`,
      note: `偏耗泄，宜守、控扩张。${hint}`,
    };
  }

  if (dayunWx === "火" && yongWx === "水") {
    return {
      stance: "caution",
      ganzhi,
      step,
      chart_token: `大运${ganzhi}·燥热偏耗`,
      note: `燥热偏耗，宜守。${hint}`,
    };
  }

  return {
    stance: "mixed",
    ganzhi,
    step,
    chart_token: `大运${ganzhi}·气候交织`,
    note: `气候交织，宜守中选点。${hint}`,
  };
}

export function formatDayunPolarityForInventory(p: DayunPolarity): string {
  return `- 大运攻守松紧（本案可引 · 非日期点）: ${p.chart_token}〔${p.stance}〕— ${p.note}`;
}

export function buildDayunPolarityInventoryLine(
  structured: ProfileStructured,
  questionCategory?: string | null,
): string {
  return formatDayunPolarityForInventory(
    buildDayunPolarity(structured, questionCategory),
  );
}
