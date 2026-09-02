/**
 * Call B · 备料全覆盖 — validate + deterministic patch for investigation_agenda.
 * Ensures spine needs_validation → collecting agenda → six-page delivery inputs.
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import { DUAL_PARTY_REALITY_NEED_LABELS } from "@/lib/llm/prompts/pivot-dual-party-policy";
import { extractRelationFocusHintsFromText } from "@/lib/poju/relation-focus-hints";
import { splitNeedsValidationFacets } from "@/lib/llm/deepseek/segment2-spine-readiness";

export type AgendaSpineCoverageContext = {
  original_question?: string;
  question_category?: string | null;
};

const PLACEHOLDER_NEEDS_RE = /^待补/;
const RELATION_CATEGORIES = new Set(["relationship", "interpersonal", "family"]);

const BINARY_THEME_CHECKS = [
  {
    id: "role_power",
    label: DUAL_PARTY_REALITY_NEED_LABELS[0]!,
    pattern: /角色|权力|伴侣|老板|合伙人|同事|家人|对方|男友|女友|配偶/i,
  },
  {
    id: "observable_behavior",
    label: DUAL_PARTY_REALITY_NEED_LABELS[1]!,
    pattern: /行为|态度|反对|沟通|表现|可观察|怎么说|怎么做/i,
  },
  {
    id: "bottom_line",
    label: DUAL_PARTY_REALITY_NEED_LABELS[2]!,
    pattern: /底线|成本|储蓄|安全垫|不可逆|撑多久|最坏|硬约束/i,
  },
] as const;

function agendaBlob(item: AgendaItem): string {
  return [item.label, item.supports, item.collection_goal].filter(Boolean).join(" ");
}

function needsText(raw: string | undefined): string {
  return (raw ?? "").trim();
}

function isActionableNeeds(raw: string | undefined): boolean {
  const t = needsText(raw);
  return t.length >= 4 && !PLACEHOLDER_NEEDS_RE.test(t);
}

function shortLabelFromNeeds(needs: string, fallback: string): string {
  const t = needs.trim().replace(/[？?。]+$/g, "");
  if (t.length <= 22) return t.startsWith("你的") ? t : `你的${t}`;
  const slice = t.slice(0, 20).replace(/[，,；;：:]+$/g, "");
  return slice.startsWith("你的") ? slice : `你的${slice}`;
}

function nextAgendaId(agenda: AgendaItem[]): string {
  let n = agenda.length + 1;
  while (agenda.some((a) => a.id === `ag_coverage_${n}`)) n += 1;
  return `ag_coverage_${n}`;
}

export function isDualPartyPivotCase(
  core: BreakthroughCore,
  ctx: AgendaSpineCoverageContext,
): boolean {
  if (ctx.question_category && RELATION_CATEGORIES.has(ctx.question_category)) {
    return true;
  }
  if (ctx.question_category === "decision") {
    return extractRelationFocusHintsFromText(ctx.original_question ?? "").themes.includes(
      "relationship",
    );
  }
  const blob = [
    ctx.original_question ?? "",
    core.situation_conclusion,
    core.response ?? "",
    core.key_crossroads.real_fork,
    core.key_crossroads.needs_validation,
  ].join("\n");
  const hints = extractRelationFocusHintsFromText(blob);
  return hints.themes.includes("relationship") || /家人|反对|男友|女友|伴侣|配偶|感情/.test(blob);
}

export function needsSignalsCloseCoverage(core: BreakthroughCore): boolean {
  const rf = core.rhythm_frame;
  const er = core.energy_retune_frame;
  const blob = [
    rf.phase1_observe,
    rf.phase2_adjust,
    rf.phase3_consolidate,
    er.timing_ripeness,
    er.daily_retune,
  ].join(" ");
  return /观察|调整|巩固|节奏|近7|一周|30天|时段|精力|时间/.test(blob);
}

function coveredActionFrameIndices(agenda: AgendaItem[]): Set<number> {
  const set = new Set<number>();
  for (const item of agenda) {
    if (item.frame_kind === "modern_action" && item.frame_index != null) {
      set.add(item.frame_index);
    }
  }
  return set;
}

function hasFrameKind(agenda: AgendaItem[], kind: AgendaItem["frame_kind"]): boolean {
  return agenda.some((a) => a.frame_kind === kind);
}

function servesPages(agenda: AgendaItem[]): Set<string> {
  const pages = new Set<string>();
  for (const item of agenda) {
    if (item.serves_page?.trim()) pages.add(item.serves_page.trim());
    else if (item.frame_kind === "modern_action") pages.add("science_action");
    else if (item.frame_kind === "energy_retune") pages.add("metaphysics_action");
  }
  return pages;
}

function facetKeywords(facet: string): string[] {
  return facet
    .replace(/[？?，,；;：:。]+/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
}

function facetCoveredByText(facet: string, blob: string): boolean {
  const normalizedFacet = facet.replace(/[\s\u3000，,；;：:？?。]+/g, "").toLowerCase();
  const normalizedBlob = blob.replace(/[\s\u3000，,；;：:？?。]+/g, "").toLowerCase();
  if (normalizedFacet.length < 4) return false;
  const probe = normalizedFacet.slice(0, Math.min(10, normalizedFacet.length));
  if (normalizedBlob.includes(probe)) return true;
  const keywords = facetKeywords(facet);
  if (keywords.length === 0) return false;
  const hits = keywords.filter((kw) => normalizedBlob.includes(kw.toLowerCase())).length;
  return hits >= Math.min(2, keywords.length);
}

function facetCoveredByAgenda(facet: string, agenda: AgendaItem[]): boolean {
  const blob = agenda.map((item) => agendaBlob(item)).join(" ");
  return facetCoveredByText(facet, blob);
}

function uncoveredCrossroadsFacets(core: BreakthroughCore, agenda: AgendaItem[]): string[] {
  const facets = splitNeedsValidationFacets(core.key_crossroads.needs_validation);
  if (facets.length <= 1) return [];
  const blob = agenda.map((item) => agendaBlob(item)).join(" ");
  return facets.filter((facet) => !facetCoveredByText(facet, blob));
}

function binaryThemesPresent(agenda: AgendaItem[]): Set<string> {
  const found = new Set<string>();
  for (const item of agenda) {
    const blob = agendaBlob(item);
    for (const theme of BINARY_THEME_CHECKS) {
      if (theme.pattern.test(blob)) found.add(theme.id);
    }
  }
  return found;
}

export type AgendaSpineCoverageResult =
  | { ok: true }
  | { ok: false; reason: string; gaps: readonly string[] };

export function validateAgendaSpineCoverage(
  agenda: AgendaItem[],
  core: BreakthroughCore,
  ctx: AgendaSpineCoverageContext,
): AgendaSpineCoverageResult {
  const gaps: string[] = [];
  const xc = core.key_crossroads;
  const er = core.energy_retune_frame;
  const frames = core.modern_action_frames ?? [];

  if (isActionableNeeds(xc.needs_validation) && !hasFrameKind(agenda, "key_crossroads")) {
    gaps.push("missing_key_crossroads_agenda");
  }

  const uncoveredFacets = uncoveredCrossroadsFacets(core, agenda);
  for (let i = 0; i < uncoveredFacets.length; i++) {
    gaps.push(`missing_key_crossroads_facet_${i + 1}`);
  }

  if (isActionableNeeds(er.needs_validation) && !hasFrameKind(agenda, "energy_retune")) {
    gaps.push("missing_energy_retune_agenda");
  }

  if (frames.length > 0) {
    const covered = coveredActionFrameIndices(agenda);
    for (let i = 1; i <= frames.length; i++) {
      if (!covered.has(i)) gaps.push(`missing_modern_action_frame_${i}`);
    }
  }

  const pages = servesPages(agenda);
  const hasScience =
    pages.has("science_action") || agenda.some((a) => a.frame_kind === "modern_action");
  if (!hasScience && frames.length > 0) {
    gaps.push("missing_serves_page_science_action");
  }

  if (agenda.length >= 3 && pages.size === 1 && pages.has("science_action")) {
    gaps.push("serves_page_all_science_action");
  }

  if (isDualPartyPivotCase(core, ctx)) {
    const themes = binaryThemesPresent(agenda);
    for (const theme of BINARY_THEME_CHECKS) {
      if (!themes.has(theme.id)) gaps.push(`missing_binary_${theme.id}`);
    }
    const criticalCount = agenda.filter((a) => a.critical).length;
    if (criticalCount < 3) gaps.push("binary_critical_lt_3");
  }

  if (needsSignalsCloseCoverage(core) && !pages.has("signals_close")) {
    const hasRhythmGoal = agenda.some((a) =>
      /近7|一周|节奏|时间|精力/.test(agendaBlob(a)),
    );
    if (!hasRhythmGoal) gaps.push("missing_serves_page_signals_close");
  }

  if (
    isDualPartyPivotCase(core, ctx) &&
    !pages.has("risk_guard") &&
    !pages.has("metaphysics_action") &&
    !hasFrameKind(agenda, "energy_retune")
  ) {
    gaps.push("missing_serves_page_risk_or_metaphysics");
  }

  if (agenda.length < 3) gaps.push("agenda_lt_3");
  if (agenda.length > 6) gaps.push("agenda_gt_6");

  if (gaps.length === 0) return { ok: true };
  return { ok: false, reason: gaps[0] ?? "coverage_failed", gaps };
}

function pushAgendaItem(agenda: AgendaItem[], item: AgendaItem): void {
  if (agenda.some((a) => a.id === item.id)) return;
  agenda.push(item);
}

/** Deterministic patch: fill gaps from spine needs_validation before delivery collecting. */
export function patchAgendaSpineCoverage(
  agenda: AgendaItem[],
  core: BreakthroughCore,
  ctx: AgendaSpineCoverageContext,
): AgendaItem[] {
  const next = agenda.map((a) => ({ ...a }));
  const xc = core.key_crossroads;
  const er = core.energy_retune_frame;
  const frames = core.modern_action_frames ?? [];

  if (isActionableNeeds(xc.needs_validation) && !hasFrameKind(next, "key_crossroads")) {
    pushAgendaItem(next, {
      id: nextAgendaId(next),
      label: shortLabelFromNeeds(xc.needs_validation, "你的分岔现实"),
      critical: true,
      status: "unexplored",
      frame_kind: "key_crossroads",
      supports: xc.real_fork.slice(0, 80) || "key_crossroads",
      serves_page: "risk_guard",
      serves_path: "both",
      role: "calibrate",
      collection_goal: `对齐分岔判断所需现实: ${xc.needs_validation.slice(0, 120)}`,
    });
  }

  for (const facet of uncoveredCrossroadsFacets(core, next)) {
    const enrichIdx = next.findIndex(
      (a) =>
        a.frame_kind === "key_crossroads" &&
        !facetCoveredByText(facet, agendaBlob(a)),
    );
    if (enrichIdx >= 0) {
      const item = next[enrichIdx]!;
      next[enrichIdx] = {
        ...item,
        label: item.label || shortLabelFromNeeds(facet, "你的分岔验证点"),
        collection_goal: [item.collection_goal, facet].filter(Boolean).join("；"),
        serves_page: item.serves_page === "science_action" ? "risk_guard" : item.serves_page,
      };
      continue;
    }
    pushAgendaItem(next, {
      id: nextAgendaId(next),
      label: shortLabelFromNeeds(facet, "你的分岔验证点"),
      critical: true,
      status: "unexplored",
      frame_kind: "key_crossroads",
      supports: xc.real_fork.slice(0, 80) || "key_crossroads",
      serves_page: "risk_guard",
      serves_path: "both",
      role: "calibrate",
      collection_goal: `对齐分岔面所需现实: ${facet.slice(0, 120)}`,
    });
  }

  const covered = coveredActionFrameIndices(next);
  for (let i = 0; i < frames.length; i++) {
    const idx = i + 1;
    if (covered.has(idx)) continue;
    const frame = frames[i]!;
    pushAgendaItem(next, {
      id: nextAgendaId(next),
      label: shortLabelFromNeeds(frame.needs_validation || frame.direction, `行动假设${idx}`),
      critical: i < 2,
      status: "unexplored",
      frame_kind: "modern_action",
      frame_index: idx,
      supports: frame.direction,
      serves_page: "science_action",
      serves_path: i === 0 ? "primary" : i === 1 ? "backup" : "both",
      role: "fill",
      collection_goal: `验证行动假设#${idx}能否落地: ${(frame.needs_validation || frame.direction).slice(0, 120)}`,
    });
    covered.add(idx);
  }

  if (isActionableNeeds(er.needs_validation) && !hasFrameKind(next, "energy_retune")) {
    pushAgendaItem(next, {
      id: nextAgendaId(next),
      label: shortLabelFromNeeds(er.needs_validation, "你的日常调频现实"),
      critical: true,
      status: "unexplored",
      frame_kind: "energy_retune",
      supports: er.direction_fit || "energy_retune",
      serves_page: "metaphysics_action",
      serves_path: "both",
      role: "personalize",
      collection_goal: `对齐调频/关系场景所需现实: ${er.needs_validation.slice(0, 120)}`,
    });
  }

  if (isDualPartyPivotCase(core, ctx)) {
    const themes = binaryThemesPresent(next);
    for (const theme of BINARY_THEME_CHECKS) {
      if (themes.has(theme.id)) continue;
      pushAgendaItem(next, {
        id: nextAgendaId(next),
        label: theme.label,
        critical: true,
        status: "unexplored",
        frame_kind: "key_crossroads",
        supports: xc.real_fork.slice(0, 80) || theme.label,
        serves_page: theme.id === "bottom_line" ? "risk_guard" : "risk_guard",
        serves_path: "both",
        role: theme.id === "observable_behavior" ? "calibrate" : "fill",
        collection_goal: theme.label,
      });
      themes.add(theme.id);
    }
  }

  const pages = servesPages(next);
  if (
    isDualPartyPivotCase(core, ctx) &&
    !pages.has("risk_guard") &&
    !pages.has("metaphysics_action") &&
    !hasFrameKind(next, "energy_retune")
  ) {
    pushAgendaItem(next, {
      id: nextAgendaId(next),
      label: "关系摩擦的真实表现",
      critical: true,
      status: "unexplored",
      frame_kind: "key_crossroads",
      supports: xc.path_costs.slice(0, 80) || "path_costs",
      serves_page: "risk_guard",
      serves_path: "both",
      role: "calibrate",
      collection_goal: "摸清反对/摩擦的可观察表现,够写执行刹车与边界",
    });
  }

  if (needsSignalsCloseCoverage(core) && !servesPages(next).has("signals_close")) {
    const hasRhythmGoal = next.some((a) => /近7|一周|节奏|时间|精力/.test(agendaBlob(a)));
    if (!hasRhythmGoal) {
      pushAgendaItem(next, {
        id: nextAgendaId(next),
        label: "近7日可投入节奏",
        critical: true,
        status: "unexplored",
        frame_kind: "modern_action",
        frame_index: Math.min(2, core.modern_action_frames?.length ?? 1),
        supports: core.rhythm_frame.phase1_observe.slice(0, 80) || "rhythm_frame",
        serves_page: "signals_close",
        serves_path: "both",
        role: "fill",
        collection_goal: "确认近7日可投入的时间/节奏,够写收束页微行动",
      });
    }
  }

  return finalizeAgendaPool(next, core, ctx);
}

