/**
 * Build prioritized calc slice from A0 plan + compact inventory fallback.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { resolveAgendaRelationContext } from "@/lib/llm/prompts/relation-closed-set-context";
import { buildTopicTypedInventoryLine } from "@/lib/calculations/topic-typed-fields";
import { buildDayunPolarityInventoryLine } from "@/lib/calculations/dayun-polarity";
import {
  buildMetaphysicsPack,
  type MetaphysicsPack,
} from "@/lib/calculations/metaphysics-pack";
import type { CalcRelevancePlan } from "@/lib/llm/deepseek/calc-relevance-plan";
import { extractElementScoresRawFromBaseAnalysis } from "@/lib/poju/attach-metaphysics-pack";

export type CompactInventoryOptions = {
  questionCategory?: string | null;
};

/** One-line compact closed-set index — fallback safety net. */
export function buildCompactInventoryIndex(
  structured: ProfileStructured,
  opts?: CompactInventoryOptions,
): string {
  const shenSha = new Set<string>();
  const tenGods = new Set<string>();
  const lifeStages = new Set<string>();
  if (structured.pillars_detail) {
    for (const key of ["year", "month", "day", "hour"] as const) {
      const p = structured.pillars_detail[key];
      if (p.ten_god) tenGods.add(p.ten_god);
      for (const s of p.shen_sha ?? []) shenSha.add(s);
      if (p.life_stage_han) lifeStages.add(p.life_stage_han);
    }
  }
  const daYun = (structured.da_yun ?? [])
    .slice(0, 3)
    .map((d) => `${d.ganzhi}(${d.start_age}岁)`)
    .join("、");
  const topic = buildTopicTypedInventoryLine(structured, opts?.questionCategory);
  const dayun = buildDayunPolarityInventoryLine(structured, opts?.questionCategory);

  return [
    `神煞: ${[...shenSha].join("、") || "(无)"}`,
    `十神: ${[...tenGods].join("、") || "(无)"}`,
    `长生: ${[...lifeStages].join("、") || "(无)"}`,
    `大运样本: ${daYun || "(无)"}`,
    `用神: ${structured.yong_shen || "(无)"} | 忌神: ${(structured.ji_shen ?? []).join("、") || "(无)"}`,
    `强弱: ${structured.strength || "(无)"}`,
    topic,
    dayun,
  ]
    .filter(Boolean)
    .join("\n");
}

export type CalcSliceInput = {
  structured: ProfileStructured;
  plan: CalcRelevancePlan;
  questionCategory: string | null;
  base_analysis?: unknown;
  pack?: MetaphysicsPack | null;
};

function tryBuildPack(structured: ProfileStructured, base_analysis?: unknown): MetaphysicsPack | null {
  try {
    const raw = extractElementScoresRawFromBaseAnalysis(base_analysis);
    return buildMetaphysicsPack({
      structured,
      element_scores_raw: raw,
    });
  } catch {
    return null;
  }
}

