/**
 * M3 — eight-page generation for Decision Intake 2.0.
 *
 * Each model page reads: frozen DC page feed (dc-page-feed) + Personal Analysis
 * artifact + local chart lines + page definition (DECISION_PAGE_SCHEMAS) +
 * validated upstream pages. Output is structured JSON, validated (A: judge only),
 * then rendered deterministically. 03 is a code-built glossary appendix from
 * term markers in the final evidence layer (no model call); 07 is generated
 * only when the topic gate applies.
 */

import { resolveTermForLocale } from "@/lib/llm/pro/delivery/decision-report-v2/body-compliance";
import {
  buildGlossaryAppendix,
  collectUsedTermIdsFromEvidence,
} from "@/lib/llm/pro/delivery/decision-report-v2/glossary-appendix";
import { DELIVERY_LLM_MAX_TOKENS } from "@/lib/llm/pro/delivery/delivery-tasks";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import {
  deliveryTopicFromSignals,
  page07Applies,
} from "@/lib/llm/pro/delivery/slice-for-page";
import { buildUserFacingExpressionContractBlock } from "@/lib/llm/prompts/user-facing-expression-contract";
import {
  bareMingliWordInPlain,
  encodeAndPolishDeliveryEvidence,
  listUnresolvedWordSlots,
  maskMarkersForAudit,
  parseTermMarkers,
} from "@/lib/llm/sanitize/term-marking";
import { pojuTermBySlug } from "@/lib/glossary/pojulife-terms";
import { buildDecisionContextPageFeed } from "@/lib/poju/decision-context/dc-page-feed";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import { tryParseJsonObject } from "@/lib/poju/shared/json-tools";
import {
  DI2_READING_ORDER,
  PERSONAL_ANALYSIS_SECTIONS,
  type EvidenceReference,
  type PersonalAnalysisArtifact,
  type ReportEvidenceCoverageEntry,
  type DecisionReportPageRecord,
} from "./decision-report-types";
import {
  di2EvidenceLayerText,
  renderDi2PageBody,
  type Di2Experiment,
  type Di2PageBlock,
  type Di2PageStructured,
  type Di2PathOption,
  type Di2Review,
} from "./decision-report-render";
import {
  addProfileEvidence,
  buildDcEvidenceIndex,
  requiredUnresolvedRefs,
  type ProfileProjection,
} from "./personal-analysis";
import type { DecisionBlueprint } from "./types";

/** Fail-closed: raw term markers must resolve in SSOT before polish demotion can hide them. */
function assertEvidenceTermMarkersResolvable(text: string, locale: string): void {
  for (const m of parseTermMarkers(text)) {
    if (!m.id) continue;
    if (pojuTermBySlug(m.id) || resolveTermForLocale(m.id, locale)) continue;
    throw new Error(`glossary term_id「${m.id}」missing SSOT soft label for locale`);
  }
}

// ─── Topic gate (07) ───────────────────────────────────────────────────────

export function resolvePage07Applicability(input: {
  dc: DecisionContext;
  blueprint: DecisionBlueprint | null;
}): { applies: boolean; topic: string | null } {
  if (input.blueprint?.page_07_emit === true) {
    return { applies: true, topic: input.blueprint.topic_tags?.[0] ?? "blueprint" };
  }
  const question =
    input.dc.definition.decision_question ?? input.blueprint?.decision_question ?? null;
  const candidates = [null, ...(input.blueprint?.topic_tags ?? [])];
  for (const tag of candidates) {
    const topic = deliveryTopicFromSignals({ question, topic: tag });
    if (page07Applies(topic)) return { applies: true, topic };
  }
  return { applies: false, topic: null };
}

// ─── Evidence index for pages ──────────────────────────────────────────────

export function buildReportEvidenceIndex(input: {
  dc: DecisionContext;
  projection: ProfileProjection;
  artifact: PersonalAnalysisArtifact;
}): Map<string, EvidenceReference> {
  const idx = addProfileEvidence(buildDcEvidenceIndex(input.dc), input.projection);
  for (const key of PERSONAL_ANALYSIS_SECTIONS) {
    for (const item of input.artifact[key]) {
      idx.set(item.item_id, {
        ref_id: item.item_id,
        kind: "analysis_item",
        status: "personal_analysis",
        excerpt: item.text,
      });
    }
  }
  return idx;
}

/**
 * Deterministic two-way report evidence audit. Page metadata has already been
 * bound to the current Job / Freeze / Analysis by the runner before this runs.
 */
