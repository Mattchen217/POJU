/**
 * S5 Freeze→Delivery wire + S6 LAB observation (engineering gates, no live LLM).
 * Run: pnpm exec tsx scripts/test-s5-freeze-s6-observation.ts
 */

import assert from "node:assert/strict";
import {
  applySufficiencyFreezeToSession,
  canFreezeSessionOnSufficiency,
  evaluateDecisionSufficiency,
  freezeDraftForDelivery,
  naValidationBoundToDc,
  reaggregateDirsIntake,
  resolveDeliveryDcPayload,
  seedDecisionContextFromOpening,
  shouldRequireFrozenDecisionContext,
  type DecisionContext,
} from "../lib/poju/decision-context";
import type { POJUSessionState } from "../lib/poju/types";
import { buildLabObservation } from "../lib/llm/pro/delivery/lab/observation";

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${name}`);
    console.error(e);
  }
}

function makeDraft(): DecisionContext {
  const seeded = seedDecisionContextFromOpening({
    context_id: "dc_s5",
    now: "2026-11-03T20:00:00.000Z",
    core_dilemma: {
      concrete_event: "Stay or leave",
      stakes: "Income",
      sticking_point: null,
    },
    desired_direction: { wants: "Reversible", priority: "stability" },
    user_statements: [
      {
        statement: "Six months runway",
        verification_level: "user_asserted",
        has_user_confirm_event: true,
        status: "confirmed",
        source_turn_id: "t1",
        fact_roles: ["runway", "event", "support"],
      },
    ],
    user_constraints: [
      {
        statement: "No irreversible move before verify",
        category: "reversibility",
        rigidity: "hard",
        source_turn_id: "tc1",
        has_user_confirm_event: true,
      },
    ],
  });
  seeded.reality_facts = seeded.reality_facts.map((f) => ({
    ...f,
    related_dir_ids: ["d1"],
  }));
  seeded.constraints = seeded.constraints.map((c) => ({
    ...c,
    related_dir_ids: ["d1"],
  }));
  const dirsSeed = [
    {
      dir_id: "d1",
      need: "runway",
      why: "afford",
      required_fact_roles: ["runway"],
      current_state: "unknown" as const,
      partial_satisfaction: false,
      agenda_item_ids: [] as string[],
      id_lifecycle: "active" as const,
      may_affect_p5_ranking: false,
    },
  ];
  seeded.dirs = reaggregateDirsIntake(
    dirsSeed,
    seeded.reality_facts,
    [],
    seeded.constraints,
    [],
    naValidationBoundToDc(seeded, "sess_s5"),
  );
  return seeded;
}

function sessionWith(
  dc: DecisionContext | null,
  extra?: Partial<POJUSessionState>,
): POJUSessionState {
  return {
    session_id: "sess_s5",
    user_id: "u1",
    created_at: "2026-11-03T20:00:00.000Z",
    last_interaction_at: "2026-11-03T20:00:00.000Z",
    messages: [],
    agent_v2: {
      current_phase: "awaiting_confirmation",
      original_question: "Q",
      context_collected: {},
      turn_count: 1,
      tokens_used: 0,
      stall_offer_pending: false,
      delivery_mode: "full",
    } as POJUSessionState["agent_v2"],
    decision_context: dc,
    decision_context_versions: [],
    ...extra,
  } as POJUSessionState;
}

async function main() {
  console.log("S5 freeze wire + S6 observation");

  const draft = makeDraft();
  assert.equal(evaluateDecisionSufficiency(draft).canStop, true);

  await check("S5: stall path cannot freeze", () => {
    const base = sessionWith(draft);
    const s = sessionWith(draft, {
      agent_v2: {
        ...base.agent_v2!,
        stall_offer_pending: true,
      },
    });
    const gate = canFreezeSessionOnSufficiency({
      session: s,
      trigger: "pre_delivery_safety",
    });
    assert.equal(gate.allowed, false);
    assert.equal(gate.reason, "stall_or_degraded_path");
  });

  await check("S5: purchase/CTA flag blocks freeze", () => {
    const gate = canFreezeSessionOnSufficiency({
      session: sessionWith(draft),
      trigger: "pre_delivery_safety",
      from_purchase_or_report_cta: true,
    });
    assert.equal(gate.allowed, false);
    assert.equal(gate.reason, "purchase_or_cta_path");
  });

  await check("S5: sufficiency freezes draft → final + binding", () => {
    const s = sessionWith(draft);
    const result = applySufficiencyFreezeToSession(s, {
      now: "2026-11-03T20:10:00.000Z",
    });
    assert.equal(result.ok, true);
    assert.equal("skipped" in result && result.skipped, false);
    if (!result.ok || ("skipped" in result && result.skipped)) {
      throw new Error("expected freeze");
    }
    assert.equal(result.session.decision_context?.status, "final");
    assert.ok(result.pack.binding.context_hash);
    assert.equal(
      result.pack.binding.context_hash,
      result.session.decision_context?.content_hash,
    );
  });

  await check("S5: already frozen skips idempotently", () => {
    const pack = freezeDraftForDelivery(draft, {
      session: sessionWith(draft),
      now: "2026-11-03T20:10:00.000Z",
    });
    const s = sessionWith(pack.frozen, {
      decision_context_versions: [pack.version_snapshot],
    });
    const result = applySufficiencyFreezeToSession(s);
    assert.equal(result.ok, true);
    assert.equal("skipped" in result && result.skipped, true);
    if (!result.ok || !("skipped" in result) || !result.skipped) {
      throw new Error("expected skip");
    }
    assert.equal(result.reason, "already_frozen");
  });

  await check("S5: legacy session without DC does not require DC", () => {
    assert.equal(
      shouldRequireFrozenDecisionContext({
        sessionHasDecisionContext: false,
        sessionHasFrozenDc: false,
        envEnabled: true,
      }),
      false,
    );
  });

  await check("S5: frozen DC session always requires binding", () => {
    assert.equal(
      shouldRequireFrozenDecisionContext({
        sessionHasDecisionContext: true,
        sessionHasFrozenDc: true,
        envEnabled: false,
      }),
      true,
    );
  });

  await check("S5: resolveDeliveryDcPayload after freeze", () => {
    const pack = freezeDraftForDelivery(draft, {
      session: sessionWith(draft),
      now: "2026-11-03T20:10:00.000Z",
    });
    const s = sessionWith(pack.frozen, {
      decision_context_versions: [pack.version_snapshot],
    });
    const payload = resolveDeliveryDcPayload(s);
    assert.equal(payload.require_decision_context, true);
    assert.ok(payload.binding);
    assert.equal(payload.binding?.context_hash, pack.binding.context_hash);
    assert.ok(payload.snapshot);
  });

  await check("S6: observation layers present", () => {
    const obs = buildLabObservation({
      stage: "v3:body",
      step_key: "05.body",
      page: "05",
      session_id: "sess_s5",
      lab_id: "lab_1",
      call_trace: {
        phase: "content_body_v3",
        system: "sys",
        user: "Formal Decision Context\nhello",
        user_feed: "## Formal Decision Context\n{}",
        reasoning: null,
        raw_text: '{"page":"05"}',
        parsed: { page: "05" },
        meta: {
          actual_model: "test-model",
          generation_id: "gen_1",
          latency_ms: 12,
          finish_reason: "stop",
        },
      },
      input_payload: { key: "05", decision_context_feed_present: true },
      processing_actions: [{ action: "runContentBodyGenerate", detail: "ok" }],
      gate_verdict: { passed: true },
      output_to_next_stage: { page: "05" },
      context_binding: {
        context_id: "dc_s5",
        context_version: 1,
        context_hash: "a".repeat(64),
      },
      has_context_snapshot: true,
      dc_feed_injected: true,
    });
    assert.equal(obs.stage, "v3:body");
    assert.equal(obs.prompt?.has_formal_dc, true);
    assert.equal(obs.context?.binding?.context_id, "dc_s5");
    assert.equal(obs.response?.parsed_present, true);
    assert.equal(obs.validation?.passed, true);
    assert.equal(obs.render?.preview_kind, "output_to_next_stage");
    assert.ok((obs.transform?.length ?? 0) >= 1);
  });

  console.log(`\nResults: PASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
