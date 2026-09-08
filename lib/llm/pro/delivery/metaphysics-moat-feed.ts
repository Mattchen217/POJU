/**
 * P4 metaphysics_action · moat means candidate menu from pack / retune / ten-god / dayun.
 * Quality-first: give the model typed means to grow — do not rely on p4_* sanitize
 * retries to invent timing/polarity/archetype after the fact.
 *
 * Also emits stable eligibility markers so inferP4MoatEligibleTypes / assign
 * share the same truth as this menu.
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";
import { formatDayunSemanticForPrompt } from "@/lib/glossary/dayun-semantic-ssot";
import {
  extractTenGodNamesFromText,
  formatTenGodSemanticForPrompt,
} from "@/lib/glossary/tengod-semantic-ssot";
import type { CoveredAgendaItem } from "./reality-constraints";
import type { P4MoatMeansType } from "@/lib/glossary/wuxing-semantic-ssot";

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function pushUnique(out: string[], line: string, max: number): void {
  const t = line.trim();
  if (!t || out.length >= max) return;
  const norm = t.replace(/\s+/g, "").slice(0, 48);
  if (out.some((x) => x.replace(/\s+/g, "").slice(0, 48) === norm)) return;
  out.push(t);
}

function tenGodBlob(core: BreakthroughCore): string {
  return [
    ...(core.multi_dimension_reckoning ?? []).flatMap((d) => [
      d.dimension,
      d.judgment,
      d.chart_basis,
    ]),
    core.energy_retune_frame?.structural_basis ?? "",
    core.primary_path?.structural_basis ?? "",
    core.key_crossroads?.structural_basis ?? "",
  ].join(" ");
}

export type MetaphysicsMoatFeedOpts = {
  original_question?: string | null;
  desired_outcome?: string | null;
  answerMaxChars?: number;
};

export type MetaphysicsMoatFeedResult = {
  block: string;
  eligible: P4MoatMeansType[];
};

/**
 * Build numbered moat-means menu + eligibility for deep/fill (metaphysics_action).
 * Keep on compress — means cannot be invented from ⟦w:⟧ alone.
 */
