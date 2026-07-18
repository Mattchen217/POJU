/**
 * Layer 1 — machine-facing core judgments (expand structured, never re-judge).
 * Shared by POJU / Match / Glyph / Syncro. No metaphor · no scene · no age plot.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { DaYunEntry } from "@/lib/calculations/lunar-dayun";
import { computeNatalChartRelations } from "@/lib/calculations/relation-engine";
import { OUT_OF_SET_FORBIDDEN_HAN } from "@/lib/glossary/term-closed-set";
import { pojuTermByTraditional } from "@/lib/glossary/pojulife-terms";
import { STEMS, type HeavenlyStem, type WuXing } from "@/lib/match/data/stems-branches";
import { normalizeShenshaName } from "@/lib/poju/shensha-alias";
import type { RelationKind } from "@/lib/calculations/relation-engine";
import { autoMarkBareTerms } from "@/lib/llm/sanitize/term-marking";

/** RelationKind → 中文原词（喂模型真算；勿喂软译「磨蚀」）。 */
const RELATION_KIND_HAN: Readonly<Record<RelationKind, string>> = {
  chong: "冲",
  xing: "刑",
  hai: "害",
  liuhe: "六合",
  banhe: "半合",
  sanhe: "三合",
  stem_he: "天干合",
  ten_god_tension: "十神张力",
};

export type CoreJudgmentsRefs = {
  day_master: string;
  strength: string;
  yong_shen: string;
  xi_shen: string[];
  ji_shen: string[];
  pattern: string;
  /** 0-based index into structured.da_yun for the current step; null if unknown. */
  da_yun_step: number | null;
  shensha_instances: string[];
  natal_relations: string[];
};

/**
 * Compressed neutral judgments — one source of "what this chart means"
 * so four products do not invent conflicting narratives.
 */
export type CoreJudgments = {
  identity_anchor: string;
  drive_mechanism: string;
  structural_gap: string;
  balance_anchor: string;
  exchange_mode: string;
  leverage_state: string;
  /** Current step climate only — no age / Ganzhi / calendar year. */
  climate_now: string;
  refs: CoreJudgmentsRefs;
};

