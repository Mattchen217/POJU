import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { computeChartRelations, type RelationLabel } from "@/lib/calculations/relation-engine";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";

const PILLAR_KEYS = ["year", "month", "day", "hour"] as const;

/** Engine-computed shen_sha only — for last-mile guard before generation. */
export function extractChartShenSha(structured: ProfileStructured): string[] {
  const set = new Set<string>();
  const pd = structured.pillars_detail;
  if (!pd) return [];
  for (const key of PILLAR_KEYS) {
    for (const s of pd[key]?.shen_sha ?? []) {
      const t = s.trim();
      if (t) set.add(t);
    }
  }
  return [...set];
}

/** Breakthrough-core user tail — affirmative + audit failure mode. */
export function buildShenShaGuardBlock(structured: ProfileStructured): string {
  const chartShenSha = extractChartShenSha(structured);
  if (chartShenSha.length > 0) {
    return `【本盘神煞 · 硬约束（生成前再读一遍）】
这个盘引擎实际算出的神煞【只有】：${chartShenSha.join("、")}。
- 要提神煞，【只能从这几个里挑、按名引用】，结合所问之事点出助力或隐忧。
- 你只能引用【本盘实例清单里实际算出】的神煞，按名引用。清单之外的任何神煞——无论你训练里多熟——对这个盘都不存在，写了即视为编造、会被拦截重写。
- 神煞少是正常的。不要为了"丰富"去补；不够就靠十神/用神/喜忌/强弱/当前阶段气候/藏干说话，那些才是你的主材料。`;
  }
  return `【本盘神煞 · 硬约束（生成前再读一遍）】
这个盘引擎【没算出任何神煞】。所以整篇输出里【一个神煞名都不许出现】。
- 你只能引用【本盘实例清单里实际算出】的神煞，按名引用。清单之外的任何神煞——无论你训练里多熟——对这个盘都不存在，写了即视为编造、会被拦截重写。清单为空则整篇不出现任何神煞名。
- 神煞为空是完全正常的——靠十神/用神/喜忌/强弱/当前阶段气候/藏干说话即可。写任何神煞名都会被拦截、整份重写。`;
}

/** Chat system prompt — same closed-set rule, compact for prefix cache. */
export function buildChatShenShaGuardBlock(structured: ProfileStructured): string {
  const chartShenSha = extractChartShenSha(structured);
  if (chartShenSha.length > 0) {
    return `【本盘神煞 · 硬约束】
这个盘引擎实算的神煞【只有】：${chartShenSha.join("、")}。提神煞【只能从这里挑、按名引用】。
你只能引用【本盘实例清单里实际算出】的神煞，按名引用。清单之外的任何神煞——无论你训练里多熟——对这个盘都不存在，写了就是错。
神煞少是正常的——没有就靠十神/用神/喜忌/强弱/当前阶段气候说话，别为"丰富"硬补。`;
  }
  return `【本盘神煞 · 硬约束】
这个盘引擎【没算出任何神煞】。整份聊天回复里【一个神煞名都不许出现】。
你只能引用【本盘实例清单里实际算出】的神煞，按名引用。清单为空则整篇不出现任何神煞名。
神煞为空是正常的——靠十神/用神/喜忌/强弱/当前阶段气候说话即可，别为"丰富"硬补。`;
}

