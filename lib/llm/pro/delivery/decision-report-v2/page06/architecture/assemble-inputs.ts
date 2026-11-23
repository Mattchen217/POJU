/**
 * Build Page06 input_manifest + missing_inputs from production inputs.
 * Deterministic — no LLM. Never invents reality facts.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import {
  PAGE06_INPUT_FIELD_CONTRACTS,
  page06InputContractById,
  type Page06InputManifestEntry,
} from "./input-contracts";
import {
  gapStatusFromDcFactStatus,
  type Page06GenerationStatus,
  type Page06MissingInput,
} from "./gaps";

export type Page06ArchitectureInputSnapshot = {
  report_id: string;
  locale: string;
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  page01_present: boolean;
  page02_has_content_units: boolean;
  page02_unit_count: number;
  page04_has_content_units: boolean;
  page04_unit_count: number;
  page05_has_preferred_paths: boolean;
  page05_preferred_count: number;
  page07_available: boolean;
  approved_readings?: ReadonlyArray<{
    reading_id?: string;
    domain?: string;
    excerpt?: string;
  }>;
  approved_reading_count: number;
  registry_claim_count: number;
};

export type Page06FieldAssemblyRow = {
  present: boolean;
  status: Page06InputManifestEntry["collection_status"];
  summary: string | null;
};

type Page06AssemblyContext = {
  snap: Page06ArchitectureInputSnapshot;
};

type Page06FieldAssembler = (
  ctx: Page06AssemblyContext,
) => Page06FieldAssemblyRow;

function decisionQuestion(dc: DecisionContext | null | undefined): string {
  return (dc?.definition?.decision_question ?? "").trim();
}

export function filterValidApprovedReadings(
  readings: ReadonlyArray<{
    reading_id?: string;
    domain?: string;
    excerpt?: string;
  }>,
): Array<{ reading_id: string; domain: string; excerpt: string }> {
  const out: Array<{ reading_id: string; domain: string; excerpt: string }> =
    [];
  for (const r of readings) {
    const reading_id = String(r.reading_id ?? "").trim();
    const excerpt = String(r.excerpt ?? "").trim();
    if (!reading_id || !excerpt) continue;
    out.push({
      reading_id,
      domain: String(r.domain ?? "convergence").trim() || "convergence",
      excerpt,
    });
  }
  return out;
}

export const PAGE06_FIELD_ASSEMBLERS: Record<string, Page06FieldAssembler> = {
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
  page05_paths_payload: (ctx) => ({
    present: ctx.snap.page05_has_preferred_paths,
    status: ctx.snap.page05_has_preferred_paths ? "ready" : "missing",
    summary: ctx.snap.page05_has_preferred_paths
      ? `preferred=${ctx.snap.page05_preferred_count}`
      : null,
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
  declined_unknown_na_facts_payload: (ctx) => {
    const facts = (ctx.snap.dc?.reality_facts ?? []).filter(
      (f) =>
        f.status === "declined" ||
        f.status === "unknown" ||
        f.status === "not_applicable",
    );
    const status =
      facts.find((f) => f.status === "declined")?.status ??
      facts.find((f) => f.status === "unknown")?.status ??
      facts.find((f) => f.status === "not_applicable")?.status;
    return {
      present: facts.length > 0,
      status: status
        ? (gapStatusFromDcFactStatus(status) ?? "missing")
        : "missing",
      summary: facts.length
        ? facts.map((f) => `${f.fact_id}:${f.status}`).join(",")
        : null,
    };
  },
  open_conflicts: (ctx) => {
    const conflicts = (ctx.snap.dc?.conflicts ?? []).filter(
      (c) => c.state === "open" || c.state === "unresolved_in_final",
    );
    return {
      present: conflicts.length > 0,
      status: conflicts.length > 0 ? "conflict" : "missing",
      summary: conflicts.length ? `open=${conflicts.length}` : null,
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
  book_judgment_face06_units: (ctx) => {
    const n = (ctx.snap.pack?.units ?? []).filter((u) =>
      u.serves_face.includes("06"),
    ).length;
    return {
      present: n > 0,
      status: n > 0 ? "ready" : "missing",
      summary: n ? `face06_units=${n}` : null,
    };
  },
  approved_personal_readings: (ctx) => {
    const valid = filterValidApprovedReadings(ctx.snap.approved_readings ?? []);
    return {
      present: valid.length > 0,
      status: valid.length > 0 ? "ready" : "missing",
      summary: valid.length ? `readings=${valid.length}` : null,
    };
  },
  evidence_registry_claims: (ctx) => ({
    present: ctx.snap.registry_claim_count > 0,
    status: ctx.snap.registry_claim_count > 0 ? "ready" : "missing",
    summary: `claims=${ctx.snap.registry_claim_count}`,
  }),
  page07_field_payload: (ctx) => ({
    present: ctx.snap.page07_available,
    status: ctx.snap.page07_available ? "ready" : "not_applicable",
    summary: ctx.snap.page07_available
      ? "page07 available"
      : "not_applicable for Page06 Batch1",
  }),
};

export function page06AssembledFieldIds(): string[] {
  return Object.keys(PAGE06_FIELD_ASSEMBLERS).sort();
}

export function assertPage06InputAssemblyCoverage(): void {
  const contractIds = PAGE06_INPUT_FIELD_CONTRACTS.map((c) => c.field_id).sort();
  const assembled = page06AssembledFieldIds();
  if (JSON.stringify(contractIds) !== JSON.stringify(assembled)) {
    throw new Error(
      `page06 input assembly coverage mismatch: contracts=${contractIds.join(",")} assemblers=${assembled.join(",")}`,
    );
  }
}

export function assemblePage06InputManifest(
  snap: Page06ArchitectureInputSnapshot,
): Page06InputManifestEntry[] {
  const ctx: Page06AssemblyContext = { snap };
  const out: Page06InputManifestEntry[] = [];
  for (const contract of PAGE06_INPUT_FIELD_CONTRACTS) {
    const assembler = PAGE06_FIELD_ASSEMBLERS[contract.field_id];
    if (!assembler) {
      throw new Error(`missing assembler for ${contract.field_id}`);
    }
    const row = assembler(ctx);
    let status = row.status;
    if (
      !contract.required &&
      !row.present &&
      contract.field_id === "page07_field_payload"
    ) {
      status = "not_applicable";
    }
    out.push({
      field_id: contract.field_id,
      section_id: contract.section_id,
      source_kind: contract.source_kind,
      present: row.present,
      collection_status: status,
      value_summary: row.summary,
    });
  }
  return out;
}

export function buildPage06MissingInputs(
  manifest: readonly Page06InputManifestEntry[],
): Page06MissingInput[] {
  const gaps: Page06MissingInput[] = [];
  for (const entry of manifest) {
    const contract = page06InputContractById(entry.field_id);
    if (!contract) continue;
    if (entry.collection_status === "ready") continue;
    if (entry.collection_status === "not_applicable") continue;

    if (contract.required && !entry.present) {
      gaps.push({
        gap_id: `gap_${entry.field_id}`,
        page_id: "06",
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
      if (contract.missing_handling === "gap_note_only") {
        const status: Page06MissingInput["status"] =
          entry.collection_status === "unverified" ||
          entry.collection_status === "conflict" ||
          entry.collection_status === "declined" ||
          entry.collection_status === "unknown"
            ? entry.collection_status
            : "missing";
        gaps.push({
          gap_id: `gap_${entry.field_id}`,
          page_id: "06",
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
      entry.collection_status === "unverified" ||
      entry.collection_status === "conflict" ||
      entry.collection_status === "declined" ||
      entry.collection_status === "unknown"
    ) {
      gaps.push({
        gap_id: `gap_${entry.field_id}_${entry.collection_status}`,
        page_id: "06",
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

export function page06FactGapsFromDc(
  dc: DecisionContext | null | undefined,
): Page06MissingInput[] {
  if (!dc) return [];
  const gaps: Page06MissingInput[] = [];
  for (const f of dc.reality_facts ?? []) {
    const mapped = gapStatusFromDcFactStatus(f.status);
    if (!mapped) continue;
    gaps.push({
      gap_id: `gap_fact_${f.fact_id}`,
      page_id: "06",
      section_id: "evidence_boundary",
      field_id: `reality_fact:${f.fact_id}`,
      status: mapped,
      why_needed: "Preserve DC fact status; never upgrade in Page06 body.",
      affects_content: "execution grounding / confirmed_fact_ids",
      follow_up_collect_hint: "Clarify fact in intake if it decides the first step.",
      handling:
        mapped === "unverified" || mapped === "conflict"
          ? "generate_conditional_only"
          : "show_gap_note_only",
    });
  }
  return gaps.slice(0, 16);
}

export function resolvePage06GenerationStatus(input: {
  missing_inputs: readonly Page06MissingInput[];
  structure_ok?: boolean;
  has_generated_page?: boolean;
}): Page06GenerationStatus {
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
