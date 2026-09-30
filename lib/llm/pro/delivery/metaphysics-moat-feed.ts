/**
 * P4 metaphysics_action · 东方谋略约束帧（局势·意象·仪轨）。
 *
 * Spec: `.cursor/docs/P4-东方谋略-规格锁.md`
 * 铁律「禁正例照抄」：只给方向 + 禁区 + 本盘真算料；禁止整句 means 范文。
 * fill 按本维批断自写 means；本文件不提供可跨案照抄的动作句。
 *
 * Internal moat_class 仍用 timing|polarity|archetype（闸门/派工兼容）：
 *   timing   ≈ 奇门局势交锋 + 运岁窗
 *   polarity ≈ 八字意象调频 + 行为仪轨（类别上限）
 *   archetype≈ 十神/门向站位（借势姿态）
 *
 * Soft-translate 走既有 SSOT；禁另起对照表。
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
  buildQimenAdversarialMicroScript,
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
  /**
   * 批断枪：不灌 Q/E/收集事实（处境词诱回写）；保留锁盘+派工+结构候选。
   */
  forJudgment?: boolean;
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

/**
 * P4 批断枪 means_candidate_ref 闭集（与派工绑定表 round-robin 一致）。
 * 代码按 path 下标钉死；禁模型自造「运岁近窗未熟/泄秀节律者」等人设标签。
 */
export const METAPHYSICS_JUDGMENT_MEANS_REFS = [
  "时机候选1",
  "极性候选1",
  "角色候选1",
  "时机候选2",
  "极性候选2",
  "角色候选2",
] as const;

export const METAPHYSICS_JUDGMENT_PATHS = [
  "dimensions[0]",
  "dimensions[1]",
  "dimensions[2]",
  "dimensions[3]",
  "dimensions[4]",
  "dimensions[5]",
] as const;

export const METAPHYSICS_JUDGMENT_MOAT_BY_INDEX: readonly P4MoatMeansType[] = [
  "timing",
  "polarity",
  "archetype",
  "timing",
  "polarity",
  "archetype",
];

