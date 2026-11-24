/**
 * Page07 Batch 1 — architecture / applicability tests (Field & Relationship).
 * Run: pnpm exec tsx scripts/test-page07-architecture-batch1.ts
 */

import assert from "node:assert/strict";
import {
  PAGE07_SECTION_IDS,
  PAGE07_SECTION_DEFINITIONS,
  PAGE07_INPUT_FIELD_CONTRACTS,
  PAGE07_SECTION_CONTENT_SPECS,
  PAGE07_MODEL_TASKS,
  PAGE07_GAP_STATUSES,
  PAGE07_ARCHITECTURE_PROMPT_VERSION,
  PAGE07_UPSTREAM_CONTRACT,
  PAGE07_DOWNSTREAM_CONTRACT,
  PAGE07_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM,
  assertPage07InputAssemblyCoverage,
  page07AssembledFieldIds,
  normalizePage07ReadingOrder,
  page07RequiredSectionIds,
  page07InputContractsForSection,
  buildPage07ArchitectureProduction,
  page07TaskInterface,
} from "@/lib/llm/pro/delivery/decision-report-v2/page07/architecture";
import { evaluatePage07Applicability } from "@/lib/llm/pro/delivery/decision-report-v2/page07/applicability";
import { buildFace07ProductionContext } from "@/lib/llm/pro/delivery/decision-report-v2/page07/production";
import type { DecisionContext } from "@/lib/poju/decision-context/types";

console.log("=== Page07 Batch1 architecture (no LLM quality claims) ===");

function dc(partial: {
  question?: string | null;
  facts?: DecisionContext["reality_facts"];
  constraints?: DecisionContext["constraints"];
  dirs?: DecisionContext["dirs"];
}): DecisionContext {
  return {
    context_id: "dc_arch_07",
    version: 1,
    status: "final",
    content_hash: "hash_arch_07",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    definition: {
      decision_question: partial.question ?? null,
      concrete_event: null,
      desired_outcome: null,
      stakes: null,
      goal_priorities: [],
      unacceptable_outcomes: [],
    },
    constraints: partial.constraints ?? [],
    reality_facts: partial.facts ?? [],
    dirs: partial.dirs ?? [],
    conflicts: [],
    hypotheses: [],
  };
}

{
  assert.equal(PAGE07_SECTION_IDS.length, 4);
  assert.equal(PAGE07_SECTION_DEFINITIONS.length, 4);
  assert.equal(PAGE07_SECTION_CONTENT_SPECS.length, 4);
  assert.deepEqual(normalizePage07ReadingOrder([]), [...PAGE07_SECTION_IDS]);
  assert.deepEqual(normalizePage07ReadingOrder(["alignment_with_main"]), [
    "alignment_with_main",
    "field_judgment",
    "relationship_interaction",
    "evidence_boundary",
  ]);
  for (const id of page07RequiredSectionIds()) {
    assert.ok(PAGE07_SECTION_IDS.includes(id));
  }
  for (const key of ["page01", "page02", "page04", "page05", "page06", "decision_context"] as const) {
    assert.ok(PAGE07_UPSTREAM_CONTRACT[key].length > 0, key);
  }
  assert.equal(PAGE07_DOWNSTREAM_CONTRACT.page08.implemented, false);
  for (const field of [
    "applicability_status",
    "participants",
    "related_page05_path_ids",
    "related_page06_action_ids",
    "effect_on_page06_execution",
  ]) {
    assert.ok(
      (PAGE07_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM as readonly string[]).includes(field),
      field,
    );
  }
  assert.ok(PAGE07_ARCHITECTURE_PROMPT_VERSION.includes("page07"));
  assert.equal(PAGE07_MODEL_TASKS.length, 2);
  assert.equal(page07TaskInterface("page07_field_generate")?.on_failure, "single_repair_then_fail");
  assert.ok(PAGE07_GAP_STATUSES.includes("not_applicable"));
  console.log("A PASS — section / dependency SSOTs");
}

{
  assertPage07InputAssemblyCoverage();
  assert.deepEqual(
    page07AssembledFieldIds(),
    PAGE07_INPUT_FIELD_CONTRACTS.map((c) => c.field_id).sort(),
  );
  for (const id of PAGE07_SECTION_IDS) {
    assert.ok(page07InputContractsForSection(id).length >= 1, id);
  }
  const required = PAGE07_INPUT_FIELD_CONTRACTS.filter((c) => c.required).map((c) => c.field_id);
  for (const id of [
    "decision_question",
    "report_locale",
    "page01_structured_payload",
    "page02_foundation_payload",
    "page04_bottleneck_payload",
    "page05_paths_payload",
    "page06_execution_payload",
    "evidence_registry_claims",
  ]) {
    assert.ok(required.includes(id), id);
  }
  console.log("B PASS — input contract coverage");
}

