/**
 * P4 metaphysics_action · moat means candidate menu from pack / retune / ten-god / dayun.
 * Quality-first: give the model typed means to grow — do not rely on p4_* sanitize
 * retries to invent timing/polarity/archetype after the fact.
 *
 * Also emits stable eligibility markers so inferP4MoatEligibleTypes / assign
 * share the same truth as this menu, plus Assign binding hint table.
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";
import { formatDayunSemanticForPrompt } from "@/lib/glossary/dayun-semantic-ssot";
import {
  extractTenGodNamesFromText,
  formatTenGodSemanticForPrompt,
} from "@/lib/glossary/tengod-semantic-ssot";
import type { CoveredAgendaItem } from "./reality-constraints";
import type { P4MoatMeansType } from "@/lib/glossary/wuxing-semantic-ssot";
import {
  clipAssignField,
  formatAssignBindingHintTable,
  type AssignPathHint,
} from "./page-schema/assign-binding-seed";
import { distributeP4MoatTargets } from "./page-schema/deep-evidence-assign";

function clip(s: string, max: number): string {
  return clipAssignField(s, max);
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

export type MoatTypedCandidate = {
  type: P4MoatMeansType;
  label: string;
  body: string;
  primary?: string;
  cite?: string;
};

const REF_PREFIX: Record<P4MoatMeansType, string> = {
  timing: "时机候选",
  polarity: "极性候选",
  archetype: "角色候选",
};

/**
 * Round-robin typed candidates onto dimensions[i] aligned with moat targets.
 */
