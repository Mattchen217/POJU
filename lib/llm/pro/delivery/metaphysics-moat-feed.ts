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
import { scrubJudgmentFeedPrescriptions } from "@/lib/llm/pro/delivery/pipeline-v3/scrub-judgment-feed";
import type {
  DeliveryQimenFactPack,
  DeliveryQimenStance,
} from "./page-schema/qimen-fact-pack";
import type { MetaphysicsPack } from "@/lib/calculations/metaphysics-pack/types";
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

/** Fact-pack 四柱行：天干位十神 = 透干闭集（禁派工/批断写成「藏于支」）。 */
function stemTenGodsFromFactPack(pack: string): Set<string> {
  const out = new Set<string>();
  const re =
    /(?:年|月|日|时)柱[^\n]{0,40}天干[甲乙丙丁戊己庚辛壬癸][^\n]{0,24}十神(偏印|正印|食神|伤官|七杀|正官|比肩|劫财|偏财|正财|日主自身)/g;
  for (const m of pack.matchAll(re)) {
    const g = m[1];
    if (g && g !== "日主自身") out.add(g);
  }
  return out;
}

/** Compass letter → 白话方位（可见层可用；禁宫门原名）。 */
function dirCodeToZh(code: string): string {
  const c = code.trim().toUpperCase();
  const map: Record<string, string> = {
    N: "北",
    S: "南",
    E: "东",
    W: "西",
    NE: "东北",
    NW: "西北",
    SE: "东南",
    SW: "西南",
  };
  return map[c] ?? code;
}

/**
 * 正文枪专用：本案时方/色锚种子（方向帧 · 禁正例整句）。
 * 只在 !forJudgment 时注入。
 */
