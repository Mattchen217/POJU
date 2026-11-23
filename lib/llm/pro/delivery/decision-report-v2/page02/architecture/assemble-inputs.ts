/**
 * Build Page02 input_manifest + missing_inputs from production inputs.
 * Deterministic — no LLM. Never invents reality facts.
 *
 * Every PAGE02_INPUT_FIELD_CONTRACTS.field_id MUST have an assembler entry.
 * Silent fallback to missing is forbidden (coverage asserted at module load).
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import {
  PAGE02_INPUT_FIELD_CONTRACTS,
  page02InputContractById,
  type Page02InputManifestEntry,
} from "./input-contracts";
import {
  gapStatusFromDcFactStatus,
  type Page02GenerationStatus,
  type Page02MissingInput,
} from "./gaps";

export type Page02ArchitectureInputSnapshot = {
  report_id: string;
  locale: string;
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  page01_core_judgment: string | null | undefined;
  page01_why_paths?: readonly string[];
  page01_conditions?: ReadonlyArray<{
    condition: string;
    status: string;
    source_ids?: readonly string[];
  }>;
  available_domains: readonly string[];
  profile_version?: string | null;
  approved_readings?: ReadonlyArray<{
    reading_id?: string;
    domain?: string;
    excerpt?: string;
  }>;
  /** Statistics only — must NOT substitute for approved_readings objects. */
  approved_reading_count: number;
  registry_claim_count: number;
  reality_mechanism_evidence_count?: number;
};

export type Page02FieldAssemblyRow = {
  present: boolean;
  status: Page02InputManifestEntry["collection_status"];
  summary: string | null;
};

type Page02FieldAssembler = (
  ctx: Page02AssemblyContext,
) => Page02FieldAssemblyRow;

type Page02AssemblyContext = {
  snap: Page02ArchitectureInputSnapshot;
  question: string;
  confirmedFacts: NonNullable<DecisionContext["reality_facts"]>;
  unverifiedFacts: NonNullable<DecisionContext["reality_facts"]>;
  declinedUnknown: NonNullable<DecisionContext["reality_facts"]>;
  openConflicts: NonNullable<DecisionContext["conflicts"]>;
  constraints: NonNullable<DecisionContext["constraints"]>;
  validReadings: Array<{
    reading_id: string;
    domain: string;
    excerpt: string;
  }>;
  destinyUnits: NonNullable<BookJudgmentPack["units"]>;
  scienceUnits: NonNullable<BookJudgmentPack["units"]>;
  whyPaths: readonly string[];
  conditions: NonNullable<Page02ArchitectureInputSnapshot["page01_conditions"]>;
  mechCount: number;
  profile: string | null;
  confirmedSummary: string;
  unverifiedSummary: string;
  readingSummary: string;
  condDepsPresent: boolean;
};