const WUXING_TUNE: Record<WuXing, { zh: string; en: string }> = {
  木: { zh: "同类支持、节奏化生长", en: "peer support and paced growth" },
  火: { zh: "可见表达与分段输出", en: "visible expression and segmented output" },
  土: { zh: "承载节奏与边界稳定", en: "holding rhythm and stable boundaries" },
  金: { zh: "规则网格与收敛校准", en: "rule grid and convergent calibration" },
  水: { zh: "节律/独处/复盘冷却", en: "rhythm / solitude / review cooling" },
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

export function resolveCurrentDaYunStep(
  da_yun: DaYunEntry[],
  nowYear = new Date().getFullYear(),
): number | null {
  if (!Array.isArray(da_yun) || da_yun.length === 0) return null;
  let step = 0;
  for (let i = 0; i < da_yun.length; i++) {
    if ((da_yun[i]?.start_year ?? 0) <= nowYear) step = i;
  }
  return step;
}

function collectShensha(structured: ProfileStructured): string[] {
  const out = new Set<string>();
  const detail = structured.pillars_detail;
  if (!detail) return [];
  for (const p of [detail.year, detail.month, detail.day, detail.hour]) {
    for (const s of p.shen_sha ?? []) {
      const t = String(s).trim();
      if (t) out.add(t);
    }
  }
  return [...out];
}

function tenGodsPresent(structured: ProfileStructured): string[] {
  const detail = structured.pillars_detail;
  if (!detail) return [];
  return [detail.year, detail.month, detail.day, detail.hour]
    .map((p) => String(p.ten_god ?? "").trim())
    .filter(Boolean);
}

function driveFromTenGods(gods: string[], locale: string): string {
  const zh = locale.startsWith("zh");
  const joined = gods.join("");
  if (/食神|伤官/.test(joined) && /财/.test(joined)) {
    return zh
      ? "产出→资源回流的闭环效率高（机制转译，不谈职业）"
      : "Produce→resource-return loop runs efficiently (mechanism only; no career typing)";
  }
  if (/印/.test(joined) && /官|杀/.test(joined)) {
    return zh
      ? "约束与补给互相咬合时系统最稳（机制转译，不谈职场情节）"
      : "Constraint and supply lock best when linkage holds (mechanism only)";
  }
  if (/比肩|劫财/.test(joined)) {
    return zh
      ? "并行协作能放大推进力，单打硬顶更易内耗"
      : "Parallel alliance amplifies drive; solo hard-push drains faster";
  }
  return zh
    ? "关键链路在于把本盘主导驱动机制跑通，而非换赛道式折腾"
    : "Leverage comes from running this chart’s dominant drive mechanism—not channel-hopping";
}

function exchangeFromTenGods(gods: string[], locale: string): string {
  const zh = locale.startsWith("zh");
  const needSupply = gods.some((g) => /印/.test(g));
  const giveExpress = gods.some((g) => /食神|伤官/.test(g));
  const giveStructure = gods.some((g) => /官|杀/.test(g));
  const parts: string[] = [];
  if (needSupply) {
    parts.push(zh ? "需要被稳定结构供给" : "needs steady structural supply");
  } else {
    parts.push(zh ? "对外索取不宜过猛" : "should not over-draw from outside");
  }
  if (giveExpress) {
    parts.push(zh ? "擅长以协调与表达给出" : "gives best through coordination and expression");
  } else if (giveStructure) {
    parts.push(zh ? "擅长以边界与秩序给出" : "gives best through boundary and order");
  } else {
    parts.push(zh ? "擅长以并行推进给出" : "gives best through parallel momentum");
  }
  return parts.join(zh ? "；" : "; ");
}

function identityAnchor(
  dmWx: WuXing | null,
  strength: ProfileStructured["strength"],
  locale: string,
): string {
  const zh = locale.startsWith("zh");
  const wxLabel = dmWx ?? (zh ? "未知" : "unknown");
  if (strength === "weak") {
    return zh
      ? `借力生长型（${wxLabel}）：能量靠连接与节奏放大，硬撑则折`
      : `Borrow-to-grow type (${wxLabel}): energy scales via connection and rhythm; hard brace breaks`;
  }
  if (strength === "strong") {
    return zh
      ? `外放主导型（${wxLabel}）：能量主动外溢，需泄中求衡`
      : `Outward-drive type (${wxLabel}): energy spills outward; balance via controlled release`;
  }
  return zh
    ? `均衡运行型（${wxLabel}）：进出大致相当，怕骤然过载或突然断供`
    : `Balanced-run type (${wxLabel}): inflow≈outflow; fragile to sudden overload or cut-off`;
}

function structuralGap(structured: ProfileStructured, locale: string): string {
  const zh = locale.startsWith("zh");
  const ji = structured.ji_shen ?? [];
  const jiEl = ji.map(elementFromAny).filter(Boolean) as WuXing[];
  if (jiEl.includes("水") || ji.some((j) => j.includes("水"))) {
    return zh
      ? "冷却机制不足 → 信息未齐即锁定决策"
      : "Cooling capacity runs low → locks decisions before inputs are complete";
  }
  if (jiEl.includes("金") || ji.some((j) => j.includes("金"))) {
    return zh
      ? "收敛网格偏弱 → 输出易散、难收口"
      : "Convergent grid runs thin → output scatters, hard to close loops";
  }
  if (structured.strength === "strong") {
    return zh
      ? "外放偏多 → 连续高压后内耗累积"
      : "Outward drive runs high → internal friction accumulates after chained pressure";
  }
  if (structured.strength === "weak") {
    return zh
      ? "补给不稳 → 单点硬顶时易折"
      : "Supply is uneven → single-point hard pushes snap easier";
  }
  return zh
    ? "配置短板在过载窗口：节律一乱，判断先糊"
    : "Config weak point is overload windows: when rhythm breaks, judgment blurs first";
}

function balanceAnchor(structured: ProfileStructured, locale: string): string {
  const zh = locale.startsWith("zh");
  const yong = elementFromAny(structured.yong_shen) ?? elementFromAny(structured.xi_shen?.[0] ?? "");
  const xi = (structured.xi_shen ?? [])
    .map(elementFromAny)
    .filter(Boolean) as WuXing[];
  const yongTune = yong ? WUXING_TUNE[yong] : null;
  const xiTune = xi[0] ? WUXING_TUNE[xi[0]] : null;
  if (zh) {
    const a = yong && yongTune ? `需补【${yong}】：${yongTune.zh}` : "按补给方向补关键平衡机制";
    const b = xi[0] && xiTune && xi[0] !== yong ? `；辅【${xi[0]}】：${xiTune.zh}` : "";
    return `${a}${b}（含方位/色彩/时段锚；禁动作清单）`;
  }
  const a =
    yong && yongTune
      ? `Favor 【${yong}】: ${yongTune.en}`
      : "Tune toward structured favorable direction";
  const b =
    xi[0] && xiTune && xi[0] !== yong ? `; support 【${xi[0]}】: ${xiTune.en}` : "";
  return `${a}${b} (direction/color/time anchors only; no action checklists)`;
}

function climateNow(
  structured: ProfileStructured,
  step: number | null,
  locale: string,
): string {
  const zh = locale.startsWith("zh");
  if (step == null || !structured.da_yun[step]) {
    return zh ? "当前这步：节奏不明，宜守" : "Current step: climate unclear — prefer hold";
  }
  const gz = structured.da_yun[step]!.ganzhi;
  const dayunWx = stemWuxing(gz);
  const yongWx = elementFromAny(structured.yong_shen);
  if (!dayunWx) {
    return zh
      ? "当前这步：气候平稳，宜守中带进"
      : "Current step: steady climate — hold with selective advance";
  }
  const generates: Record<WuXing, WuXing> = {
    木: "火",
    火: "土",
    土: "金",
    金: "水",
    水: "木",
  };
  if (yongWx && (dayunWx === yongWx || generates[dayunWx] === yongWx)) {
    return zh
      ? "当前这步：补给侧偏顺，可择机推进"
      : "Current step: supply side coherent — selective advance ok";
  }
  if (yongWx && generates[yongWx] === dayunWx) {
    return zh ? "当前这步：偏耗泄，宜守" : "Current step: drain-leaning — prefer hold";
  }
  if (dayunWx === "火" && yongWx === "水") {
    return zh ? "当前这步：燥热偏耗，宜守" : "Current step: dry-heat drain lean — prefer hold";
  }
  return zh ? "当前这步：气候交织，宜守" : "Current step: mixed climate — prefer hold";
}

/** Code-only climate readout — never ask the model to invent this. */
export function buildClimateNowFromStructured(
  structured: ProfileStructured,
  locale = "zh",
): string {
  const step = resolveCurrentDaYunStep(structured.da_yun);
  return climateNow(structured, step, locale);
}

/**
 * Expand structured into Layer-1 judgments. Never invent career/scene/metaphor.
 * Deterministic fallback used when the independent medium LLM call fails.
 */

/**
 * 关系条目：喂【真词】给模型真算（刑@year-day，不是「磨蚀@year-day」）。
 * RelationKind → 中文原词；positions 是 year/month/day/hour。
 * 合规在输出端 autoMarkBareTerms，不在这儿阉割。
 */
function desensitizeRelations(structured: ProfileStructured): string[] {
  return computeNatalChartRelations(structured).map((r) => {
    const kindHan = RELATION_KIND_HAN[r.kind] ?? r.kind;
    return r.positions.length ? `${kindHan}@${r.positions.join("-")}` : kindHan;
  });
}

/**
 * 神煞：喂【真词】给模型真算（天乙贵人，不是「提携」）。
 * 黑名单（恐吓/宿命）仍丢；须能在输出端软译回来（SSOT 有对应术语，含别名归一）。
 * 合规在输出端做，不在输入端阉割。
 */
function desensitizeShensha(structured: ProfileStructured): string[] {
  const out: string[] = [];
  const dropped: string[] = [];
  for (const han of collectShensha(structured)) {
    if (
      (OUT_OF_SET_FORBIDDEN_HAN as readonly string[]).some(
        (b) => han === b || han.includes(b),
      )
    ) {
      dropped.push(`${han}(黑名单)`);
      continue;
    }
    const key = normalizeShenshaName(han);
    const t =
      pojuTermByTraditional(han, "bazi") ??
      pojuTermByTraditional(key, "bazi") ??
      pojuTermByTraditional(key);
    if (!t) {
      dropped.push(`${han}(SSOT无对应术语,输出端无法软译→丢)`);
      continue;
    }
    out.push(han);
  }
  if (dropped.length) {
    // 响亮:丢掉的是这盘的算料,丢多了 core_judgments 就没东西可锚(铁律 #5)
    console.warn(`[core_judgments] refs 神煞脱敏丢弃 ${dropped.length} 项:${dropped.join("、")}`);
  }
  return out;
}

/** refs are always code-filled from structured — never model-generated. */
export function buildCoreJudgmentsRefsFromStructured(
  structured: ProfileStructured,
): CoreJudgmentsRefs {
  const step = resolveCurrentDaYunStep(structured.da_yun);
  return {
    day_master: structured.day_master,
    strength: structured.strength,
    yong_shen: structured.yong_shen,
    xi_shen: [...(structured.xi_shen ?? [])],
    ji_shen: [...(structured.ji_shen ?? [])],
    pattern: structured.pattern,
    da_yun_step: step,
    shensha_instances: desensitizeShensha(structured),
    natal_relations: desensitizeRelations(structured),
  };
}

/** 落库/注入用：refs 真词 → 金字，避免裸命理词进下游 content。 */
export function softMarkCoreJudgmentsRefs(
  refs: CoreJudgmentsRefs,
  locale: string,
): CoreJudgmentsRefs {
  return {
    ...refs,
    shensha_instances: refs.shensha_instances.map((s) => autoMarkBareTerms(s, locale)),
    natal_relations: refs.natal_relations.map((s) => {
      const at = s.indexOf("@");
      if (at < 0) return autoMarkBareTerms(s, locale);
      return `${autoMarkBareTerms(s.slice(0, at), locale)}@${s.slice(at + 1)}`;
    }),
  };
}

export function buildCoreJudgmentsFromStructured(
  structured: ProfileStructured,
  locale = "zh",
): CoreJudgments {
  const dmWx = stemWuxing(structured.day_master);
  const gods = tenGodsPresent(structured);
  const refs = buildCoreJudgmentsRefsFromStructured(structured);
  const zh = locale.startsWith("zh");

  return {
    identity_anchor: identityAnchor(dmWx, structured.strength, locale),
    drive_mechanism: driveFromTenGods(gods, locale),
    structural_gap: structuralGap(structured, locale),
    balance_anchor: balanceAnchor(structured, locale),
    exchange_mode: exchangeFromTenGods(gods, locale),
    leverage_state: zh
      ? "关键补给到位、节奏可控时最易突破（不预测事件、不指定行业）"
      : "Breakthrough is easiest when key supply holds and rhythm is controllable (no event forecast, no industry)",
    climate_now: climateNow(structured, refs.da_yun_step, locale),
    refs,
  };
}

export function isCoreJudgments(v: unknown): v is CoreJudgments {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.identity_anchor === "string" &&
    typeof o.drive_mechanism === "string" &&
    typeof o.structural_gap === "string" &&
    typeof o.balance_anchor === "string" &&
    typeof o.exchange_mode === "string" &&
    typeof o.leverage_state === "string" &&
    typeof o.climate_now === "string" &&
    o.refs != null &&
    typeof o.refs === "object"
  );
}