function formatCaseShiFangQiSeed(
  pack: MetaphysicsPack | null | undefined,
): string | null {
  if (!pack) return null;
  const dirs = (pack.directions?.preferred ?? [])
    .slice(0, 3)
    .map(dirCodeToZh)
    .filter(Boolean);
  const hours = (pack.favorable_hours ?? [])
    .slice(0, 3)
    .map((h) => {
      const br = String(h.branch ?? "").trim();
      const period = String(h.period ?? "").trim();
      if (!br) return "";
      return period ? `${br}时（${period}）` : `${br}时`;
    })
    .filter(Boolean);
  const colors = (pack.color?.labels_zh ?? []).slice(0, 3).filter(Boolean);
  if (dirs.length === 0 && hours.length === 0 && colors.length === 0) {
    return null;
  }
  return [
    "【本案时方气场种子 · 正文 means 优先对上 · 禁照抄成固定句】",
    dirs.length ? `方位偏好（白话落座/换场）: ${dirs.join("、")}` : "",
    hours.length
      ? `时辰窗（白话收口/静默）: ${hours.join("；")} —— 可写「该时辰前后先不硬谈」，禁铁口吉凶时点`
      : "",
    colors.length
      ? `色气偏好（气场调候）: ${colors.join("/")} —— 可写感官偏好，禁符咒/水晶`
      : "",
    "填法: 仪轨/意象 means 至少部分能回溯上列种子自写；禁跨案养生三联模板与液态水道具调候（勿枚举成可抄清单）。",
  ]
    .filter(Boolean)
    .join("\n");
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
        prefer_cite: pickAssignCite(
          scrubJudgmentFeedPrescriptions(any.cite ?? ""),
          null,
        ),
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
      prefer_cite: pickAssignCite(
        scrubJudgmentFeedPrescriptions(c.cite ?? ""),
        null,
      ),
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
  const lines: string[] = forJudgment
    ? [
        "【P4 批断约束帧】主张=门宫主客·用忌·岁运张力；禁仪轨处方、处境尾巴、半祈使收束。",
        "means_candidate_ref 须抄派工闭集标签；calc_cite 禁宜…/加大投入类尾巴。",
      ]
    : [
        "【P4 正文约束帧 · 暗锦囊】",
        "允许轴：局势=敌虚实+攻守+近窗 → means 时方差/藏隐气口；意象=气场色气收势；仪轨=本案时方种子+结界（恰好一维）；站位=落座/体态/时窗。",
        "主语=局/气/时方/结界。每条 means 须能被本维批断证明；删真算锚须垮。",
        "硬门槛：若下方已钉死对方投入形态 → 只写该门槛下藏隐观气口/不跟虚高出手；禁止把已被拒的投入形态写成过渡手段。",
        "离开允许轴：means 主语若变成职场周旋/教练壁垒/发明月数/可见真词/引号稿/跨案养生/水道具 → 整句改回允许轴；半否定句（不展开某某）不算合格。真词只进 chart_anchors。",
      ];

  if (!forJudgment) {
    // 不灌问题/期望原文（兼职试水等路径词 priming）；议题用中性一句 + 硬门槛事实
    lines.push(
      "【议题】合伙推力下的出手节奏与底线气口（勿把生活路径词写进 means）",
    );
    const hardFacts: string[] = [];
    let doorClosed = false;
    for (const item of covered_agenda ?? []) {
      const blob = `${item.label ?? ""}${item.answer ?? ""}`;
      if (/拒绝.{0,12}兼职|必须全职|不同意兼职|不接受兼职|兼职.{0,8}拒绝/.test(blob)) {
        doorClosed = true;
        hardFacts.push(
          `对方投入门槛: ${clip(item.answer?.trim() || item.label || "", 80)}`,
        );
      }
      if (/撑|半年|焦虑|收入|底线/.test(blob) && /半年|个月|焦虑/.test(blob)) {
        hardFacts.push(`收入承压窗: ${clip(item.answer?.trim() || "", 60)}`);
      }
    }
    if (doorClosed) {
      lines.push(
        "【硬门槛】对方已钉死全职核心位。正文只写该门槛下藏隐观气口/不跟虚高出手/结界护底线；禁止把已被拒的投入形态写成过渡或默认路径。",
      );
    }
    if (hardFacts.length) {
      lines.push("【硬门槛事实】");
      hardFacts.slice(0, 4).forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    }
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
    const tQ = forJudgment
      ? `type=timing · 批断结构候选（禁抄取向处方）\n` +
        `真算: ${qimen.ju_name}；值使${qimen.zhi_shi_door}落${qimen.zhi_shi_palace}；${qimen.host_guest}\n` +
        `批断填法: 写门宫主客·场域虚高/气口张力；停在气口易被压；禁攻守祈使/仪轨处方。`
      : `type=timing · 约束帧·局势交锋（自写 means，禁抄套话）\n` +
        `真算: ${qimen.ju_name}；值使${qimen.zhi_shi_door}落${qimen.zhi_shi_palace}；${qimen.host_guest}\n` +
        `方向: ${dir}\n` +
        `填法: strategy 写清敌虚实+我方攻守+近窗；means≥2＝知局后可做的玄学动作（藏隐气口/不跟虚高出手/换场观局/时方收口），禁纯职场沉默术；正文博弈白话，真词进 chart_anchors。`;
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
    if (forJudgment) {
      lines.push(`用神: ${yong}`);
      lines.push(`忌神: ${ji.join("、") || "(无)"}`);
      lines.push("pack_polarity: (见上 · 用忌驱动意象调频)");
    } else {
      lines.push(
        `pack_polarity: 用忌已锁（元素名只进 chart_anchors；可见层用「滋养/缓冲偏软」「外界催促燥热」白话）`,
      );
    }
    const jiBlob = ji.length ? ji.join("、") : "过旺干扰侧";
    const img = yongImagery(yong);
    const p1 = forJudgment
      ? `type=polarity · 约束帧·意象调频（批断）\n` +
        `真算: 用神${yong}偏弱未得令（本候选少写忌神堆砌）\n` +
        `方向: 靠近用神气场（${img.near}）；忌气上涌时${img.cool}\n` +
        `派工主张核（与极性2互异）: 只钉「用神${yong}偏弱/未得令」。`
      : `type=polarity · 约束帧·意象调频（自写 means，禁抄套话）\n` +
        `真算（内部·勿抄进可见层）: 用神侧偏弱未得令\n` +
        `方向: ${img.near}；外界催促上涌时${img.cool}；不入对方催促燥阵\n` +
        `填法: 维名「意象调频…」；means 写气场调候（白话冷热/缓冲/收势/色气）；**可见层禁写用神/忌神/两五行并写**；禁职场课。\n` +
        `派工主张核（与极性2互异）: 只钉用神偏弱/未得令；禁止复读忌侧成势+通关。`;
    const p2 = forJudgment
      ? `type=polarity · 约束帧·行为仪轨（批断）\n` +
        `真算: 忌${jiBlob}成势压局；通关未立\n` +
        `派工主张核: 只钉「忌${jiBlob}成势 + 通关未立」。` +
        `\n批断填法: 「通关未立」=金被火制/关口阻滞；禁改写「喜神金未透/通关金未透」（天干已有金时尤忌）。`
      : `type=polarity · 约束帧·行为仪轨（整页唯一仪轨维；自写 means）\n` +
        `真算（内部·勿抄进可见层）: 忌侧成势压局；通关未立\n` +
        `方向: 仪轨 ∈ 时方窗 / 气场调候 / 结界仪轨（白话）\n` +
        `填法: 维名恰好含「行为仪轨」；means≥2；优先用下方时方种子；**可见层禁两五行并写/忌神报幕**；禁跨案养生三联；禁 P3 工具。\n` +
        `派工主张核（与极性1互异）: 只钉忌侧成势+通关未立；禁止再写用神偏弱。`;
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

  if (!forJudgment) {
    const seed = formatCaseShiFangQiSeed(pack ?? null);
    if (seed) lines.push(seed);
  }

  const er = core?.energy_retune_frame;
  const timingVal = er?.timing_ripeness?.trim();
  const hasTiming =
    Boolean(timingVal) && timingVal !== "(缺失)" && timingVal !== "(无)";
  if (hasTiming || er?.structural_basis?.trim()) {
    eligible.add("timing");
    const retuneScrubbed = scrubJudgmentFeedPrescriptions(
      er?.structural_basis ?? "",
    );
    const timingScrubbed = scrubJudgmentFeedPrescriptions(timingVal ?? "");
    lines.push(`timing_ripeness: ${timingScrubbed || "(见锚)"}`);
    lines.push(
      `current_da_yun_cycle:\n- timing_ripeness: ${timingScrubbed || "(缺失)"}\n- retune_basis: ${clip(retuneScrubbed, 120) || "(缺失)"}`,
    );
    // 批断可薄挂阶段多维；正文禁灌 multi_dim 原句（常含「用兼职节奏」等路径处方）
    if (forJudgment) {
      const phaseDims = (core?.multi_dimension_reckoning ?? [])
        .filter((d) => /大运|流年|周期|阶段|运/.test(d.dimension))
        .slice(0, 3);
      if (phaseDims.length > 0) {
        lines.push("阶段相关多维:");
        for (const d of phaseDims) {
          lines.push(
            `- 【${d.dimension}】${clip(scrubJudgmentFeedPrescriptions(d.judgment), 100)}（锚: ${clip(d.chart_basis, 60)}）`,
          );
        }
      }
    }
    // 批断挂阶段节奏字典；正文 means 不需要「谈交换与定价」等生活处方 priming
    if (forJudgment) {
      lines.push(
        formatDayunSemanticForPrompt(timingScrubbed || retuneScrubbed),
      );
    }
    const phaseHint = clip(
      scrubJudgmentFeedPrescriptions(timingVal || er?.structural_basis || "大运窗口"),
      80,
    );
    const tDayun = forJudgment
      ? `type=timing · 约束帧·运岁局势（批断结构）\n` +
        `真算对照: ${phaseHint}\n` +
        `方向: 近窗未熟则运岁窗口收窄、用神承压；过冲则忌神成势（批断只写松紧，不写加码/投入）\n` +
        `填法: 维名偏「近窗/时机」；批断停在窗口收窄/气候交织。`
      : `type=timing · 约束帧·近窗局势（自写 means，禁抄套话）\n` +
        `真算对照: ${phaseHint}\n` +
        `方向: 近窗未熟则窗口收紧、支撑承压；过冲则干扰侧成势（只写松紧）\n` +
        `填法: 维名偏「近窗/时机局势…」；**可见层禁写运岁/大运/流年/用神/忌神**；strategy 用「近窗未熟/气候收紧」白话；means 再证不宜跳步；真词只进 chart_anchors。`;
    const tIdx = typed.filter((c) => c.type === "timing").length + 1;
    lines.push(`时机候选${tIdx}. ${tDayun}`);
    // Cite = 结构短摘 only（用忌/运岁松紧）；禁用 phaseDims.judgment / retune_basis
    // 当种子——那些常带「需抑制/喜水来调候/可补足安全感」处方尾巴。
    const jiCite = ji.length ? `忌${ji.join("、")}成势` : "忌神成势";
    const yongCite = yong && yong !== "(无)" ? `用神${yong}未透足` : "用神未透足";
    const timingCiteClean =
      pickAssignCite(
        `${yongCite}；${jiCite}；运岁窗口收窄`,
        timingScrubbed,
      ) || `${yongCite}；${jiCite}；气候交织`;
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
      const t2 = forJudgment
        ? `type=timing · 约束帧·运岁局势（批断）\n` +
          `真算对照: timing_ripeness / ${phaseHint}\n` +
          `方向: 过冲或未熟时守自身结构节奏；第二切入须与候选1 的结构点不同\n` +
          `填法: 批断停在近窗/气候；禁手段处方。`
        : `type=timing · 约束帧·近窗局势（自写 means）\n` +
          `真算对照: timing_ripeness / ${phaseHint}\n` +
          `方向: 过冲或未熟时守自身结构节奏；第二切入须与候选1 的结构点不同\n` +
          `填法: means 扣气口自检/近窗；可见层禁运岁/大运/用忌原名；禁与奇门维同义换皮。`;
      lines.push(`时机候选2. ${t2}`);
      typed.push({
        type: "timing",
        label: "时机候选2",
        body: t2,
        primary: /流年|气候交织|交运/.test(String(timingVal))
          ? "流年"
          : "气候交织",
        cite:
          pickAssignCite(timingScrubbed, `${yongCite}；${jiCite}`) ||
          "运岁未熟；气候交织",
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
    // 正文禁灌十神语义 SSOT（动力锚含「技艺」→ 易滑向技术细节周旋）；批断保留
    if (forJudgment) {
      lines.push(formatTenGodSemanticForPrompt(tenGods));
    }
    const tg0 = tenGods[0]!;
    const tg1 = tenGods[1] ?? tenGods[0]!;
    const packText = opts?.chart_fact_pack ?? "";
    const stemGods = stemTenGodsFromFactPack(packText);
    const citeForRole = (tg: string): string => {
      if (stemGods.has(tg)) return clip(`十神${tg}透干`, 80);
      if (/藏干|支中/.test(packText) && packText.includes(tg)) {
        return clip(`十神${tg}支中藏`, 80);
      }
      return clip(`十神${tg}透干`, 80);
    };
    const a1 = forJudgment
      ? `type=archetype · 批断结构候选（禁抄取向处方）\n` +
        `真算: 十神${tg0}${stemGods.has(tg0) ? "透干" : ""}\n` +
        `批断填法: 写柱位动力/负荷/与另一十神之牵制张力；停在显性不足/制衡位弱；禁「借势不争/侧翼守序」收束；chart_anchors 须含${tg0}。`
      : `type=archetype · 约束帧·站位借势（自写 means）\n` +
        `真算: 十神${tg0}${stemGods.has(tg0) ? "透干" : ""}\n` +
        `方向: 借势、不硬争主导；与另一站位维姿态互异\n` +
        `填法: 维名「站位借势…」；chart_anchors 含${tg0}；可见层零十神原名；means=落座/体态/时窗藏隐。`;
    const a2 = forJudgment
      ? `type=archetype · 批断结构候选（禁抄取向处方）\n` +
        `真算: 十神${tg1}${stemGods.has(tg1) ? "透干" : ""}\n` +
        `批断填法: 写与候选1 互异的柱位对比张力；禁把天干十神写成「藏于支」；禁「内守侧翼/借势不争」收束；chart_anchors 须含${tg1}。`
      : `type=archetype · 约束帧·站位借势（自写 means）\n` +
        `真算: 十神${tg1}${stemGods.has(tg1) ? "透干" : ""}\n` +
        `方向: 内守侧翼、与候选1 互异\n` +
        `填法: chart_anchors 含${tg1}；可见层零十神原名；means=落座/体态/时窗藏隐。`;
    lines.push(`角色候选1. ${a1}`);
    lines.push(`角色候选2. ${a2}`);
    typed.push({
      type: "archetype",
      label: "角色候选1",
      body: a1,
      primary: tg0,
      cite: citeForRole(tg0),
      claim_seed: clip(
        `十神${tg0}${stemGods.has(tg0) ? "透干" : ""}，格局以${tg0}为显、角色力量偏在此十神`,
        120,
      ),
    });
    typed.push({
      type: "archetype",
      label: "角色候选2",
      body: a2,
      primary: tg1,
      cite: citeForRole(tg1),
      claim_seed: clip(
        `十神${tg1}${stemGods.has(tg1) ? "透干" : ""}，与食伤/日主形成结构对比、角色力量落在${tg1}一侧`,
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

  // 正文/批断均不灌 direction_fit·complementary（谈判课/提问代替断言 → 站位滑向周旋）

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
