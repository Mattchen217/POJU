/**
 * Build Page07 input_manifest + missing_inputs from production inputs.
 * Required-field blocks apply only when applicability_status is applicable.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { Page07ApplicabilityStatus } from "../applicability";
import {
  PAGE07_INPUT_FIELD_CONTRACTS,
  page07InputContractById,
  type Page07InputManifestEntry,
} from "./input-contracts";
import {
  gapStatusFromDcFactStatus,
  type Page07GenerationStatus,
  type Page07MissingInput,
} from "./gaps";

export type Page07ArchitectureInputSnapshot = {
  report_id: string;
  locale: string;
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  applicability_status: Page07ApplicabilityStatus;
  page01_present: boolean;
  page02_has_content_units: boolean;
  page02_unit_count: number;
  page04_has_content_units: boolean;
  page04_unit_count: number;
  page05_has_preferred_paths: boolean;
  page05_preferred_count: number;
  page06_has_primary_path: boolean;
  page06_action_count: number;
  registry_claim_count: number;
};

export type Page07FieldAssemblyRow = {
  present: boolean;
  status: Page07InputManifestEntry["collection_status"];
  summary: string | null;
};

type Page07AssemblyContext = {
  snap: Page07ArchitectureInputSnapshot;
};

type Page07FieldAssembler = (
  ctx: Page07AssemblyContext,
) => Page07FieldAssemblyRow;

function decisionQuestion(dc: DecisionContext | null | undefined): string {
  return (dc?.definition?.decision_question ?? "").trim();
}

export const PAGE07_FIELD_ASSEMBLERS: Record<string, Page07FieldAssembler> = {
  decision_question: (ctx) => {
    const q = decisionQuestion(ctx.snap.dc);
    return {
      present: q.length > 0,
      status: q.length > 0 ? "ready" : "missing",
      summary: q ? q.slice(0, 160) : null,
    };
  },
  report_locale: (ctx) => {
    const loc = (ctx.snap.locale ?? "").trim();
    return {
      present: loc.length > 0,
      status: loc.length > 0 ? "ready" : "missing",
      summary: loc || null,
    };
  },
  applicability_gate: (ctx) => ({
    present: true,
    status: "ready",
    summary: ctx.snap.applicability_status,
  }),
  page01_structured_payload: (ctx) => ({
    present: ctx.snap.page01_present,
    status: ctx.snap.page01_present ? "ready" : "missing",
    summary: ctx.snap.page01_present ? "Face01V2 present" : null,
  }),
  page02_foundation_payload: (ctx) => ({
    present: ctx.snap.page02_has_content_units,
    status: ctx.snap.page02_has_content_units ? "ready" : "missing",
    summary: ctx.snap.page02_has_content_units
      ? `units=${ctx.snap.page02_unit_count}`
      : null,
  }),
  page04_bottleneck_payload: (ctx) => ({
    present: ctx.snap.page04_has_content_units,
    status: ctx.snap.page04_has_content_units ? "ready" : "missing",
    summary: ctx.snap.page04_has_content_units
      ? `units=${ctx.snap.page04_unit_count}`
      : null,
  }),
  page05_paths_payload: (ctx) => ({
    present: ctx.snap.page05_has_preferred_paths,
    status: ctx.snap.page05_has_preferred_paths ? "ready" : "missing",
    summary: ctx.snap.page05_has_preferred_paths
      ? `preferred=${ctx.snap.page05_preferred_count}`
      : null,
  }),
  page06_execution_payload: (ctx) => ({
    present: ctx.snap.page06_has_primary_path,
    status: ctx.snap.page06_has_primary_path ? "ready" : "missing",
    summary: ctx.snap.page06_has_primary_path
      ? `actions=${ctx.snap.page06_action_count}`
      : null,
  }),
  confirmed_reality_facts_payload: (ctx) => {
    const facts = (ctx.snap.dc?.reality_facts ?? []).filter(
      (f) => f.status === "confirmed",
    );
    return {
      present: facts.length > 0,
      status: facts.length > 0 ? "ready" : "missing",
      summary: facts.length ? `confirmed=${facts.length}` : null,
    };
  },
  unverified_reality_facts_payload: (ctx) => {
    const facts = (ctx.snap.dc?.reality_facts ?? []).filter(
      (f) => f.status === "unverified",
    );
    return {
      present: facts.length > 0,
      status: facts.length > 0 ? "unverified" : "missing",
      summary: facts.length ? `unverified=${facts.length}` : null,
    };
  },
  reality_constraints: (ctx) => {
    const n = ctx.snap.dc?.constraints?.length ?? 0;
    return {
      present: n > 0,
      status: n > 0 ? "ready" : "missing",
      summary: n ? `constraints=${n}` : null,
    };
  },
  dirs_payload: (ctx) => {
    const n = ctx.snap.dc?.dirs?.length ?? 0;
    return {
      present: n > 0,
      status: n > 0 ? "ready" : "missing",
      summary: n ? `dirs=${n}` : null,
    };
  },
  book_judgment_face07_units: (ctx) => {
    const n = (ctx.snap.pack?.units ?? []).filter((u) =>
      u.serves_face.includes("07"),
    ).length;
    return {
      present: n > 0,
      status: n > 0 ? "ready" : "missing",
      summary: n ? `face07_units=${n}` : null,
    };
  },
  evidence_registry_claims: (ctx) => ({
    present: ctx.snap.registry_claim_count > 0,
    status: ctx.snap.registry_claim_count > 0 ? "ready" : "missing",
    summary: `claims=${ctx.snap.registry_claim_count}`,
  }),
};

export function page07AssembledFieldIds(): string[] {
  return Object.keys(PAGE07_FIELD_ASSEMBLERS).sort();
}

export function assertPage07InputAssemblyCoverage(): void {
  const contractIds = PAGE07_INPUT_FIELD_CONTRACTS.map((c) => c.field_id).sort();
  const assembled = page07AssembledFieldIds();
  if (JSON.stringify(contractIds) !== JSON.stringify(assembled)) {
    throw new Error(
      `page07 input assembly coverage mismatch: contracts=${contractIds.join(",")} assemblers=${assembled.join(",")}`,
    );
  }
}

export function assemblePage07InputManifest(
  snap: Page07ArchitectureInputSnapshot,
): Page07InputManifestEntry[] {
  const ctx: Page07AssemblyContext = { snap };
  const out: Page07InputManifestEntry[] = [];
  for (const contract of PAGE07_INPUT_FIELD_CONTRACTS) {
    const assembler = PAGE07_FIELD_ASSEMBLERS[contract.field_id];
    if (!assembler) {
      throw new Error(`missing assembler for ${contract.field_id}`);
    }
    const row = assembler(ctx);
    out.push({
      field_id: contract.field_id,
      section_id: contract.section_id,
      source_kind: contract.source_kind,
      present: row.present,
      collection_status: row.status,
      value_summary: row.summary,
    });
  }
  return out;
}

export function buildPage07MissingInputs(
  manifest: readonly Page07InputManifestEntry[],
  applicability: Page07ApplicabilityStatus,
): Page07MissingInput[] {
  const gaps: Page07MissingInput[] = [];
  for (const entry of manifest) {
    const contract = page07InputContractById(entry.field_id);
    if (!contract) continue;
    if (entry.collection_status === "ready") continue;
    if (entry.collection_status === "not_applicable") continue;
    if (entry.field_id === "applicability_gate") continue;

    if (contract.required && !entry.present) {
      if (applicability !== "applicable") continue;
      gaps.push({
        gap_id: `gap_${entry.field_id}`,
        page_id: "07",
        section_id: entry.section_id,
        field_id: entry.field_id,
        status: "missing",
        why_needed: contract.meaning,
        affects_content: contract.affects_content,
        follow_up_collect_hint: contract.follow_up_collect_hint,
        handling: "defer_generation",
      });
      continue;
    }

    if (!entry.present && contract.allow_empty) {
      if (contract.missing_handling === "gap_note_only" && applicability === "applicable") {
        const status: Page07MissingInput["status"] =
          entry.collection_status === "unverified" ||
          entry.collection_status === "conflict" ||
          entry.collection_status === "declined" ||
          entry.collection_status === "unknown"
            ? entry.collection_status
            : "missing";
        gaps.push({
          gap_id: `gap_${entry.field_id}`,
          page_id: "07",
          section_id: entry.section_id,
          field_id: entry.field_id,
          status,
          why_needed: contract.meaning,
          affects_content: contract.affects_content,
          follow_up_collect_hint: contract.follow_up_collect_hint,
          handling: "show_gap_note_only",
        });
      }
      continue;
    }

    if (
      applicability === "applicable" &&
      (entry.collection_status === "unverified" ||
        entry.collection_status === "conflict" ||
        entry.collection_status === "declined" ||
        entry.collection_status === "unknown")
    ) {
      gaps.push({
        gap_id: `gap_${entry.field_id}_${entry.collection_status}`,
        page_id: "07",
        section_id: entry.section_id,
        field_id: entry.field_id,
        status: entry.collection_status,
        why_needed: contract.meaning,
        affects_content: contract.affects_content,
        follow_up_collect_hint: contract.follow_up_collect_hint,
        handling:
          entry.collection_status === "unverified" ||
          entry.collection_status === "conflict"
            ? "generate_conditional_only"
            : "show_gap_note_only",
      });
    }
  }
  return gaps;
}

export function page07FactGapsFromDc(
  dc: DecisionContext | null | undefined,
  applicability: Page07ApplicabilityStatus,
): Page07MissingInput[] {
  if (!dc || applicability !== "applicable") return [];
  const gaps: Page07MissingInput[] = [];
  for (const f of dc.reality_facts ?? []) {
    const mapped = gapStatusFromDcFactStatus(f.status);
    if (!mapped) continue;
    gaps.push({
      gap_id: `gap_fact_${f.fact_id}`,
      page_id: "07",
      section_id: "evidence_boundary",
      field_id: `reality_fact:${f.fact_id}`,
      status: mapped,
      why_needed: "Preserve DC fact status; never upgrade in Page07 body.",
      affects_content: "field/relationship grounding / confirmed_fact_ids",
      follow_up_collect_hint:
        "Clarify the fact in intake if it decides the field or relationship.",
      handling:
        mapped === "unverified" || mapped === "conflict"
          ? "generate_conditional_only"
          : "show_gap_note_only",
    });
  }
  return gaps.slice(0, 16);
}

export function resolvePage07GenerationStatus(input: {
  applicability: Page07ApplicabilityStatus;
  missing_inputs: readonly Page07MissingInput[];
  structure_ok?: boolean;
  has_generated_page?: boolean;
}): Page07GenerationStatus {
  if (input.applicability === "not_applicable") return "skipped_not_applicable";
  if (input.applicability === "insufficient_information") {
    return "insufficient_information";
  }
  if (input.structure_ok === false) return "failed_structure";
  const blocking = input.missing_inputs.some(
    (g) => g.handling === "defer_generation",
  );
  if (blocking) return "blocked_on_required_inputs";
  if (input.has_generated_page) {
    return input.missing_inputs.length > 0
      ? "generated_with_gaps"
      : "generated_complete";
  }
  return "ready_for_generation";
}