{
  const relocate = evaluatePage07Applicability(
    dc({
      question: "Should I relocate and enter a partnership with Alex?",
    }),
    [],
    [],
    "Should I relocate and enter a partnership with Alex?",
  );
  assert.equal(relocate.status, "applicable");
  assert.ok(relocate.signals.some((s) => s.linked && s.stem === "relocate"));
  assert.ok(relocate.signals.some((s) => s.linked && s.stem === "partnership"));

  const careerChange = evaluatePage07Applicability(
    dc({ question: "Should I change careers into a new company?" }),
    [],
    [],
    "Should I change careers into a new company?",
  );
  assert.equal(careerChange.status, "applicable");

  const family = evaluatePage07Applicability(
    dc({ question: "Will family affect this decision about the offer?" }),
    [],
    [],
    "Will family affect this decision about the offer?",
  );
  assert.equal(family.status, "applicable");
  assert.ok(family.signals.some((s) => s.stem === "family_affects_decision" && s.linked));

  const org = evaluatePage07Applicability(
    dc({ question: "Does the team field at the new org support this move?" }),
    [],
    [],
    "Does the team field at the new org support this move?",
  );
  assert.equal(org.status, "applicable");

  const solo = evaluatePage07Applicability(
    dc({ question: "Should I take a solo promotion and keep my runway?" }),
    [],
    [],
    "Should I take a solo promotion and keep my runway?",
  );
  assert.equal(solo.status, "not_applicable");

  const bare = evaluatePage07Applicability(
    dc({
      question: "Should I take a solo promotion and keep my runway?",
      constraints: [
        {
          constraint_id: "c_rel",
          statement: "relationship",
          category: "responsibility",
          status: "confirmed",
          verification_level: "user_asserted",
          source_stage: "collecting",
          source_turn_id: "t1",
          rigidity: "soft",
          user_confirmed: true,
        },
      ],
    }),
    [],
    [],
    "Should I take a solo promotion and keep my runway?",
  );
  assert.equal(bare.status, "not_applicable");
  assert.ok(bare.signals.some((s) => s.stem === "bare_relationship_label" && !s.linked));

  const empty = evaluatePage07Applicability(dc({ question: "" }), [], [], "");
  assert.equal(empty.status, "insufficient_information");

  const unknownDir = evaluatePage07Applicability(
    dc({
      question: "What should I do next?",
      dirs: [
        {
          dir_id: "dir_move",
          need: "Whether relocation is still unknown",
          why: "The move is not decided",
          required_fact_roles: [],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          id_lifecycle: "active",
        },
      ],
    }),
    undefined,
    undefined,
    undefined,
  );
  assert.equal(unknownDir.status, "insufficient_information");
  assert.ok(unknownDir.signals.some((s) => s.stem === "relocate" && s.linked === false));

  console.log("C PASS — applicability gate");
}

{
  const blocked = buildFace07ProductionContext({
    report_id: "arch07_na",
    locale: "en",
    dc: dc({ question: "Should I take a solo promotion and keep my runway?" }),
    pack: null,
  });
  assert.equal(blocked.ok, true);
  if (!blocked.ok) throw new Error("unreachable");
  assert.equal(blocked.ctx.may_invoke_llm, false);
  assert.equal(blocked.ctx.applicability.status, "not_applicable");
  assert.equal(blocked.ctx.architecture.generation_status, "skipped_not_applicable");

  const thin = buildFace07ProductionContext({
    report_id: "arch07_thin",
    locale: "en",
    dc: dc({ question: null }),
    pack: null,
  });
  assert.equal(thin.ok, true);
  if (!thin.ok) throw new Error("unreachable");
  assert.equal(thin.ctx.applicability.status, "insufficient_information");
  assert.equal(thin.ctx.may_invoke_llm, false);
  assert.equal(thin.ctx.architecture.generation_status, "insufficient_information");

  const missingDc = buildFace07ProductionContext({
    report_id: "arch07_nodc",
    locale: "en",
    dc: null,
    pack: null,
  });
  assert.equal(missingDc.ok, false);
  if (missingDc.ok) throw new Error("unreachable");
  assert.equal(missingDc.reason, "face07_missing_decision_context");

  const applicableBlocked = buildPage07ArchitectureProduction({
    report_id: "arch07_applicable_blocked",
    locale: "en",
    dc: dc({ question: "Should I relocate with a partnership?" }),
    pack: null,
  });
  assert.equal(applicableBlocked.ok, true);
  if (!applicableBlocked.ok) throw new Error("unreachable");
  assert.equal(applicableBlocked.may_invoke_llm, false);
  assert.equal(
    applicableBlocked.envelope.generation_status,
    "blocked_on_required_inputs",
  );
  assert.ok(
    applicableBlocked.envelope.missing_inputs.some(
      (g) => g.handling === "defer_generation" && g.field_id === "page06_execution_payload",
    ),
  );
  console.log("D PASS — production context does not invoke when gated");
}

console.log("ok page07 architecture batch1");