export function buildMetaphysicsMoatFeedBlock(
  core: BreakthroughCore | null | undefined,
  covered_agenda: readonly CoveredAgendaItem[] | null | undefined,
  opts?: MetaphysicsMoatFeedOpts,
): MetaphysicsMoatFeedResult {
  const answerMax = opts?.answerMaxChars ?? 180;
  const eligible = new Set<P4MoatMeansType>();
  const lines: string[] = [
    "【P4 护城河手段候选菜单 · dimensions/means 优先生长源】",
    "规则：每维 strategy+means 须能回溯下列某一候选（可压缩改写）；means 用 {text,type}，type 对齐候选类。",
    "有料才写、无料不编；禁止邮件/话术/日历等 P3 科学执行腔换皮；禁止流水摆件/绿植/晒太阳物化补泻。",
    "timing text 须含转折/窗口/切换/多久之一；polarity 须含补给/消耗/靠近/远离/补泻之一；archetype 须含借势/开创/角色定位/格局之一。",
  ];

  const q = opts?.original_question?.trim();
  if (q) lines.push(`问题: ${clip(q, answerMax)}`);
  const want = opts?.desired_outcome?.trim();
  if (want) lines.push(`期望: ${clip(want, answerMax)}`);

  const pack = core?.metaphysics_pack;
  const yong = pack?.yong_shen.primary_yong_shen?.trim();
  const ji = (pack?.yong_shen.ji_shen ?? []).filter(Boolean);
  if (yong && yong !== "(无)") {
    eligible.add("polarity");
    lines.push(`yong: ${yong}`);
    lines.push(`ji: ${ji.join(",") || "(无)"}`);
    lines.push("pack_polarity: (见上 · 用忌驱动靠近/远离)");
    lines.push(
      `极性候选1. type=polarity · 靠近用神侧状态能力（补给），远离忌神过耗；细节贴本案问题/期望，禁物件补泻。`,
    );
    lines.push(
      `极性候选2. type=polarity · 过旺则宜泄成产出/路径，勿硬克；对不上本盘用忌则只写单元素状态调和。`,
    );
  }

  const er = core?.energy_retune_frame;
  const timingVal = er?.timing_ripeness?.trim();
  const hasTiming =
    Boolean(timingVal) && timingVal !== "(缺失)" && timingVal !== "(无)";
  if (hasTiming || er?.structural_basis?.trim()) {
    eligible.add("timing");
    lines.push(`timing_ripeness: ${timingVal || "(见锚)"}`);
    lines.push(
      `current_da_yun_cycle:\n- timing_ripeness: ${timingVal || "(缺失)"}\n- retune_basis: ${clip(er?.structural_basis ?? "", 120) || "(缺失)"}`,
    );
    const phaseDims = (core?.multi_dimension_reckoning ?? [])
      .filter((d) => /大运|流年|周期|阶段|运/.test(d.dimension))
      .slice(0, 3);
    if (phaseDims.length > 0) {
      lines.push("阶段相关多维:");
      for (const d of phaseDims) {
        lines.push(`- 【${d.dimension}】${clip(d.judgment, 100)}（锚: ${clip(d.chart_basis, 60)}）`);
      }
    }
    lines.push(formatDayunSemanticForPrompt(timingVal || er?.structural_basis));
    lines.push(
      `时机候选1. type=timing · 近阶窗口：把推进本案问题的动作排进「可切换/可转折」的阶段窗（多久/切换），勿报吉凶日期。`,
    );
    lines.push(
      `时机候选2. type=timing · 未熟/过冲时先守节奏再图扩展——写清策略切换条件，禁空喊纪元。`,
    );
  }

  const tenGods = core ? extractTenGodNamesFromText(tenGodBlob(core)) : [];
  if (tenGods.length > 0) {
    eligible.add("archetype");
    lines.push(formatTenGodSemanticForPrompt(tenGods));
    lines.push(
      `角色候选1. type=archetype · 借势/角色定位：按本案十神气质调整「你站哪一席」（指挥官/顾问/冲锋），禁与 timing 维逐字雷同。`,
    );
    lines.push(
      `角色候选2. type=archetype · 开创 vs 守成：用格局语言写清本案该借势还是自开，贴问题期望。`,
    );
  } else {
    const roleDims = (core?.multi_dimension_reckoning ?? [])
      .filter((d) => /十神|格局|官杀|印|食伤|比劫/.test(`${d.dimension}${d.judgment}`))
      .slice(0, 2);
    if (roleDims.length > 0) {
      eligible.add("archetype");
      lines.push("【十神语义 SSOT · 内部】（从多维抽取）");
      for (const d of roleDims) {
        lines.push(`- 【${d.dimension}】${clip(d.judgment, 120)}（锚: ${clip(d.chart_basis, 60)}）`);
      }
      lines.push(
        `角色候选1. type=archetype · 按上列格局判断调整角色定位/借势开创，贴本案问题。`,
      );
    }
  }

  if (er?.direction_fit?.trim() || er?.complementary?.trim()) {
    lines.push(
      `场域辅助(非护城河主轴·可选):\n- direction_fit: ${clip(er?.direction_fit ?? "", 120)}\n- complementary: ${clip(er?.complementary ?? "", 120)}`,
    );
  }

  const facts: string[] = [];
  for (const item of covered_agenda ?? []) {
    const label = clip(item.label || "收集项", 40);
    const answer = item.answer?.trim();
    if (answer) pushUnique(facts, `${label}: ${clip(answer, answerMax)}`, 5);
  }
  if (facts.length > 0) {
    lines.push("收集事实(落地细节只许同向):");
    facts.forEach((f, i) => lines.push(`事实${i + 1}. ${f}`));
  }

  const eligibleList = [...eligible];
  lines.push(
    `eligible_moat_classes: ${eligibleList.join(",") || "(none)"}`,
    `建议维数: ${Math.max(3, Math.min(6, eligibleList.length * 2 || 3))}；每类护城河至少兑现 1 条 typed means。`,
  );

  return { block: lines.join("\n"), eligible: eligibleList };
}
