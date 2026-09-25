/**
 * P4 metaphysics_action · 东方谋略候选菜单（局势·意象·仪轨）。
 *
 * Spec: `.cursor/docs/P4-东方谋略-规格锁.md`
 * Quality-first: typed means grow from this menu — not p4_* sanitize retries.
 *
 * Internal moat_class 仍用 timing|polarity|archetype（闸门/派工兼容）：
 *   timing   ≈ 奇门局势交锋 + 运岁窗 + 时仪轨
 *   polarity ≈ 八字意象调频（用忌气场）
 *   archetype≈ 十神/门向站位（借势姿态）
 *
 * Soft-translate 走既有 SSOT；本文件只给结构 cite + 东方处世白话草稿，不另起对照表。
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
import type {
  DeliveryQimenFactPack,
  DeliveryQimenStance,
} from "./page-schema/qimen-fact-pack";
import {
  DELIVERY_QIMEN_FACT_PACK_HEADER,
  isValidDeliveryQimenFactPack,
} from "./page-schema/qimen-fact-pack";

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
  /** Locked qimen pan from delivery Fact-pack (Step1). */
  qimen?: DeliveryQimenFactPack | null;
  /** Full chart fact pack text (may already contain qimen section). */
  chart_fact_pack?: string | null;
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

/** Imagery verbs from 用神 — zero bare 食神/丙火; no CBT bandwidth jargon. */
function yongImagery(yong: string): { near: string; cool: string } {
  if (yong.includes("水")) {
    return { near: "静润降温、涵养沉潜", cool: "以静制动，待气定再应" };
  }
  if (yong.includes("金")) {
    return { near: "肃杀立界、收束锋芒", cool: "借金立界，斩断杂气蔓延" };
  }
  if (yong.includes("木")) {
    return { near: "舒展疏导、侧翼生发", cool: "借势伸展，不硬顶硬刚" };
  }
  if (yong.includes("火")) {
    return { near: "明照聚焦、短时宣泄", cool: "先泄燥火，再定加码" };
  }
  if (yong.includes("土")) {
    return { near: "厚载沉稳、落笔定心", cool: "以实镇虚，心神归位" };
  }
  return { near: "回稳补给、远离过耗", cool: "先稳住气场再应外催" };
}

function stanceMeans(stance: DeliveryQimenStance): {
  means1: string;
  means2: string;
  strategyHint: string;
} {
  switch (stance) {
    case "attack":
      return {
        strategyHint: "局开宜进取，仍须先按住自身躁气再动，忌被虚高声势牵着冲",
        means1:
          "局势宜进取时，仍先拉开半步缓冲冷静期——气定后再推进，不在催促场里当场拍板。",
        means2:
          "进取前做一次身心结界：静坐片刻或温凉饮一轮，确认自己未入对方火阵，再迈步。",
      };
    case "hold":
      return {
        strategyHint: "局宜守养休整，未熟不拔根，保住既有源头",
        means1:
          "守成窗口内收缩心力激活——只维持本分节律，不因外催把破局跳步写进当下身心承诺。",
        means2:
          "每天固定一段独处静场作恢复仪轨，只调自己的节奏，不做破局加码。",
      };
    case "hide":
      return {
        strategyHint: "局宜藏隐试探，暗中看清再露锋",
        means1:
          "藏隐局中先稳住可进可退姿态——轻力试探即可，不把全部心力押进对方节奏。",
        means2:
          "关键交涉前换到通风开阔、背靠实墙的清静场，避开局促逼仄的高压场再开口。",
      };
    case "display":
      return {
        strategyHint: "局宜显名示能，但忌强结硬绑",
        means1:
          "显名示能时只亮本分锋芒，不把身心绑死在一局；见虚高声势先拉开时空再应。",
        means2:
          "表态前静坐片刻理清底线，确认未入画饼火阵，再用自己的节律回应。",
      };
    case "retreat":
    default:
      return {
        strategyHint: "局偏耗损，宜退避防损，先护己气",
        means1:
          "逆风局先退后半步——拉开缓冲冷静期，不入对方高压场做重大定夺。",
        means2:
          "急躁或被逼时先温凉饮/深呼吸三轮泄掉燥气，身心回稳后再考虑是否回应。",
      };
  }
}

