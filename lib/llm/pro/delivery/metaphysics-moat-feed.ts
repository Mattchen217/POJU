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
  scrubAssignClaimBanSeed,
  type AssignPathHint,
} from "./page-schema/assign-binding-seed";
import {
  citeHasMeansAdvice,
  softStripMeansLayerFromClaim,
} from "./page-schema/assign-fact-pack-claim-gate";
import { distributeP4MoatTargets, P4_MOAT_REF_PREFIX } from "./page-schema/deep-evidence-assign";
import { fiveElementToZh } from "@/lib/llm/pro/delivery/locale-evidence-tokens";

function clip(s: string, max: number): string {
  return clipAssignField(s, max);
}

/** Assign prefer_cite: structure/pack line only — never means-body or advice gloss. */
function pickAssignCite(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string | undefined {
  for (const raw of [primary, fallback]) {
    const t = (raw ?? "").trim();
    if (t.length < 4) continue;
    if (citeHasMeansAdvice(t)) continue;
    if (/^type=\w+/i.test(t) || /means\d\s*:/i.test(t)) continue;
    return clip(t, 80);
  }
  return undefined;
}

/** Assign prefer_claim: structure seed only; strip personality/means brochure. */
function pickAssignClaimSeed(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string | undefined {
  for (const raw of [primary, fallback]) {
    const scrubbed = softStripMeansLayerFromClaim(
      scrubAssignClaimBanSeed(raw ?? ""),
    );
    if (scrubbed.length < 8) continue;
    if (citeHasMeansAdvice(scrubbed)) continue;
    return clip(scrubbed, 120);
  }
  return undefined;
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
  /** Assign-only structure claim seed — never paste action means into unit_claim. */
  claim_seed?: string;
};

const REF_PREFIX = P4_MOAT_REF_PREFIX;

/** Deterministic seat label from ten-god — inner role, not job title. */
function archetypeSeatForTenGod(tg: string): string {
  if (/食神|伤官/.test(tg)) return "泄秀表达者";
  if (/正印|偏印/.test(tg)) return "内守涵养者";
  if (/正官|七杀/.test(tg)) return "边界收敛者";
  if (/比肩|劫财/.test(tg)) return "自立并进者";
  if (/正财|偏财/.test(tg)) return "资源节律者";
  return "结构借势者";
}

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
        prefer_cite: pickAssignCite(any.cite, null),
        prefer_claim:
          pickAssignClaimSeed(any.claim_seed, any.cite) ||
          clip(`本维护城河结构主张（dimensions[${i}]）`, 120),
      });
      continue;
    }
    const pool = byType[moat];
    const c = pool.length > 0 ? pool[cursors[moat]++ % pool.length]! : null;
    if (!c) {
      hints.push({
        path,
        prefer_candidate_ref: `${REF_PREFIX[moat]}1`,
        prefer_claim: clip(`本维须兑现 ${moat} 护城河结构（干支/用忌/十神）`, 120),
      });
      continue;
    }
    const idxInType = byType[moat].indexOf(c) + 1;
    hints.push({
      path,
      prefer_primary: c.primary,
      prefer_candidate_ref: `${REF_PREFIX[moat]}${idxInType}`,
      prefer_cite: pickAssignCite(c.cite, null),
      prefer_claim:
        pickAssignClaimSeed(c.claim_seed, c.cite) ||
        clip(`本维须兑现 ${moat} 护城河结构（干支/用忌/十神）`, 120),
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
    "【P4 护城河手段候选菜单 · 自我调频专用】",
    "本菜单只生长「执行主辅时我怎么调自己」：运程窗口 / 用忌补泄 / 十神内在站位。",
    "规则：每维整句抄写下列 means + 贴案轻改；dimensions 条数=派工锁定表；means≥2。",
    "P4≠P3：禁止把谈判/文档/交付/股权/书面协议写成 means；那是科学页。",
    "timing=收缩/切换自身投入带宽；polarity=靠近补给·远离过耗·以泄代克；archetype=内在角色姿态。",
    "【禁项·勿抄进 means】架构文档/交付计划/书面化/验证期/股权话语权/律师备忘录/安全垫/物化补泻/模块换筹码。",
    "chart_anchors 只写结构真词；勿填 leverage/avoid/field_matrix。",
  ];

  const q = opts?.original_question?.trim();
  if (q) lines.push(`问题: ${clip(q, answerMax)}`);
  const want = opts?.desired_outcome?.trim();
  if (want) lines.push(`期望: ${clip(want, answerMax)}`);

  const pack = core?.metaphysics_pack;
  const yong = fiveElementToZh(pack?.yong_shen.primary_yong_shen?.trim() ?? "");
  const ji = (pack?.yong_shen.ji_shen ?? []).map((s) => fiveElementToZh(s)).filter(Boolean);
  if (yong && yong !== "(无)") {
    eligible.add("polarity");
    lines.push(`用神: ${yong}`);
    lines.push(`忌神: ${ji.join("、") || "(无)"}`);
    lines.push("pack_polarity: (见上 · 用忌驱动靠近/远离)");
    const jiBlob = ji.length ? ji.join("、") : "过旺干扰侧";
    const p1 =
      `type=polarity · 完整动作草稿（可抄）\n` +
      `means1: 关键决定前先进入用神${yong}补给态——独处降噪、放慢呼吸与思绪，等内在冷静弹性回来，再面对催促场。\n` +
      `means2: 觉察忌${jiBlob}过耗场（逼迫立刻定夺的高压气场）时主动抽离，先恢复用神弹性，再决定是否回应。`;
    const p2 =
      `type=polarity · 完整动作草稿（可抄）\n` +
      `means1: 忌${jiBlob}燥热上涌时，先用短时专注表达/手作/书写把急躁泄掉（以泄代克），身心回稳后再考虑是否加码。\n` +
      `means2: 泄后回到冷静场域完成状态调和，确认恢复缓冲够用，再继续推进。`;
    lines.push(`极性候选1. ${p1}`);
    lines.push(`极性候选2. ${p2}`);
    typed.push({
      type: "polarity",
      label: "极性候选1",
      body: p1,
      primary: /用神|身弱|身强/.test(yong) ? yong : `用神${yong}`,
      cite: clip(`用神${yong}${ji.length ? `；忌${ji.join("、")}` : ""}`, 80),
      claim_seed: clip(
        `日主身势下用神${yong}偏弱、忌${jiBlob}偏旺，用忌力量对比失衡`,
        120,
      ),
    });
    typed.push({
      type: "polarity",
      label: "极性候选2",
      body: p2,
      primary: ji[0] ? `忌神${ji[0]}` : undefined,
      cite: clip(`用忌补泄：用${yong}`, 80),
      claim_seed: clip(
        `忌${jiBlob}偏旺、用神${yong}受制，生克通关落在用忌结构`,
        120,
      ),
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
    const phaseHint = clip(
      phaseDims[0]?.judgment || timingVal || er?.structural_basis || "大运窗口",
      60,
    );
    const t1 =
      `type=timing · 完整动作草稿（可抄）\n` +
      `means1: 未熟窗口先收缩自身投入带宽——心力与注意力只维持最低必要激活，不因外界催促破窗加码；内在冷静且客观条件成熟时再切换加码。\n` +
      `means2: 未熟期每天固定一段独处降噪作补给窗，只调自己的节奏与恢复，不把破局跳步写进当下身心承诺。`;
    const t2 =
      `type=timing · 完整动作草稿（可抄）\n` +
      `means1: 运岁过冲或未熟时先守自身结构节奏——守成窗口内不加码扩心力；对照 timing_ripeness / ${phaseHint}，窗口到了再加码。\n` +
      `means2: 守成期第二手段只做调频准备（补给、回稳），不做破局跳步。`;
    lines.push(`时机候选1. ${t1}`);
    lines.push(`时机候选2. ${t2}`);
    const phaseCite =
      phaseDims[0]?.judgment || timingVal || er?.structural_basis || "大运窗口";
    const timingCiteClean =
      pickAssignCite(phaseCite, er?.structural_basis) ||
      pickAssignCite(timingVal, "大运流年阶段") ||
      "大运流年阶段";
    typed.push({
      type: "timing",
      label: "时机候选1",
      body: t1,
      primary: "大运",
      cite: timingCiteClean,
      claim_seed: clip(
        `大运流年阶段下用神未透足、忌神成势，运岁窗口未熟（对照：${phaseHint}）`,
        120,
      ),
    });
    typed.push({
      type: "timing",
      label: "时机候选2",
      body: t2,
      primary: /流年|气候交织|交运/.test(String(timingVal))
        ? "流年"
        : "气候交织",
      cite:
        pickAssignCite(timingVal, er?.structural_basis) ||
        "运岁未熟",
      claim_seed: clip(
        `运岁未熟或过冲，大运与流年忌神交织压用神，气候未转`,
        120,
      ),
    });
  }

  const tenGods = core ? extractTenGodNamesFromText(tenGodBlob(core)) : [];
  if (tenGods.length > 0) {
    eligible.add("archetype");
    lines.push(formatTenGodSemanticForPrompt(tenGods));
    const tg0 = tenGods[0]!;
    const tg1 = tenGods[1] ?? tenGods[0]!;
    const role0 = archetypeSeatForTenGod(tg0);
    const role1 = archetypeSeatForTenGod(tg1);
    const a1 =
      `type=archetype · 完整动作草稿（可抄）\n` +
      `means1: 内在按「${tg0}」落成「${role0}」——催促面前先稳住自己的表达/涵养节律，以借势姿态处压力，不把身心绷成硬争主导。\n` +
      `means2: 感到被逼到墙角时，先回到该角色的可进可退站位：收住硬刚冲动，用自己的节律回应，而不是用对抗抬升内耗。`;
    const a2 =
      `type=archetype · 完整动作草稿（可抄）\n` +
      `means1: 用「${tg1}」对照——本案以「${role1}」姿态借势或侧翼自处，先调自己的站位与输出节律。\n` +
      `means2: 输出/涵养节律上保持可进可退；触及硬边界时退回守序姿态，守住自己的调频底线，不硬刚耗自己。`;
    lines.push(`角色候选1. ${a1}`);
    lines.push(`角色候选2. ${a2}`);
    typed.push({
      type: "archetype",
      label: "角色候选1",
      body: a1,
      primary: tg0,
      cite: clip(`十神${tg0}透干/当令`, 80),
      claim_seed: clip(
        `十神${tg0}透干/当令，格局以${tg0}为显、角色力量偏在此十神`,
        120,
      ),
    });
    typed.push({
      type: "archetype",
      label: "角色候选2",
      body: a2,
      primary: tg1,
      cite: clip(`十神${tg1}与日主对照`, 80),
      claim_seed: clip(
        `十神${tg1}对照下格局角色力量落在${tg1}一侧，与日主形成结构对比`,
        120,
      ),
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
        `type=archetype · 完整动作草稿（可抄）\n` +
        `means1: 按上列格局落成内在借势姿态——先稳住自己的表达/涵养节律，不硬争主导耗自己。\n` +
        `means2: 催促加码时收住硬刚冲动，回到可进可退站位，用自身节律回应压力。`;
      lines.push(`角色候选1. ${a1}`);
      const roleCite =
        pickAssignCite(roleDims[0]!.chart_basis, roleDims[0]!.judgment) ||
        pickAssignCite(roleDims[0]!.dimension, "十神格局对照");
      typed.push({
        type: "archetype",
        label: "角色候选1",
        body: a1,
        primary: undefined,
        cite: roleCite,
        claim_seed: clip(
          pickAssignClaimSeed(
            `${clip(roleDims[0]!.chart_basis || roleDims[0]!.dimension, 40)}，十神/格局力量对比见本维角色结构`,
            null,
          ) || "十神/格局力量对比见本维角色结构",
          120,
        ),
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
