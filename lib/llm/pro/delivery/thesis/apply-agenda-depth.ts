/**
 * Agenda may only change depth / truncate conclusion — never classical facts.
 */

import type { ChartThesis, ThesisDimension, ThesisDimensionId } from "@/lib/llm/pro/delivery/thesis/types";
import { THESIS_EMPTY_CONCLUSION_ZH } from "@/lib/llm/pro/delivery/thesis/types";

const BRIEF_MAX = 48;

function isEmptyDimension(dim: ThesisDimension): boolean {
  if (dim.conclusion_zh === THESIS_EMPTY_CONCLUSION_ZH) return true;
  if (Array.isArray(dim.classical_basis)) {
    const items = dim.classical_basis;
    const factual = items.filter((i) => i.key !== "strength_verdict_premise");
    if (factual.length > 0 && factual.every((i) => !i.present)) return true;
  }
  return false;
}

function shortenConclusionSameFacts(zh: string): string {
  if (zh.length <= BRIEF_MAX) return zh;
  const sentence = zh.match(/^[^。！？]+[。！？]?/);
  if (sentence && sentence[0].length >= 8 && sentence[0].length <= BRIEF_MAX + 12) {
    return sentence[0];
  }
  return `${zh.slice(0, BRIEF_MAX)}…`;
}

function agendaFullIds(agendaSummary: string | null): Set<ThesisDimensionId> | null {
  if (!agendaSummary || !agendaSummary.trim()) return null;
  const t = agendaSummary;
  const full = new Set<ThesisDimensionId>();
  let hit = false;
  if (/创业|钱|财/.test(t)) {
    full.add("resource_pattern");
    full.add("cycle_rhythm");
    hit = true;
  }
  if (/表达|创作/.test(t)) {
    full.add("expression_creativity");
    hit = true;
  }
  return hit ? full : null;
}

/**
 * Adjust depth from agenda keywords. Must not mutate classical_basis /
 * strength_verdict / wuxing_relations content — only depth + optional truncate.
 */
export function applyAgendaDepth(
  thesis: ChartThesis,
  agendaSummary: string | null,
): ChartThesis {
  const targeted = agendaFullIds(agendaSummary);

  const dimensions = thesis.dimensions.map((dim) => {
    const empty = isEmptyDimension(dim);
    let depth: ThesisDimension["depth"];

    if (empty) {
      depth = "brief";
    } else if (targeted == null) {
      // Default: all non-empty full.
      depth = "full";
    } else if (targeted.has(dim.dimension_id)) {
      depth = "full";
    } else {
      depth = "brief";
    }

    const conclusion_zh =
      depth === "brief" && dim.conclusion_zh !== THESIS_EMPTY_CONCLUSION_ZH
        ? shortenConclusionSameFacts(dim.conclusion_zh)
        : dim.conclusion_zh;

    return {
      ...dim,
      // Preserve frozen fact fields by reference / shallow copy of arrays.
      classical_basis: dim.classical_basis,
      strength_verdict: dim.strength_verdict,
      wuxing_relations: dim.wuxing_relations,
      depth,
      conclusion_zh,
    };
  });

  return {
    ...thesis,
    dimensions,
  };
}