function buildChartRelationsGuardBlock(structured: ProfileStructured, compact: boolean): string {
  const rels = computeChartRelations(structured);
  if (rels.length > 0) {
    const list = rels.map((r) => r.han).join("、");
    if (compact) {
      return `【本盘动态关系 · 硬约束】
引擎实算的关系【只有】：${list}。提刑冲合害/半合/三合/天干合【只能从这里挑、按名引用】，须软翻译标记。
你会算各种刑冲合害，但【这个盘只有上面这几个】；其它一律不许写，写了会被拦截。`;
    }
    return `【本盘动态关系 · 硬约束（生成前再读一遍）】
引擎实算的关系【只有】：${list}。
- 要提关系，【只能从上面几个里挑、按名引用】，结合所问之事点出张力或助力；须 \`⟦t:<关系id>|软译|白话⟧\` 标记。
- 这盘没算出的刑冲合害/半合/三合/天干合——对【这个盘】不存在。写一个都算编造，会被审计拦截、整份重写。
- 关系少是正常的。不要为了"丰富"去补；不够就靠十神/用神/喜忌/强弱/当前阶段气候说话。`;
  }
  if (compact) {
    return `【本盘动态关系 · 硬约束】
引擎【没算出任何刑冲合害/半合/三合/天干合】。整份回复里【禁止】写相冲/相刑/相害/六合/半合/三合/天干五合等关系词。`;
  }
  return `【本盘动态关系 · 硬约束（生成前再读一遍）】
引擎【没算出任何刑冲合害/半合/三合/天干合】。整份输出里【禁止】写相冲/相刑/相害/六合/半合/三合/天干五合/刑冲合害等关系词。
关系为空是完全正常的——靠十神/用神/喜忌/强弱/当前阶段气候说话即可。写任何关系词都会被拦截、整份重写。`;
}

function buildDirectedRelationsGuardBlock(rels: RelationLabel[], compact: boolean): string {
  if (rels.length > 0) {
    const list = rels.map((r) => r.han).join("、");
    if (compact) {
      return `【流年/定向动态关系 · 硬约束】
本问题类别下引擎实算的流年引动与十神张力【只有】：${list}。提流年关系/伤官见官/枭神夺食【只能从这里挑、按名引用】，须软翻译标记。
你会算各种流年引动，但【本问题定向只有上面这几个】；其它一律不许写，写了会被拦截。`;
    }
    return `【流年/定向动态关系 · 硬约束（生成前再读一遍）】
本问题类别下引擎实算的流年引动与十神张力【只有】：${list}。
- 要提流年关系或十神张力，【只能从上面几个里挑、按名引用】，须 \`⟦t:<关系id>|软译|白话⟧\` 标记。
- 没算出的流年引动/伤官见官/枭神夺食——对【本问题定向】不存在。写一个都算编造，会被审计拦截。
- 少是正常的；不够就靠本命关系/十神/用神/当前阶段气候说话。`;
  }
  if (compact) {
    return `【流年/定向动态关系 · 硬约束】
本问题类别下【没算出】流年引动或十神张力。禁止写「流年引动」「伤官见官」「枭神夺食」及未在本盘本命关系清单中的刑冲合害词。`;
  }
  return `【流年/定向动态关系 · 硬约束（生成前再读一遍）】
本问题类别下【没算出】流年引动或十神张力。禁止写流年引动/伤官见官/枭神夺食等关系词。
靠本命关系/十神/用神/当前阶段气候说话即可；写任何未列出的流年关系词都会被拦截。`;
}

/**
 * 全站唯一事实守卫入口 — 神煞 + 本命关系 + 可选流年/定向动态关系。
 * `verbose: true` 用于 breakthrough-core 等内部脊柱（长版措辞）；聊天默认 compact。
 */
export function buildChatFactGuardBlock(
  structured: ProfileStructured,
  opts?: { directedRelations?: RelationLabel[]; verbose?: boolean },
): string {
  const compact = !opts?.verbose;
  const shenShaBlock = compact
    ? buildChatShenShaGuardBlock(structured)
    : buildShenShaGuardBlock(structured);
  const directedGuard =
    opts?.directedRelations !== undefined
      ? buildDirectedRelationsGuardBlock(opts.directedRelations, compact)
      : "";
  return stitchPromptSections(
    shenShaBlock,
    buildChartRelationsGuardBlock(structured, compact),
    directedGuard,
  );
}

/** @deprecated 使用 buildChatFactGuardBlock(structured, { verbose: true, directedRelations }) */
export function buildFactGuardBlock(structured: ProfileStructured): string {
  return buildChatFactGuardBlock(structured, { verbose: true });
}
