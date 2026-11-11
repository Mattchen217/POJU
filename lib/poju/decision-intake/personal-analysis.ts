/**
 * M3 — Personal Analysis for Decision Intake 2.0.
 *
 * Inputs (all read-only):
 *  - frozen DecisionContext snapshot (server Freeze registry) — sole fact source;
 *  - Decision Blueprint registered with that Freeze (directions / priorities);
 *  - personal profile: structured base analysis → local chart calculation lines
 *    (+ Ziwei closed-set soft labels when birth data exists).
 *
 * The model interprets; code computes every status. Items carry an epistemic
 * class and must cite real refs; nothing here mutates or confirms DC content.
 */

import { sha256 } from "@noble/hashes/sha2.js";

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildChartFactPack } from "@/lib/llm/pro/delivery/page-schema/chart-fact-pack";
import { DELIVERY_LLM_MAX_TOKENS } from "@/lib/llm/pro/delivery/delivery-tasks";
import { buildUserFacingExpressionContractBlock } from "@/lib/llm/prompts/user-facing-expression-contract";
import { bareMingliWordInPlain } from "@/lib/llm/sanitize/term-marking";
import { canonicalStringify } from "@/lib/poju/decision-context/normalize";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import { tryParseJsonObject } from "@/lib/poju/shared/json-tools";
import {
  EPISTEMIC_CLASSES,
  PERSONAL_ANALYSIS_SECTIONS,
  type EpistemicClass,
  type EvidenceReference,
  type PersonalAnalysisArtifact,
  type PersonalAnalysisItem,
  type PersonalAnalysisSectionKey,
} from "./decision-report-types";
import type { DecisionBlueprint } from "./types";

// ─── Profile projection ─────────────────────────────────────────────────────

export type ProfileLine = { ref_id: string; text: string };

/** What the server keeps for one registered personal profile (no raw birth data). */
export type RegisteredProfile = {
  profile_id: string | null;
  profile_hash: string;
  structured: ProfileStructured;
  ziwei_closed_set: string | null;
  registered_at: string;
  /** Formal calculation chain version the server recomputed with. */
  calculation_schema_version: string;
  /** Calculation instant (= the Freeze's frozen_at); time-relative lines use it. */
  calculation_timestamp: string;
};

export type ProfileProjection = {
  profile_id: string | null;
  profile_hash: string;
  chart_lines: ProfileLine[];
  ziwei_lines: ProfileLine[];
  calculated_at: string;
};

const textEncoder = new TextEncoder();

