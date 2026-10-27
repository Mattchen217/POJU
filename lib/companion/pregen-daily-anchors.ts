/**
 * v1 Companion · Daily Anchor pre-generation rails.
 *
 * Same PASS batch may pre-generate ≤30 day anchors aligned to report strategy
 * closed sets from: execution_guidance + self_regulation + validation_*.
 * No revisit loop — anchors are one-shot; push can be disabled.
 */

import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import { COMPANION_WINDOW_DAYS } from "./types";
import type { CompanionBrief } from "./types";

/** Closed-set source pages for Daily Anchor wording. */
export const DAILY_ANCHOR_SOURCE_PAGES = [
  "execution_guidance",
  "self_regulation",
  "validation_risk",
  "validation_close",
  "recommended_strategy",
  "decision_brief",
] as const;

export type DailyAnchorSourcePage = (typeof DAILY_ANCHOR_SOURCE_PAGES)[number];

export type DailyAnchorSeed = {
  day_index: number; // 0..29
  /** Rotating perspective: execute | regulate | validate */
  lens: "execute" | "regulate" | "validate";
  /** Must stay inside brief primary/backup rails. */
  track_role: "primary" | "backup";
  /** Soft hints pulled from page schemas (archive means / fuse lines). */
  closed_set_hints: string[];
};

const LENS_ROTATION: DailyAnchorSeed["lens"][] = [
  "execute",
  "regulate",
  "validate",
];

function pushUnique(out: string[], s: string | undefined | null, max = 8): void {
  const t = (s ?? "").trim();
  if (!t || out.includes(t) || out.length >= max) return;
  out.push(t.slice(0, 200));
}

export type DailyAnchorClosedHints = Record<
  DailyAnchorSeed["lens"],
  string[]
>;

/** Seal-time: pull closed-set strings from 06/07/08/09 (+ brief) page schemas. */
export function buildDailyAnchorClosedHints(
  pages: Partial<Record<string, DeliveryPageData>> | undefined,
): DailyAnchorClosedHints {
  const execute: string[] = [];
  const regulate: string[] = [];
  const validate: string[] = [];
  if (!pages) return { execute, regulate, validate };
  const exec = pages.execution_guidance;
  if (exec && exec.page === "execution_guidance") {
    for (const a of exec.primary_toolkit.angles) {
      for (const m of a.means) pushUnique(execute, m);
    }
  }
  const self = pages.self_regulation;
  if (self && self.page === "self_regulation") {
    for (const d of self.dimensions) {
      pushUnique(regulate, d.strategy);
      for (const m of d.means) pushUnique(regulate, m);
    }
  }
  const risk = pages.validation_risk;
  if (risk && risk.page === "validation_risk") {
    for (const r of risk.red_lights) pushUnique(validate, r.situation);
    pushUnique(validate, risk.switch_to_backup.situation);
  }
  const close = pages.validation_close;
  if (close && close.page === "validation_close") {
    pushUnique(validate, close.immediate_action);
    for (const w of close.watch_signals) pushUnique(validate, w);
  }
  const strat = pages.recommended_strategy;
  if (strat && strat.page === "recommended_strategy") {
    pushUnique(execute, strat.primary.why);
    pushUnique(execute, strat.primary.exit);
    pushUnique(validate, strat.backup.exit);
    pushUnique(validate, strat.backup.when);
  }
  const briefPage = pages.decision_brief;
  if (briefPage && briefPage.page === "decision_brief") {
    pushUnique(execute, briefPage.primary.why);
    pushUnique(validate, briefPage.backup.when);
  }
  return { execute, regulate, validate };
}

/**
 * Build ≤30 deterministic Daily Anchor seeds for a sealed PASS.
 * Strategy-consistent (brief rails) + perspective rotation; no revisit hooks.
 */
export function buildDailyAnchorSeeds(input: {
  brief: CompanionBrief;
  pageSchemas?: Partial<Record<string, DeliveryPageData>>;
  /** Prefer sealed hints (from job) over re-parsing pageSchemas. */
  closedHints?: DailyAnchorClosedHints | null;
  /** Cap ≤ COMPANION_WINDOW_DAYS. */
  days?: number;
}): DailyAnchorSeed[] {
  const n = Math.min(
    Math.max(1, input.days ?? COMPANION_WINDOW_DAYS),
    COMPANION_WINDOW_DAYS,
  );
  const byLens =
    input.closedHints &&
    (input.closedHints.execute.length > 0 ||
      input.closedHints.regulate.length > 0 ||
      input.closedHints.validate.length > 0)
      ? input.closedHints
      : buildDailyAnchorClosedHints(input.pageSchemas);
  const seeds: DailyAnchorSeed[] = [];
  for (let i = 0; i < n; i++) {
    const lens = LENS_ROTATION[i % LENS_ROTATION.length]!;
    const track_role: "primary" | "backup" =
      i % 5 === 4 ? "backup" : "primary";
    const pool = byLens[lens];
    const closed_set_hints =
      pool.length > 0
        ? [pool[i % pool.length]!]
        : [
            track_role === "primary"
              ? input.brief.primary.claim.slice(0, 160)
              : input.brief.backup.claim.slice(0, 160),
          ];
    seeds.push({ day_index: i, lens, track_role, closed_set_hints });
  }
  return seeds;
}

/** Prompt rail block for companion daily LLM (inject under brief). */
export function dailyAnchorClosedSetPromptBlock(
  seed: DailyAnchorSeed,
  locale: string,
): string {
  const zh = locale.toLowerCase().startsWith("zh");
  const lensLabel = zh
    ? { execute: "执行原则", regulate: "自我调频", validate: "风险/收束" }[seed.lens]
    : { execute: "execution", regulate: "self-regulation", validate: "validation" }[
        seed.lens
      ];
  const hints = seed.closed_set_hints.map((h) => `- ${h}`).join("\n");
  return zh
    ? `【Daily Anchor 闭集 · 第 ${seed.day_index + 1}/30 · 镜头=${lensLabel} · 轨=${seed.track_role}】\n须贴合报告策略栏杆；hints 仅作闭集，禁另开第三套战略：\n${hints}\n禁回访改旧报告；禁布置可验收作业表。`
    : `[Daily Anchor closed-set · day ${seed.day_index + 1}/30 · lens=${lensLabel} · track=${seed.track_role}]\nStay inside report strategy rails; hints are closed-set only — no third strategy:\n${hints}\nNo revisit/edit of the sealed report; no assignable homework table.`;
}
