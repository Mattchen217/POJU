/**
 * Deterministic judgment core from ThesisCalcFeed — classical_basis + brief conclusions, no LLM.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { applyAgendaDepth } from "@/lib/llm/pro/delivery/thesis/apply-agenda-depth";
import { buildThesisCalcFeed } from "@/lib/llm/pro/delivery/thesis/build-thesis-calc-feed";
import type {
  ChartThesis,
  ChecklistItemStatus,
  ThesisCalcFeed,
  ThesisDimension,
  ThesisDimensionId,
  ThesisWuxingRelation,
} from "@/lib/llm/pro/delivery/thesis/types";
import {
  THESIS_DIMENSION_IDS,
  THESIS_DIMENSION_NAME_ZH,
  THESIS_EMPTY_CONCLUSION_ZH,
} from "@/lib/llm/pro/delivery/thesis/types";

const WUXING_SET = new Set(["木", "火", "土", "金", "水"]);

const SHENG: Record<string, string> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

const KE: Record<string, string> = {
  木: "土",
  土: "水",
  水: "火",
  火: "金",
  金: "木",
};

function extractWuxingToken(raw: string): string | null {
  const t = raw.trim();
  if (WUXING_SET.has(t)) return t;
  const m = t.match(/[木火土金水]/);
  return m?.[0] ?? null;
}

function relationBetween(from: string, to: string): string {
  if (from === to) return "同气";
  if (SHENG[from] === to) return "生";
  if (KE[from] === to) return "克";
  if (SHENG[to] === from) return "被生";
  if (KE[to] === from) return "被克";
  return "相涉";
}

function parseWuxingSeeds(hints: string[]): ThesisWuxingRelation[] {
  const yong: string[] = [];
  const ji: string[] = [];
  for (const h of hints) {
    const y = /^wuxing:yong:(.+)$/.exec(h);
    if (y) {
      const wx = extractWuxingToken(y[1] ?? "");
      if (wx) yong.push(wx);
    }
    const j = /^wuxing:ji:(.+)$/.exec(h);
    if (j) {
      const wx = extractWuxingToken(j[1] ?? "");
      if (wx) ji.push(wx);
    }
  }
  const out: ThesisWuxingRelation[] = [];
  const seen = new Set<string>();
  for (const jWx of [...new Set(ji)]) {
    for (const yWx of [...new Set(yong)]) {
      const key = `${jWx}->${yWx}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        from: jWx,
        to: yWx,
        relation: relationBetween(jWx, yWx),
        note: "忌神相对用神（真算种子，未扩写）",
      });
    }
  }
  return out;
}

function conclusionFromItems(items: ChecklistItemStatus[], empty: boolean): string {
  if (empty) return THESIS_EMPTY_CONCLUSION_ZH;
  const present = items
    .filter((i) => i.present && i.key !== "strength_verdict_premise")
    .map((i) => i.summary_zh.trim())
    .filter(Boolean);
  if (present.length === 0) return THESIS_EMPTY_CONCLUSION_ZH;
  // Deterministic vernacular join — only checklist facts, no invented clauses.
  const body = present.map((s) => (s.endsWith("。") ? s.slice(0, -1) : s)).join("。");
  return `${body}。`;
}

function withStrengthPremise(
  items: ChecklistItemStatus[],
  strengthVerdict: string | undefined,
): ChecklistItemStatus[] {
  if (!strengthVerdict) return [...items];
  return [
    {
      key: "strength_verdict_premise",
      present: true,
      summary_zh: `前提：日主强弱判定为${strengthVerdict}`,
    },
    ...items,
  ];
}

function buildOneDimension(
  id: ThesisDimensionId,
  feed: ThesisCalcFeed,
  strengthVerdict: string | undefined,
): ThesisDimension {
  const dim = feed.dimensions[id];
  const empty = dim.empty;
  let classical_basis: ChecklistItemStatus[] = [...dim.items];

  if (id === "favor_avoid_tuning" || id === "interpersonal_pattern") {
    classical_basis = withStrengthPremise(classical_basis, strengthVerdict);
  }

  const wuxing_relations =
    id === "favor_avoid_tuning" ? parseWuxingSeeds(dim.hints) : [];

  return {
    dimension_id: id,
    dimension_name_zh: THESIS_DIMENSION_NAME_ZH[id],
    classical_basis,
    ...(id === "day_master_strength" && dim.strength_verdict
      ? { strength_verdict: dim.strength_verdict }
      : {}),
    conclusion_zh: conclusionFromItems(dim.items, empty),
    usable_claims_hint: empty ? [] : [...dim.hints],
    wuxing_relations,
    depth: empty ? "brief" : "full",
  };
}

/** Feed → frozen judgment core (depth may still be adjusted by agenda). */
export function buildJudgmentCoreFromFeed(
  feed: ThesisCalcFeed,
  meta?: { as_of_day?: string; question_category?: string | null },
): ChartThesis {
  const strengthVerdict = feed.dimensions.day_master_strength.strength_verdict;
  const dimensions = THESIS_DIMENSION_IDS.map((id) =>
    buildOneDimension(id, feed, strengthVerdict),
  );

  return {
    version: 1,
    structured_fingerprint: feed.fingerprint,
    dimensions,
    generated_at: new Date().toISOString(),
    judgment_core_frozen: true,
    as_of_day: meta?.as_of_day,
    question_category: meta?.question_category ?? null,
  };
}

function asOfDayUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ensureJob helper: structured → feed → core → agenda depth. */
export function buildChartThesisFromStructured(
  structured: ProfileStructured,
  agendaSummary?: string | null,
  opts?: {
    nowYear?: number;
    as_of?: Date;
    timezone?: string;
    question_category?: import("@/lib/poju/agent-state").QuestionCategory;
    supplement?: import("@/lib/calculations/topic-calc-supplement").TopicCalcSupplement | null;
  },
): ChartThesis {
  const as_of = opts?.as_of ?? (opts?.nowYear
    ? new Date(Date.UTC(opts.nowYear, 5, 15, 12, 0, 0))
    : new Date());
  const feed = buildThesisCalcFeed(structured, {
    nowYear: opts?.nowYear,
    as_of,
    timezone: opts?.timezone,
    question_category: opts?.question_category,
    supplement: opts?.supplement,
  });
  const core = buildJudgmentCoreFromFeed(feed, {
    as_of_day: asOfDayUtc(as_of),
    question_category: opts?.question_category ?? null,
  });
  return applyAgendaDepth(core, agendaSummary ?? null);
}