function resolveQimen(
  opts?: MetaphysicsMoatFeedOpts,
): DeliveryQimenFactPack | null {
  if (isValidDeliveryQimenFactPack(opts?.qimen ?? null)) return opts!.qimen!;
  const pack = opts?.chart_fact_pack?.trim() ?? "";
  if (!pack.includes(DELIVERY_QIMEN_FACT_PACK_HEADER)) return null;
  // Lightweight parse for menu growth when structured qimen object missing.
  const ju = pack.match(/局:\s*([^\n]+)/)?.[1]?.trim();
  const fu = pack.match(/值符:\s*([^\n]+)/)?.[1]?.trim();
  const shi = pack.match(/值使:\s*([^\n]+)/)?.[1]?.trim();
  const host = pack.match(/主客：[^\n]+/)?.[0]?.trim();
  const stanceZh = pack.match(/局势取向:\s*([^（\n]+)/)?.[1]?.trim();
  const castAt = pack.match(/锁盘时刻:\s*([^\n]+)/)?.[1]?.trim();
  if (!ju || !shi) return null;
  const stance: DeliveryQimenStance = /进取/.test(stanceZh ?? "")
    ? "attack"
    : /守养|休整/.test(stanceZh ?? "")
      ? "hold"
      : /藏隐|试探/.test(stanceZh ?? "")
        ? "hide"
        : /显名/.test(stanceZh ?? "")
          ? "display"
          : "retreat";
  const door = shi.replace(/落.*/, "").trim();
  return {
    qimen_cast_at: castAt || new Date(0).toISOString(),
    ju_name: ju,
    zhi_fu_star: fu?.replace(/落.*/, "").trim() || "值符",
    zhi_fu_palace: fu?.match(/落(.+)/)?.[1]?.trim() || "",
    zhi_shi_door: door,
    zhi_shi_palace: shi.match(/落(.+)/)?.[1]?.trim() || "",
    host_guest: host || "主客：（见奇门锁盘）",
    stance,
    stance_zh: stanceZh || "宜守养休整",
    door_meaning_zh: door,
    wang_xiang: "",
    palace_lines: [],
    text: pack.slice(pack.indexOf(DELIVERY_QIMEN_FACT_PACK_HEADER)),
  };
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
        prefer_claim: clip(`本维须兑现 ${moat} 护城河结构（干支/用忌/十神/奇门）`, 120),
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
        clip(`本维须兑现 ${moat} 护城河结构（干支/用忌/十神/奇门）`, 120),
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
    "【P4 东方谋略手段候选菜单 · 暗锦囊】",
    "定位：相对 P3 明战术的暗面——局势交锋 · 意象调频 · 行为仪轨。",
    "映射（内部 type 不变）：timing=局势/运岁窗/时仪轨；polarity=用忌意象气场；archetype=十神·门向站位。",
    "规则：每维整句抄写下列 means + 贴案轻改；dimensions 条数=派工锁定表；means≥2。",
    "P4≠P3：禁合同/条款/股权/律师/Excel/OKR/邮件模板/谈判话术剧本/里程碑锁权益。",
    "文风：东方处世谋略（以静制动、未熟不拔根、借势不硬刚）；禁投入带宽/补给态/过度激活/破窗加码等科技心理黑话。",
    "仪轨白名单：缓冲冷静期、静坐片刻、温凉饮、深呼吸、通风开阔处、背靠实墙。禁水晶/符咒/道具买卖/绿植晒太阳物化。",
    "正文零裸专名（无食神/奇门遁甲报幕）；chart_anchors 只写结构真词；勿填 leverage/avoid/field_matrix。",
  ];

  const q = opts?.original_question?.trim();
  if (q) lines.push(`问题: ${clip(q, answerMax)}`);
  const want = opts?.desired_outcome?.trim();
  if (want) lines.push(`期望: ${clip(want, answerMax)}`);

  const qimen = resolveQimen(opts);
  if (qimen) {
    eligible.add("timing");
    lines.push("【奇门锁盘·局势真算】");
    lines.push(`锁盘: ${qimen.qimen_cast_at}`);
    lines.push(`局: ${qimen.ju_name}`);
    lines.push(`值符: ${qimen.zhi_fu_star}落${qimen.zhi_fu_palace}`);
    lines.push(`值使: ${qimen.zhi_shi_door}落${qimen.zhi_shi_palace}`);
    lines.push(qimen.host_guest);
    lines.push(`局势取向: ${qimen.stance_zh}`);
    const sm = stanceMeans(qimen.stance);
    const tQ =
      `type=timing · 完整动作草稿（可抄）· 局势交锋\n` +
      `means1: ${sm.means1}\n` +
      `means2: ${sm.means2}`;
    lines.push(`时机候选1. ${tQ}`);
    typed.push({
      type: "timing",
      label: "时机候选1",
      body: tQ,
      primary: qimen.zhi_shi_door,
      cite: clip(
        `值使${qimen.zhi_shi_door}落${qimen.zhi_shi_palace}；${qimen.ju_name}`,
        80,
      ),
      claim_seed: clip(
        `${qimen.ju_name}，值使${qimen.zhi_shi_door}落${qimen.zhi_shi_palace}，${qimen.host_guest.replace(/^主客：/, "")}`,
        120,
      ),
    });
  }

  const pack = core?.metaphysics_pack;
  const yong = fiveElementToZh(pack?.yong_shen.primary_yong_shen?.trim() ?? "");
  const ji = (pack?.yong_shen.ji_shen ?? [])
    .map((s) => fiveElementToZh(s))
    .filter(Boolean);
  if (yong && yong !== "(无)") {
    eligible.add("polarity");
    lines.push(`用神: ${yong}`);
    lines.push(`忌神: ${ji.join("、") || "(无)"}`);
    lines.push("pack_polarity: (见上 · 用忌驱动意象调频)");
    const jiBlob = ji.length ? ji.join("、") : "过旺干扰侧";
    const img = yongImagery(yong);
    const p1 =
      `type=polarity · 完整动作草稿（可抄）· 意象调频\n` +
      `means1: 关键定夺前先靠近用神${yong}意象——${img.near}；${img.cool}，再面对催促场。\n` +
      `means2: 觉察忌${jiBlob}燥气上涌（逼迫立刻定夺的高压场）时主动抽离，先恢复静定，再决定是否回应。`;
    const p2 =
      `type=polarity · 完整动作草稿（可抄）· 意象调频\n` +
      `means1: 忌${jiBlob}燥热上涌时，先用短时专注表达/手作/书写把急躁泄掉，身心回稳后再考虑是否加码。\n` +
      `means2: 泄后回到清静场域完成状态调和——温凉饮或深呼吸三轮亦可——确认缓冲够用再继续。`;
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
    const tDayun =
      `type=timing · 完整动作草稿（可抄）· 运岁局势\n` +
      `means1: 运岁窗口未熟时先守成——心力只维持本分节律，不因外催把破局跳步写进当下身心承诺；气定且条件成熟再切换加码。\n` +
      `means2: 未熟期每天固定一段独处静场作仪轨，只调自己的节奏与恢复，不做破局加码。`;
    const tIdx = typed.filter((c) => c.type === "timing").length + 1;
    lines.push(`时机候选${tIdx}. ${tDayun}`);
    const phaseCite =
      phaseDims[0]?.judgment || timingVal || er?.structural_basis || "大运窗口";
    const timingCiteClean =
      pickAssignCite(phaseCite, er?.structural_basis) ||
      pickAssignCite(timingVal, "大运流年阶段") ||
      "大运流年阶段";
    typed.push({
      type: "timing",
      label: `时机候选${tIdx}`,
      body: tDayun,
      primary: "大运",
      cite: timingCiteClean,
      claim_seed: clip(
        `大运流年阶段下用神未透足、忌神成势，运岁窗口未熟（对照：${phaseHint}）`,
        120,
      ),
    });
    if (typed.filter((c) => c.type === "timing").length < 2) {
      const t2 =
        `type=timing · 完整动作草稿（可抄）· 运岁局势\n` +
        `means1: 运岁过冲或未熟时先守自身结构节奏——守成窗口内不加码扩心力；对照 timing_ripeness / ${phaseHint}，窗口到了再加码。\n` +
        `means2: 守成期第二手段只做仪轨准备（静场、回稳），不做破局跳步。`;
      lines.push(`时机候选2. ${t2}`);
      typed.push({
        type: "timing",
        label: "时机候选2",
        body: t2,
        primary: /流年|气候交织|交运/.test(String(timingVal))
          ? "流年"
          : "气候交织",
        cite: pickAssignCite(timingVal, er?.structural_basis) || "运岁未熟",
        claim_seed: clip(
          `运岁未熟或过冲，大运与流年忌神交织压用神，气候未转`,
          120,
        ),
      });
    }
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
      `type=archetype · 完整动作草稿（可抄）· 站位借势\n` +
      `means1: 内在按「${role0}」借势站位——催促面前先稳住自己的表达/涵养节律，不把身心绷成硬争主导。\n` +
      `means2: 感到被逼到墙角时，先回到可进可退站位：收住硬刚冲动，用自己的节律回应，而不是用对抗抬升内耗。`;
    const a2 =
      `type=archetype · 完整动作草稿（可抄）· 站位借势\n` +
      `means1: 对照「${role1}」姿态侧翼自处——先调自己的站位与输出节律，不抢台前硬名。\n` +
      `means2: 触及硬边界时退回守序姿态，守住身心结界底线，不硬刚耗自己。`;
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
        `type=archetype · 完整动作草稿（可抄）· 站位借势\n` +
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
    lines.push("收集事实(落地细节只许同向·不得写成 P3 工具):");
    facts.forEach((f, i) => lines.push(`事实${i + 1}. ${f}`));
  }

  const eligibleList = [...eligible];
  const unitCount = Math.max(3, Math.min(6, eligibleList.length * 2 || 3));
  lines.push(
    `eligible_moat_classes: ${eligibleList.join(",") || "(none)"}`,
    `建议维数: ${unitCount}；每类护城河至少兑现 1 条 typed means（局势/意象/站位）。`,
  );

  const hintTable = formatAssignBindingHintTable(
    buildMetaphysicsAssignPathHints(typed, eligibleList, unitCount),
  );
  if (hintTable) lines.push(hintTable);

  return { block: lines.join("\n"), eligible: eligibleList };
}
