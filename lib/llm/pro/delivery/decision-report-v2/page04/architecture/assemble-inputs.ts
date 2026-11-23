/**
 * Build Page04 input_manifest + missing_inputs from production inputs.
 * Deterministic — no LLM. Never invents reality facts.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import {
  PAGE04_INPUT_FIELD_CONTRACTS,
  page04InputContractById,
  type Page04InputManifestEntry,
} from "./input-contracts";
import {
  gapStatusFromDcFactStatus,
  type Page04GenerationStatus,
  type Page04MissingInput,
} from "./gaps";

export type Page04ArchitectureInputSnapshot = {
  report_id: string;
  locale: string;
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  page01_core_judgment: string | null | undefined;
  page01_conditions?: ReadonlyArray<{
    condition: string;
    status: string;
    source_ids?: readonly string[];
  }>;
  /** Actual Page02 object presence (not a boolean flag alone). */
  page02_has_content_units: boolean;
  page02_unit_count: number;
  page03_available: boolean;
  approved_readings?: ReadonlyArray<{
    reading_id?: string;
    domain?: string;
    excerpt?: string;
  }>;
  approved_reading_count: number;
  registry_claim_count: number;
};

export type Page04FieldAssemblyRow = {
  present: boolean;
  status: Page04InputManifestEntry["collection_status"];
  summary: string | null;
};

type Page04FieldAssembler = (
  ctx: Page04AssemblyContext,
) => Page04FieldAssemblyRow;

type Page04AssemblyContext = {
  snap: Page04ArchitectureInputSnapshot;
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
  face04Units: NonNullable<BookJudgmentPack["units"]>;
  conditions: NonNullable<
    Page04ArchitectureInputSnapshot["page01_conditions"]
  >;
  confirmedSummary: string;
  unverifiedSummary: string;
  readingSummary: string;
};

