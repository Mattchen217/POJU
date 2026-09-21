/**
 * This person's computed chart, written out for a 批断.
 * Not a slug menu. Day master, pillars, hidden stems, 用喜忌 stay in.
 * Only instances that were actually calculated are listed.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { computeNatalChartRelations } from "@/lib/calculations/relation-engine";
import { resolveLuckCycles } from "@/lib/calculations/resolve-luck-cycles";
import { CLOSED_SHEN_SHA } from "@/lib/glossary/term-closed-set";
import { fiveElementToZh } from "@/lib/llm/pro/delivery/locale-evidence-tokens";

const STRENGTH_ZH: Record<ProfileStructured["strength"], string> = {
  strong: "身强",
  weak: "身弱",
  balanced: "中和",
};

const PILLAR_ZH = {
  year: "年柱",
  month: "月柱",
  day: "日柱",
  hour: "时柱",
} as const;

const GANZHI_RE = /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;

export type ChartFactPack = {
  text: string;
  day_master: string;
  ganzhi: string[];
  shen_sha: string[];
};

export function buildChartFactPack(
  structured: ProfileStructured,
  opts?: { as_of?: Date; timezone?: string },
): ChartFactPack {
  const day_master = structured.day_master.trim();
  const ganzhi = new Set<string>();
  const shen_sha = new Set<string>();
  const lines: string[] = [];

  const strength = STRENGTH_ZH[structured.strength] ?? structured.strength;
  lines.push(`日主：${day_master || "—"}（${strength}）`);
  if (structured.pattern?.trim()) lines.push(`格局：${structured.pattern.trim()}`);
  const yong = fiveElementToZh(structured.yong_shen?.trim() ?? "");
  const xi = (structured.xi_shen ?? []).map((s) => fiveElementToZh(s.trim())).filter(Boolean);
  const ji = (structured.ji_shen ?? []).map((s) => fiveElementToZh(s.trim())).filter(Boolean);
  lines.push(`用神：${yong || "—"}`);
  lines.push(`喜神：${xi.join("、") || "—"}`);
  lines.push(`忌神：${ji.join("、") || "—"}`);
  if (yong) lines.push(`用神${yong}`);
  if (xi.length) lines.push(`喜${xi.join("")}`);
  if (ji.length) lines.push(`忌${ji.join("")}`);

  const pillars = structured.four_pillars;
  if (structured.pillars_detail) {
    for (const key of ["year", "month", "day", "hour"] as const) {
      const p = structured.pillars_detail[key];
      if (p.ganzhi) ganzhi.add(p.ganzhi);
      for (const name of p.shen_sha ?? []) {
        const t = name.trim();
        if (t) shen_sha.add(t);
      }
      const tenGod =
        p.ten_god === "元男" || p.ten_god === "元女" ? "日主自身" : p.ten_god || "—";
      const hidden = (p.hidden_stems ?? []).filter(Boolean).join("、") || "无";
      const stars = (p.shen_sha ?? []).filter(Boolean).join("、") || "无";
      lines.push(
        `${PILLAR_ZH[key]} ${p.ganzhi} 天干${p.stem} 地支${p.branch} 十神${tenGod} 藏干${hidden} 神煞${stars}`,
      );
    }
  } else {
    lines.push(
      `四柱 年${pillars.year} 月${pillars.month} 日${pillars.day} 时${pillars.hour}`,
    );
    for (const g of [pillars.year, pillars.month, pillars.day, pillars.hour]) {
      if (g?.trim()) ganzhi.add(g.trim());
    }
  }

  let relations: string[] = [];
  try {
    relations = computeNatalChartRelations(structured)
      .map((r) => r.han.trim())
      .filter(Boolean);
  } catch {
    relations = [];
  }
  lines.push(`本盘合冲刑害：${relations.length ? relations.join("、") : "无"}`);

  try {
    const cycles = resolveLuckCycles(
      structured,
      opts?.as_of ?? new Date(),
      opts?.timezone ?? "UTC",
    );
    if (cycles.dayunEntry?.ganzhi) {
      ganzhi.add(cycles.dayunEntry.ganzhi);
      lines.push(
        `当前大运：${cycles.dayunEntry.ganzhi}（${cycles.dayunEntry.start_age}岁起）`,
      );
    }
    if (cycles.liunian?.ganzhi) {
      ganzhi.add(cycles.liunian.ganzhi);
      lines.push(`当前流年：${cycles.liunian.ganzhi}`);
    }
    if (cycles.liuyue?.ganzhi) {
      ganzhi.add(cycles.liuyue.ganzhi);
      lines.push(`当前流月：${cycles.liuyue.ganzhi}`);
    }
  } catch {
    // Cycles are optional. Natal facts above still stand.
  }

  return {
    text: lines.join("\n"),
    day_master,
    ganzhi: [...ganzhi],
    shen_sha: [...shen_sha],
  };
}

/** Ganzhi pair or named 神煞 in the judgment that this chart did not calculate. */
export function judgmentOffChartReason(
  evidence: string,
  pack: Pick<ChartFactPack, "ganzhi" | "shen_sha">,
): string | null {
  const text = evidence.replace(/⟦(?:w|t|词):([^|]*)(?:\|[^⟧]*)?⟧/g, "$1");
  const allowed = new Set(pack.ganzhi.map((g) => g.trim()).filter(Boolean));
  const found = text.match(GANZHI_RE) ?? [];
  for (const g of found) {
    if (!allowed.has(g)) return `off_chart_ganzhi:${g}`;
  }
  const stars = new Set(pack.shen_sha.map((s) => s.trim()).filter(Boolean));
  for (const name of CLOSED_SHEN_SHA) {
    if (text.includes(name) && !stars.has(name)) return `off_chart_shen_sha:${name}`;
  }
  return null;
}