export function buildReportEvidenceCoverage(input: {
  dc: DecisionContext;
  artifact: PersonalAnalysisArtifact;
  pages: ReadonlyArray<DecisionReportPageRecord>;
  binding?: { job_id: string; execution_generation: number; freeze_id: string; context_hash: string; analysis_id: string };
  blueprint?: DecisionBlueprint | null;
}): { ok: boolean; matrix: ReportEvidenceCoverageEntry[]; reason: string | null } {
  const referencesByPage = new Map<string, Set<string>>();
  const pageRefs = (value: unknown): string[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const refs: string[] = [];
    if (Array.isArray(row.evidence_refs)) refs.push(...row.evidence_refs.filter((x): x is string => typeof x === "string"));
    return refs;
  };
  for (const p of input.pages) {
    const refs = new Set<string>();
    const structured = p.structured as Record<string, unknown> | null;
    if (structured && Array.isArray(structured.blocks)) for (const b of structured.blocks) pageRefs(b).forEach((r) => refs.add(r));
    if (structured && Array.isArray(structured.paths)) for (const x of structured.paths) pageRefs(x).forEach((r) => refs.add(r));
    if (structured?.experiment) pageRefs(structured.experiment).forEach((r) => refs.add(r));
    if (structured?.review) pageRefs(structured.review).forEach((r) => refs.add(r));
    referencesByPage.set(p.page_id, refs);
  }
  const bindingFailures = input.binding
    ? input.pages.filter((p) => p.job_id !== input.binding!.job_id ||
        p.execution_generation !== input.binding!.execution_generation ||
        p.freeze_id !== input.binding!.freeze_id || p.context_hash !== input.binding!.context_hash ||
        p.analysis_id !== input.binding!.analysis_id)
    : [];
  const analysisItems = PERSONAL_ANALYSIS_SECTIONS.flatMap((key) => input.artifact[key]);
  const analysisById = new Map(analysisItems.map((item) => [item.item_id, item]));
  const dcEvidence = buildDcEvidenceIndex(input.dc);
  const entries: ReportEvidenceCoverageEntry[] = [];

  // Every substantive generated page must use both analysis and frozen-context
  // evidence. Page 03 is a code-built glossary appendix (no model evidence refs).
  for (const p of input.pages) {
    if (p.page_id === "03" || p.applicability === "not_applicable") continue;
    const refs = referencesByPage.get(p.page_id) ?? new Set<string>();
    const hasAnalysis = [...refs].some((id) => analysisById.has(id));
    const hasContext = [...refs].some((id) => dcEvidence.has(id) || id === "DEF");
    entries.push({
      source_id: `page:${p.page_id}`, source_type: "report_section", status: "substantive",
      related_direction_id: null, expected_sections: [p.page_id], actual_sections: [p.page_id],
      evidence_reference: [...refs].join(",") || null,
      coverage_result: hasAnalysis && hasContext ? "covered" : "missing",
      missing_reason: hasAnalysis && hasContext ? null : "section_requires_personal_analysis_and_frozen_context_evidence",
    });
  }
  for (const p of bindingFailures) entries.push({
    source_id: `page:${p.page_id}`, source_type: "page_binding", status: "mismatched",
    related_direction_id: null, expected_sections: [p.page_id], actual_sections: [p.page_id],
    evidence_reference: null, coverage_result: "missing",
    missing_reason: "page_job_generation_freeze_context_or_analysis_binding_mismatch",
  });

  const evidenceById = new Map(input.artifact.evidence_references.map((ref) => [ref.ref_id, ref]));
  const validPageRefs = new Set(["DEF", ...dcEvidence.keys(), ...evidenceById.keys(), ...analysisById.keys()]);
  for (const [page, refs] of referencesByPage) {
    for (const ref of refs) if (!validPageRefs.has(ref)) entries.push({
      source_id: ref, source_type: "fabricated_evidence_reference", status: "invalid",
      related_direction_id: null, expected_sections: [page], actual_sections: [page],
      evidence_reference: ref, coverage_result: "missing", missing_reason: "evidence_reference_not_in_frozen_context_or_validated_analysis",
    });
  }
  for (const page of input.pages) {
    if (page.page_id === "03" || page.applicability === "not_applicable") continue;
    const structured = page.structured as Record<string, unknown> | null;
    const nodes: Array<{ id: string; data: Record<string, unknown> }> = [];
    if (Array.isArray(structured?.blocks)) (structured!.blocks as Array<Record<string, unknown>>).forEach((data, index) => nodes.push({ id: String(data.segment_id ?? index), data }));
    if (Array.isArray(structured?.paths)) (structured!.paths as Array<Record<string, unknown>>).forEach((data, index) => nodes.push({ id: String(data.path_id ?? `path-${index}`), data }));
    if (structured?.experiment && typeof structured.experiment === "object") nodes.push({ id: "experiment", data: structured.experiment as Record<string, unknown> });
    if (structured?.review && typeof structured.review === "object") nodes.push({ id: "review", data: structured.review as Record<string, unknown> });
    for (const { id, data: block } of nodes) {
      const body = Object.entries(block).filter(([key, value]) => key !== "evidence_refs" && typeof value === "string").map(([, value]) => value as string).join(" ").trim();
      if (!body) continue;
      const refs = Array.isArray(block.evidence_refs) ? block.evidence_refs.filter((x): x is string => typeof x === "string") : [];
      const hasAnalysis = refs.some((id) => analysisById.has(id));
      const hasDc = refs.some((id) => id === "DEF" || dcEvidence.has(id));
      if (!hasAnalysis || !hasDc) entries.push({
        source_id: `conclusion:${page.page_id}:${id}`, source_type: "unreferenced_conclusion",
        status: "substantive", related_direction_id: null, expected_sections: [page.page_id], actual_sections: [page.page_id],
        evidence_reference: refs.join(",") || null, coverage_result: "missing",
        missing_reason: "each_substantive_conclusion_requires_analysis_and_frozen_dc_evidence",
      });
    }
  }
  const conflictIds = new Set(input.dc.conflicts.filter((c) => c.state !== "clarified").map((c) => c.conflict_id));
  for (const page of input.pages) {
    const structured = page.structured as Record<string, unknown> | null;
    const nodes: Array<{ id: string; data: Record<string, unknown> }> = [];
    if (Array.isArray(structured?.blocks)) (structured!.blocks as Array<Record<string, unknown>>).forEach((data, index) => nodes.push({ id: String(data.segment_id ?? index), data }));
    if (Array.isArray(structured?.paths)) (structured!.paths as Array<Record<string, unknown>>).forEach((data, index) => nodes.push({ id: String(data.path_id ?? `path-${index}`), data }));
    if (structured?.experiment && typeof structured.experiment === "object") nodes.push({ id: "experiment", data: structured.experiment as Record<string, unknown> });
    if (structured?.review && typeof structured.review === "object") nodes.push({ id: "review", data: structured.review as Record<string, unknown> });
    for (const { id, data: block } of nodes) {
      const refs = Array.isArray(block.evidence_refs) ? block.evidence_refs.filter((x): x is string => typeof x === "string") : [];
      if (!refs.some((ref) => conflictIds.has(ref))) continue;
      const text = Object.entries(block).filter(([key, value]) => key !== "evidence_refs" && typeof value === "string").map(([, value]) => value as string).join(" ");
      const resolvedClaim = /(?:已(?:经)?(?:明确)?(?:解决|澄清|消除)|被(?:明确)?(?:解决|澄清|消除)|\b(?:resolved|settled)\b)/i.test(text) &&
        !/(尚未|未|没有|not\s+(?:yet\s+)?|unresolved)\s+(?:clearly\s+)?(?:resolved|settled|解决|澄清|消除)/i.test(text);
      if (resolvedClaim) entries.push({
        source_id: `conclusion:${page.page_id}:${id}`, source_type: "open_conflict_claim",
        status: "conflict_open", related_direction_id: null, expected_sections: [page.page_id], actual_sections: [page.page_id],
        evidence_reference: refs.filter((ref) => conflictIds.has(ref)).join(","),
        coverage_result: "missing", missing_reason: "open_conflict_described_as_resolved",
      });
    }
  }
  for (const item of input.artifact.personal_pattern_analysis) {
    const hasChartAnchor = item.evidence_refs.some((id) => {
      const ref = evidenceById.get(id);
      return ref && (ref.kind === "chart_line" || ref.kind === "ziwei_line");
    });
    const validRefs = item.evidence_refs.every((id) => evidenceById.has(id));
    if (!hasChartAnchor || !validRefs) entries.push({
      source_id: item.item_id, source_type: "personal_pattern_analysis", status: item.basis_class,
      related_direction_id: null, expected_sections: ["01", "02", "04"], actual_sections: [],
      evidence_reference: item.evidence_refs.join(",") || null, coverage_result: "missing",
      missing_reason: !hasChartAnchor ? "pattern_judgment_missing_chart_anchor" : "analysis_item_has_invalid_evidence_reference",
    });
  }

  const sourceRows: Array<{ id: string; type: string; status: string; direction: string | null; expected: string[]; naReason: string | null }> = [
    { id: "DEF", type: "decision_definition", status: "frozen", direction: null, expected: ["01", "02", "05"], naReason: null },
    ...input.dc.reality_facts.filter((f) => f.status === "confirmed" && f.user_confirmed).map((f) => ({ id: f.fact_id, type: "reality_fact", status: f.status, direction: null, expected: ["01", "02", "04", "05", "06", "08"], naReason: null })),
    ...input.dc.constraints.filter((c) => c.rigidity === "hard" || c.user_confirmed).map((c) => ({ id: c.constraint_id, type: "constraint", status: c.status, direction: null, expected: ["02", "05", "06", "08"], naReason: null })),
    ...input.dc.hypotheses.filter((h) => h.state !== "rejected" && h.related_dir_ids.some((id) => input.dc.dirs.some((d) => d.dir_id === id && d.may_affect_p5_ranking))).map((h) => ({ id: h.hypothesis_id, type: "hypothesis", status: h.state, direction: h.related_dir_ids[0] ?? null, expected: ["04", "05", "06"], naReason: null })),
    ...input.dc.dirs.filter((d) => d.id_lifecycle === "active" && (d.required_fact_roles.length > 0 || d.may_affect_p5_ranking)).map((d) => {
      const na = input.dc.explicit_na_classifications?.find((e) => e.dir_id === d.dir_id && !e.revoked);
      return { id: d.dir_id, type: "dir", status: d.current_state, direction: d.dir_id, expected: ["04", "05", "06", "08"], naReason: d.current_state === "n_a" && na ? na.na_condition_code : null };
    }),
    ...input.dc.conflicts.filter((c) => c.state !== "clarified").map((c) => ({ id: c.conflict_id, type: "conflict", status: c.state, direction: null, expected: ["04", "05", "08"], naReason: null })),
  ];
  const citeSections = new Map<string, Set<string>>();
  for (const [page, refs] of referencesByPage) {
    for (const id of refs) {
      citeSections.get(id)?.add(page) ?? citeSections.set(id, new Set([page]));
      const item = analysisById.get(id);
      for (const source of item?.evidence_refs ?? []) citeSections.get(source)?.add(page) ?? citeSections.set(source, new Set([page]));
    }
  }
  for (const row of sourceRows) {
    const actual = [...(citeSections.get(row.id) ?? [])];
    const covered = actual.length > 0 && actual.some((page) => row.expected.includes(page));
    const isNa = row.type === "dir" && row.status === "n_a";
    const n_a = row.type === "dir" && row.status === "n_a" && Boolean(row.naReason) &&
      actual.some((page) => row.expected.includes(page)) &&
      input.pages.some((p) => actual.includes(p.page_id) && p.content_markdown.includes(row.naReason!));
    entries.push({
      source_id: row.id, source_type: row.type, status: row.status, related_direction_id: row.direction,
      expected_sections: row.expected, actual_sections: actual, evidence_reference: actual.length ? row.id : null,
      coverage_result: n_a ? "not_applicable" : isNa ? "missing" : covered ? "covered" : "missing",
      missing_reason: n_a ? null : isNa ? "not_applicable_source_missing_explicit_report_reason" : covered ? null : "material_frozen_source_not_cited_by_report_or_linked_analysis",
      applicability_reason: n_a ? row.naReason : null,
    });
  }
  for (const direction of (input.blueprint?.directions ?? []).filter((d) => d.priority === "P0" || d.priority === "P1")) {
    const actual = [...new Set(direction.dir_ids.flatMap((id) => [...(citeSections.get(id) ?? [])]))];
    const expected = ["01", "02", "04", "05", "06", "08"];
    const covered = actual.some((section) => expected.includes(section));
    entries.push({
      source_id: direction.direction_id, source_type: "blueprint_direction", status: direction.priority,
      related_direction_id: direction.direction_id, expected_sections: expected, actual_sections: actual,
      evidence_reference: direction.dir_ids.join(",") || null, coverage_result: covered ? "covered" : "missing",
      missing_reason: covered ? null : "important_blueprint_direction_not_addressed",
    });
  }
  const missing = entries.filter((e) => e.coverage_result === "missing");
  return { ok: missing.length === 0, matrix: entries, reason: missing.length ? `coverage_missing:${missing.map((e) => e.source_id).join(",")}` : null };
}