export function buildSliceFromRelevancePlan(input: CalcSliceInput): string {
  const { structured, plan, questionCategory } = input;
  const pack = input.pack ?? tryBuildPack(structured, input.base_analysis);
  const families = new Set(plan.calc_families);
  const lines: string[] = [
    "【优先真算切片 · Call A0 选定】",
    `problem_focus: ${plan.problem_focus}`,
    `desired_outcome_lens: ${plan.desired_outcome_lens}`,
  ];

  if (families.has("topic_typed")) {
    lines.push(buildTopicTypedInventoryLine(structured, questionCategory));
  }
  if (families.has("dayun_pace")) {
    lines.push(buildDayunPolarityInventoryLine(structured, questionCategory));
  }
  if (families.has("directed_relations") || families.has("natal_relations")) {
    const { directedInventoryBlock } = resolveAgendaRelationContext(
      structured,
      questionCategory,
    );
    if (directedInventoryBlock) lines.push(directedInventoryBlock);
  }
  if (families.has("pack_yong_ji") || families.has("pack_dashboard")) {
    if (pack) {
      lines.push(
        `pack_yong_ji: yong=${pack.yong_shen.primary_yong_shen} ji=${pack.yong_shen.ji_shen.join(",") || "(无)"}`,
      );
      if (families.has("pack_dashboard")) {
        const d = pack.dashboard;
        lines.push(
          `pack_dashboard: output=${d.output_capacity} sustain=${d.sustain_capacity} resistance=${d.resistance_load}`,
        );
      }
    } else {
      lines.push("pack: (暂缺 — 用 structured 用神/忌神)");
    }
  }
  if (families.has("element_scores") && pack) {
    const e = pack.element_scores;
    lines.push(
      `element_scores: 木${e.wood} 火${e.fire} 土${e.earth} 金${e.metal} 水${e.water}`,
    );
  }
  if (families.has("strength")) {
    lines.push(`strength: ${structured.strength || "(无)"}`);
  }
  if (families.has("pattern") && structured.pattern) {
    lines.push(`pattern: ${structured.pattern}`);
  }
  if (families.has("ten_god_pillars") || families.has("shen_sha") || families.has("life_stage")) {
    lines.push(buildCompactInventoryIndex(structured, { questionCategory }));
  }

  if (plan.reckoning_dimensions.length > 0) {
    lines.push("【拟多维方向 · A0】");
    for (const d of plan.reckoning_dimensions) {
      lines.push(
        `- ${d.dimension}${d.required_anchors.length ? ` | 锚:${d.required_anchors.join("、")}` : ""}`,
      );
    }
  }

  lines.push("\n【闭集兜底索引】");
  lines.push(buildCompactInventoryIndex(structured, { questionCategory }));

  return lines.filter(Boolean).join("\n");
}

/** Warn if plan anchors not found in compact index (observability). */
export function validatePlanAnchorsInIndex(
  plan: CalcRelevancePlan,
  indexText: string,
): string[] {
  const missing: string[] = [];
  for (const d of plan.reckoning_dimensions) {
    for (const a of d.required_anchors) {
      if (a.length >= 2 && !indexText.includes(a)) missing.push(a);
    }
  }
  return missing;
}

const ANCHOR_POLARITY_RE =
  /^(favor|drain|tension|neutral|caution|mixed)$/i;

/**
 * Model often writes `用神·water favor` instead of closed-set `用神·water〔favor〕`.
 * Generate lookup variants without inventing new chart facts.
 */
export function expandAnchorLookupVariants(raw: string): string[] {
  const a = raw.trim();
  if (!a) return [];
  const out: string[] = [a];

  const spaced = a.match(/^(.+?)\s+(favor|drain|tension|neutral|caution|mixed)$/i);
  if (spaced) {
    const token = spaced[1]!.trim();
    const pol = spaced[2]!.toLowerCase();
    out.push(`${token}〔${pol}〕`, token);
  }

  const bracketed = a.match(/^(.+?)〔(favor|drain|tension|neutral|caution|mixed)〕$/i);
  if (bracketed) {
    out.push(bracketed[1]!.trim());
  }

  // `忌神·fire、earth drain` already handled by spaced; also try without trailing polarity glued
  const glued = a.match(/^(.+?)[·・]?(favor|drain|tension|neutral|caution|mixed)$/i);
  if (glued && glued[1] && glued[1].length >= 2 && !spaced) {
    const token = glued[1]!.replace(/[·・\s]+$/u, "").trim();
    const pol = glued[2]!.toLowerCase();
    if (token && !ANCHOR_POLARITY_RE.test(token)) {
      out.push(`${token}〔${pol}〕`, token);
    }
  }

  // After `·` take the right-hand chart token (e.g. 官杀显·正官 → 正官)
  const dot = a.match(/^[^·・]+[·・](.+)$/u);
  if (dot) {
    const rhs = dot[1]!.replace(/\s+(favor|drain|tension|neutral|caution|mixed)$/i, "").trim();
    if (rhs.length >= 2) out.push(rhs);
  }

  return [...new Set(out.filter((x) => x.length >= 2))];
}

