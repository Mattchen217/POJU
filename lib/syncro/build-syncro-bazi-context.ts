import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { DaYunEntry } from "@/lib/calculations/lunar-dayun";
import { calculateCurrentYearGanZhi } from "@/lib/llm/prompts/oriental-counselor-base";
import { BRANCH_TO_WUXING, STEM_TO_WUXING, type WuXing } from "@/lib/syncro/wuxing-utils";

export interface SyncroBaziContext {
  day_master: string;
  day_master_wuxing?: WuXing;
  yong_shen: string;
  xi_shen?: string[];
  ji_shen?: string[];
  wuxing_strength?: Record<string, number>;
  current_da_yun?: { ganzhi?: string; wuxing?: string; theme?: string };
  current_liu_nian?: { ganzhi?: string; wuxing?: string };
  key_shen_sha?: string[];
}

const TIMING_RELEVANT_SHEN_SHA = new Set([
  "驿马",
  "将星",
  "华盖",
  "天马",
  "劫煞",
  "灾煞",
  "飞刃",
  "亡神",
]);

const ELEMENT_TO_WUXING: Record<string, WuXing> = {
  木: "木",
  火: "火",
  土: "土",
  金: "金",
  水: "水",
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
};

export function isTimingRelevantShenSha(name: string): boolean {
  return TIMING_RELEVANT_SHEN_SHA.has(name);
}

export function elementTokenToWuXing(token: string): WuXing | undefined {
  const trimmed = token.trim();
  if (STEM_TO_WUXING[trimmed]) return STEM_TO_WUXING[trimmed];
  const lower = trimmed.toLowerCase();
  if (ELEMENT_TO_WUXING[lower]) return ELEMENT_TO_WUXING[lower];
  if (ELEMENT_TO_WUXING[trimmed]) return ELEMENT_TO_WUXING[trimmed];
  return undefined;
}

export function elementsToWuXingList(tokens?: string[]): WuXing[] {
  if (!tokens?.length) return [];
  const out: WuXing[] = [];
  for (const token of tokens) {
    const wx = elementTokenToWuXing(token);
    if (wx && !out.includes(wx)) out.push(wx);
  }
  return out;
}

function estimateWuxingStrength(structured: ProfileStructured): Record<string, number> | undefined {
  const pillars = structured.four_pillars;
  if (!pillars) return undefined;

  const counts: Record<WuXing, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  let total = 0;

  for (const gz of Object.values(pillars)) {
    if (!gz || gz.length < 2) continue;
    const stem = gz.charAt(0);
    const branch = gz.charAt(1);
    const stemWx = STEM_TO_WUXING[stem];
    const branchWx = BRANCH_TO_WUXING[branch];
    if (stemWx) {
      counts[stemWx] += 1;
      total += 1;
    }
    if (branchWx) {
      counts[branchWx] += 1;
      total += 1;
    }
  }

  if (total <= 0) return undefined;

  const result: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    result[key] = Math.round((count / total) * 100);
  }
  return result;
}

function resolveCurrentDaYun(
  daYun: DaYunEntry[],
  now = new Date(),
): SyncroBaziContext["current_da_yun"] | undefined {
  if (!daYun.length) return undefined;

  const year = now.getFullYear();
  const idx = daYun.findIndex((entry, i) => {
    const next = daYun[i + 1];
    return year >= entry.start_year && (!next || year < next.start_year);
  });

  const entry = idx >= 0 ? daYun[idx] : daYun[daYun.length - 1];
  if (!entry?.ganzhi) return undefined;

  const stem = entry.ganzhi.charAt(0);
  const wuxing = STEM_TO_WUXING[stem];

  return {
    ganzhi: entry.ganzhi,
    wuxing,
    theme: wuxing ? `${wuxing}气大运段` : undefined,
  };
}

function resolveCurrentLiuNian(now = new Date()): SyncroBaziContext["current_liu_nian"] {
  const yearInfo = calculateCurrentYearGanZhi(now);
  return {
    ganzhi: yearInfo.gan_zhi,
    wuxing: elementTokenToWuXing(yearInfo.element) ?? undefined,
  };
}