// ─── Prompt ────────────────────────────────────────────────────────────────

function bullet(ref: string, text: string, tail?: string): string {
  return `- [${ref}] ${text.replace(/\s+/g, " ").trim()}${tail ? ` （${tail}）` : ""}`;
}

/** Readable page-scoped DC feed (dc-page-feed projection, not a JSON dump). */
export function formatPageDcFeed(dc: DecisionContext, pageId: DecisionPageId): string {
  const feed = buildDecisionContextPageFeed(dc, pageId);
  const idx = buildDcEvidenceIndex(dc);
  const out: string[] = [
    `【冻结决策上下文 · ${feed.binding.context_id}@v${feed.binding.context_version}（只读）】`,
    `决策问题：${feed.definition.decision_question ?? "—"}；想要的结果：${feed.definition.desired_outcome ?? "—"}；不可接受：${feed.definition.unacceptable_outcomes.join("；") || "—"}`,
  ];
  const confirmed = feed.confirmed_facts.filter((f) => idx.get(f.fact_id)?.status === "confirmed_fact");
  const nonConfirmed = [
    ...feed.confirmed_facts.filter((f) => idx.get(f.fact_id)?.status !== "confirmed_fact"),
    ...feed.unverified_or_estimate_facts,
  ];
  const seen = new Set<string>();
  out.push("已确认事实：");
  out.push(...(confirmed.length ? confirmed.map((f) => bullet(f.fact_id, f.statement)) : ["- （无）"]));
  out.push("未确认 / 估计 / 未知（不得当作事实）：");
  const rest = nonConfirmed.filter((f) => {
    if (seen.has(f.fact_id)) return false;
    seen.add(f.fact_id);
    return true;
  });
  out.push(
    ...(rest.length
      ? rest.map((f) => bullet(f.fact_id, f.statement, idx.get(f.fact_id)?.status))
      : ["- （无）"]),
  );
  out.push("约束：");
  out.push(
    ...(feed.constraints.length
      ? feed.constraints.map((c) =>
          bullet(c.constraint_id, c.statement, `${c.rigidity} · ${c.category} · ${idx.get(c.constraint_id)?.status}`),
        )
      : ["- （无）"]),
  );
  const hyps = feed.hypotheses.filter((h) => h.state !== "rejected");
  out.push("待验证假设（不是事实）：");
  out.push(
    ...(hyps.length
      ? hyps.map((h) => bullet(h.hypothesis_id, h.statement, `${h.state}${h.validation_need ? ` · ${h.validation_need}` : ""}`))
      : ["- （无）"]),
  );
  out.push("调查方向状态：");
  out.push(
    ...(feed.dirs.length
      ? feed.dirs.map((d) =>
          bullet(d.dir_id, d.need, `${d.current_state}${d.may_affect_p5_ranking ? " · 可能改变路径排序" : ""}`),
        )
      : ["- （无）"]),
  );
  out.push("矛盾：");
  out.push(
    ...(feed.conflicts.length
      ? feed.conflicts.map((c) =>
          bullet(
            c.conflict_id,
            `${c.conflict_field}: ${c.statements_snapshot.join(" ↔ ")}`,
            `${c.state}${c.affects_preferred_path === false ? "" : " · 可能影响首选路径"}`,
          ),
        )
      : ["- （无）"]),
  );
  const boundaries = dc.information_boundaries ?? [];
  out.push("信息边界：");
  out.push(...(boundaries.length ? boundaries.map((b, i) => bullet(`IB-${i + 1}`, b)) : ["- （无）"]));
  out.push("本页规则：");
  out.push(...feed.stage4_rules.map((r) => `- ${r}`));
  return out.join("\n");
}

