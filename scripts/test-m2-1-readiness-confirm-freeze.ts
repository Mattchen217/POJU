/**
 * M2.1 — Readiness → user confirm → Freeze (real production entry E2E)
 * plus promotion-contract regressions (Max REQUEST CHANGES).
 *
 *   pnpm test:m2-1-readiness-confirm-freeze
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";

installIntakeR6TestGlobals("dev_m21_confirm_freeze");
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0),
  configurable: true,
  writable: true,
});

let passed = 0;
let failed = 0;

async function check(label: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${label}`);
    console.error(e);
  }
}

async function main() {
  console.log("M2.1 readiness confirm → Freeze + promotion contract");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession, savePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { handleUserMessage } = await import("../lib/poju/agent");
  const { evaluateDecisionSufficiency } = await import(
    "../lib/poju/decision-context/stop-criteria"
  );
  const { confirmUnderstandingAndFreeze } = await import(
    "../lib/poju/decision-intake/confirm-and-freeze"
  );
  const { buildRealityFact } = await import(
    "../lib/poju/decision-context/fact-combination"
  );
  const { createInitialAgentState } = await import("../lib/poju/agent-state");

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  type POJUSessionState = import("../lib/poju/types").POJUSessionState;
  type DecisionContext = import("../lib/poju/decision-context/types").DecisionContext;
  type DIR = import("../lib/poju/decision-context/types").DIR;
  type RealityFact = import("../lib/poju/decision-context/types").RealityFact;
  type Constraint = import("../lib/poju/decision-context/types").Constraint;

  async function durable(sid: string): Promise<POJUSessionState> {
    const s = await loadPOJUSession(sid);
    assert.ok(s, `missing ${sid}`);
    return s;
  }

  const lastAssistant = (s: POJUSessionState) => {
    const a = [...s.messages].reverse().find((m) => m.role === "assistant");
    assert.ok(a, "assistant message missing");
    return a!;
  };

  let stubResponse = "MODEL FREEFORM MUST NEVER REACH USER";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url !== "/api/poju/chat") throw new Error(`unexpected fetch: ${url}`);
    return new Response(
      JSON.stringify({
        response: stubResponse,
        collection_progress: "advancing",
        question_status: "asked",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const nowIso = "2026-11-08T19:00:00.000Z";

  function starterDirs(): DIR[] {
    const mk = (
      dir_id: string,
      role: string,
      may_affect_p5_ranking: boolean,
    ): DIR => ({
      dir_id,
      need: dir_id,
      why: dir_id,
      required_fact_roles: [role],
      current_state: "unknown",
      partial_satisfaction: false,
      agenda_item_ids: [],
      may_affect_p5_ranking,
      id_lifecycle: "active",
    });
    return [
      mk("dir_options", "option", true),
      mk("dir_status_quo", "status_quo", true),
      mk("dir_hard_constraint", "hard_constraint", true),
      mk("dir_risk", "risk", false),
    ];
  }

  function readyUnderstanding(session_id: string, context_id: string) {
    return {
      understanding_id: `u_${session_id}`,
      session_id,
      context_id,
      context_version: 1,
      blueprint_version: 1,
      built_at: nowIso,
      current_understanding: {
        summary: "test",
        decision_question: "q",
        confirmed_briefs: [],
        unconfirmed_briefs: [],
        analysis_briefs: [],
        conflict_briefs: [],
        confidence: "medium" as const,
      },
      understood: { items: [] },
      need_to_understand: { items: [] },
      readiness: {
        verdict: "ready_for_final_confirm" as const,
        can_ask: false,
        reasons: ["test_ready"],
      },
      next_question_plan: null,
      last_sent_question: null,
      last_answer_event_id: null,
      personal_pattern_insight: {
        status: "unavailable" as const,
        reason: "test",
        insights: [],
      },
      budget: {
        soft_budget_limit: 12,
        hard_budget_limit: 20,
        session_asked_count: 3,
        review_cycle: 0,
        cycle_base_asked: 0,
        remaining_hard_budget: 17,
        depth_by_dir: {},
      },
    };
  }

  function baseDc(
    context_id: string,
    facts: RealityFact[],
    constraints: Constraint[] = [],
  ): DecisionContext {
    return {
      context_id,
      version: 1,
      status: "draft",
      definition: {
        concrete_event: null,
        stakes: null,
        desired_outcome: null,
        decision_question: "q",
        goal_priorities: [],
        unacceptable_outcomes: [],
      },
      reality_facts: facts,
      constraints,
      hypotheses: [],
      conflicts: [],
      dirs: starterDirs(),
      information_boundaries: [],
      explicit_na_evidence: [],
      content_hash: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
  }

  async function craftReadySession(input: {
    payment_id: string;
    facts: RealityFact[];
    constraints?: Constraint[];
  }): Promise<POJUSessionState> {
    const sid = await createPOJUSession({
      payment_id: input.payment_id,
      original_question: "contract test",
    });
    const base = await durable(sid);
    const dc = baseDc(`dc_${sid}`, input.facts, input.constraints ?? []);
    const messages = [
      ...base.messages,
      {
        role: "user" as const,
        content: "asserted source",
        timestamp: nowIso,
        client_id: "turn_asserted",
      },
      {
        role: "user" as const,
        content: "estimate source",
        timestamp: nowIso,
        client_id: "turn_estimate",
      },
      {
        role: "user" as const,
        content: "constraint source",
        timestamp: nowIso,
        client_id: "turn_constraint",
      },
      {
        role: "user" as const,
        content: "确认",
        timestamp: nowIso,
        client_id: "turn_confirm",
      },
    ];
    const agent = createInitialAgentState({ original_question: "contract test" });
    const session: POJUSessionState = {
      ...base,
      messages,
      decision_context: dc,
      decision_context_versions: [],
      confirmation_events: [],
      decision_understanding: readyUnderstanding(sid, dc.context_id) as POJUSessionState["decision_understanding"],
      agent_v2: {
        ...agent,
        current_phase: "awaiting_confirmation",
        stall_offer_pending: false,
      },
    };
    await savePOJUSession(session);
    return durable(sid);
  }

  try {
    await check("M21-static agent wires confirmUnderstandingAndFreeze", async () => {
      const src = readFileSync(join(process.cwd(), "lib/poju/agent.ts"), "utf8");
      assert.match(src, /confirmUnderstandingAndFreeze/);
      assert.match(src, /M2\.1/);
      assert.match(src, /m21_readiness_stop|awaiting_confirmation/);
      const mod = readFileSync(
        join(process.cwd(), "lib/poju/decision-intake/confirm-and-freeze.ts"),
        "utf8",
      );
      assert.match(mod, /ensureSessionFrozenForDelivery/);
      assert.match(mod, /evaluateDecisionSufficiency/);
      assert.match(mod, /deriveUserConfirmedFromEvents/);
      assert.match(mod, /missing_source_turn_id/);
      assert.doesNotMatch(mod, /current_state:\s*"known"/);
      assert.doesNotMatch(
        mod,
        /verification_level === "user_estimate" \? "user_asserted"/,
      );
    });

    await check("M21-C1 estimate stays unverified + user_estimate after confirm", async () => {
      const session = await craftReadySession({
        payment_id: "pay_m21_c1",
        facts: [
          buildRealityFact({
            fact_id: "fact_estimate",
            statement: "大概有三成把握",
            status: "unverified",
            verification_level: "user_estimate",
            source_stage: "collecting",
            source_turn_id: "turn_estimate",
            fact_roles: ["risk"],
            related_dir_ids: ["dir_risk"],
          }),
          buildRealityFact({
            fact_id: "fact_asserted",
            statement: "桌上选项是留任或创业",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["option"],
            related_dir_ids: ["dir_options"],
          }),
        ],
      });
      const result = await confirmUnderstandingAndFreeze({
        session,
        statement: "确认",
        confirmation_turn_id: "turn_confirm",
        now: nowIso,
      });
      const outEst = result.session.decision_context!.reality_facts.find(
        (f) => f.fact_id === "fact_estimate",
      )!;
      assert.equal(outEst.status, "unverified");
      assert.equal(outEst.verification_level, "user_estimate");
      assert.equal(outEst.user_confirmed, false);
      const outAs = result.session.decision_context!.reality_facts.find(
        (f) => f.fact_id === "fact_asserted",
      )!;
      assert.equal(outAs.status, "confirmed");
      assert.equal(outAs.verification_level, "user_asserted");
      assert.equal(outAs.user_confirmed, true);
    });

    await check("M21-C2 user_asserted + constraint promote with Confirmation Events", async () => {
      const session = await craftReadySession({
        payment_id: "pay_m21_c2",
        facts: [
          buildRealityFact({
            fact_id: "fact_ok",
            statement: "现状是大厂稳定工作",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["status_quo"],
            related_dir_ids: ["dir_status_quo"],
          }),
          buildRealityFact({
            fact_id: "fact_opt",
            statement: "选项：留任 / 创业",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["option"],
            related_dir_ids: ["dir_options"],
          }),
          buildRealityFact({
            fact_id: "fact_hc",
            statement: "硬约束：学费不能断",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_constraint",
            fact_roles: ["hard_constraint"],
            related_dir_ids: ["dir_hard_constraint"],
          }),
        ],
        constraints: [
          {
            constraint_id: "c_hard",
            statement: "存款只够六个月",
            category: "financial",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_constraint",
            rigidity: "hard",
            user_confirmed: false,
            related_dir_ids: ["dir_hard_constraint"],
            updated_at: nowIso,
          },
        ],
      });
      const result = await confirmUnderstandingAndFreeze({
        session,
        statement: "确认",
        confirmation_turn_id: "turn_confirm",
        now: nowIso,
      });
      const fact = result.session.decision_context!.reality_facts.find(
        (f) => f.fact_id === "fact_ok",
      )!;
      assert.equal(fact.status, "confirmed");
      assert.equal(fact.verification_level, "user_asserted");
      assert.equal(fact.user_confirmed, true);
      assert.ok(
        (result.session.confirmation_events ?? []).some(
          (e) => e.target_type === "fact" && e.fact_id === "fact_ok",
        ),
      );
      const constraint = result.session.decision_context!.constraints.find(
        (c) => c.constraint_id === "c_hard",
      )!;
      assert.equal(constraint.status, "confirmed");
      assert.equal(constraint.user_confirmed, true);
      assert.ok(
        (result.session.confirmation_events ?? []).some(
          (e) =>
            e.target_type === "constraint" && e.constraint_id === "c_hard",
        ),
      );
    });

    await check("M21-C3 missing source_turn_id → fail-closed, not user_confirmed", async () => {
      const orphan = {
        ...buildRealityFact({
          fact_id: "fact_orphan",
          statement: "无来源陈述",
          status: "unverified",
          verification_level: "user_asserted",
          source_stage: "collecting",
          source_turn_id: "turn_asserted",
          fact_roles: ["option"],
          related_dir_ids: ["dir_options"],
        }),
        source_turn_id: "",
      };
      const good = buildRealityFact({
        fact_id: "fact_good",
        statement: "有来源",
        status: "unverified",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "turn_asserted",
        fact_roles: ["status_quo"],
        related_dir_ids: ["dir_status_quo"],
      });
      const session = await craftReadySession({
        payment_id: "pay_m21_c3",
        facts: [orphan, good],
      });
      const beforeJson = JSON.stringify(session.decision_context);
      const result = await confirmUnderstandingAndFreeze({
        session,
        statement: "确认",
        confirmation_turn_id: "turn_confirm",
        now: nowIso,
      });
      assert.equal(result.outcome, "promote_failed");
      assert.match(result.error ?? "", /missing_source_turn_id/);
      assert.equal(result.promoted_fact_ids.length, 0);
      assert.equal(JSON.stringify(result.session.decision_context), beforeJson);
      assert.equal(
        result.session.decision_context!.reality_facts.find(
          (f) => f.fact_id === "fact_orphan",
        )!.user_confirmed,
        false,
      );
      assert.equal((result.session.confirmation_events ?? []).length, 0);
    });

    await check("M21-C4 independently_verified / declined / unknown never promote", async () => {
      const session = await craftReadySession({
        payment_id: "pay_m21_c4",
        facts: [
          buildRealityFact({
            fact_id: "fact_iv",
            statement: "独立核验",
            status: "confirmed",
            verification_level: "independently_verified",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["option"],
            related_dir_ids: ["dir_options"],
          }),
          buildRealityFact({
            fact_id: "fact_declined",
            statement: "拒答",
            status: "declined",
            verification_level: "none",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["status_quo"],
            related_dir_ids: ["dir_status_quo"],
          }),
          buildRealityFact({
            fact_id: "fact_unknown",
            statement: "未知",
            status: "unknown",
            verification_level: "none",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["hard_constraint"],
            related_dir_ids: ["dir_hard_constraint"],
          }),
        ],
      });
      const result = await confirmUnderstandingAndFreeze({
        session,
        statement: "确认",
        confirmation_turn_id: "turn_confirm",
        now: nowIso,
      });
      const outIv = result.session.decision_context!.reality_facts.find(
        (f) => f.fact_id === "fact_iv",
      )!;
      assert.equal(outIv.verification_level, "independently_verified");
      assert.equal(outIv.user_confirmed, false);
      assert.equal(
        result.session.decision_context!.reality_facts.find(
          (f) => f.fact_id === "fact_declined",
        )!.status,
        "declined",
      );
      assert.equal(
        result.session.decision_context!.reality_facts.find(
          (f) => f.fact_id === "fact_unknown",
        )!.status,
        "unknown",
      );
      assert.equal((result.session.confirmation_events ?? []).length, 0);
    });

    await check("M21-C5 every user_confirmed fact/constraint has Confirmation Event", async () => {
      const session = await craftReadySession({
        payment_id: "pay_m21_c5",
        facts: [
          buildRealityFact({
            fact_id: "fact_a",
            statement: "选项A",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["option"],
            related_dir_ids: ["dir_options"],
          }),
          buildRealityFact({
            fact_id: "fact_b",
            statement: "现状B",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["status_quo"],
            related_dir_ids: ["dir_status_quo"],
          }),
          buildRealityFact({
            fact_id: "fact_c",
            statement: "约束事实C",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_constraint",
            fact_roles: ["hard_constraint"],
            related_dir_ids: ["dir_hard_constraint"],
          }),
        ],
        constraints: [
          {
            constraint_id: "c_a",
            statement: "硬约束A",
            category: "financial",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_constraint",
            rigidity: "hard",
            user_confirmed: false,
            related_dir_ids: ["dir_hard_constraint"],
            updated_at: nowIso,
          },
        ],
      });
      const result = await confirmUnderstandingAndFreeze({
        session,
        statement: "确认",
        confirmation_turn_id: "turn_confirm",
        now: nowIso,
      });
      const events = result.session.confirmation_events ?? [];
      for (const f of result.session.decision_context!.reality_facts) {
        if (f.user_confirmed !== true) continue;
        assert.ok(
          events.some((e) => e.target_type === "fact" && e.fact_id === f.fact_id),
          `fact ${f.fact_id} user_confirmed without event`,
        );
      }
      for (const c of result.session.decision_context!.constraints) {
        if (c.user_confirmed !== true) continue;
        assert.ok(
          events.some(
            (e) =>
              e.target_type === "constraint" && e.constraint_id === c.constraint_id,
          ),
          `constraint ${c.constraint_id} user_confirmed without event`,
        );
      }
    });

    await check("M21-C6 repeat confirm does not duplicate events or versions", async () => {
      let session = await craftReadySession({
        payment_id: "pay_m21_c6",
        facts: [
          buildRealityFact({
            fact_id: "fact_r1",
            statement: "选项",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["option"],
            related_dir_ids: ["dir_options"],
          }),
          buildRealityFact({
            fact_id: "fact_r2",
            statement: "现状",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["status_quo"],
            related_dir_ids: ["dir_status_quo"],
          }),
          buildRealityFact({
            fact_id: "fact_r3",
            statement: "硬约束事实",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_constraint",
            fact_roles: ["hard_constraint"],
            related_dir_ids: ["dir_hard_constraint"],
          }),
        ],
      });
      const first = await confirmUnderstandingAndFreeze({
        session,
        statement: "确认",
        confirmation_turn_id: "turn_confirm",
        now: nowIso,
      });
      const events1 = first.session.confirmation_events ?? [];
      const version1 = first.session.decision_context!.version;
      assert.ok(events1.length >= 1);

      const dc = first.session.decision_context!;
      session = {
        ...first.session,
        messages: [
          ...first.session.messages,
          {
            role: "user",
            content: "确认",
            timestamp: nowIso,
            client_id: "turn_confirm_2",
          },
        ],
        decision_context:
          dc.status === "final"
            ? { ...dc, status: "draft", content_hash: undefined }
            : dc,
        decision_understanding: readyUnderstanding(
          first.session.session_id,
          dc.context_id,
        ) as POJUSessionState["decision_understanding"],
      };
      await savePOJUSession(session);
      session = await durable(session.session_id);

      const second = await confirmUnderstandingAndFreeze({
        session,
        statement: "确认",
        confirmation_turn_id: "turn_confirm_2",
        now: nowIso,
      });
      const events2 = second.session.confirmation_events ?? [];
      assert.equal(events2.length, events1.length);
      assert.equal(second.session.decision_context!.version, version1);
    });

    await check("M21-C7 event provenance failure → fail-closed, no partial state", async () => {
      const session = await craftReadySession({
        payment_id: "pay_m21_c7",
        facts: [
          buildRealityFact({
            fact_id: "fact_bad_src",
            statement: "坏来源",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_does_not_exist",
            fact_roles: ["option"],
            related_dir_ids: ["dir_options"],
          }),
          buildRealityFact({
            fact_id: "fact_good2",
            statement: "好来源",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            fact_roles: ["status_quo"],
            related_dir_ids: ["dir_status_quo"],
          }),
        ],
      });
      const before = JSON.stringify({
        dc: session.decision_context,
        events: session.confirmation_events ?? [],
      });
      const result = await confirmUnderstandingAndFreeze({
        session,
        statement: "确认",
        confirmation_turn_id: "turn_confirm",
        now: nowIso,
      });
      assert.equal(result.outcome, "promote_failed");
      assert.equal(result.promoted_fact_ids.length, 0);
      assert.equal(
        JSON.stringify({
          dc: result.session.decision_context,
          events: result.session.confirmation_events ?? [],
        }),
        before,
      );
    });

    await check("M21-C8 insufficient sufficiency → cannot Freeze; can continue collecting", async () => {
      const session = await craftReadySession({
        payment_id: "pay_m21_c8",
        facts: [
          buildRealityFact({
            fact_id: "fact_only_est",
            statement: "大概吧",
            status: "unverified",
            verification_level: "user_estimate",
            source_stage: "collecting",
            source_turn_id: "turn_estimate",
            fact_roles: ["option"],
            related_dir_ids: ["dir_options"],
          }),
        ],
      });
      const result = await confirmUnderstandingAndFreeze({
        session,
        statement: "确认",
        confirmation_turn_id: "turn_confirm",
        now: nowIso,
      });
      assert.equal(result.outcome, "not_sufficient_after_confirm");
      assert.equal(result.sufficiency_can_stop, false);
      assert.notEqual(result.session.decision_context!.status, "final");
      assert.equal(
        result.session.decision_context!.reality_facts[0]!.status,
        "unverified",
      );
      assert.equal(
        result.session.decision_context!.reality_facts[0]!.verification_level,
        "user_estimate",
      );
      assert.equal(result.session.agent_v2?.current_phase, "collecting_context");
      assert.equal(result.session.decision_understanding?.readiness.can_ask, true);
    });

    // ---------- Production entry E2E ----------

    let sid = "";
    let session: POJUSessionState | null = null;

    await check("M21-01 fresh session → adaptive first Q", async () => {
      sid = await createPOJUSession({
        payment_id: "pay_m21_01",
        original_question: "要不要离职去创业？",
      });
      const before = await durable(sid);
      assert.equal(before.decision_context ?? null, null);

      stubResponse = "FREEFORM_BOOT";
      const out = await handleUserMessage({
        session: before,
        userMessage: "我在犹豫要不要离职去创业，家里还有贷款和孩子。",
        locale: "zh",
      });
      await savePOJUSession(out);
      session = await durable(sid);

      assert.ok(session.decision_context);
      assert.equal(session.decision_context!.status, "draft");
      assert.ok(session.decision_blueprint);
      assert.ok(session.adaptive_ask_plan);
      assert.equal(lastAssistant(session).content, session.adaptive_ask_plan!.question_text);
      assert.notEqual(lastAssistant(session).content, stubResponse);
    });

    await check("M21-02 answer until readiness ready_for_final_confirm (no forged known)", async () => {
      assert.ok(session);
      const answers = [
        "目前桌上真实选项是：留任、内部转岗、出去创业做咨询。",
        "现状是大厂稳定工作，月薪足够但成长停滞，房贷按月在还。",
        "硬约束是存款只够撑六个月，孩子学费不能断，父母需要照顾。",
        "风险上最多能接受收入腰斩一年，再差就会回撤。",
        "补充：如果创业，方向是企业咨询，已有两个潜在客户意向。",
        "补充：转岗的机会大概在下个季度评估窗口。",
      ];
      let guard = 0;
      while (
        session!.decision_understanding?.readiness.can_ask !== false &&
        guard < 12
      ) {
        const msg =
          answers[guard] ??
          `继续补充第${guard + 1}点：我会按事实回答当前问题，尽量具体可核验。`;
        guard += 1;
        stubResponse = `FREEFORM_${guard}`;
        for (const d of session!.decision_context!.dirs) {
          if (d.may_affect_p5_ranking === false) continue;
          assert.notEqual(
            d.current_state,
            "known",
            `DIR ${d.dir_id} must not be known before user confirm (no forge)`,
          );
        }
        const out = await handleUserMessage({
          session: session!,
          userMessage: msg,
          locale: "zh",
        });
        await savePOJUSession(out);
        session = await durable(sid);
        if (lastAssistant(session).content.startsWith("FREEFORM_")) {
          assert.fail("freeform leaked to user");
        }
      }

      assert.ok(session!.decision_understanding);
      assert.equal(session!.decision_understanding!.readiness.can_ask, false);
      assert.ok(
        session!.decision_understanding!.readiness.verdict ===
          "ready_for_final_confirm" ||
          session!.decision_understanding!.readiness.verdict ===
            "hard_budget_exhausted",
      );
      assert.equal(session!.agent_v2?.current_phase, "awaiting_confirmation");
      assert.match(lastAssistant(session!).content, /理解确认|确认/);
      assert.equal(session!.decision_context!.status, "draft");
      const suf = evaluateDecisionSufficiency(session!.decision_context!);
      assert.equal(suf.canStop, false);
    });

    await check("M21-03 user 确认 → promote → Freeze final + hash + contract", async () => {
      assert.ok(session);
      stubResponse = "FREEFORM_CONFIRM_MUST_NOT_SHOW";
      assert.ok(session!.decision_context!.reality_facts.length >= 1);

      const estimatesBefore = session!.decision_context!.reality_facts.filter(
        (f) => f.verification_level === "user_estimate",
      );

      const out = await handleUserMessage({
        session: session!,
        userMessage: "确认",
        locale: "zh",
      });
      await savePOJUSession(out);
      session = await durable(sid);

      const asst = lastAssistant(session);
      assert.notEqual(asst.content, stubResponse);
      assert.match(asst.content, /已冻结|冻结/);

      const dc = session.decision_context!;
      assert.equal(dc.status, "final");
      assert.ok(dc.content_hash && dc.content_hash.length > 8);
      assert.ok(
        (session.decision_context_versions ?? []).some((v) => v.status === "final"),
      );

      const critical = dc.dirs.filter(
        (d) => d.id_lifecycle === "active" && d.may_affect_p5_ranking !== false,
      );
      for (const d of critical) {
        assert.ok(
          d.current_state === "known" || d.current_state === "n_a",
          `critical DIR ${d.dir_id} should be known|n_a after confirm, got ${d.current_state}`,
        );
      }

      assert.ok(dc.reality_facts.some((f) => f.status === "confirmed"));
      assert.ok((session.confirmation_events ?? []).length >= 1);

      for (const f of dc.reality_facts) {
        if (f.user_confirmed !== true) continue;
        assert.ok(
          (session.confirmation_events ?? []).some(
            (e) => e.target_type === "fact" && e.fact_id === f.fact_id,
          ),
          `user_confirmed fact ${f.fact_id} missing Confirmation Event`,
        );
        assert.notEqual(f.verification_level, "user_estimate");
        assert.notEqual(f.verification_level, "independently_verified");
      }
      for (const before of estimatesBefore) {
        const after = dc.reality_facts.find((f) => f.fact_id === before.fact_id);
        if (!after) continue;
        assert.equal(after.status, "unverified");
        assert.equal(after.verification_level, "user_estimate");
      }

      assert.equal(evaluateDecisionSufficiency(dc).canStop, true);
    });

    await check("M21-04 freeze is fail-closed without readiness", async () => {
      const sid2 = await createPOJUSession({
        payment_id: "pay_m21_04",
        original_question: "要不要换城市？",
      });
      let s2 = await durable(sid2);
      stubResponse = "FREEFORM_X";
      const boot = await handleUserMessage({
        session: s2,
        userMessage: "我在考虑要不要换到另一个城市工作。",
        locale: "zh",
      });
      await savePOJUSession(boot);
      s2 = await durable(sid2);
      assert.equal(s2.decision_context?.status, "draft");

      if (s2.decision_understanding?.readiness.can_ask === false) {
        console.log("    skipped — already ready after first turn");
        return;
      }
      const beforeStatus = s2.decision_context!.status;
      const out = await handleUserMessage({
        session: s2,
        userMessage: "确认",
        locale: "zh",
      });
      await savePOJUSession(out);
      s2 = await durable(sid2);
      assert.equal(s2.decision_context!.status, beforeStatus);
      assert.notEqual(s2.decision_context!.status, "final");
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log(`\nM2.1 result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