function enrichAgendaForCoverage(
  agenda: AgendaItem[],
  core: BreakthroughCore,
  ctx: AgendaSpineCoverageContext,
): AgendaItem[] {
  const next = agenda.map((a) => ({ ...a }));

  if (needsSignalsCloseCoverage(core)) {
    const hasPage = next.some((a) => a.serves_page === "signals_close");
    const hasRhythmGoal = next.some((a) => /近7|一周|节奏|时间|精力/.test(agendaBlob(a)));
    if (!hasPage && !hasRhythmGoal) {
      const idx = next.findIndex((a) => a.frame_kind === "modern_action");
      if (idx >= 0) {
        const item = next[idx]!;
        const rhythmHint =
          core.rhythm_frame.phase1_observe.slice(0, 60) || "近7日可投入节奏";
        next[idx] = {
          ...item,
          collection_goal: [item.collection_goal, `确认近7日可投入的时间/节奏: ${rhythmHint}`]
            .filter(Boolean)
            .join("；"),
        };
      }
    }
  }

  if (isDualPartyPivotCase(core, ctx)) {
    const themes = binaryThemesPresent(next);
    for (const theme of BINARY_THEME_CHECKS) {
      if (themes.has(theme.id)) continue;
      const idx = next.findIndex(
        (a) =>
          a.frame_kind === "key_crossroads" &&
          !BINARY_THEME_CHECKS.some((t) => t.pattern.test(agendaBlob(a))),
      );
      if (idx >= 0) {
        const item = next[idx]!;
        next[idx] = {
          ...item,
          label: item.label || theme.label,
          collection_goal: theme.label,
          serves_page: "risk_guard",
        };
        themes.add(theme.id);
      }
    }
    for (const item of next) {
      if (item.frame_kind === "key_crossroads" && item.serves_page === "science_action") {
        item.serves_page = "risk_guard";
      }
    }
  }

  return next;
}