function formatAnalysisForPage(artifact: PersonalAnalysisArtifact): string {
  const out: string[] = ["【个人分析（已校验 · 只读）】"];
  for (const key of PERSONAL_ANALYSIS_SECTIONS) {
    const items = artifact[key];
    if (!items.length) continue;
    out.push(`${key}:`);
    for (const it of items) {
      out.push(
        `- [${it.item_id}] (${it.basis_class}) ${it.text} ｜依据：${it.traditional_basis || "—"} ｜引用：${it.evidence_refs.join(",")}`,
      );
    }
  }
  out.push(
    `置信度：${artifact.confidence_and_limits.overall_confidence}；局限：${artifact.confidence_and_limits.limits.join("；")}`,
  );
  return out.join("\n");
}

function formatChartLines(projection: ProfileProjection): string {
  const out = ["【本地排盘（代码真算 · 只读 · 只可引用）】"];
  out.push(...projection.chart_lines.map((l) => bullet(l.ref_id, l.text)));
  out.push(...projection.ziwei_lines.map((l) => bullet(l.ref_id, l.text)));
  return out.join("\n");
}

function formatUpstream(upstream: ReadonlyMap<DecisionPageId, Di2PageStructured>): string {
  if (!upstream.size) return "";
  const out = ["【已完成的上游页（本页须与之一致）】"];
  for (const [id, page] of upstream) {
    out.push(`页 ${id} · ${page.title}`);
    for (const b of page.blocks) out.push(`- ${b.segment_id} ${b.heading}：${b.body}`);
    for (const p of page.paths ?? []) {
      out.push(`- 路径 ${p.rank}. ${p.label}｜条件：${p.conditions}｜退出：${p.exit_condition}`);
    }
    if (page.experiment) {
      out.push(`- 验证实验：${page.experiment.hypothesis}｜动作：${page.experiment.action}｜观察：${page.experiment.observe}｜成功：${page.experiment.success}`);
    }
  }
  return out.join("\n");
}