function summaryOrNull(
  value: string | null | undefined,
  max = 160,
): string | null {
  const t = (value ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function filterValidApprovedReadings(
  readings: Page04ArchitectureInputSnapshot["approved_readings"],
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

export const PAGE04_FIELD_ASSEMBLERS: Record<string, Page04FieldAssembler> = {
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
  page01_core_judgment: (ctx) => ({
    present: Boolean(ctx.snap.page01_core_judgment?.trim()),
    status: ctx.snap.page01_core_judgment?.trim() ? "ready" : "missing",
    summary: summaryOrNull(ctx.snap.page01_core_judgment),
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
  page02_foundation_payload: (ctx) => ({
    present:
      ctx.snap.page02_has_content_units && ctx.snap.page02_unit_count > 0,
    status:
      ctx.snap.page02_has_content_units && ctx.snap.page02_unit_count > 0
        ? "ready"
        : "missing",
    summary: ctx.snap.page02_has_content_units
      ? `page02_units=${ctx.snap.page02_unit_count}`
      : null,
  }),
  page03_pattern_payload: (ctx) => ({
    present: ctx.snap.page03_available,
    status: ctx.snap.page03_available ? "ready" : "not_applicable",
    summary: ctx.snap.page03_available
      ? "page03_available"
      : "page03_not_in_batch",
  }),
  confirmed_reality_facts_payload: (ctx) => ({
    present: ctx.confirmedFacts.length > 0,
    status: ctx.confirmedFacts.length > 0 ? "ready" : "missing",
    summary: ctx.confirmedSummary || null,
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
  reality_constraints: (ctx) => ({
    present: ctx.constraints.length > 0,
    status: ctx.constraints.length > 0 ? "ready" : "missing",
    summary: ctx.constraints.length
      ? `constraints=${ctx.constraints.length}`
      : null,
  }),
  book_judgment_face04_units: (ctx) => ({
    present: ctx.face04Units.length > 0,
    status: ctx.face04Units.length > 0 ? "ready" : "missing",
    summary: ctx.face04Units.length
      ? `face04_units=${ctx.face04Units.length}`
      : null,
  }),
  evidence_registry_claims: (ctx) => ({
    present: ctx.snap.registry_claim_count > 0,
    status: ctx.snap.registry_claim_count > 0 ? "ready" : "missing",
    summary: `claims=${ctx.snap.registry_claim_count}`,
  }),
  personal_readings_payload: (ctx) => ({
    present: ctx.validReadings.length > 0,
    status: ctx.validReadings.length > 0 ? "ready" : "missing",
    summary: ctx.validReadings.length
      ? ctx.readingSummary || `readings=${ctx.validReadings.length}`
      : null,
  }),
};

export function page04AssembledFieldIds(): string[] {
  return Object.keys(PAGE04_FIELD_ASSEMBLERS).sort();
}

export function assertPage04InputAssemblyCoverage(): {
  ok: true;
  field_ids: string[];
} {
  const contractIds = PAGE04_INPUT_FIELD_CONTRACTS.map((c) => c.field_id).sort();
  const assembledIds = page04AssembledFieldIds();
  const missing = contractIds.filter((id) => !PAGE04_FIELD_ASSEMBLERS[id]);
  const extra = assembledIds.filter(
    (id) => !PAGE04_INPUT_FIELD_CONTRACTS.some((c) => c.field_id === id),
  );
  if (missing.length || extra.length) {
    throw new Error(
      `Page04 input assembly coverage broken: missing=[${missing.join(",")}] extra=[${extra.join(",")}]`,
    );
  }
  return { ok: true, field_ids: contractIds };
}

assertPage04InputAssemblyCoverage();

function buildAssemblyContext(
  snap: Page04ArchitectureInputSnapshot,
): Page04AssemblyContext {
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
  const face04Units = (snap.pack?.units ?? []).filter((u) =>
    u.serves_face.includes("04"),
  );
  const conditions = snap.page01_conditions ?? [];

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

  return {
    snap,
    question,
    confirmedFacts,
    unverifiedFacts,
    declinedUnknown,
    openConflicts,
    constraints,
    validReadings,
    face04Units,
    conditions,
    confirmedSummary,
    unverifiedSummary,
    readingSummary,
  };
}

export function assemblePage04InputManifest(
  snap: Page04ArchitectureInputSnapshot,
): Page04InputManifestEntry[] {
  const ctx = buildAssemblyContext(snap);
  return PAGE04_INPUT_FIELD_CONTRACTS.map((c) => {
    const assembler = PAGE04_FIELD_ASSEMBLERS[c.field_id];
    if (!assembler) {
      throw new Error(
        `Page04 field assembler missing for contract field_id=${c.field_id}`,
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

export function buildPage04MissingInputs(
  manifest: readonly Page04InputManifestEntry[],
): Page04MissingInput[] {
  const gaps: Page04MissingInput[] = [];
  for (const entry of manifest) {
    const contract = page04InputContractById(entry.field_id);
    if (!contract) continue;
    if (entry.collection_status === "ready" && entry.present) continue;

    const status = entry.collection_status;
    if (
      status === "not_applicable" &&
      !contract.required &&
      entry.field_id !== "unverified_reality_facts_payload" &&
      entry.field_id !== "open_conflicts" &&
      entry.field_id !== "declined_or_unknown_facts" &&
      entry.field_id !== "page03_pattern_payload"
    ) {
      continue;
    }

    if (entry.field_id === "page03_pattern_payload" && !entry.present) {
      continue;
    }

    if (!contract.required && status === "missing" && contract.allow_empty) {
      gaps.push({
        gap_id: `gap_04_${entry.field_id}_missing`,
        page_id: "04",
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
        gap_id: `gap_04_${entry.field_id}_${gapStatus}`,
        page_id: "04",
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
        gap_id: `gap_04_${entry.field_id}_${gapStatus}`,
        page_id: "04",
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

export function resolvePage04GenerationStatus(input: {
  missing_inputs: readonly Page04MissingInput[];
  structure_ok: boolean;
  has_generated_page: boolean;
}): Page04GenerationStatus {
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

export function page04FactGapsFromDc(
  dc: DecisionContext | null | undefined,
): Page04MissingInput[] {
  if (!dc) return [];
  const out: Page04MissingInput[] = [];
  for (const fact of dc.reality_facts ?? []) {
    const mapped = gapStatusFromDcFactStatus(fact.status);
    if (!mapped) continue;
    out.push({
      gap_id: `gap_04_fact_${fact.fact_id}_${mapped}`,
      page_id: "04",
      section_id: "evidence_boundary",
      field_id: `reality_fact:${fact.fact_id}`,
      status: mapped,
      why_needed: "Reality fact must not be treated as confirmed without status.",
      affects_content: "manifestation / evidence boundary",
      follow_up_collect_hint: `Clarify or verify fact ${fact.fact_id}`,
      handling:
        mapped === "unverified" || mapped === "unknown"
          ? "generate_conditional_only"
          : "omit_section_content",
    });
  }
  return out;
}
