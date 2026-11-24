/**
 * Build Page08 input_manifest + missing_inputs from production inputs.
 * Page07 never blocks. Missing and insufficient_information are gaps.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import {
  PAGE08_INPUT_FIELD_CONTRACTS,
  page08InputContractById,
  type Page08InputManifestEntry,
} from "./input-contracts";
import {
  gapStatusFromDcFactStatus,
  type Page08GenerationStatus,
  type Page08MissingInput,
} from "./gaps";

export type Page08Page07Presence =
  | "missing"
  | "not_applicable"
  | "insufficient_information"
  | "applicable";

export type Page08ArchitectureInputSnapshot = {
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
  page06_has_monitoring: boolean;
  page06_action_count: number;
  page07_presence: Page08Page07Presence;
  page07_summary: string | null;
  registry_claim_count: number;
};

export type Page08FieldAssemblyRow = {
  present: boolean;
  status: Page08InputManifestEntry["collection_status"];
  summary: string | null;
};

type Page08AssemblyContext = {
  snap: Page08ArchitectureInputSnapshot;
};

type Page08FieldAssembler = (
  ctx: Page08AssemblyContext,
) => Page08FieldAssemblyRow;

function decisionQuestion(dc: DecisionContext | null | undefined): string {
  return (dc?.definition?.decision_question ?? "").trim();
}

export const PAGE08_FIELD_ASSEMBLERS: Record<string, Page08FieldAssembler> = {
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
  page06_monitoring_payload: (ctx) => ({
    present: ctx.snap.page06_has_monitoring,
    status: ctx.snap.page06_has_monitoring ? "ready" : "missing",
    summary: ctx.snap.page06_has_monitoring
      ? `actions=${ctx.snap.page06_action_count}`
      : null,
  }),
  page07_field_payload: (ctx) => {
    const presence = ctx.snap.page07_presence;
    if (presence === "applicable") {
      return {
        present: true,
        status: "ready",
        summary: ctx.snap.page07_summary,
      };
    }
    if (presence === "not_applicable") {
      return {
        present: true,
        status: "not_applicable",
        summary: ctx.snap.page07_summary ?? "not_applicable",
      };
    }
    if (presence === "insufficient_information") {
      return {
        present: false,
        status: "unknown",
        summary: ctx.snap.page07_summary ?? "insufficient_information",
      };
    }
    return { present: false, status: "missing", summary: null };
  },
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
  book_judgment_face08_units: (ctx) => {
    const n = (ctx.snap.pack?.units ?? []).filter((u) =>
      u.serves_face.includes("08"),
    ).length;
    return {
      present: n > 0,
      status: n > 0 ? "ready" : "missing",
      summary: n ? `face08_units=${n}` : null,
    };
  },
  evidence_registry_claims: (ctx) => ({
    present: ctx.snap.registry_claim_count > 0,
    status: ctx.snap.registry_claim_count > 0 ? "ready" : "missing",
    summary: `claims=${ctx.snap.registry_claim_count}`,
  }),
};

export function page08AssembledFieldIds(): string[] {
  return Object.keys(PAGE08_FIELD_ASSEMBLERS).sort();
}

export function assertPage08InputAssemblyCoverage(): void {
  const contractIds = PAGE08_INPUT_FIELD_CONTRACTS.map((c) => c.field_id).sort();
  const assembled = page08AssembledFieldIds();
  if (JSON.stringify(contractIds) !== JSON.stringify(assembled)) {
    throw new Error(
      `page08 input assembly coverage mismatch: contracts=${contractIds.join(",")} assemblers=${assembled.join(",")}`,
    );
  }
}

export function assemblePage08InputManifest(
  snap: Page08ArchitectureInputSnapshot,
): Page08InputManifestEntry[] {
  const ctx: Page08AssemblyContext = { snap };
  const out: Page08InputManifestEntry[] = [];
  for (const contract of PAGE08_INPUT_FIELD_CONTRACTS) {
    const assembler = PAGE08_FIELD_ASSEMBLERS[contract.field_id];
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

export function buildPage08MissingInputs(
  manifest: readonly Page08InputManifestEntry[],
): Page08MissingInput[] {
  const gaps: Page08MissingInput[] = [];
  for (const entry of manifest) {
    const contract = page08InputContractById(entry.field_id);
    if (!contract) continue;
    if (entry.collection_status === "ready") continue;
    if (entry.collection_status === "not_applicable") continue;

    if (contract.required && !entry.present) {
      gaps.push({
        gap_id: `gap_${entry.field_id}`,
        page_id: "08",
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
        const status: Page08MissingInput["status"] =
          entry.collection_status === "unverified" ||
          entry.collection_status === "conflict" ||
          entry.collection_status === "declined" ||
          entry.collection_status === "unknown"
            ? entry.collection_status
            : "missing";
        const page07Insufficient = entry.field_id === "page07_field_payload" && status === "unknown";
        const page07Missing = entry.field_id === "page07_field_payload" && status === "missing";
        gaps.push({
          gap_id: page07Insufficient
            ? "gap_page07_insufficient_information"
            : `gap_${entry.field_id}`,
          page_id: "08",
          section_id: entry.section_id,
          field_id: entry.field_id,
          status,
          why_needed: page07Insufficient
            ? "Page07 applicability is insufficient_information."
            : contract.meaning,
          affects_content: page07Insufficient
            ? "Gap only. Do not relabel Page07 as applicable or invent its analysis."
            : page07Missing
              ? "Page07 is missing. Do not invent field or relationship facts."
              : contract.affects_content,
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
        page_id: "08",
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

export function page08FactGapsFromDc(
  dc: DecisionContext | null | undefined,
): Page08MissingInput[] {
  if (!dc) return [];
  const gaps: Page08MissingInput[] = [];
  for (const f of dc.reality_facts ?? []) {
    const mapped = gapStatusFromDcFactStatus(f.status);
    if (!mapped) continue;
    gaps.push({
      gap_id: `gap_fact_${f.fact_id}`,
      page_id: "08",
      section_id: "evidence_boundary",
      field_id: `reality_fact:${f.fact_id}`,
      status: mapped,
      why_needed: "Preserve DC fact status; never upgrade it in Page08.",
      affects_content: "confirmed_fact_ids / unverified_fact_ids",
      follow_up_collect_hint:
        "Clarify the fact in intake before treating it as confirmed.",
      handling:
        mapped === "unverified" || mapped === "conflict"
          ? "generate_conditional_only"
          : "show_gap_note_only",
    });
  }
  return gaps.slice(0, 16);
}

export function resolvePage08GenerationStatus(input: {
  missing_inputs: readonly Page08MissingInput[];
  structure_ok?: boolean;
  has_generated_page?: boolean;
}): Page08GenerationStatus {
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