function summaryOrNull(
  value: string | null | undefined,
  max = 160,
): string | null {
  const t = (value ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Valid approved reading objects only (id + domain + excerpt). */
export function filterValidApprovedReadings(
  readings: Page02ArchitectureInputSnapshot["approved_readings"],
): Array<{ reading_id: string; domain: string; excerpt: string }> {
  const out: Array<{ reading_id: string; domain: string; excerpt: string }> =
    [];
  for (const r of readings ?? []) {
    const reading_id = (r.reading_id ?? "").trim();
    const domain = (r.domain ?? "").trim();
    const excerpt = (r.excerpt ?? "").trim();
    if (!reading_id || !domain || !excerpt) continue;
    out.push({ reading_id, domain, excerpt });
  }
  return out;
}

/**
 * Explicit field_id → assembler map. Must cover every contract field_id.
 * Adding a contract without an entry fails module-load coverage check.
 */
export const PAGE02_FIELD_ASSEMBLERS: Record<string, Page02FieldAssembler> = {
  page01_core_judgment: (ctx) => ({
    present: Boolean(ctx.snap.page01_core_judgment?.trim()),
    status: ctx.snap.page01_core_judgment?.trim() ? "ready" : "missing",
    summary: summaryOrNull(ctx.snap.page01_core_judgment),
  }),
  page01_why_paths: (ctx) => ({
    present: ctx.whyPaths.length > 0,
    status: ctx.whyPaths.length > 0 ? "ready" : "missing",
    summary: ctx.whyPaths.length ? `why_paths=${ctx.whyPaths.length}` : null,
  }),
  decision_question: (ctx) => ({
    present: Boolean(ctx.question),
    status: ctx.question ? "ready" : "missing",
    summary: summaryOrNull(ctx.question),
  }),
  report_locale: (ctx) => ({
    present: Boolean(ctx.snap.locale?.trim()),
    status: ctx.snap.locale?.trim() ? "ready" : "missing",
    summary: ctx.snap.locale || null,
  }),
  available_personal_domains: (ctx) => ({
    present: ctx.snap.available_domains.length > 0,
    status: ctx.snap.available_domains.length > 0 ? "ready" : "missing",
    summary: ctx.snap.available_domains.join(",") || null,
  }),
  personal_profile_version: (ctx) => ({
    present: Boolean(ctx.profile),
    status: ctx.profile ? "ready" : "missing",
    summary: ctx.profile,
  }),
  personal_readings_payload: (ctx) => ({
    // Count alone never marks present — only valid reading objects.
    present: ctx.validReadings.length > 0,
    status: ctx.validReadings.length > 0 ? "ready" : "missing",
    summary: ctx.validReadings.length
      ? ctx.readingSummary || `readings=${ctx.validReadings.length}`
      : null,
  }),
  book_judgment_destiny_units: (ctx) => ({
    present: ctx.destinyUnits.length > 0,
    status: ctx.destinyUnits.length > 0 ? "ready" : "missing",
    summary: ctx.destinyUnits.length
      ? `destiny_units=${ctx.destinyUnits.length}`
      : null,
  }),
  confirmed_reality_facts_payload: (ctx) => ({
    present: ctx.confirmedFacts.length > 0,
    status: ctx.confirmedFacts.length > 0 ? "ready" : "missing",
    summary: ctx.confirmedSummary || null,
  }),
  reality_mechanism_inputs: (ctx) => ({
    present: ctx.constraints.length > 0 || ctx.mechCount > 0,
    status:
      ctx.constraints.length > 0 || ctx.mechCount > 0 ? "ready" : "missing",
    summary: `constraints=${ctx.constraints.length};mech_ev=${ctx.mechCount}`,
  }),
  book_judgment_science_units: (ctx) => ({
    present: ctx.scienceUnits.length > 0,
    status: ctx.scienceUnits.length > 0 ? "ready" : "missing",
    summary: ctx.scienceUnits.length
      ? `science_units=${ctx.scienceUnits.length}`
      : null,
  }),
  evidence_registry_claims: (ctx) => ({
    present: ctx.snap.registry_claim_count > 0,
    status: ctx.snap.registry_claim_count > 0 ? "ready" : "missing",
    summary: `claims=${ctx.snap.registry_claim_count}`,
  }),
  page01_recommendation_conditions: (ctx) => ({
    present: ctx.conditions.length > 0,
    status: ctx.conditions.length > 0 ? "ready" : "missing",
    summary: ctx.conditions.length
      ? ctx.conditions
          .slice(0, 3)
          .map((c) => `${c.status}:${c.condition.slice(0, 32)}`)
          .join(" || ")
      : null,
  }),
  conditional_explanation_deps: (ctx) => ({
    present: ctx.condDepsPresent,
    status: ctx.condDepsPresent ? "ready" : "missing",
    summary: `confirmed=${ctx.confirmedFacts.length};unverified=${ctx.unverifiedFacts.length};p01_conds=${ctx.conditions.length}`,
  }),
  unverified_reality_facts_payload: (ctx) => ({
    present: ctx.unverifiedFacts.length > 0,
    status: ctx.unverifiedFacts.length > 0 ? "unverified" : "not_applicable",
    summary:
      ctx.unverifiedSummary || `unverified=${ctx.unverifiedFacts.length}`,
  }),
  declined_or_unknown_facts: (ctx) => ({
    present: ctx.declinedUnknown.length > 0,
    status: ctx.declinedUnknown.length
      ? (gapStatusFromDcFactStatus(ctx.declinedUnknown[0]!.status) ?? "unknown")
      : "not_applicable",
    summary: ctx.declinedUnknown.length
      ? ctx.declinedUnknown.map((f) => `${f.fact_id}:${f.status}`).join(",")
      : null,
  }),
  open_conflicts: (ctx) => ({
    present: ctx.openConflicts.length > 0,
    status: ctx.openConflicts.length > 0 ? "conflict" : "not_applicable",
    summary: `open_conflicts=${ctx.openConflicts.length}`,
  }),
};

/** Contract field_ids that have a real assembler (must equal contract set). */
export function page02AssembledFieldIds(): string[] {
  return Object.keys(PAGE02_FIELD_ASSEMBLERS).sort();
}

export function assertPage02InputAssemblyCoverage(): {
  ok: true;
  field_ids: string[];
} {
  const contractIds = PAGE02_INPUT_FIELD_CONTRACTS.map((c) => c.field_id).sort();
  const assembledIds = page02AssembledFieldIds();
  const missing = contractIds.filter((id) => !PAGE02_FIELD_ASSEMBLERS[id]);
  const extra = assembledIds.filter(
    (id) => !PAGE02_INPUT_FIELD_CONTRACTS.some((c) => c.field_id === id),
  );
  if (missing.length || extra.length) {
    throw new Error(
      `Page02 input assembly coverage broken: missing=[${missing.join(",")}] extra=[${extra.join(",")}]`,
    );
  }
  return { ok: true, field_ids: contractIds };
}

// Fail closed at module load — new contract without assembler cannot ship silently.
assertPage02InputAssemblyCoverage();

function buildAssemblyContext(
  snap: Page02ArchitectureInputSnapshot,
): Page02AssemblyContext {
  const dc = snap.dc;
  const question = dc?.definition?.decision_question?.trim() ?? "";
  const confirmedFacts = (dc?.reality_facts ?? []).filter(
    (f) => f.status === "confirmed",
  );
  const unverifiedFacts = (dc?.reality_facts ?? []).filter(
    (f) => f.status === "unverified",
  );
  const declinedUnknown = (dc?.reality_facts ?? []).filter((f) =>
    ["declined", "unknown", "not_applicable"].includes(f.status),
  );
  const openConflicts = (dc?.conflicts ?? []).filter(
    (c) => c.state !== "clarified",
  );
  const constraints = dc?.constraints ?? [];
  const validReadings = filterValidApprovedReadings(snap.approved_readings);
  const packUnits = snap.pack?.units ?? [];
  const destinyUnits = packUnits.filter(
    (u) =>
      u.serves_face.includes("02") &&
      (u.track === "destiny" || u.track === "convergence"),
  );
  const scienceUnits = packUnits.filter(
    (u) => u.serves_face.includes("02") && u.track === "science",
  );
  const whyPaths = snap.page01_why_paths ?? [];
  const conditions = snap.page01_conditions ?? [];
  const mechCount = snap.reality_mechanism_evidence_count ?? 0;
  const profile =
    snap.profile_version?.trim() ||
    snap.pack?.cfp_hash ||
    snap.pack?.zfp_hash ||
    null;

  const confirmedSummary = confirmedFacts
    .slice(0, 3)
    .map(
      (f) =>
        `${f.fact_id}|${f.status}|${f.verification_level ?? "?"}|${(f.statement ?? "").slice(0, 40)}`,
    )
    .join(" || ");
  const unverifiedSummary = unverifiedFacts
    .slice(0, 3)
    .map(
      (f) =>
        `${f.fact_id}|${f.status}|${f.verification_level ?? "?"}|${(f.statement ?? "").slice(0, 40)}`,
    )
    .join(" || ");
  const readingSummary = validReadings
    .slice(0, 3)
    .map((r) => `${r.reading_id}|${r.domain}|${r.excerpt.slice(0, 40)}`)
    .join(" || ");

  const condDepsPresent =
    confirmedFacts.length > 0 ||
    unverifiedFacts.length > 0 ||
    conditions.length > 0;

  return {
    snap,
    question,
    confirmedFacts,
    unverifiedFacts,
    declinedUnknown,
    openConflicts,
    constraints,
    validReadings,
    destinyUnits,
    scienceUnits,
    whyPaths,
    conditions,
    mechCount,
    profile,
    confirmedSummary,
    unverifiedSummary,
    readingSummary,
    condDepsPresent,
  };
}

export function assemblePage02InputManifest(
  snap: Page02ArchitectureInputSnapshot,
): Page02InputManifestEntry[] {
  const ctx = buildAssemblyContext(snap);
  return PAGE02_INPUT_FIELD_CONTRACTS.map((c) => {
    const assembler = PAGE02_FIELD_ASSEMBLERS[c.field_id];
    if (!assembler) {
      throw new Error(
        `Page02 field assembler missing for contract field_id=${c.field_id}`,
      );
    }
    const row = assembler(ctx);
    return {
      field_id: c.field_id,
      section_id: c.section_id,
      source_kind: c.source_kind,
      present: row.present,
      collection_status: row.status,
      value_summary: row.summary,
    };
  });
}

export function buildPage02MissingInputs(
  manifest: readonly Page02InputManifestEntry[],
): Page02MissingInput[] {
  const gaps: Page02MissingInput[] = [];
  for (const entry of manifest) {
    const contract = page02InputContractById(entry.field_id);
    if (!contract) continue;

    if (entry.collection_status === "ready" && entry.present) continue;

    const status = entry.collection_status;
    if (
      status === "not_applicable" &&
      !contract.required &&
      entry.field_id !== "unverified_reality_facts_payload" &&
      entry.field_id !== "open_conflicts" &&
      entry.field_id !== "declined_or_unknown_facts"
    ) {
      continue;
    }

    if (!contract.required && status === "missing" && contract.allow_empty) {
      gaps.push({
        gap_id: `gap_02_${entry.field_id}_missing`,
        page_id: "02",
        section_id: contract.section_id,
        field_id: entry.field_id,
        status: "missing",
        why_needed: contract.meaning,
        affects_content: contract.affects_content,
        follow_up_collect_hint: contract.follow_up_collect_hint,
        handling:
          contract.missing_handling === "block_page_generation"
            ? "defer_generation"
            : contract.missing_handling === "omit_dependent_units" ||
                contract.missing_handling === "use_empty_section_display"
              ? "omit_section_content"
              : "show_gap_note_only",
      });
      continue;
    }

    if (status === "ready") continue;

    const gapStatus =
      status === "missing" ||
      status === "unknown" ||
      status === "conflict" ||
      status === "unverified" ||
      status === "declined" ||
      status === "not_applicable"
        ? status
        : "missing";

    if (
      (entry.field_id === "unverified_reality_facts_payload" ||
        entry.field_id === "open_conflicts" ||
        entry.field_id === "declined_or_unknown_facts") &&
      !entry.present
    ) {
      continue;
    }

    if (contract.required && !entry.present) {
      gaps.push({
        gap_id: `gap_02_${entry.field_id}_${gapStatus}`,
        page_id: "02",
        section_id: contract.section_id,
        field_id: entry.field_id,
        status: gapStatus === "not_applicable" ? "missing" : gapStatus,
        why_needed: contract.meaning,
        affects_content: contract.affects_content,
        follow_up_collect_hint: contract.follow_up_collect_hint,
        handling: "defer_generation",
      });
      continue;
    }

    if (
      entry.present &&
      (gapStatus === "unverified" ||
        gapStatus === "conflict" ||
        gapStatus === "declined" ||
        gapStatus === "unknown")
    ) {
      gaps.push({
        gap_id: `gap_02_${entry.field_id}_${gapStatus}`,
        page_id: "02",
        section_id: contract.section_id,
        field_id: entry.field_id,
        status: gapStatus,
        why_needed: contract.meaning,
        affects_content: contract.affects_content,
        follow_up_collect_hint: contract.follow_up_collect_hint,
        handling:
          gapStatus === "declined"
            ? "omit_section_content"
            : "generate_conditional_only",
      });
    }
  }
  return gaps;
}

export function resolvePage02GenerationStatus(input: {
  missing_inputs: readonly Page02MissingInput[];
  structure_ok: boolean;
  has_generated_page: boolean;
}): Page02GenerationStatus {
  if (!input.structure_ok && input.has_generated_page) {
    return "failed_structure";
  }
  const blocking = input.missing_inputs.some(
    (g) => g.handling === "defer_generation",
  );
  if (blocking && !input.has_generated_page) {
    return "blocked_on_required_inputs";
  }
  if (!input.has_generated_page) {
    return blocking ? "blocked_on_required_inputs" : "ready_for_generation";
  }
  if (input.missing_inputs.length > 0) {
    return "generated_with_gaps";
  }
  return "generated_complete";
}

export function page02FactGapsFromDc(
  dc: DecisionContext | null | undefined,
): Page02MissingInput[] {
  if (!dc) return [];
  const out: Page02MissingInput[] = [];
  for (const fact of dc.reality_facts ?? []) {
    const mapped = gapStatusFromDcFactStatus(fact.status);
    if (!mapped) continue;
    out.push({
      gap_id: `gap_02_fact_${fact.fact_id}_${mapped}`,
      page_id: "02",
      section_id: "explanation_boundary",
      field_id: `reality_fact:${fact.fact_id}`,
      status: mapped,
      why_needed: "Reality fact must not be treated as confirmed without status.",
      affects_content: "reality_fact units / confirmed boundary lists",
      follow_up_collect_hint: `Clarify or verify fact ${fact.fact_id}`,
      handling:
        mapped === "unverified" || mapped === "unknown"
          ? "generate_conditional_only"
          : "omit_section_content",
    });
  }
  return out;
}
