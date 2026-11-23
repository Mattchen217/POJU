/**
 * Build Page02 input_manifest + missing_inputs from production inputs.
 * Deterministic — no LLM. Never invents reality facts.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import {
  PAGE02_INPUT_FIELD_CONTRACTS,
  type Page02InputManifestEntry,
} from "./input-contracts";
import {
  gapStatusFromDcFactStatus,
  type Page02GenerationStatus,
  type Page02MissingInput,
} from "./gaps";
import { page02InputContractById } from "./input-contracts";

export type Page02ArchitectureInputSnapshot = {
  report_id: string;
  locale: string;
  dc: DecisionContext | null | undefined;
  pack: BookJudgmentPack | null | undefined;
  page01_core_judgment: string | null | undefined;
  available_domains: readonly string[];
  approved_reading_count: number;
  registry_claim_count: number;
};

function summaryOrNull(value: string | null | undefined, max = 120): string | null {
  const t = (value ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function assemblePage02InputManifest(
  snap: Page02ArchitectureInputSnapshot,
): Page02InputManifestEntry[] {
  const dc = snap.dc;
  const question = dc?.definition?.decision_question?.trim() ?? "";
  const confirmedFacts = (dc?.reality_facts ?? []).filter(
    (f) => f.status === "confirmed",
  );
  const unverifiedFacts = (dc?.reality_facts ?? []).filter(
    (f) => f.status === "unverified",
  );
  const openConflicts = (dc?.conflicts ?? []).filter(
    (c) => c.state !== "clarified",
  );

  const values: Record<string, { present: boolean; status: Page02InputManifestEntry["collection_status"]; summary: string | null }> =
    {
      page01_core_judgment: {
        present: Boolean(snap.page01_core_judgment?.trim()),
        status: snap.page01_core_judgment?.trim() ? "ready" : "missing",
        summary: summaryOrNull(snap.page01_core_judgment),
      },
      decision_question: {
        present: Boolean(question),
        status: question ? "ready" : "missing",
        summary: summaryOrNull(question),
      },
      personal_readings_available: {
        present: snap.approved_reading_count > 0,
        status: snap.approved_reading_count > 0 ? "ready" : "missing",
        summary: `readings=${snap.approved_reading_count}`,
      },
      confirmed_reality_facts: {
        present: confirmedFacts.length > 0,
        status: confirmedFacts.length > 0 ? "ready" : "missing",
        summary: `confirmed=${confirmedFacts.length}`,
      },
      unverified_reality_facts: {
        present: unverifiedFacts.length > 0,
        status: unverifiedFacts.length > 0 ? "unverified" : "not_applicable",
        summary: `unverified=${unverifiedFacts.length}`,
      },
      open_conflicts: {
        present: openConflicts.length > 0,
        status: openConflicts.length > 0 ? "conflict" : "not_applicable",
        summary: `open_conflicts=${openConflicts.length}`,
      },
      evidence_registry_claims: {
        present: snap.registry_claim_count > 0,
        status: snap.registry_claim_count > 0 ? "ready" : "missing",
        summary: `claims=${snap.registry_claim_count}`,
      },
      available_personal_domains: {
        present: snap.available_domains.length > 0,
        status: snap.available_domains.length > 0 ? "ready" : "missing",
        summary: snap.available_domains.join(",") || null,
      },
      report_locale: {
        present: Boolean(snap.locale?.trim()),
        status: snap.locale?.trim() ? "ready" : "missing",
        summary: snap.locale || null,
      },
    };

  return PAGE02_INPUT_FIELD_CONTRACTS.map((c) => {
    const row = values[c.field_id] ?? {
      present: false,
      status: "missing" as const,
      summary: null,
    };
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

    // Ready fields are not gaps.
    if (entry.collection_status === "ready" && entry.present) continue;

    // Optional empty fields that allow empty → only gap when status is a real gap enum
    // and the field is required OR status is conflict/unverified/declined/unknown.
    const status = entry.collection_status;
    if (status === "not_applicable" && !contract.required) {
      // Optional N/A is informational only when we want DI2 hints — still record.
      if (
        entry.field_id !== "unverified_reality_facts" &&
        entry.field_id !== "open_conflicts"
      ) {
        continue;
      }
    }

    if (!contract.required && status === "missing" && contract.allow_empty) {
      // Optional missing → record as missing for DI2 contract, non-blocking.
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
            : contract.missing_handling === "omit_dependent_units"
              ? "omit_section_content"
              : contract.missing_handling === "use_empty_section_display"
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

    // Skip pure not_applicable optional clutter except conflict/unverified tracks
    if (
      gapStatus === "not_applicable" &&
      !contract.required &&
      entry.field_id !== "unverified_reality_facts" &&
      entry.field_id !== "open_conflicts"
    ) {
      continue;
    }

    // For unverified/open_conflicts: only emit when present
    if (
      (entry.field_id === "unverified_reality_facts" ||
        entry.field_id === "open_conflicts") &&
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

    if (entry.present && (gapStatus === "unverified" || gapStatus === "conflict")) {
      gaps.push({
        gap_id: `gap_02_${entry.field_id}_${gapStatus}`,
        page_id: "02",
        section_id: contract.section_id,
        field_id: entry.field_id,
        status: gapStatus,
        why_needed: contract.meaning,
        affects_content: contract.affects_content,
        follow_up_collect_hint: contract.follow_up_collect_hint,
        handling: "generate_conditional_only",
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

/** Per-fact gap rows for DI2 contract (optional enrichment). */
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
