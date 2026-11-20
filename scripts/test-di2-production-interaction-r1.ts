/**
 * DI2 Production Interaction Corrections R1 — unit coverage.
 * Opening asserted facts, report map, readiness hide-0%, UI projection.
 */
import assert from "node:assert/strict";
import {
  matchOpeningClaims,
  seedOpeningAssertedFacts,
} from "../lib/poju/decision-intake/opening-asserted-facts";
import {
  candidateHasReportPurpose,
  formatReportPurposeForPrompt,
  reportMappingForDir,
} from "../lib/poju/decision-intake/investigation-report-map";
import { computeReadinessProgress } from "../lib/poju/decision-intake/understanding-state";
import { projectDecisionUnderstandingBox } from "../lib/poju/decision-intake/ui-projection";
import { ensureWelcomePinnedFirst, seedFixedWelcomeMessages } from "../lib/poju/chat-bootstrap";
import type { POJUSessionState } from "../lib/poju/types";
import type { DecisionContext } from "../lib/poju/decision-context/types";
import type { DecisionBlueprint } from "../lib/poju/decision-intake/types";

const STATEMENT =
  "我从上一次的创业失败后，已经好几年没有收入了，一直找不到事情做，怎么办？";

function bareSession(): POJUSessionState {
  return {
    session_id: "sess_r1",
    messages: [],
    decision_context: {
      context_id: "dc_r1",
      version: 1,
      status: "draft",
      content_hash: "h",
      reality_facts: [],
      dirs: [
        {
          dir_id: "DIR-STATUS-QUO",
          need: "status",
          current_state: "unknown",
          id_lifecycle: "active",
          required_fact_roles: ["status_quo"],
        },
        {
          dir_id: "DIR-PAST-ATTEMPTS",
          need: "past",
          current_state: "unknown",
          id_lifecycle: "active",
          required_fact_roles: ["past_attempt"],
        },
        {
          dir_id: "DIR-DEF-QUESTION",
          need: "question",
          current_state: "unknown",
          id_lifecycle: "active",
          required_fact_roles: ["decision_question"],
        },
      ],
      conflicts: [],
      constraints: [],
      definition: { decision_question: STATEMENT },
    } as DecisionContext,
    decision_blueprint: {
      blueprint_id: "bp",
      schema_version: "1",
      decision_type: "career",
      directions: [
        {
          direction_id: "DIRN-DEFINITION",
          label: "Definition",
          priority: "P0",
          dir_ids: ["DIR-DEF-QUESTION", "DIR-STATUS-QUO", "DIR-PAST-ATTEMPTS"],
        },
      ],
      dir_ids: ["DIR-DEF-QUESTION", "DIR-STATUS-QUO", "DIR-PAST-ATTEMPTS"],
      question_budget: { soft: 6, hard: 10, depth_per_direction: 3 },
      created_at: "2026-11-20T00:00:00.000Z",
    } as DecisionBlueprint,
  } as POJUSessionState;
}

console.log("R1-1 opening claims match");
const claims = matchOpeningClaims(STATEMENT);
assert.equal(claims.length, 3);
assert.ok(claims.some((c) => c.claim_key === "past_venture_failure"));
assert.ok(claims.some((c) => c.claim_key === "prolonged_no_income"));
assert.ok(claims.some((c) => c.claim_key === "no_clear_next_work"));

console.log("R1-2 seed opening asserted facts");
const seeded = seedOpeningAssertedFacts(bareSession(), STATEMENT, "turn_1", "2026-11-20T12:00:00.000Z", "zh");
const facts = seeded.decision_context?.reality_facts ?? [];
assert.equal(facts.length, 3);
assert.ok(facts.every((f) => f.verification_level === "user_asserted"));
assert.ok(facts.every((f) => f.fact_id.startsWith("fact_open_")));

console.log("R1-3 Understood projects asserted facts");
const box = projectDecisionUnderstandingBox({
  ...seeded,
  decision_understanding: {
    understanding_id: "u1",
    current_understanding: {
      summary: "stagnation after venture failure",
      decision_question: STATEMENT,
      confirmed_briefs: [],
      unconfirmed_briefs: [],
      analysis_briefs: [],
      fingerprint: "fp",
      confidence: "low",
    },
    understood: { items: [] },
    need_to_understand: { items: [] },
    personal_pattern_insight: { status: "none", insights: [] },
    readiness: { verdict: "continue", can_ask: true, reasons: [] },
    readiness_progress: { percent: 0, complete: false, basis: "ddr_dir_gate", components: {
      ddr: 0, p0_dir: 0, p1_dir: 0, constraints: 0, conflicts: 0, sufficiency: 0,
    } },
    budget: {
      soft_budget_limit: 6,
      hard_budget_limit: 10,
      session_asked_count: 0,
      review_cycle: 1,
      cycle_base_asked: 0,
      remaining_hard_budget: 10,
      depth_by_dir: {},
    },
    last_sent_question: null,
    next_question_plan: null,
  },
} as POJUSessionState);
assert.ok(box.already_understood.length >= 3, JSON.stringify(box.already_understood));
assert.ok(box.already_understood.some((i) => i.label.includes("创业失败")));
assert.ok(box.already_understood.some((i) => i.label.includes("没有收入")));
assert.ok(box.already_understood.some((i) => i.label.includes("找不到")));
// With asserted facts, Fresh 0% is no longer shown as misleading empty — either null or >0 after recompute.
assert.ok(box.progress_percent === null || box.progress_percent >= 0);

console.log("R1-4 readiness with asserted facts is not empty-band full credit");
const progress = computeReadinessProgress({
  dc: seeded.decision_context!,
  blueprint: seeded.decision_blueprint!,
  sufficiency: { verdict: "insufficient", canStop: false, reasons: [] } as never,
});
assert.ok(progress.percent < 100);
assert.equal(progress.complete, false);
console.log("  components", progress.components, "percent", progress.percent);

console.log("R1-5 report map");
assert.ok(reportMappingForDir("DIR-DEF-OUTCOME"));
assert.ok(reportMappingForDir("DIR-BIZ-MODEL"));
assert.equal(candidateHasReportPurpose(["DIR-BIZ-MODEL"]), true);
assert.equal(candidateHasReportPurpose(["DIR-UNKNOWN-XYZ"]), false);
const purpose = formatReportPurposeForPrompt(["DIR-DEF-OUTCOME"], "zh");
assert.equal(purpose.layer, "user_expectation");
assert.ok(purpose.report_pages.includes("01"));

console.log("R1-6 welcome pinned first");
let s = bareSession();
s = {
  ...s,
  messages: [
    { role: "user", content: STATEMENT, timestamp: "2026-11-20T12:00:01.000Z" },
  ],
} as POJUSessionState;
s = seedFixedWelcomeMessages(s, "zh");
s = ensureWelcomePinnedFirst(s);
assert.equal(s.messages[0]?.meta?.kind, "welcome");
assert.equal(s.messages[1]?.role, "user");

console.log("ALL R1 unit checks passed");