function pageSpecificContract(pageId: DecisionPageId, requiredOpen: string[]): string[] {
  if (pageId === "05") {
    return [
      "本页额外输出 paths（2–4 条，按 rank 1..n 排序）：",
      'paths: [{ "path_id": "P1", "rank": 1, "label": "...", "conditions": "成立条件（含仍未知的前提）", "cost": "...", "risk": "...", "reversibility": "...", "exit_condition": "何时退出/换轨", "ranking_basis": "为什么排在这里（依据层）", "evidence_refs": ["..."] }]',
      "- 首选必须是条件式推荐；缺资料不等于不可行，写成『取决于……』。",
      "- 每条路径至少引用一个决策上下文编号；可以有组合/分阶段/可逆小试路径，前提是上下文支持。",
      requiredOpen.length
        ? `- 这些未解决编号可能改变排序，本页 blocks 或 paths 中必须引用到：${requiredOpen.join("、")}。`
        : "",
    ].filter(Boolean);
  }
  if (pageId === "06") {
    return [
      "本页额外输出 experiment（只一个可验证、低成本、可逆的验证实验）：",
      'experiment: { "hypothesis": "要验证的判断", "action": "做什么", "observe": "观察什么信号", "window": "时间窗", "success": "怎样算成立", "if_fail": "不成立时怎么办", "defer_costs": "验证完成前先不投入的成本", "evidence_refs": ["..."] }',
      "- 这是验证实验，不是按周排的任务清单，也不是 30 天计划。",
      "- 实验要对齐 05 页首选路径的关键未知。",
    ];
  }
  if (pageId === "08") {
    return [
      "本页额外输出 review：",
      'review: { "core_metrics": ["与 06 页共享的核心观察指标"], "continue_when": "...", "adjust_when": "...", "stop_when": "...", "rerun_when": "什么变化出现时重跑本题", "evidence_refs": ["..."] }',
      "- 四种判断都要有触发条件，且建立在 06 页的观察信号上；不许新增上下文里没有的数字阈值。",
    ];
  }
  return [];
}

function languageInstruction(locale: string): string {
  const l = (locale || "zh").toLowerCase();
  if (l.startsWith("zh")) return "所有可见文字用简体中文。";
  if (l.startsWith("es")) return "Write all visible text in Spanish.";
  if (l.startsWith("fr")) return "Write all visible text in French.";
  return "Write all visible text in English.";
}

export function buildDecisionReportPagePrompt(input: {
  pageId: DecisionPageId;
  dc: DecisionContext;
  projection: ProfileProjection;
  artifact: PersonalAnalysisArtifact;
  upstream: ReadonlyMap<DecisionPageId, Di2PageStructured>;
  locale: string;
}): { system: string; user: string } {
  const schema = DECISION_PAGE_SCHEMAS[input.pageId];
  const contract = buildUserFacingExpressionContractBlock({ locale: input.locale, preset: "delivery" });
  const requiredOpen = input.pageId === "05" ? requiredUnresolvedRefs(input.dc) : [];
  const system = [
    "你是 POJU 决策报告的执笔人，正在写八页报告中的一页。",
    "",
    "## 本页职责",
    `页 ${schema.pageId} · ${schema.title} —— 回答用户的问题：「${schema.question}」`,
    `双轨挂法：${schema.dualTrackNote}`,
    "段落（每段一个 block，segment_id 用下面的字母，全部都要写）：",
    ...schema.segments.map((s) => `- ${s.id} · ${s.label}：${s.duty}`),
    "（段落职责里提到的『批断包 / claim / pack unit』在本流程中指个人分析条目 PA-*；CFP/ZFP 指本地排盘行。）",
    "",
    "## 事实纪律（硬）",
    "- 唯一事实来源是冻结决策上下文；个人分析是对它的解读，不是新事实。",
    "- 已确认事实才能当事实写；未核实、估计、假设、未知必须在正文里带出不确定性，不得升级。",
    "- 不得替用户补全未知，不得发明数字、概率、阈值、时间点。",
    "- 排盘行只能引用，不得自行推算。传统命理是依据的主干，现代科学只作辅助解释。",
    "- 不得提出修改决策上下文。",
    "",
    "## 两层文字",
    "- body / heading：用户可见白话，零命理专名（十神、干支、用喜忌、运岁报幕、合冲刑害、神煞宫星原名、命盘报幕都不许出现）。",
    "- basis：依据层，写清为什么对这个人成立，可用命理真词。",
    contract,
    "",
    "## 引用",
    "- 每个 block 的 evidence_refs 至少一个，只能用输入方括号里的编号（上下文 id、IB-n、CFP-nn、ZFP-nn、PA-*）。编造编号 = 整页作废。",
    "",
    "## 输出",
    "只输出一个 JSON 对象，不要 markdown 围栏：",
    '{ "title": "本页标题（白话）", "blocks": [{ "segment_id": "A", "heading": "段标题", "body": "正文", "basis": "依据层", "evidence_refs": ["..."] }] }',
    ...pageSpecificContract(input.pageId, requiredOpen),
    "",
    "## 交稿前自检",
    "- 删掉冻结上下文与排盘引用后，这页是否还成立？还成立 = 写成了谁都适用的话，重写。",
    "- 正文里有没有 JSON、字段名、编号堆砌或命理专名？有就改写。",
    languageInstruction(input.locale),
  ].join("\n");

  const user = [
    formatPageDcFeed(input.dc, input.pageId),
    "",
    formatAnalysisForPage(input.artifact),
    "",
    formatChartLines(input.projection),
    formatUpstream(input.upstream) ? `\n${formatUpstream(input.upstream)}` : "",
  ].join("\n");
  return { system, user };
}