function collectKeyShenSha(structuredProfile: ProfileStructured): string[] {
  const pillars = structuredProfile.pillars_detail;
  if (!pillars) return [];

  const found = new Set<string>();
  for (const key of ["year", "month", "day", "hour"] as const) {
    for (const sha of pillars[key].shen_sha ?? []) {
      if (isTimingRelevantShenSha(sha)) found.add(sha);
    }
  }
  return [...found];
}

function summarizeWuxingStrength(strength?: Record<string, number>): string | null {
  if (!strength) return null;
  const entries = Object.entries(strength).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;

  const avg = entries.reduce((sum, [, v]) => sum + v, 0) / entries.length;
  return entries
    .map(([wx, pct]) => {
      if (pct >= avg * 1.2) return `${wx}偏旺`;
      if (pct <= avg * 0.8) return `${wx}偏弱`;
      return `${wx}平`;
    })
    .join("、");
}

/** 全部来自本地 structured，零 LLM。缺字段就省略，不编造。 */
export function buildSyncroBaziContext(
  structured?: ProfileStructured,
): SyncroBaziContext | null {
  if (!structured) return null;

  const dayMasterStem = structured.day_master?.charAt(0) ?? structured.day_master;
  const dayMasterWuXing = dayMasterStem ? STEM_TO_WUXING[dayMasterStem] : undefined;
  const wuxingStrength = estimateWuxingStrength(structured);
  const keyShenSha = collectKeyShenSha(structured);

  const ctx: SyncroBaziContext = {
    day_master: structured.day_master,
    yong_shen: structured.yong_shen,
  };

  if (dayMasterWuXing) ctx.day_master_wuxing = dayMasterWuXing;
  if (structured.xi_shen?.length) ctx.xi_shen = structured.xi_shen;
  if (structured.ji_shen?.length) ctx.ji_shen = structured.ji_shen;
  if (wuxingStrength) ctx.wuxing_strength = wuxingStrength;
  if (structured.da_yun?.length) {
    const daYun = resolveCurrentDaYun(structured.da_yun);
    if (daYun) ctx.current_da_yun = daYun;
  }
  ctx.current_liu_nian = resolveCurrentLiuNian();
  if (keyShenSha.length) ctx.key_shen_sha = keyShenSha;

  return ctx;
}

/** 渲染给 LLM 读的命局背景（system 内部；用户可见 JSON 仍走四道防线）。 */
export function buildSyncroBaziContextSection(
  ctx: SyncroBaziContext | null,
  patternSummary?: string,
): string {
  if (!ctx) {
    return `# 用户命局背景（已本地精算，供解读引用，勿改 current_level）

(本地结构化命局尚未就绪 — 仅依据矩阵与任务写文案，勿编造具体用神/大运结论。)`;
  }

  const wuxingSummary = summarizeWuxingStrength(ctx.wuxing_strength);
  const xiLine = ctx.xi_shen?.length ? ctx.xi_shen.join("、") : "—";
  const jiLine = ctx.ji_shen?.length ? ctx.ji_shen.join("、") : "—";
  const daYunLine = ctx.current_da_yun?.ganzhi
    ? `${ctx.current_da_yun.ganzhi}${ctx.current_da_yun.theme ? `（${ctx.current_da_yun.theme}）` : ""}`
    : "—";
  const liuNianLine = ctx.current_liu_nian?.ganzhi ?? "—";
  const shenShaLine = ctx.key_shen_sha?.length ? ctx.key_shen_sha.join("、") : "—";

  return `# 用户命局背景（已本地精算，供解读引用，勿改 current_level）

- 日主：${ctx.day_master}${ctx.day_master_wuxing ? `（${ctx.day_master_wuxing}）` : ""}
- 用神：${ctx.yong_shen}；喜神：${xiLine}；忌神：${jiLine}
${wuxingSummary ? `- 五行旺衰（本地四柱计分）：${wuxingSummary}` : ""}
${patternSummary ? `- 格局摘要：${patternSummary}` : ""}
- 当前大运：${daYunLine}；流年：${liuNianLine}
- 关键神煞（行动/时机相关）：${shenShaLine}

说明：以上为本地命理引擎结果（**非**深度① LLM 叙事报告）。请在 rationale / detailed_advice / task_response 中**引用其中 ≥1 项**解释为何此时此向利于/不利于用户这件事；用户可见处不写干支/用神/八门等术语，用 core nature / balancing element / life cycle / 能量语言。`;
}