export function buildMetaphysicsAssignPathHints(
  candidates: readonly MoatTypedCandidate[],
  eligible: readonly P4MoatMeansType[],
  unitCount: number,
): AssignPathHint[] {
  const n = Math.max(2, Math.min(6, unitCount));
  const targets = distributeP4MoatTargets(new Set(eligible), n);
  const byType: Record<P4MoatMeansType, MoatTypedCandidate[]> = {
    timing: [],
    polarity: [],
    archetype: [],
  };
  for (const c of candidates) byType[c.type].push(c);
  const cursors: Record<P4MoatMeansType, number> = {
    timing: 0,
    polarity: 0,
    archetype: 0,
  };

  const hints: AssignPathHint[] = [];
  for (let i = 0; i < n; i++) {
    const moat = targets[i];
    const path = `dimensions[${i}]`;
    if (!moat) {
      const any = candidates[i % Math.max(1, candidates.length)];
      if (!any) continue;
      hints.push({
        path,
        prefer_primary: any.primary,
        prefer_candidate_ref: any.label,
        prefer_cite: any.cite || clip(any.body, 80),
        prefer_claim: clip(any.body.replace(/^type=\w+\s*·\s*/, ""), 120),
      });
      continue;
    }
    const pool = byType[moat];
    const c = pool.length > 0 ? pool[cursors[moat]++ % pool.length]! : null;
    if (!c) {
      hints.push({
        path,
        prefer_candidate_ref: `${REF_PREFIX[moat]}1`,
        prefer_claim: clip(`本维须兑现 ${moat} 护城河机制`, 120),
      });
      continue;
    }
    const idxInType = byType[moat].indexOf(c) + 1;
    hints.push({
      path,
      prefer_primary: c.primary,
      prefer_candidate_ref: `${REF_PREFIX[moat]}${idxInType}`,
      prefer_cite: c.cite || clip(c.body, 80),
      prefer_claim: clip(c.body.replace(/^type=\w+\s*·\s*/, ""), 120),
    });
  }
  return hints;
}

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
  const typed: MoatTypedCandidate[] = [];
  const lines: string[] = [
    "【P4 护城河手段候选菜单 · dimensions/means 优先生长源】",
    "规则：每维 strategy+means 须能回溯下列某一候选（可压缩改写）；means 用 {text,type}，type 对齐候选类。",
    "有料才写、无料不编；禁止邮件/话术/日历等 P3 科学执行腔换皮；禁止流水摆件/绿植/晒太阳物化补泻。",
    "timing text 须含转折/窗口/切换/多久之一；polarity 须含补给/消耗/靠近/远离/补泻之一；archetype 须含借势/开创/角色定位/格局之一。",
    "手段须像东方调频动作（节律窗口/补给远离/借势站位），禁止周独处复盘、兼职顾问工时协议、止损计划、财务 KPI 等项目管理句当主 means。",
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
    const p1 =
      "type=polarity · 靠近能补给冷静弹性的状态场（人/时/向择一），主动远离持续掏空根基的过耗场；贴本案问题，禁物件补泻、禁周复盘清单。";
    const p2 =
      "type=polarity · 过旺则宜泄成可交付产出/路径，勿硬克；对不上本盘用忌则只写单元素状态调和，勿写财务 KPI。";
    lines.push(`极性候选1. ${p1}`);
    lines.push(`极性候选2. ${p2}`);
    typed.push({
      type: "polarity",
      label: "极性候选1",
      body: p1,
      primary: /用神|身弱|身强/.test(yong) ? yong : `用神${yong}`,
      cite: clip(`用神${yong}${ji.length ? `；忌${ji.join("、")}` : ""}`, 80),
    });
    typed.push({
      type: "polarity",
      label: "极性候选2",
      body: p2,
      primary: ji[0] ? `忌神${ji[0]}` : undefined,
      cite: clip(`用忌补泄：用${yong}`, 80),
    });
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
        lines.push(
          `- 【${d.dimension}】${clip(d.judgment, 100)}（锚: ${clip(d.chart_basis, 60)}）`,
        );
      }
    }
    lines.push(formatDayunSemanticForPrompt(timingVal || er?.structural_basis));
    const t1 =
      "type=timing · 近阶窗口：把推进本案的关键动作排进「可切换/可转折」的阶段窗（多久/切换条件），用结构节律说话，勿报吉凶日期，勿写兼职工时协议。";
    const t2 =
      "type=timing · 未熟/过冲时先守结构节奏再图扩展——写清策略切换的运程条件（窗口到了才加码），禁空喊纪元、禁财务安全垫 KPI。";
    lines.push(`时机候选1. ${t1}`);
    lines.push(`时机候选2. ${t2}`);
    const phaseCite =
      phaseDims[0]?.judgment || timingVal || er?.structural_basis || "大运窗口";
    typed.push({
      type: "timing",
      label: "时机候选1",
      body: t1,
      primary: "大运",
      cite: clip(phaseCite, 80),
    });
    typed.push({
      type: "timing",
      label: "时机候选2",
      body: t2,
      primary: /流年|气候交织|交运/.test(String(timingVal))
        ? "流年"
        : "气候交织",
      cite: clip(timingVal || "未熟先守节奏", 80),
    });
  }

  const tenGods = core ? extractTenGodNamesFromText(tenGodBlob(core)) : [];
  if (tenGods.length > 0) {
    eligible.add("archetype");
    lines.push(formatTenGodSemanticForPrompt(tenGods));
    const a1 =
      "type=archetype · 借势/角色定位：按本案十神气质调整「你站哪一席」（输出者/守序者/冲锋者），用表达与技艺借势，禁与 timing 维逐字雷同，禁签约兼职顾问句。";
    const a2 =
      "type=archetype · 开创 vs 守成：用格局语言写清本案该借势还是侧翼自开，贴问题期望；手段写站位与输出姿态，不写项目管理里程碑。";
    lines.push(`角色候选1. ${a1}`);
    lines.push(`角色候选2. ${a2}`);
    typed.push({
      type: "archetype",
      label: "角色候选1",
      body: a1,
      primary: tenGods[0],
      cite: clip(`十神角色：${tenGods.slice(0, 3).join("、")}`, 80),
    });
    typed.push({
      type: "archetype",
      label: "角色候选2",
      body: a2,
      primary: tenGods[1] ?? tenGods[0],
      cite: clip(`格局角色：${tenGods.slice(0, 2).join("、")}`, 80),
    });
  } else {
    const roleDims = (core?.multi_dimension_reckoning ?? [])
      .filter((d) =>
        /十神|格局|官杀|印|食伤|比劫/.test(`${d.dimension}${d.judgment}`),
      )
      .slice(0, 2);
    if (roleDims.length > 0) {
      eligible.add("archetype");
      lines.push("【十神语义 SSOT · 内部】（从多维抽取）");
      for (const d of roleDims) {
        lines.push(
          `- 【${d.dimension}】${clip(d.judgment, 120)}（锚: ${clip(d.chart_basis, 60)}）`,
        );
      }
      const a1 =
        "type=archetype · 按上列格局判断调整角色定位/借势开创，贴本案问题。";
      lines.push(`角色候选1. ${a1}`);
      typed.push({
        type: "archetype",
        label: "角色候选1",
        body: a1,
        primary: undefined,
        cite: clip(roleDims[0]!.judgment, 80),
      });
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
  const unitCount = Math.max(3, Math.min(6, eligibleList.length * 2 || 3));
  lines.push(
    `eligible_moat_classes: ${eligibleList.join(",") || "(none)"}`,
    `建议维数: ${unitCount}；每类护城河至少兑现 1 条 typed means。`,
  );

  const hintTable = formatAssignBindingHintTable(
    buildMetaphysicsAssignPathHints(typed, eligibleList, unitCount),
  );
  if (hintTable) lines.push(hintTable);

  return { block: lines.join("\n"), eligible: eligibleList };
}
