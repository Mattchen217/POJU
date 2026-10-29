/**
 * BookJudgmentPack quota · reverse from report blueprint (Canvas SoT).
 * 报告 → 段表 → 批断配额（反推，不顺推硬塞）。
 * Pack-gun duty 正写：机制/偏差/负荷 | 命理判断 | 交汇张力 | 复盘问句。
 */

import { CANONICAL_FACE_BLUEPRINT } from "@/lib/poju/report-blueprint";
import {
  DECISION_PAGE_SCHEMAS,
  type DualTrackMount,
} from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import type { PageSegmentId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import type { BookFaceId, BookJudgmentTrack } from "./schema";
import { BOOK_FACE_IDS } from "./schema";

export type QuotaPreferredTrack = BookJudgmentTrack | "any";

export type BookJudgmentSegmentSlot = {
  segmentId: PageSegmentId;
  label: string;
  duty: string;
  preferred_track: QuotaPreferredTrack;
  /** Pointer D / appendix contrast may be false. */
  needs_unit: boolean;
};

export type BookJudgmentFaceQuota = {
  faceId: BookFaceId;
  title: string;
  dualTrack: DualTrackMount;
  /** From blueprint modules.writes */
  report_writes: string;
  science_disciplines: string[];
  min_units: number;
  min_destiny: number;
  min_science: number;
  segment_slots: BookJudgmentSegmentSlot[];
};

export type BookJudgmentQuotaTable = {
  version: 1;
  total_min_units: number;
  faces: BookJudgmentFaceQuota[];
};

function preferredForSegment(
  dualTrack: DualTrackMount,
  segmentId: PageSegmentId,
): { preferred_track: QuotaPreferredTrack; needs_unit: boolean } {
  switch (dualTrack) {
    case "abc":
      if (segmentId === "A") return { preferred_track: "destiny", needs_unit: true };
      if (segmentId === "B") return { preferred_track: "science", needs_unit: true };
      if (segmentId === "C") return { preferred_track: "convergence", needs_unit: true };
      return { preferred_track: "any", needs_unit: true };
    case "pointer":
      if (segmentId === "D") return { preferred_track: "any", needs_unit: false };
      if (segmentId === "A") return { preferred_track: "destiny", needs_unit: true };
      if (segmentId === "B") return { preferred_track: "any", needs_unit: true };
      if (segmentId === "C") return { preferred_track: "science", needs_unit: true };
      return { preferred_track: "any", needs_unit: true };
    case "fold":
      if (segmentId === "A") return { preferred_track: "destiny", needs_unit: true };
      if (segmentId === "B") return { preferred_track: "science", needs_unit: true };
      if (segmentId === "C") return { preferred_track: "any", needs_unit: true };
      if (segmentId === "D") return { preferred_track: "any", needs_unit: true };
      if (segmentId === "E") return { preferred_track: "any", needs_unit: false };
      return { preferred_track: "any", needs_unit: true };
    case "reality":
      if (segmentId === "A") return { preferred_track: "science", needs_unit: true };
      if (segmentId === "B") return { preferred_track: "destiny", needs_unit: true };
      return { preferred_track: "convergence", needs_unit: true };
    case "appendix":
      if (segmentId === "A") return { preferred_track: "destiny", needs_unit: true };
      if (segmentId === "B") return { preferred_track: "destiny", needs_unit: true };
      if (segmentId === "C") return { preferred_track: "science", needs_unit: true };
      return { preferred_track: "any", needs_unit: true };
    default:
      return { preferred_track: "any", needs_unit: true };
  }
}

function faceMins(dualTrack: DualTrackMount, slotCount: number): {
  min_units: number;
  min_destiny: number;
  min_science: number;
} {
  const min_units = Math.max(3, Math.min(slotCount, 5));
  return {
    min_units,
    min_destiny: 1,
    min_science: dualTrack === "appendix" ? 1 : 1,
  };
}

const DUTY_MECH = "写可验证机制/偏差/负荷；禁手段处方与条件→投入加减。";
const DUTY_JUDGE = "写命理判断/结构倾向；禁路径处方与落地操作句。";
const DUTY_CONV = "写双轨交汇张力或同向；禁动作清单。";
const DUTY_REVIEW = "写复盘问句或边界判断；禁信号停损框与操作处方。";

/**
 * Pack-gun duty 正写（不改 decision-pages 用户可见段标题 SoT）。
 */
function toJudgmentSegmentCopy(seg: {
  id: string;
  label: string;
  duty: string;
}): { label: string; duty: string } {
  const label = seg.label.trim();
  const duty = seg.duty.trim();
  const blob = `${label} ${duty}`;

  if (/红灯|绿灯|停损|短信号/.test(blob)) {
    return { label: "偏差·负荷机制", duty: DUTY_MECH };
  }
  if (/近步|动作类型|完成样貌|怎么落地|下周干/.test(blob)) {
    return { label: "近窗机制约束", duty: DUTY_MECH };
  }
  if (/切轨|停止|换轨或停下/.test(blob)) {
    return { label: "边界判断", duty: DUTY_REVIEW };
  }
  if (/自我调频|怎么调自己/.test(blob)) {
    return { label: "自稳机制", duty: DUTY_MECH };
  }
  if (/科学机制/.test(label)) {
    return { label: "科学机制", duty: DUTY_MECH };
  }
  if (/命理理由/.test(label)) {
    return { label: "命理判断", duty: DUTY_JUDGE };
  }
  if (/汇合|交汇/.test(label)) {
    return { label: "交汇张力", duty: DUTY_CONV };
  }
  if (/主推荐|首选|更宜的一条路|更宜/.test(blob)) {
    return { label: "结构倾向判断", duty: DUTY_JUDGE };
  }
  if (/次选|慎选|不选什么|成立条件/.test(label)) {
    return { label: "结构边界", duty: DUTY_JUDGE };
  }
  if (/卡点命名|表现|怎么出现|若硬顶/.test(blob)) {
    return { label: "偏差·负荷机制", duty: DUTY_MECH };
  }
  if (/复盘问句|何时重跑/.test(label)) {
    return {
      label: label.includes("复盘") ? "复盘问句" : "重跑条件判断",
      duty: DUTY_REVIEW,
    };
  }
  if (/场域判断|关系\/互动|对齐/.test(label)) {
    return { label, duty: DUTY_JUDGE };
  }
  if (/可核对锚|依据指针|依据折叠|对照|阶段气候|节奏提醒/.test(label)) {
    return {
      label,
      duty: /气候|节奏/.test(label) ? DUTY_MECH : "写短锚或对照判断；禁手段处方。",
    };
  }
  if (/八字本题|紫微本题|对照一句/.test(label)) {
    return { label, duty: "写本题短锚对照；禁手段处方。" };
  }
  if (/更宜|落地|验证单元|投入|短信号|动作类型|完成样貌/.test(duty)) {
    return { label: label || "结构判断", duty: DUTY_JUDGE };
  }
  return { label, duty };
}

function toJudgmentDualTrackNote(note: string): string {
  return note
    .replace(/红灯[、，,]?/g, "偏差机制、")
    .replace(/近步原则、完成样貌、?/g, "近窗机制约束、")
    .replace(/不是勾选作业。?/g, "禁操作清单。")
    .replace(/更宜/g, "结构倾向");
}

/**
 * Reverse quota from CANONICAL_FACE_BLUEPRINT + DECISION_PAGE_SCHEMAS.
 * Deterministic — no LLM.
 */
export function buildBookJudgmentQuotaFromBlueprint(): BookJudgmentQuotaTable {
  const byFace = new Map(
    CANONICAL_FACE_BLUEPRINT.map((row) => [row.faceId, row] as const),
  );
  const faces: BookJudgmentFaceQuota[] = [];

  for (const faceId of BOOK_FACE_IDS) {
    const schema = DECISION_PAGE_SCHEMAS[faceId];
    const bp = byFace.get(faceId);
    const modules = bp?.modules ?? [];
    const also = bp?.alsoFeeds ?? [];
    const report_writes = [...modules, ...also]
      .map((m) => m.writes)
      .filter(Boolean)
      .join(" · ");
    const science_disciplines = [
      ...new Set(
        [...modules, ...also].flatMap((m) => [...(m.science_disciplines ?? [])]),
      ),
    ];
    const segment_slots: BookJudgmentSegmentSlot[] = schema.segments.map((seg) => {
      const pref = preferredForSegment(schema.dualTrack, seg.id);
      const copy = toJudgmentSegmentCopy(seg);
      return {
        segmentId: seg.id,
        label: copy.label,
        duty: copy.duty,
        preferred_track: pref.preferred_track,
        needs_unit: pref.needs_unit,
      };
    });
    const mins = faceMins(
      schema.dualTrack,
      segment_slots.filter((s) => s.needs_unit).length,
    );
    faces.push({
      faceId,
      title: schema.title,
      dualTrack: schema.dualTrack,
      report_writes:
        report_writes || toJudgmentDualTrackNote(schema.dualTrackNote),
      science_disciplines,
      min_units: mins.min_units,
      min_destiny: mins.min_destiny,
      min_science: mins.min_science,
      segment_slots,
    });
  }

  const sumFace = faces.reduce((n, f) => n + f.min_units, 0);
  return {
    version: 1,
    total_min_units: Math.max(24, sumFace),
    faces,
  };
}

/** Compact prompt block for the one-shot gun. */
export function formatQuotaTableForPrompt(quota: BookJudgmentQuotaTable): string {
  const lines: string[] = [
    `## 批断配额表（从决策报告反推 · 只写表内需要的 · 禁无依据自由发挥）`,
    `total_min_units=${quota.total_min_units} · 不够条数=失败勿早停`,
    `段职责已正写为：机制/偏差/负荷 | 命理判断 | 交汇张力 | 复盘问句 — 禁手段 duty`,
  ];
  for (const f of quota.faces) {
    lines.push(
      `### Face ${f.faceId}「${f.title}」dualTrack=${f.dualTrack} · min_units=${f.min_units} · min_destiny≥${f.min_destiny} · min_science≥${f.min_science}`,
    );
    if (f.report_writes) {
      lines.push(`报告 writes：${f.report_writes.slice(0, 400)}`);
    }
    if (f.science_disciplines.length) {
      lines.push(`科学学科：${f.science_disciplines.join("、")}`);
    }
    for (const s of f.segment_slots) {
      if (!s.needs_unit) {
        lines.push(`- ${s.segmentId} ${s.label}：可选（${s.duty}）`);
        continue;
      }
      lines.push(
        `- ${s.segmentId} ${s.label} → track≈${s.preferred_track} · duty=${s.duty}`,
      );
    }
  }
  return lines.join("\n");
}

/** Lab/单测：配额 prompt 不得残留手段 duty 标签。 */
export const MEANS_DUTY_LEAK_RE =
  /红灯信号|短信号|更宜的一条路|动作类型|完成样貌|验证单元|加大投入|下一步的动作/;

export function quotaPromptHasMeansDutyLeak(prompt: string): boolean {
  return MEANS_DUTY_LEAK_RE.test(prompt);
}