function dedupeAgendaItems(agenda: AgendaItem[]): AgendaItem[] {
  const byActionIdx = new Map<number, AgendaItem>();
  const seenIds = new Set<string>();
  const out: AgendaItem[] = [];

  const preferItem = (current: AgendaItem, incoming: AgendaItem): AgendaItem => {
    const score = (item: AgendaItem): number => {
      let s = 0;
      if (item.id.startsWith("agenda_")) s += 4;
      if (!item.id.startsWith("ag_coverage_")) s += 2;
      if (item.label.trim().length > 0) s += 1;
      return s;
    };
    return score(incoming) > score(current) ? incoming : current;
  };

  for (const item of agenda) {
    if (seenIds.has(item.id)) continue;
    if (item.frame_kind === "modern_action" && item.frame_index != null) {
      const existing = byActionIdx.get(item.frame_index);
      if (existing) {
        byActionIdx.set(item.frame_index, preferItem(existing, item));
        continue;
      }
      byActionIdx.set(item.frame_index, item);
      continue;
    }
    seenIds.add(item.id);
    out.push(item);
  }

  for (const item of byActionIdx.values()) {
    seenIds.add(item.id);
    out.push(item);
  }
  return out;
}

function selectAgendaSubset(
  agenda: AgendaItem[],
  core: BreakthroughCore,
  ctx: AgendaSpineCoverageContext,
  max: number,
): AgendaItem[] {
  if (agenda.length <= max) return agenda;
  const picked: AgendaItem[] = [];
  const used = new Set<AgendaItem>();

  const take = (pred: (a: AgendaItem) => boolean) => {
    for (const item of agenda) {
      if (used.has(item) || picked.length >= max) return;
      if (!pred(item)) continue;
      picked.push(item);
      used.add(item);
    }
  };

  const frames = core.modern_action_frames ?? [];
  // Frame coverage is non-negotiable — never drop a spine action frame when trimming.
  for (let i = 1; i <= frames.length; i++) {
    const idx = i;
    const candidates = agenda.filter(
      (a) => a.frame_kind === "modern_action" && a.frame_index === idx,
    );
    const preferred =
      candidates.find((a) => a.id.startsWith("agenda_")) ??
      candidates.find((a) => !a.id.startsWith("ag_coverage_")) ??
      candidates[0];
    if (preferred && !used.has(preferred) && picked.length < max) {
      picked.push(preferred);
      used.add(preferred);
    }
  }
  take((a) => a.frame_kind === "energy_retune");
  take((a) => a.frame_kind === "key_crossroads");
  if (isDualPartyPivotCase(core, ctx)) {
    for (const theme of BINARY_THEME_CHECKS) {
      take((a) => theme.pattern.test(agendaBlob(a)));
    }
  }
  take((a) => a.serves_page === "risk_guard" || a.serves_page === "metaphysics_action");
  if (needsSignalsCloseCoverage(core)) {
    take((a) => a.serves_page === "signals_close");
  }

  const rest = [...agenda]
    .filter((a) => !used.has(a))
    .sort((a, b) => Number(b.critical) - Number(a.critical));
  for (const item of rest) {
    if (picked.length >= max) break;
    picked.push(item);
    used.add(item);
  }

  return picked.length >= 3 ? picked : agenda.slice(0, max);
}