function hexOf(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Stable hash over the formal profile calculation result, schema and calculation instant. */
export function computeProfileHash(input: {
  structured: ProfileStructured;
  ziwei_closed_set: string | null;
  calculation_schema_version: string;
  calculation_timestamp: string;
}): string {
  const canonical = canonicalStringify({
    structured: JSON.parse(JSON.stringify(input.structured)) as unknown,
    ziwei_closed_set: input.ziwei_closed_set ?? null,
    calculation_schema_version: input.calculation_schema_version,
    calculation_timestamp: input.calculation_timestamp,
  });
  return hexOf(sha256(textEncoder.encode(canonical)));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function ziweiLinesFromClosedSet(block: string | null): ProfileLine[] {
  if (!block?.trim()) return [];
  const rows = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("【") && !l.startsWith("（"));
  return rows.map((text, i) => ({ ref_id: `ZFP-${pad2(i + 1)}`, text }));
}

/** Deterministic local calculation → numbered citeable lines. */
export function buildProfileProjection(
  profile: RegisteredProfile,
  opts?: { as_of?: Date },
): ProfileProjection {
  const asOf = opts?.as_of ?? new Date(profile.calculation_timestamp);
  const pack = buildChartFactPack(profile.structured, { as_of: asOf });
  const seen = new Set<string>();
  const chart_lines: ProfileLine[] = [];
  for (const raw of pack.text.split("\n")) {
    const text = raw.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    chart_lines.push({ ref_id: `CFP-${pad2(chart_lines.length + 1)}`, text });
  }
  return {
    profile_id: profile.profile_id,
    profile_hash: profile.profile_hash,
    chart_lines,
    ziwei_lines: ziweiLinesFromClosedSet(profile.ziwei_closed_set),
    calculated_at: asOf.toISOString(),
  };
}

// ─── Evidence index (deterministic statuses) ───────────────────────────────

export function factEvidenceStatus(
  f: DecisionContext["reality_facts"][number],
): EvidenceReference["status"] {
  if (f.status === "confirmed" && f.user_confirmed) return "confirmed_fact";
  if (f.verification_level === "user_estimate") return "user_estimate";
  if (f.status === "confirmed" || f.status === "unverified") return "user_stated_unverified";
  return "unknown_or_declined";
}

export function buildDcEvidenceIndex(dc: DecisionContext): Map<string, EvidenceReference> {
  const idx = new Map<string, EvidenceReference>();
  const d = dc.definition;
  const defText = [d.decision_question, d.concrete_event, d.desired_outcome, d.stakes]
    .filter((x): x is string => Boolean(x && x.trim()))
    .join(" / ");
  idx.set("DEF", {
    ref_id: "DEF",
    kind: "definition",
    status: "decision_definition",
    excerpt: defText || "—",
  });
  for (const f of dc.reality_facts) {
    idx.set(f.fact_id, {
      ref_id: f.fact_id,
      kind: "reality_fact",
      status: factEvidenceStatus(f),
      excerpt: f.statement,
    });
  }
  for (const c of dc.constraints) {
    idx.set(c.constraint_id, {
      ref_id: c.constraint_id,
      kind: "constraint",
      status:
        c.status === "confirmed" && c.user_confirmed
          ? "constraint_confirmed"
          : "constraint_unverified",
      excerpt: c.statement,
    });
  }
  for (const h of dc.hypotheses) {
    if (h.state === "rejected") continue;
    idx.set(h.hypothesis_id, {
      ref_id: h.hypothesis_id,
      kind: "hypothesis",
      status: "hypothesis",
      excerpt: h.statement,
    });
  }
  for (const dir of dc.dirs) {
    if (dir.id_lifecycle !== "active") continue;
    idx.set(dir.dir_id, {
      ref_id: dir.dir_id,
      kind: "dir",
      status:
        dir.current_state === "known"
          ? "dir_known"
          : dir.current_state === "conflict"
            ? "dir_conflict"
            : dir.current_state === "n_a"
              ? "dir_not_applicable"
              : "dir_unknown",
      excerpt: dir.need,
    });
  }
  for (const c of dc.conflicts) {
    idx.set(c.conflict_id, {
      ref_id: c.conflict_id,
      kind: "conflict",
      status: c.state === "clarified" ? "conflict_clarified" : "conflict_open",
      excerpt: `${c.conflict_field}: ${c.statements_snapshot.join(" ↔ ")}`,
    });
  }
  (dc.information_boundaries ?? []).forEach((b, i) => {
    const ref_id = `IB-${i + 1}`;
    idx.set(ref_id, { ref_id, kind: "information_boundary", status: "boundary", excerpt: b });
  });
  return idx;
}

export function addProfileEvidence(
  idx: Map<string, EvidenceReference>,
  projection: ProfileProjection,
): Map<string, EvidenceReference> {
  for (const l of projection.chart_lines) {
    idx.set(l.ref_id, { ref_id: l.ref_id, kind: "chart_line", status: "local_calculation", excerpt: l.text });
  }
  for (const l of projection.ziwei_lines) {
    idx.set(l.ref_id, { ref_id: l.ref_id, kind: "ziwei_line", status: "local_calculation", excerpt: l.text });
  }
  return idx;
}

/** Unresolved items the analysis must address (deterministic from DC). */
export function requiredUnresolvedRefs(dc: DecisionContext): string[] {
  const out: string[] = [];
  for (const c of dc.conflicts) {
    if (c.state !== "clarified") out.push(c.conflict_id);
  }
  for (const d of dc.dirs) {
    if (d.id_lifecycle !== "active") continue;
    if ((d.current_state === "unknown" || d.current_state === "conflict") && d.may_affect_p5_ranking) {
      out.push(d.dir_id);
    }
  }
  return out;
}

export function informationBoundariesFromDc(dc: DecisionContext): string[] {
  const out = [...(dc.information_boundaries ?? [])];
  for (const d of dc.dirs) {
    if (d.id_lifecycle !== "active") continue;
    if (d.current_state === "unknown" || d.current_state === "conflict") {
      out.push(`${d.need}${d.may_affect_p5_ranking ? "（可能改变路径排序）" : ""}`);
    }
  }
  for (const c of dc.conflicts) {
    if (c.state !== "clarified") {
      out.push(`${c.conflict_field}: ${c.statements_snapshot.join(" ↔ ")}`);
    }
  }
  return out;
}

// ─── Prompt ────────────────────────────────────────────────────────────────

function line(ref: string, text: string, tail?: string): string {
  return `- [${ref}] ${text.replace(/\s+/g, " ").trim()}${tail ? ` （${tail}）` : ""}`;
}

/** Readable, id-tagged projection of the frozen DC + profile. Model input only. */
export function formatAnalysisInputBlock(input: {
  dc: DecisionContext;
  blueprint: DecisionBlueprint | null;
  projection: ProfileProjection;
}): string {
  const { dc, blueprint, projection } = input;
  const idx = buildDcEvidenceIndex(dc);
  const sections: string[] = [];
  const d = dc.definition;
  sections.push(
    [
      "【决策目标 · DEF】",
      `- 决策问题：${d.decision_question ?? blueprint?.decision_question ?? "—"}`,
      `- 具体事件：${d.concrete_event ?? "—"}`,
      `- 想要的结果：${d.desired_outcome ?? "—"}`,
      `- 利害：${d.stakes ?? "—"}`,
      `- 目标优先级：${d.goal_priorities.join("；") || "—"}`,
      `- 不可接受的结果：${d.unacceptable_outcomes.join("；") || "—"}`,
    ].join("\n"),
  );

  const byStatus = (status: EvidenceReference["status"]) =>
    dc.reality_facts.filter((f) => idx.get(f.fact_id)?.status === status);
  const factBlock = (title: string, status: EvidenceReference["status"]) => {
    const rows = byStatus(status);
    sections.push(
      [title, ...(rows.length ? rows.map((f) => line(f.fact_id, f.statement)) : ["- （无）"])].join("\n"),
    );
  };
  factBlock("【已确认事实 · confirmed_fact（用户已确认）】", "confirmed_fact");
  factBlock("【用户陈述但未核实 · user_stated_unverified】", "user_stated_unverified");
  factBlock("【用户估计 · user_estimate】", "user_estimate");
  factBlock("【仍未知 / 拒答 · unknown_or_declined】", "unknown_or_declined");

  sections.push(
    [
      "【约束】",
      ...(dc.constraints.length
        ? dc.constraints.map((c) =>
            line(
              c.constraint_id,
              c.statement,
              `${c.rigidity === "hard" ? "硬" : "软"}约束 · ${c.category} · ${idx.get(c.constraint_id)?.status}`,
            ),
          )
        : ["- （无）"]),
    ].join("\n"),
  );

  const liveHyp = dc.hypotheses.filter((h) => h.state !== "rejected");
  sections.push(
    [
      "【待验证假设 · analysis_hypothesis（不是事实）】",
      ...(liveHyp.length
        ? liveHyp.map((h) =>
            line(h.hypothesis_id, h.statement, `${h.state}${h.validation_need ? ` · 验证需要：${h.validation_need}` : ""}`),
          )
        : ["- （无）"]),
    ].join("\n"),
  );

  const directionByDir = new Map<string, { label: string; priority: string }>();
  for (const dir of blueprint?.directions ?? []) {
    for (const id of dir.dir_ids) directionByDir.set(id, { label: dir.label, priority: dir.priority });
  }
  const activeDirs = dc.dirs.filter((x) => x.id_lifecycle === "active");
  sections.push(
    [
      "【调查方向状态 · DIR】",
      ...(activeDirs.length
        ? activeDirs.map((x) => {
            const dirn = directionByDir.get(x.dir_id);
            return line(
              x.dir_id,
              x.need,
              [
                x.current_state,
                x.may_affect_p5_ranking ? "可能改变路径排序" : null,
                dirn ? `${dirn.priority} · ${dirn.label}` : null,
              ]
                .filter(Boolean)
                .join(" · "),
            );
          })
        : ["- （无）"]),
    ].join("\n"),
  );

  sections.push(
    [
      "【矛盾】",
      ...(dc.conflicts.length
        ? dc.conflicts.map((c) =>
            line(
              c.conflict_id,
              `${c.conflict_field}: ${c.statements_snapshot.join(" ↔ ")}`,
              `${c.state}${c.affects_preferred_path === false ? "" : " · 可能影响首选路径"}`,
            ),
          )
        : ["- （无）"]),
    ].join("\n"),
  );

  const boundaries = dc.information_boundaries ?? [];
  sections.push(
    [
      "【信息边界】",
      ...(boundaries.length ? boundaries.map((b, i) => line(`IB-${i + 1}`, b)) : ["- （无）"]),
    ].join("\n"),
  );

  sections.push(
    [
      "【本地排盘 · 八字（代码真算，只读）】",
      ...(projection.chart_lines.length
        ? projection.chart_lines.map((l) => line(l.ref_id, l.text))
        : ["- （无）"]),
    ].join("\n"),
  );
  if (projection.ziwei_lines.length) {
    sections.push(
      [
        "【本地排盘 · 紫微软标签（代码真算，只读）】",
        ...projection.ziwei_lines.map((l) => line(l.ref_id, l.text)),
      ].join("\n"),
    );
  }
  return sections.join("\n\n");
}

function languageInstruction(locale: string): string {
  const l = (locale || "zh").toLowerCase();
  if (l.startsWith("zh")) return "所有可见文字用简体中文。";
  if (l.startsWith("es")) return "Write all visible text in Spanish.";
  if (l.startsWith("fr")) return "Write all visible text in French.";
  return "Write all visible text in English.";
}

export function buildPersonalAnalysisPrompt(input: {
  dc: DecisionContext;
  blueprint: DecisionBlueprint | null;
  projection: ProfileProjection;
  locale: string;
}): { system: string; user: string } {
  const contract = buildUserFacingExpressionContractBlock({
    locale: input.locale,
    preset: "delivery",
  });
  const required = requiredUnresolvedRefs(input.dc);
  const system = [
    "你是 POJU 的个人分析师：用东方命理（八字为主、紫微为辅）读懂这个人，再把它压到用户眼前这一个决策上。",
    "",
    "## 你在做什么",
    "- 输入是一份已冻结、只读的决策上下文（唯一事实来源）和本地代码算好的个人排盘行。",
    "- 你产出一份《个人分析》：这个人在本次决策里的模式、长处、风险、决策倾向、与约束的交互、对各条路径的含义、仍未解决的条件、置信度与局限。",
    "- 这份分析之后会喂给八页报告，所以每一条都必须能指回输入里的编号。",
    "",
    "## 认识论纪律（硬）",
    "- 每条 item 必须声明 basis_class，取值只能是：confirmed_fact / user_stated_unverified / user_estimate / analysis_hypothesis / pattern_judgment。",
    "- confirmed_fact 只能建立在【已确认事实】或已确认约束上；用户陈述未核实、用户估计、假设、未知都不许写成已确认。",
    "- 你对这个人的命理推断与模式判断一律是 pattern_judgment；引用输入里的待验证假设时用 analysis_hypothesis。",
    "- 不许确认、改写、补全或推翻任何事实；不许替用户回答未知项；不许新增数字、概率、阈值。",
    "- 排盘行是代码真算结果：只能引用和解释，禁止自行推算、改写干支或补算运岁。",
    "- 传统命理是分析的基础；现代科学只作辅助解释（science_note 可选），不得用来证明或否定传统判断。",
    "- 一切围绕当前决策：与本题无关的人生泛论不写。",
    "",
    "## 两层文字",
    "- text：用户可见白话（行为、精力、节奏、处境），零命理专名、零干支、零十神、零用喜忌报幕、零合冲刑害、零神煞宫星原名。",
    "- traditional_basis：依据层，写清本盘机制链，可以使用命理真词，并引用 CFP/ZFP 行。",
    contract,
    "",
    "## 引用",
    "- evidence_refs 只能填输入里方括号中的编号（DEF、事实/约束/假设/DIR/矛盾 id、IB-n、CFP-nn、ZFP-nn）。编不存在的编号 = 整份作废。",
    "- personal_pattern_analysis / personal_strengths / personal_risks 每条至少引用一行排盘（CFP/ZFP）。",
    "- decision_tendencies / constraint_interaction / decision_path_implications / unresolved_conditions 每条至少引用一个决策上下文编号。",
    required.length
      ? `- unresolved_conditions 必须覆盖这些未解决编号（每个至少被一条引用）：${required.join("、")}。`
      : "- 若输入里没有未解决矛盾与关键未知，unresolved_conditions 写仍需验证的假设或信息边界。",
    "",
    "## 输出",
    "只输出一个 JSON 对象，不要 markdown 围栏：",
    "{",
    '  "personal_pattern_analysis": [Item, Item, ...],   // ≥2',
    '  "personal_strengths": [Item, ...],                // ≥1',
    '  "personal_risks": [Item, ...],                    // ≥1',
    '  "decision_tendencies": [Item, ...],               // ≥1',
    `  "constraint_interaction": [Item, ...],            // ${input.dc.constraints.length ? "≥1" : "可为空"}`,
    '  "decision_path_implications": [Item, ...],        // ≥2',
    '  "unresolved_conditions": [Item, ...],',
    '  "confidence": { "overall": "low|medium|high", "limits": ["..."] }',
    "}",
    'Item = { "text": "...", "traditional_basis": "...", "science_note": "..." | null, "basis_class": "...", "evidence_refs": ["..."] }',
    "",
    "## 交稿前自检",
    "- 删掉排盘行后，这些判断是否就站不住？站得住 = 写成了谁都适用的泛论，重写。",
    "- 有没有一条把未核实、估计或假设说成已确认？有就降级 basis_class。",
    "- text 里有没有命理专名？有就挪到 traditional_basis。",
    languageInstruction(input.locale),
  ].join("\n");

  const user = [
    "以下是本次冻结的决策上下文与个人排盘（只读）：",
    "",
    formatAnalysisInputBlock(input),
  ].join("\n");
  return { system, user };
}

// ─── Validation (A: judge only) ────────────────────────────────────────────

const SECTION_SHORT: Record<PersonalAnalysisSectionKey, string> = {
  personal_pattern_analysis: "pattern",
  personal_strengths: "strength",
  personal_risks: "risk",
  decision_tendencies: "tendency",
  constraint_interaction: "constraint",
  decision_path_implications: "path",
  unresolved_conditions: "open",
};

const CHART_ANCHORED: ReadonlySet<PersonalAnalysisSectionKey> = new Set([
  "personal_pattern_analysis",
  "personal_strengths",
  "personal_risks",
]);

const DC_ANCHORED: ReadonlySet<PersonalAnalysisSectionKey> = new Set([
  "decision_tendencies",
  "constraint_interaction",
  "decision_path_implications",
  "unresolved_conditions",
]);

function asString(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function isChartRef(r: EvidenceReference | undefined): boolean {
  return r?.kind === "chart_line" || r?.kind === "ziwei_line";
}

function isDcRef(r: EvidenceReference | undefined): boolean {
  return Boolean(r) && !isChartRef(r) && r!.kind !== "analysis_item";
}

export type PersonalAnalysisValidation =
  | { ok: true; artifact: PersonalAnalysisArtifact }
  | { ok: false; reason: string };

/** Class claims must match the frozen status of what they cite. */
function classConsistent(
  cls: EpistemicClass,
  refs: EvidenceReference[],
): string | null {
  const factLike = refs.filter((r) => r.kind === "reality_fact" || r.kind === "constraint");
  if (cls === "confirmed_fact") {
    if (!factLike.length) return "confirmed_fact_without_fact_ref";
    const bad = refs.find(
      (r) =>
        r.kind === "hypothesis" ||
        ((r.kind === "reality_fact" || r.kind === "constraint") &&
          r.status !== "confirmed_fact" &&
          r.status !== "constraint_confirmed"),
    );
    if (bad) return `confirmed_fact_upgrades:${bad.ref_id}`;
    return null;
  }
  if (cls === "user_stated_unverified") {
    return factLike.some(
      (r) => r.status === "user_stated_unverified" || r.status === "constraint_unverified",
    )
      ? null
      : "unverified_class_without_unverified_ref";
  }
  if (cls === "user_estimate") {
    return refs.some((r) => r.status === "user_estimate") ? null : "estimate_class_without_estimate_ref";
  }
  if (cls === "analysis_hypothesis") {
    return refs.some((r) => r.kind === "hypothesis") ? null : "hypothesis_class_without_hypothesis_ref";
  }
  return null;
}

export function validatePersonalAnalysisOutput(input: {
  raw: string;
  dc: DecisionContext;
  projection: ProfileProjection;
  locale: string;
}): PersonalAnalysisValidation {
  const parsed = tryParseJsonObject(input.raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  if (!parsed) return { ok: false, reason: "parse_failed" };

  const idx = addProfileEvidence(buildDcEvidenceIndex(input.dc), input.projection);
  const zh = (input.locale || "").toLowerCase().startsWith("zh");
  const hasChart = input.projection.chart_lines.length + input.projection.ziwei_lines.length > 0;
  const cited = new Set<string>();
  const sections = {} as Record<PersonalAnalysisSectionKey, PersonalAnalysisItem[]>;

  const minCount: Record<PersonalAnalysisSectionKey, number> = {
    personal_pattern_analysis: 2,
    personal_strengths: 1,
    personal_risks: 1,
    decision_tendencies: 1,
    constraint_interaction: input.dc.constraints.length ? 1 : 0,
    decision_path_implications: 2,
    unresolved_conditions: 0,
  };

  for (const key of PERSONAL_ANALYSIS_SECTIONS) {
    const arr = parsed[key];
    if (!Array.isArray(arr)) return { ok: false, reason: `missing_section:${key}` };
    if (arr.length < minCount[key]) return { ok: false, reason: `too_few_items:${key}` };
    const items: PersonalAnalysisItem[] = [];
    for (let i = 0; i < arr.length; i++) {
      const o = arr[i] as Record<string, unknown> | null;
      if (!o || typeof o !== "object") return { ok: false, reason: `bad_item:${key}[${i}]` };
      const text = asString(o.text);
      const traditional_basis = asString(o.traditional_basis);
      const science = asString(o.science_note);
      const basis_class = asString(o.basis_class) as EpistemicClass;
      const refsRaw = Array.isArray(o.evidence_refs) ? o.evidence_refs : [];
      const evidence_refs = [...new Set(refsRaw.map((r) => asString(r)).filter(Boolean))];
      const where = `${key}[${i}]`;
      if (text.length < 8) return { ok: false, reason: `thin_text:${where}` };
      if (!EPISTEMIC_CLASSES.includes(basis_class)) return { ok: false, reason: `bad_class:${where}` };
      if (!evidence_refs.length) return { ok: false, reason: `no_refs:${where}` };
      const unknown = evidence_refs.find((r) => !idx.has(r));
      if (unknown) return { ok: false, reason: `unknown_ref:${where}:${unknown}` };
      const refs = evidence_refs.map((r) => idx.get(r)!);
      if (CHART_ANCHORED.has(key) && hasChart && !refs.some(isChartRef)) {
        return { ok: false, reason: `no_chart_anchor:${where}` };
      }
      if (CHART_ANCHORED.has(key) && traditional_basis.length < 6) {
        return { ok: false, reason: `thin_traditional_basis:${where}` };
      }
      if (DC_ANCHORED.has(key) && !refs.some(isDcRef)) {
        return { ok: false, reason: `no_dc_anchor:${where}` };
      }
      const clsErr = classConsistent(basis_class, refs);
      if (clsErr) return { ok: false, reason: `${clsErr}:${where}` };
      if (zh) {
        const bare = bareMingliWordInPlain(text);
        if (bare) return { ok: false, reason: `bare_term_in_text:${where}:${bare}` };
      }
      for (const r of evidence_refs) cited.add(r);
      items.push({
        item_id: `PA-${SECTION_SHORT[key]}-${i + 1}`,
        text,
        traditional_basis,
        science_note: science || null,
        basis_class,
        evidence_refs,
      });
    }
    sections[key] = items;
  }

  const required = requiredUnresolvedRefs(input.dc);
  const openCited = new Set(sections.unresolved_conditions.flatMap((i) => i.evidence_refs));
  const missing = required.filter((r) => !openCited.has(r));
  if (missing.length) return { ok: false, reason: `unresolved_not_covered:${missing.join(",")}` };
  if (required.length && sections.unresolved_conditions.length === 0) {
    return { ok: false, reason: "unresolved_conditions_empty" };
  }

  const conf = (parsed.confidence ?? {}) as Record<string, unknown>;
  const overall = asString(conf.overall);
  if (overall !== "low" && overall !== "medium" && overall !== "high") {
    return { ok: false, reason: "bad_confidence" };
  }
  const limits = Array.isArray(conf.limits)
    ? conf.limits.map((x) => asString(x)).filter(Boolean)
    : [];
  if (!limits.length) return { ok: false, reason: "no_limits" };

  const d = input.dc.definition;
  const artifact: PersonalAnalysisArtifact = {
    decision_target: {
      decision_question: d.decision_question,
      concrete_event: d.concrete_event,
      desired_outcome: d.desired_outcome,
      stakes: d.stakes,
      goal_priorities: [...d.goal_priorities],
      unacceptable_outcomes: [...d.unacceptable_outcomes],
    },
    ...sections,
    evidence_references: [...cited].map((r) => ({ ...idx.get(r)! })),
    confidence_and_limits: {
      overall_confidence: overall,
      limits,
      information_boundaries: informationBoundariesFromDc(input.dc),
    },
  };
  return { ok: true, artifact };
}

// ─── Model call ────────────────────────────────────────────────────────────

export type PersonalAnalysisModelOutcome =
  | { ok: true; artifact: PersonalAnalysisArtifact; model: string; tokens_used: number }
  | { ok: false; reason: string; transport: boolean; model: string; tokens_used: number };

type RawModelFn = (prompt: { system: string; user: string }) => Promise<{
  content: string;
  model: string;
  tokens_used: number;
  finish_reason?: string | null;
}>;

/**
 * Test hook: replaces only the network call. Output still goes through the
 * production validator. Never set in production code paths.
 */
let __testAnalysisModel: RawModelFn | null = null;
export function __setPersonalAnalysisModelForTests(fn: RawModelFn | null): void {
  __testAnalysisModel = fn;
}

export async function runPersonalAnalysisModel(input: {
  dc: DecisionContext;
  blueprint: DecisionBlueprint | null;
  projection: ProfileProjection;
  locale: string;
  session_id: string;
  signal?: AbortSignal;
  timeout_ms?: number;
}): Promise<PersonalAnalysisModelOutcome> {
  const prompt = buildPersonalAnalysisPrompt(input);
  let content = "";
  let model = "";
  let tokens_used = 0;
  let finish: string | null | undefined;
  try {
    if (__testAnalysisModel) {
      const out = await __testAnalysisModel(prompt);
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
        temperature: 0.4,
        timeout_ms: input.timeout_ms ?? 240_000,
        max_attempts: 1,
        session_id: input.session_id,
        phase_name: "di2_personal_analysis",
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
  if (!content.trim()) {
    return { ok: false, reason: "empty_response", transport: true, model, tokens_used };
  }
  if (finish === "length") {
    return { ok: false, reason: "truncated", transport: false, model, tokens_used };
  }
  const v = validatePersonalAnalysisOutput({
    raw: content,
    dc: input.dc,
    projection: input.projection,
    locale: input.locale,
  });
  if (!v.ok) {
    return { ok: false, reason: v.reason, transport: false, model, tokens_used };
  }
  return { ok: true, artifact: v.artifact, model, tokens_used };
}