/** Closed tokens present in compact / topic-typed inventory text. */
export function collectClosedSetTokensFromIndex(indexText: string): string[] {
  const tokens = new Set<string>();

  for (const m of indexText.matchAll(
    /([^\s；;，,：:]{1,48})〔(favor|drain|tension|neutral|caution|mixed)〕/gi,
  )) {
    tokens.add(m[0]!);
    tokens.add(m[1]!.trim());
  }

  const yong = indexText.match(/用神:\s*([^|\n]+)/);
  if (yong) {
    const v = yong[1]!.trim();
    if (v && v !== "(无)") {
      tokens.add(v);
      tokens.add(`用神·${v}`);
    }
  }
  const ji = indexText.match(/忌神:\s*([^\n|]+)/);
  if (ji) {
    const raw = ji[1]!.trim();
    if (raw && raw !== "(无)") {
      tokens.add(`忌神·${raw}`);
      for (const part of raw.split(/[、,，]/)) {
        const p = part.trim();
        if (p) tokens.add(p);
      }
    }
  }

  const ten = indexText.match(/十神:\s*([^\n]+)/);
  if (ten) {
    for (const part of ten[1]!.split(/[、,，]/)) {
      const p = part.trim();
      if (p && p !== "(无)") tokens.add(p);
    }
  }

  const shen = indexText.match(/神煞:\s*([^\n]+)/);
  if (shen) {
    for (const part of shen[1]!.split(/[、,，]/)) {
      const p = part.trim();
      if (p && p !== "(无)") tokens.add(p);
    }
  }

  return [...tokens];
}

/**
 * Resolve one A0 anchor to a closed-set string that appears in the index, or null to drop.
 */
export function resolvePlanAnchorAgainstIndex(
  raw: string,
  indexText: string,
  catalog?: readonly string[],
): string | null {
  const variants = expandAnchorLookupVariants(raw);
  for (const v of variants) {
    if (indexText.includes(v)) return v;
  }

  const cat = catalog ?? collectClosedSetTokensFromIndex(indexText);
  // Prefer longest catalog hit contained in any variant (or containing a variant).
  let best: string | null = null;
  for (const v of variants) {
    for (const c of cat) {
      if (c.length < 2) continue;
      if (v === c || v.includes(c) || c.includes(v)) {
        if (!best || c.length > best.length) best = c;
      }
    }
  }
  if (best && indexText.includes(best)) return best;
  return null;
}

export type SanitizePlanAnchorsResult = {
  plan: CalcRelevancePlan;
  /** Original anchors that could not be resolved to the closed set. */
  dropped: string[];
  /** remapped: original → closed-set form (when different). */
  remapped: Array<{ from: string; to: string }>;
};

/**
 * Hard scrub: only keep anchors that resolve into the compact inventory index.
 * Misses are dropped from the plan (warn upstream) — never feed invented tokens downstream.
 */
export function sanitizePlanAnchorsInIndex(
  plan: CalcRelevancePlan,
  indexText: string,
): SanitizePlanAnchorsResult {
  const catalog = collectClosedSetTokensFromIndex(indexText);
  const dropped: string[] = [];
  const remapped: Array<{ from: string; to: string }> = [];

  const reckoning_dimensions = plan.reckoning_dimensions.map((d) => {
    const required_anchors: string[] = [];
    const seen = new Set<string>();
    for (const raw of d.required_anchors) {
      const resolved = resolvePlanAnchorAgainstIndex(raw, indexText, catalog);
      if (!resolved) {
        if (raw.trim().length >= 2) dropped.push(raw.trim());
        continue;
      }
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      required_anchors.push(resolved);
      if (resolved !== raw.trim()) remapped.push({ from: raw.trim(), to: resolved });
    }
    return { dimension: d.dimension, required_anchors };
  });

  return {
    plan: { ...plan, reckoning_dimensions },
    dropped,
    remapped,
  };
}