function finalizeAgendaPool(
  agenda: AgendaItem[],
  core: BreakthroughCore,
  ctx: AgendaSpineCoverageContext,
): AgendaItem[] {
  let next = dedupeAgendaItems(agenda);
  if (next.length > 6) {
    next = selectAgendaSubset(next, core, ctx, 6);
  }
  next = enrichAgendaForCoverage(next, core, ctx);

  if (next.length < 3) {
    while (next.length < 3) {
      pushAgendaItem(next, {
        id: nextAgendaId(next),
        label: "待对齐关键现实",
        critical: next.length === 0,
        status: "unexplored",
        frame_kind: "key_crossroads",
        supports: core.key_crossroads.structural_basis.slice(0, 80) || "spine",
        serves_page: "science_action",
        serves_path: "both",
        role: "fill",
        collection_goal: "补齐解题所需最少现实",
      });
    }
  }

  if (!next.some((a) => a.critical)) {
    next[0] = { ...next[0]!, critical: true };
  }

  return next;
}

export function ensureAgendaSpineCoverage(
  agenda: AgendaItem[],
  core: BreakthroughCore,
  ctx: AgendaSpineCoverageContext,
): AgendaItem[] {
  let current = patchAgendaSpineCoverage(agenda, core, ctx);
  let check = validateAgendaSpineCoverage(current, core, ctx);
  if (!check.ok) {
    current = patchAgendaSpineCoverage(current, core, ctx);
    check = validateAgendaSpineCoverage(current, core, ctx);
  }
  if (!check.ok) {
    throw new AgendaSpineCoverageError(check.reason, check.gaps);
  }
  return current;
}

export class AgendaSpineCoverageError extends Error {
  readonly gaps: readonly string[];

  constructor(message: string, gaps: readonly string[] = []) {
    super(message);
    this.name = "AgendaSpineCoverageError";
    this.gaps = gaps;
  }
}