// ─── Validation (A: judge only) ────────────────────────────────────────────

function s(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function refsOf(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return [...new Set(x.map((r) => s(r)).filter(Boolean))];
}

const RAW_STRUCTURE_RE = /```|^\s*[{[]|"\w+"\s*:/m;
const SCHEDULE_MARK_RE = /第\s*[一二三四五六七八九十\d]+\s*(?:周|天|日)|\bweek\s*\d+|\bday\s*\d+/gi;

export type PageValidation =
  | { ok: true; page: Di2PageStructured }
  | { ok: false; reason: string };

export function validateDecisionReportPage(input: {
  raw: string;
  pageId: DecisionPageId;
  idx: ReadonlyMap<string, EvidenceReference>;
  dc: DecisionContext;
  locale: string;
}): PageValidation {
  const parsed = tryParseJsonObject(input.raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  if (!parsed) return { ok: false, reason: "parse_failed" };
  const zh = (input.locale || "").toLowerCase().startsWith("zh");
  const schema = DECISION_PAGE_SCHEMAS[input.pageId];
  const allRefs = new Set<string>();

  const checkRefs = (refs: string[], where: string): string | null => {
    if (!refs.length) return `no_refs:${where}`;
    const unknown = refs.find((r) => !input.idx.has(r));
    if (unknown) return `unknown_ref:${where}:${unknown}`;
    for (const r of refs) allRefs.add(r);
    return null;
  };
  const checkVisible = (text: string, where: string, min = 4): string | null => {
    if (text.length < min) return `thin:${where}`;
    if (RAW_STRUCTURE_RE.test(text)) return `raw_structure:${where}`;
    if (zh) {
      const bare = bareMingliWordInPlain(text);
      if (bare) return `bare_term:${where}:${bare}`;
    }
    return null;
  };

  /** Polish evidence-layer text; fail-closed on unresolved traditional vocabulary. */
  const polishBasis = (text: string, where: string): { ok: true; text: string } | { ok: false; reason: string } => {
    const polished = encodeAndPolishDeliveryEvidence(text, input.locale);
    const unresolved = listUnresolvedWordSlots(polished);
    if (unresolved.length) {
      return { ok: false, reason: `unresolved_term_slot:${where}:${unresolved[0]}` };
    }
    if (zh) {
      const bare = bareMingliWordInPlain(maskMarkersForAudit(polished));
      if (bare) return { ok: false, reason: `bare_term:${where}:${bare}` };
    }
    return { ok: true, text: polished };
  };

  const title = s(parsed.title);
  const titleErr = checkVisible(title, "title", 2);
  if (titleErr) return { ok: false, reason: titleErr };

  const blocksRaw = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  const blocks: Di2PageBlock[] = [];
  for (let i = 0; i < blocksRaw.length; i++) {
    const o = blocksRaw[i] as Record<string, unknown> | null;
    if (!o || typeof o !== "object") return { ok: false, reason: `bad_block:${i}` };
    const where = `block[${i}:${String(o.segment_id ?? i).toUpperCase()}]`;
    const basisPolished = polishBasis(s(o.basis), `${where}.basis`);
    if (!basisPolished.ok) return { ok: false, reason: basisPolished.reason };
    const block: Di2PageBlock = {
      segment_id: s(o.segment_id).toUpperCase(),
      heading: s(o.heading),
      body: s(o.body),
      basis: basisPolished.text,
      evidence_refs: refsOf(o.evidence_refs),
    };
    const e =
      checkVisible(block.body, `${where}.body`, 10) ??
      (block.heading ? checkVisible(block.heading, `${where}.heading`, 1) : null) ??
      checkRefs(block.evidence_refs, where);
    if (e) return { ok: false, reason: e };
    blocks.push(block);
  }
  const ids = new Set(blocks.map((b) => b.segment_id));
  const missing = schema.segments.map((x) => x.id).filter((id) => !ids.has(id));
  if (missing.length) return { ok: false, reason: `missing_segments:${missing.join(",")}` };

  const page: Di2PageStructured = { page_id: input.pageId, title, blocks };

  if (input.pageId === "05") {
    const raw = Array.isArray(parsed.paths) ? parsed.paths : [];
    if (raw.length < 2 || raw.length > 4) return { ok: false, reason: `path_count:${raw.length}` };
    const paths: Di2PathOption[] = [];
    for (let i = 0; i < raw.length; i++) {
      const o = (raw[i] ?? {}) as Record<string, unknown>;
      const p: Di2PathOption = {
        path_id: s(o.path_id) || `P${i + 1}`,
        rank: typeof o.rank === "number" ? o.rank : Number(o.rank),
        label: s(o.label),
        conditions: s(o.conditions),
        cost: s(o.cost),
        risk: s(o.risk),
        reversibility: s(o.reversibility),
        exit_condition: s(o.exit_condition),
        ranking_basis: s(o.ranking_basis),
        evidence_refs: refsOf(o.evidence_refs),
      };
      const where = `path[${i}]`;
      for (const f of ["label", "conditions", "cost", "risk", "reversibility", "exit_condition"] as const) {
        const e = checkVisible(p[f], `${where}.${f}`, 2);
        if (e) return { ok: false, reason: e };
      }
      if (p.ranking_basis.length < 4) return { ok: false, reason: `thin:${where}.ranking_basis` };
      const rb = polishBasis(p.ranking_basis, `${where}.ranking_basis`);
      if (!rb.ok) return { ok: false, reason: rb.reason };
      p.ranking_basis = rb.text;
      const e = checkRefs(p.evidence_refs, where);
      if (e) return { ok: false, reason: e };
      const grounded = p.evidence_refs.some((r) => {
        const k = input.idx.get(r)?.kind;
        return k !== "chart_line" && k !== "ziwei_line" && k !== "analysis_item";
      });
      if (!grounded) return { ok: false, reason: `path_not_grounded:${where}` };
      paths.push(p);
    }
    const ranks = paths.map((p) => p.rank).sort((a, b) => a - b);
    if (!ranks.every((r, i) => r === i + 1)) return { ok: false, reason: "path_ranks_not_sequential" };
    page.paths = paths;
    const open = requiredUnresolvedRefs(input.dc).filter((r) => !allRefs.has(r));
    if (open.length) return { ok: false, reason: `p5_unknowns_not_cited:${open.join(",")}` };
  }

  if (input.pageId === "06") {
    const o = (parsed.experiment ?? null) as Record<string, unknown> | null;
    if (!o || typeof o !== "object") return { ok: false, reason: "missing_experiment" };
    const x: Di2Experiment = {
      hypothesis: s(o.hypothesis),
      action: s(o.action),
      observe: s(o.observe),
      window: s(o.window),
      success: s(o.success),
      if_fail: s(o.if_fail),
      defer_costs: s(o.defer_costs),
      evidence_refs: refsOf(o.evidence_refs),
    };
    for (const f of ["hypothesis", "action", "observe", "window", "success", "if_fail", "defer_costs"] as const) {
      const e = checkVisible(x[f], `experiment.${f}`, 2);
      if (e) return { ok: false, reason: e };
    }
    const e = checkRefs(x.evidence_refs, "experiment");
    if (e) return { ok: false, reason: e };
    const scheduleText = [x.action, x.window, ...blocks.map((b) => b.body)].join("\n");
    const marks = new Set((scheduleText.match(SCHEDULE_MARK_RE) ?? []).map((m) => m.replace(/\s+/g, "")));
    if (marks.size >= 3) return { ok: false, reason: "checklist_schedule" };
    page.experiment = x;
  }

  if (input.pageId === "08") {
    const o = (parsed.review ?? null) as Record<string, unknown> | null;
    if (!o || typeof o !== "object") return { ok: false, reason: "missing_review" };
    const r: Di2Review = {
      core_metrics: Array.isArray(o.core_metrics) ? o.core_metrics.map((m) => s(m)).filter(Boolean) : [],
      continue_when: s(o.continue_when),
      adjust_when: s(o.adjust_when),
      stop_when: s(o.stop_when),
      rerun_when: s(o.rerun_when),
      evidence_refs: refsOf(o.evidence_refs),
    };
    if (!r.core_metrics.length) return { ok: false, reason: "review_no_core_metrics" };
    for (const [i, m] of r.core_metrics.entries()) {
      const e = checkVisible(m, `review.core_metrics[${i}]`, 2);
      if (e) return { ok: false, reason: e };
    }
    for (const f of ["continue_when", "adjust_when", "stop_when", "rerun_when"] as const) {
      const e = checkVisible(r[f], `review.${f}`, 2);
      if (e) return { ok: false, reason: e };
    }
    const e = checkRefs(r.evidence_refs, "review");
    if (e) return { ok: false, reason: e };
    page.review = r;
  }

  return { ok: true, page };
}

// ─── Deterministic pages ───────────────────────────────────────────────────

/**
 * Collect term_ids from the final rendered evidence layer of applicable pages,
 * in DI2 reading order (first appearance wins). No model call.
 */
export function collectDi2EvidenceTermIds(input: {
  pages: ReadonlyArray<Di2PageStructured>;
  refIndex: ReadonlyMap<string, EvidenceReference>;
  locale: string;
}): string[] {
  const byId = new Map(input.pages.map((p) => [p.page_id, p]));
  const lists: string[][] = [];
  for (const id of DI2_READING_ORDER) {
    if (id === "03") continue;
    const page = byId.get(id);
    if (!page) continue;
    const layerTexts: string[] = [];
    const scanRefs = (refs: string[]) => {
      for (const ref of refs) {
        const row = input.refIndex.get(ref);
        if (row?.excerpt) assertEvidenceTermMarkersResolvable(row.excerpt, input.locale);
      }
    };
    for (const block of page.blocks) {
      assertEvidenceTermMarkersResolvable(block.basis, input.locale);
      scanRefs(block.evidence_refs);
      layerTexts.push(di2EvidenceLayerText(block.basis, block.evidence_refs, input.refIndex, input.locale));
    }
    for (const path of page.paths ?? []) {
      assertEvidenceTermMarkersResolvable(path.ranking_basis, input.locale);
      scanRefs(path.evidence_refs);
      layerTexts.push(di2EvidenceLayerText(path.ranking_basis, path.evidence_refs, input.refIndex, input.locale));
    }
    if (page.experiment) {
      scanRefs(page.experiment.evidence_refs);
      layerTexts.push(di2EvidenceLayerText("", page.experiment.evidence_refs, input.refIndex, input.locale));
    }
    if (page.review) {
      scanRefs(page.review.evidence_refs);
      layerTexts.push(di2EvidenceLayerText("", page.review.evidence_refs, input.refIndex, input.locale));
    }
    const ids: string[] = [];
    for (const text of layerTexts) {
      for (const m of parseTermMarkers(text)) {
        if (m.id) ids.push(m.id);
      }
    }
    lists.push(ids);
  }
  return collectUsedTermIdsFromEvidence(lists);
}

export type BuildAppendixPageResult =
  | { applicability: "applies"; page: Di2PageStructured }
  | { applicability: "not_applicable"; page: null };

/**
 * 03: code-built glossary appendix from term markers in the final evidence layer.
 * Returns not_applicable (omit from reading order) when no terms were used.
 * Throws on invalid / non-SSOT term_ids (fail-closed).
 */
export function buildAppendixPage(input: {
  pages: ReadonlyArray<Di2PageStructured>;
  refIndex: ReadonlyMap<string, EvidenceReference>;
  locale: string;
}): BuildAppendixPageResult {
  const usedTermIds = collectDi2EvidenceTermIds(input);
  const glossary = buildGlossaryAppendix({ locale: input.locale, usedTermIds });
  if (!glossary) {
    return { applicability: "not_applicable", page: null };
  }
  return {
    applicability: "applies",
    page: {
      page_id: "03",
      title: glossary.page_title || DECISION_PAGE_SCHEMAS["03"].title,
      blocks: [],
      appendix: {
        kind: "glossary_appendix",
        reading_note: glossary.reading_note,
        term_ids: [...glossary.term_ids],
      },
    },
  };
}

export function renderPageMarkdown(
  page: Di2PageStructured,
  idx: ReadonlyMap<string, EvidenceReference>,
  locale: string,
): string {
  return renderDi2PageBody(page, idx, locale);
}

// ─── Model call ────────────────────────────────────────────────────────────

export type PageModelOutcome =
  | { ok: true; page: Di2PageStructured; model: string; tokens_used: number }
  | { ok: false; reason: string; transport: boolean; model: string; tokens_used: number };

type RawPageModelFn = (input: {
  pageId: DecisionPageId;
  system: string;
  user: string;
}) => Promise<{ content: string; model: string; tokens_used: number; finish_reason?: string | null }>;

/**
 * Test hook: replaces only the network call. Output is still validated by the
 * production validator. Never set in production code paths.
 */
let __testPageModel: RawPageModelFn | null = null;
export function __setDecisionReportPageModelForTests(fn: RawPageModelFn | null): void {
  __testPageModel = fn;
}

export async function runDecisionReportPageModel(input: {
  pageId: DecisionPageId;
  dc: DecisionContext;
  projection: ProfileProjection;
  artifact: PersonalAnalysisArtifact;
  upstream: ReadonlyMap<DecisionPageId, Di2PageStructured>;
  locale: string;
  session_id: string;
  signal?: AbortSignal;
  timeout_ms?: number;
}): Promise<PageModelOutcome> {
  const prompt = buildDecisionReportPagePrompt(input);
  let content = "";
  let model = "";
  let tokens_used = 0;
  let finish: string | null | undefined;
  try {
    if (__testPageModel) {
      const out = await __testPageModel({ pageId: input.pageId, ...prompt });
      content = out.content;
      model = out.model;
      tokens_used = out.tokens_used;
      finish = out.finish_reason;
    } else {
      const { callLLM } = await import("@/lib/llm/router");
      const res = await callLLM({
        call_type: "main_delivery",
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
        max_tokens: DELIVERY_LLM_MAX_TOKENS,
        thinking_effort: "high",
        response_format: "json",
        temperature: 0.45,
        timeout_ms: input.timeout_ms ?? 230_000,
        max_attempts: 1,
        session_id: input.session_id,
        phase_name: `di2_report_page_${input.pageId}`,
        signal: input.signal,
      });
      content = res.content ?? "";
      model = res.actual_model;
      tokens_used = res.meta.tokens_used;
      finish = res.meta.finish_reason;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `transport:${msg}`.slice(0, 300), transport: true, model, tokens_used };
  }
  if (!content.trim()) return { ok: false, reason: "empty_response", transport: true, model, tokens_used };
  if (finish === "length") return { ok: false, reason: "truncated", transport: false, model, tokens_used };
  const idx = buildReportEvidenceIndex(input);
  const v = validateDecisionReportPage({
    raw: content,
    pageId: input.pageId,
    idx,
    dc: input.dc,
    locale: input.locale,
  });
  if (!v.ok) return { ok: false, reason: v.reason, transport: false, model, tokens_used };
  return { ok: true, page: v.page, model, tokens_used };
}