/** Deterministic seat label from ten-god — inner role, not job title / deliverable. */
function archetypeSeatForTenGod(tg: string): string {
  if (/食神|伤官/.test(tg)) return "泄秀节律者";
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

/** Assign claim_seed only — structure tension, never 宜进取/宜守养 stance prescription. */
function qimenTimingClaimSeed(qimen: DeliveryQimenFactPack): string {
  const hg = qimen.host_guest.replace(/^主客：/, "").trim();
  const base = `${qimen.ju_name}，值使${qimen.zhi_shi_door}落${qimen.zhi_shi_palace}，${hg}`;
  if (/客克主/.test(hg)) return clip(`${base}，主方受制`, 120);
  if (/主克客/.test(hg)) return clip(`${base}，主方势偏强`, 120);
  if (/主生客/.test(hg)) return clip(`${base}，主方外泄生客`, 120);
  if (/客生主/.test(hg)) return clip(`${base}，客来生主`, 120);
  if (/比和/.test(hg)) return clip(`${base}，主客比和胶着`, 120);
  return clip(base, 120);
}

/** Stance → 宏观方向 only（禁整句 means 范文）。 */
function stanceDirection(stance: DeliveryQimenStance): string {
  switch (stance) {
    case "attack":
      return "局开宜进取：先按住自身躁气，忌被虚高声势牵着冲——先借势、后露锋";
    case "hold":
      return "局宜守养休整：未熟不拔根，保住既有源头——静默守气口";
    case "hide":
      return "局宜藏隐试探：暗中看清再露锋——敌明我暗";
    case "display":
      return "局宜显名示能：亮锋芒、忌强结硬绑";
    case "retreat":
    default:
      return "局偏耗损：宜退避防损，先护己气——避锋、收气口";
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
 * Build P4 constraint frame + eligibility for deep/fill (metaphysics_action).
 * 禁正例：不提供可抄 means 句；fill 按本维批断 + 下列真算/方向自写。
 */
export function buildMetaphysicsMoatFeedBlock(
  core: BreakthroughCore | null | undefined,
  covered_agenda: readonly CoveredAgendaItem[] | null | undefined,
  opts?: MetaphysicsMoatFeedOpts,
): MetaphysicsMoatFeedResult {
  const answerMax = opts?.answerMaxChars ?? 180;
  const forJudgment = opts?.forJudgment === true;
  const eligible = new Set<P4MoatMeansType>();
  const typed: MoatTypedCandidate[] = [];
  const lines: string[] = [
    "【P4 东方谋略约束帧 · 暗锦囊】",
    "定位：相对 P3 明战术的暗面——局势交锋 · 意象调频 · 行为仪轨。",
    "映射（内部 type 不变）：timing=局势/运岁窗；polarity=用忌意象+行为仪轨；archetype=十神站位（体态/结界，禁交付物）。",
    "【禁正例照抄 · 硬】下列是方向+禁区+本盘真算料，不是可抄范文。每维 means 须按本维批断自写（≥2）；禁止复用跨案套话；dimensions 条数=派工锁定表。",
    "【论证绑定 · 硬】每条 means 必须能回答：本维批断如何证明「只对此人要这样做」？答不出=废。",
    "【仪轨类别上限 · 硬】仪轨 ∈ 节奏差 / 空间切断 / 体态收势（防神棍）；禁符咒/水晶/物化。具体动词由本案批断长出；跨维禁止复读同一动作；整页不可只剩同一套身心减压模板。",
    "【站位禁交付物 · 硬】archetype means 只写站位/体态/结界/时机；禁止技术方案/技术文档/架构说明/交付物换筹码（P3 域）。",
    "【一句话动作锚 · 硬】允许一句收口动作语落地节奏差；禁止多轮口播话术剧本。",
    "【维名分工 · 硬】timing→「局势…」；polarity 意象候选→「意象调频…」；polarity 仪轨候选→唯一「行为仪轨…」；archetype→「站位借势…」（禁把站位也标行为仪轨）。",
    "【局势看透 · 硬】奇门 timing 维 strategy 须写清敌虚实（虚高/画饼/压出手位）+ 我方攻守位 + 近窗或节奏差；禁止只写「对方催促压力大」。",
    "P4≠P3：禁商业文书/交付物词族（与 system duty · 规格锁 §5 同集）。此处不复述词表，避免 priming。合伙权责议题→正文只用结界/底线/气口/出手位/攻守/藏隐。",
    "底线：不恐吓、不预测吉凶时点、不承诺结果；禁编造盘外宫门。",
    "文风：东方谋略/兵法意象（伏击、静默、破局、借势、气口、锋芒、藏隐、露锋）——须写成大白话完整句、可翻译；禁四字电报/半文言格言墙；禁 HR「注意沟通」腔与「专业壁垒/信息壁垒」职场教练腔；禁投入带宽等科技心理黑话。",
    "正文零裸专名报幕（无食神/奇门遁甲/水旺）；chart_anchors 只写结构真词；勿填 leverage/avoid/field_matrix。",
    "正文维名须覆盖三柱：≥1 维名含「局势」、≥1 含「意象」、恰好 1 含「行为仪轨」；站位维用「站位」勿挤占仪轨名额。",
    "【批断枪读法】约束帧仪轨/取向只供正文。批断主张=门宫主客·用忌·岁运张力（气口/场域虚高/窗口收窄）；禁仪轨处方、露锋、处境尾巴（白忙/权益/话语权/权力分配/模糊条款）；禁半截「若，」「使得，」「站位需…」。",
  ];

  if (!forJudgment) {
    const q = opts?.original_question?.trim();
    if (q) lines.push(`问题: ${clip(q, answerMax)}`);
    const want = opts?.desired_outcome?.trim();
    if (want) lines.push(`期望: ${clip(want, answerMax)}`);
  } else {
    lines.push(
      "【批断枪】不灌议题原文/收集事实；停在门宫·用忌·岁运张力；禁兼职/全职/权力/权益作机制主语。",
    );
  }

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
    lines.push(buildQimenAdversarialMicroScript(qimen));
    const dir = stanceDirection(qimen.stance);
    lines.push(`局势方向: ${dir}`);
    const tQ =
      `type=timing · 约束帧·局势交锋（自写 means，禁抄套话）\n` +
      `真算: ${qimen.ju_name}；值使${qimen.zhi_shi_door}落${qimen.zhi_shi_palace}；${qimen.host_guest}\n` +
      `方向: ${dir}\n` +
      `填法: strategy 写清敌虚实+我方攻守+近窗/节奏差；means≥2 须能被上列真算证明；正文用博弈白话（客强压主/出手位被压），真词进 chart_anchors。`;
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
      claim_seed: qimenTimingClaimSeed(qimen),
    });
  }

  const pack = core?.metaphysics_pack;
  let yong = fiveElementToZh(pack?.yong_shen.primary_yong_shen?.trim() ?? "");
  let ji = (pack?.yong_shen.ji_shen ?? [])
    .map((s) => fiveElementToZh(s))
    .filter(Boolean);
  // Fallback: fact-pack lines when breakthrough pack missing (still grow polarity).
  if ((!yong || yong === "(无)") && opts?.chart_fact_pack?.trim()) {
    const ym = opts.chart_fact_pack.match(/用神[：:]\s*([金木水火土]+)/);
    const jm = opts.chart_fact_pack.match(/忌神[：:]\s*([^\n]+)/);
    if (ym?.[1]) yong = ym[1];
    if (jm?.[1]) {
      ji = [...jm[1].matchAll(/[金木水火土]/g)].map((m) => m[0]!);
    }
  }
  if (yong && yong !== "(无)") {
    eligible.add("polarity");
    lines.push(`用神: ${yong}`);
    lines.push(`忌神: ${ji.join("、") || "(无)"}`);
    lines.push("pack_polarity: (见上 · 用忌驱动意象调频)");
    const jiBlob = ji.length ? ji.join("、") : "过旺干扰侧";
    const img = yongImagery(yong);
    const p1 =
      `type=polarity · 约束帧·意象调频（自写 means，禁抄套话）\n` +
      `真算: 用神${yong}偏弱未得令（本候选少写忌神堆砌）\n` +
      `方向: 靠近用神气场（${img.near}）；忌气上涌时${img.cool}；不入对方催促火阵\n` +
      `填法: 维名「意象调频…」；means 写气场稳压，须能被用忌证明；禁写成职场课。\n` +
      `派工主张核（与极性2互异）: 只钉「用神${yong}偏弱/未得令」；禁止复读忌神成势+通关。`;
    const p2 =
      `type=polarity · 约束帧·行为仪轨（整页唯一仪轨维；自写 means）\n` +
      `真算: 忌${jiBlob}成势压局；通关未立（本候选少写用神偏弱套话）\n` +
      `方向: 仪轨须落在「节奏差 / 空间切断 / 体态收势」之一类；一句可执行、可被本维批断解释\n` +
      `填法: 维名恰好含「行为仪轨」；means≥2 互不换皮；禁止跨维复读他维已用动作；禁 P3 工具。\n` +
      `派工主张核（与极性1互异）: 只钉「忌${jiBlob}成势 + 通关未立/关口阻滞」；禁止再写用神偏弱力量对比。`;
    lines.push(`极性候选1. ${p1}`);
    lines.push(`极性候选2. ${p2}`);
    typed.push({
      type: "polarity",
      label: "极性候选1",
      body: p1,
      primary: /用神|身弱|身强/.test(yong) ? yong : `用神${yong}`,
      cite: clip(`用神${yong}${ji.length ? `；忌${ji.join("、")}` : ""}`, 80),
      claim_seed: clip(`用神${yong}偏弱未得令，意象侧用神力量不足`, 120),
    });
    typed.push({
      type: "polarity",
      label: "极性候选2",
      body: p2,
      primary: ji[0] ? `忌神${ji[0]}` : undefined,
      cite: clip(
        ji[0] ? `忌神${ji[0]}成势；通关未立` : `忌${jiBlob}成势；通关未立`,
        80,
      ),
      claim_seed: clip(
        `忌${jiBlob}成势压局，通关未立、生克关口阻滞在忌旺一侧`,
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
      `type=timing · 约束帧·运岁局势（自写 means，禁抄套话）\n` +
      `真算对照: ${phaseHint}\n` +
      `方向: 近窗/未熟则守成观气口；过冲则先收心力；手段须扣本段 timing_ripeness，与奇门局势维切入不同\n` +
      `填法: 维名偏「运岁/近窗」；means 证明为何此刻不宜跳步加码。`;
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
        `大运流年阶段下用神未透足、忌神成势，运岁近窗未熟（对照：${phaseHint}）`,
        120,
      ),
    });
    if (typed.filter((c) => c.type === "timing").length < 2) {
      const t2 =
        `type=timing · 约束帧·运岁局势（自写 means）\n` +
        `真算对照: timing_ripeness / ${phaseHint}\n` +
        `方向: 过冲或未熟时守自身结构节奏；第二切入须与候选1 的结构点不同\n` +
        `填法: means 扣气口自检/近窗，禁与奇门维同义换皮。`;
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
          `运岁未熟或过冲，大运与流年忌神交织压用神，近窗未开、气候未转`,
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
      `type=archetype · 约束帧·站位借势（自写 means，禁抄套话）\n` +
      `真算: 十神${tg0}\n` +
      `方向: 内在「${role0}」姿态——借势不硬争主导；与另一站位维十神/手段必须不同\n` +
      `填法: 维名「站位借势…」；chart_anchors 须含${tg0}；means 写站位/结界/时机，禁交付物。`;
    const a2 =
      `type=archetype · 约束帧·站位借势（自写 means）\n` +
      `真算: 十神${tg1}\n` +
      `方向: 「${role1}」侧翼/守序——与候选1 姿态互异，禁止同义换皮\n` +
      `填法: chart_anchors 须含${tg1}；means 只写站位结界。`;
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
        `type=archetype · 约束帧·站位借势（自写 means）\n` +
        `真算: ${clip(roleDims[0]!.chart_basis || roleDims[0]!.dimension, 40)}\n` +
        `方向: 按上列格局落成内在借势姿态；禁硬争主导；禁交付物\n` +
        `填法: means 写站位/结界，须能被上列结构证明。`;
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

  if (
    !forJudgment &&
    (er?.direction_fit?.trim() || er?.complementary?.trim())
  ) {
    lines.push(
      `场域辅助(非护城河主轴·可选):\n- direction_fit: ${clip(er?.direction_fit ?? "", 120)}\n- complementary: ${clip(er?.complementary ?? "", 120)}`,
    );
  }

  if (!forJudgment) {
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
  }

  const eligibleList = [...eligible];
  const unitCount = Math.max(3, Math.min(6, eligibleList.length * 2 || 3));
  lines.push(
    `eligible_moat_classes: ${eligibleList.join(",") || "(none)"}`,
    `建议维数: ${unitCount}；每类护城河至少兑现 1 条 typed means；正文须显式有「行为仪轨」维名一柱。`,
  );

  const hintTable = formatAssignBindingHintTable(
    buildMetaphysicsAssignPathHints(typed, eligibleList, unitCount),
  );
  if (hintTable) lines.push(hintTable);

  return { block: lines.join("\n"), eligible: eligibleList };
}
