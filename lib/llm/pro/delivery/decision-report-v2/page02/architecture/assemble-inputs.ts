/**
 * Build Page02 input_manifest + missing_inputs from production inputs.
 * Deterministic — no LLM. Never invents reality facts.
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
  approved_reading_count: number;
  registry_claim_count: number;
  reality_mechanism_evidence_count?: number;
};

function summaryOrNull(
  value: string | null | undefined,
  max = 160,
): string | null {
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
  const declinedUnknown = (dc?.reality_facts ?? []).filter((f) =>
    ["declined", "unknown", "not_applicable"].includes(f.status),
  );
  const openConflicts = (dc?.conflicts ?? []).filter(
    (c) => c.state !== "clarified",
  );
  const constraints = dc?.constraints ?? [];
  const readings = snap.approved_readings ?? [];
  const readingCount = Math.max(
    snap.approved_reading_count,
    readings.length,
  );
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
  const readingSummary = readings
    .slice(0, 3)
    .map(
      (r) =>
        `${r.reading_id ?? "?"}|${r.domain ?? "?"}|${(r.excerpt ?? "").slice(0, 40)}`,
    )
    .join(" || ");

  const condDepsPresent =
    confirmedFacts.length > 0 ||
    unverifiedFacts.length > 0 ||
    conditions.length > 0;

  const values: Record<
    string,
    {
      present: boolean;
      status: Page02InputManifestEntry["collection_status"];
      summary: string | null;
    }
  > = {
    page01_core_judgment: {
      present: Boolean(snap.page01_core_judgment?.trim()),
      status: snap.page01_core_judgment?.trim() ? "ready" : "missing",
      summary: summaryOrNull(snap.page01_core_judgment),
    },
    page01_why_paths: {
      present: whyPaths.length > 0,
      status: whyPaths.length > 0 ? "ready" : "missing",
      summary: whyPaths.length
        ? `why_paths=${whyPaths.length}`
        : null,
    },
    decision_question: {
      present: Boolean(question),
      status: question ? "ready" : "missing",
      summary: summaryOrNull(question),
    },
    report_locale: {
      present: Boolean(snap.locale?.trim()),
      status: snap.locale?.trim() ? "ready" : "missing",
      summary: snap.locale || null,
    },
    available_personal_domains: {
      present: snap.available_domains.length > 0,
      status: snap.available_domains.length > 0 ? "ready" : "missing",
      summary: snap.available_domains.join(",") || null,
    },
    personal_profile_version: {
      present: Boolean(profile),
      status: profile ? "ready" : "missing",
      summary: profile,
    },
    personal_readings_payload: {
      present: readingCount > 0,
      status: readingCount > 0 ? "ready" : "missing",
      summary:
        readingSummary ||
        (readingCount > 0 ? `readings=${readingCount}` : null),
    },
    book_judgment_destiny_units: {
      present: destinyUnits.length > 0,
      status: destinyUnits.length > 0 ? "ready" : "missing",
      summary: destinyUnits.length
        ? `destiny_units=${destinyUnits.length}`
        : null,
    },
    confirmed_reality_facts_payload: {
      present: confirmedFacts.length > 0,
      status: confirmedFacts.length > 0 ? "ready" : "missing",
      summary: confirmedSummary || null,
    },
    reality_mechanism_inputs: {
      present: constraints.length > 0 || mechCount > 0,
      status:
        constraints.length > 0 || mechCount > 0 ? "ready" : "missing",
      summary: `constraints=${constraints.length};mech_ev=${mechCount}`,
    },
    book_judgment_science_units: {
      present: scienceUnits.length > 0,
      status: scienceUnits.length > 0 ? "ready" : "missing",
      summary: scienceUnits.length
        ? `science_units=${scienceUnits.length}`
        : null,
    },
    evidence_registry_claims: {
      present: snap.registry_claim_count > 0,
      status: snap.registry_claim_count > 0 ? "ready" : "missing",
      summary: `claims=${snap.registry_claim_count}`,
    },
    page01_recommendation_conditions: {
      present: conditions.length > 0,
      status: conditions.length > 0 ? "ready" : "missing",
      summary: conditions.length
        ? conditions
            .slice(0, 3)
            .map((c) => `${c.status}:${c.condition.slice(0, 32)}`)
            .join(" || ")
        : null,
    },
    conditional_explanation_deps: {
      present: condDepsPresent,
      status: condDepsPresent ? "ready" : "missing",
      summary: `confirmed=${confirmedFacts.length};unverified=${unverifiedFacts.length};p01_conds=${conditions.length}`,
    },
    unverified_reality_facts_payload: {
      present: unverifiedFacts.length > 0,
      status: unverifiedFacts.length > 0 ? "unverified" : "not_applicable",
      summary: unverifiedSummary || `unverified=${unverifiedFacts.length}`,
    },
    declined_or_unknown_facts: {
      present: declinedUnknown.length > 0,
      status: declinedUnknown.length
        ? (gapStatusFromDcFactStatus(declinedUnknown[0]!.status) ?? "unknown")
        : "not_applicable",
      summary: declinedUnknown.length
        ? declinedUnknown.map((f) => `${f.fact_id}:${f.status}`).join(",")
        : null,
    },
    open_conflicts: {
      present: openConflicts.length > 0,
      status: openConflicts.length > 0 ? "conflict" : "not_applicable",
      summary: `open_conflicts=${openConflicts.length}`,
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
