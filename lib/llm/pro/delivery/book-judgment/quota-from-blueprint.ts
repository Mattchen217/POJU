/**
 * BookJudgmentPack quota · reverse from report blueprint (Canvas SoT).
 * 报告 → 段表 → 批断配额（反推，不顺推硬塞）。
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
      // D 可核对锚
      return { preferred_track: "any", needs_unit: true };
    case "pointer":
      // A/B/C 各 ≥1；D 指针不强制独立盘面 unit
      if (segmentId === "D") return { preferred_track: "any", needs_unit: false };
      if (segmentId === "A") return { preferred_track: "destiny", needs_unit: true };
      if (segmentId === "B") return { preferred_track: "any", needs_unit: true };
      if (segmentId === "C") return { preferred_track: "science", needs_unit: true };
      return { preferred_track: "any", needs_unit: true };
    case "fold":
      // A/B 双轨；C/D 按 duty
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
  // Canvas: 单脸默认 ≥3（含双轨）
  const min_units = Math.max(3, Math.min(slotCount, 5));
  return {
    min_units,
    min_destiny: 1,
    min_science: dualTrack === "appendix" ? 1 : 1,
  };
}

/**
 * Pack-gun duty 正写：把「红灯信号→短信号 / 近步→动作类型」等操作框标签
 * 改成机制/偏差/负荷职责名（不改 decision-pages 正文 duty SoT）。
 */
function toJudgmentSegmentCopy(seg: {
  id: string;
  label: string;
  duty: string;
}): { label: string; duty: string } {
  const label = seg.label.trim();
  const duty = seg.duty.trim();
  if (/红灯|绿灯|停损/.test(label) || /^短信号/.test(duty)) {
    return {
      label: "偏差·负荷机制",
      duty: "写可验证偏差/负荷/反馈机制；禁信号停损框与条件→投入加减。",
    };
  }
  if (/近步/.test(label) || /动作类型|完成样貌/.test(duty)) {
    return {
      label: "近窗机制约束",
      duty: "写近窗相关机制/偏差/负荷；禁动作类型与完成样貌处方。",
    };
  }
  if (/切轨|停止/.test(label) || /换轨或停下/.test(duty)) {
    return {
      label: "边界判断",
      duty: "写边界/成本判断；禁切轨操作清单。",
    };
  }
  if (/自我调频/.test(label) || /怎么调自己/.test(duty)) {
    return {
      label: "自稳机制",
      duty: "写执行中负荷/偏差自稳机制；禁调频操作处方。",
    };
  }
  if (/科学机制/.test(label)) {
    return {
      label,
      duty: "写可验证机制/偏差/负荷；禁若条件→加大/不再加大投入。",
    };
  }
  return { label, duty };
}

function toJudgmentDualTrackNote(note: string): string {
  return note
    .replace(/红灯[、，,]?/g, "偏差机制、")
    .replace(/近步原则、完成样貌、?/g, "近窗机制约束、")
    .replace(/不是勾选作业。?/g, "禁操作清单。");
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
    const mins = faceMins(schema.dualTrack, segment_slots.filter((s) => s.needs_unit).length);
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
