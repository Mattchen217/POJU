/**
 * M1 — Production Adaptive Question Loop E2E (real production Agent path).
 * M2.4-R1-FU1: role authorization, conservative conflicts, Cases I–M + G/H.
 * M2.4-R1-FU2: formal Conflict Resolution wired into the production answer path (Cases N–T).
 * M2.4-R1-FU3: negation-safe choice parsing + C1 persist-failure rollback (Cases U–Y).
 * M2.4-R2-FU8: source-grounded model extractions, unresolved-aspect scheduling, goal_change / insight_mismatch control flow.
 * M2.4-R2-FU9: source-content equality, insight_mismatch clarification resolution, goal_change target extraction.
 *
 *   pnpm test:m1-production-adaptive-question-loop
 *
 * Uses handleUserMessage with /api/poju/chat fetch stub (deterministic adapter).
 * Stub goes through the real production chain; it does NOT bypass orchestration.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";

installIntakeR6TestGlobals("dev_m1_adaptive_loop");
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0),
  configurable: true,
  writable: true,
});

const NOW = "2026-11-08T12:00:00.000Z";
const REPO = process.cwd();

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
  console.log("M1 production adaptive question loop");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession, savePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { mutatePOJUSession } = await import("../lib/poju/session-mutation");
  const { handleUserMessage: handleUserMessageRaw } = await import("../lib/poju/agent");
  const { runCollectingDcTurn: runCollectingDcTurnRaw } = await import("../lib/poju/collecting-dc-turn");
  const { withDeterministicHandleHooks, mergeAnswerInterpretationTestHooks } = await import(
    "./fixtures/test-answer-interpretation-hook"
  );
  const handleUserMessage: typeof handleUserMessageRaw = (input) =>
    handleUserMessageRaw(withDeterministicHandleHooks(input));
  const runCollectingDcTurn: typeof runCollectingDcTurnRaw = (session, input) =>
    runCollectingDcTurnRaw(session, {
      ...input,
      test_hooks: mergeAnswerInterpretationTestHooks(input.test_hooks),
    });
  const { createInitialAgentState } = await import("../lib/poju/agent-state");
  const { createDefaultControlPlane } = await import(
    "../lib/poju/decision-context/control-plane"
  );
  const { ensureDecisionBlueprint } = await import(
    "../lib/poju/decision-intake/blueprint"
  );
  const { interpretUserAnswer, answerEventFromModelDraft, activeTargets } = await import(
    "../lib/poju/decision-intake/answer-interpretation"
  );
  const { applyAnswerEventToSessionDc } = await import(
    "../lib/poju/decision-intake/apply-answer-to-dc"
  );
  const { buildUnderstandingState } = await import(
    "../lib/poju/decision-intake/understanding-state"
  );
  const { generateQuestionText, buildAdaptiveQuestionPlan } = await import(
    "../lib/poju/decision-intake/question-generation"
  );
  const { SessionCasError, SESSION_CAS_CONFLICT } = await import(
    "../lib/poju/session-mutation"
  );
  type DecisionContext = import("../lib/poju/decision-context/types").DecisionContext;
  type POJUSessionState = import("../lib/poju/types").POJUSessionState;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  function draftDc(
    ctxId: string,
    dirs: DecisionContext["dirs"],
    definition?: Partial<DecisionContext["definition"]>,
  ): DecisionContext {
    return {
      context_id: ctxId,
      version: 1,
      status: "draft",
      definition: {
        concrete_event: definition?.concrete_event ?? "Career fork",
        stakes: definition?.stakes ?? "Income + family",
        desired_outcome: definition?.desired_outcome ?? null,
        decision_question: definition?.decision_question ?? "Should I leave my job?",
        goal_priorities: definition?.goal_priorities ?? [],
        unacceptable_outcomes: definition?.unacceptable_outcomes ?? [],
      },
      reality_facts: [],
      constraints: [],
      hypotheses: [],
      dirs,
      conflicts: [],
      content_hash: null,
      created_at: NOW,
      updated_at: NOW,
    };
  }

  function dir(
    dir_id: string,
    need: string,
    roles: string[],
    p5 = true,
  ): DecisionContext["dirs"][number] {
    return {
      dir_id,
      need,
      why: `Needed for ${dir_id}`,
      required_fact_roles: roles,
      current_state: "unknown",
      partial_satisfaction: false,
      agenda_item_ids: [],
      id_lifecycle: "active",
      may_affect_p5_ranking: p5,
    };
  }

  async function seedSession(
    tag: string,
    dirs: DecisionContext["dirs"],
    definition?: Partial<DecisionContext["definition"]>,
  ): Promise<string> {
    const sid = await createPOJUSession({
      payment_id: `pay_m1_${tag}`,
      original_question: definition?.decision_question ?? "Should I leave my job?",
    });
    await mutatePOJUSession(sid, {
      operation_id: `op_seed_m1_${tag}`,
      kind: "session_patch",
      bump_dc: true,
      apply: (latest): POJUSessionState => {
        const agent = createInitialAgentState({
          original_question: latest.original_question,
        });
        agent.current_phase = "collecting_context";
        agent.delivery_mode = "full";
        agent.stall_offer_pending = false;
        agent.core_dilemma = {
          concrete_event: definition?.concrete_event ?? "Offer vs job",
          stakes: definition?.stakes ?? "Income",
          sticking_point: "Uncertainty",
        };
        agent.desired_direction = {
          wants: "Keep optionality",
          priority: "reversibility",
        };
        const dc = draftDc(`dc_${sid}`, dirs, definition);
        const withBp = ensureDecisionBlueprint(
          {
            ...latest,
            has_profile: true,
            agent_v2: agent,
            control_plane: createDefaultControlPlane("collecting_context"),
            decision_context: dc,
          },
          { now: NOW },
        );
        return withBp.session;
      },
    });
    return sid;
  }

  async function durable(sid: string): Promise<POJUSessionState> {
    const s = await loadPOJUSession(sid);
    assert.ok(s, `missing ${sid}`);
    return s;
  }

  /** Persist an init_only plan as an actually-sent question (last_sent_question). */
  async function persistAttachedInitAsk(
    sid: string,
    operationId: string,
    sourceTurnId: string,
    initResult?: Awaited<ReturnType<typeof runCollectingDcTurn>>,
  ): Promise<POJUSessionState> {
    const seeded =
      initResult ??
      (await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: sourceTurnId,
        now: NOW,
        init_only: true,
      }));
    assert.ok(seeded.plan, `${operationId} first plan required`);
    const { attachAuthorizedAssistantQuestion } = await import(
      "../lib/poju/decision-intake/adaptive-turn"
    );
    const attached = attachAuthorizedAssistantQuestion(
      seeded.session,
      seeded.plan!,
      sourceTurnId,
    );
    await mutatePOJUSession(sid, {
      operation_id: operationId,
      kind: "session_patch",
      bump_dc: true,
      apply: () => attached,
    });
    return durable(sid);
  }

  const lastAssistant = (s: POJUSessionState) => {
    const a = [...s.messages].reverse().find((m) => m.role === "assistant");
    assert.ok(a, "assistant message missing");
    return a;
  };
  const lastUserId = (s: POJUSessionState) => {
    const u = [...s.messages].reverse().find((m) => m.role === "user");
    assert.ok(u?.client_id);
    return u!.client_id!;
  };

  // Deterministic LLM adapter — still through production handleUserMessage fetch path.
  let stubResponse = "MODEL FREEFORM QUESTION THAT SHOULD BE OVERRIDDEN";
  const fetchCalls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    fetchCalls.push(url);
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

  const jobDirs = [
    dir("DIR-OPT-ON-TABLE", "有哪些真实可选方案", ["option"]),
    dir("DIR-STATUS-QUO", "当前工作与生活基线", ["status_quo"]),
    dir("DIR-OPT-CONSTRAINTS", "硬性约束（钱/时间/责任）", ["hard_constraint"]),
    dir("DIR-RISK-TOLERANCE", "可承受的最差结果", ["risk"]),
  ];
  const moveDirs = [
    dir("DIR-LOCALE-MOVE", "搬迁目标城市与时机", ["option"]),
    dir("DIR-OPT-CONSTRAINTS", "搬迁相关硬约束", ["hard_constraint"]),
    dir("DIR-STAKEHOLDERS", "家庭利益相关方态度", ["stakeholder"]),
  ];

  try {
    // M1-01
    await check("M1-01 init Blueprint + first legal question", async () => {
      const sid = await seedSession("01", jobDirs, {
        decision_question: "要不要离职去创业？",
      });
      const before = await durable(sid);
      assert.ok(before.decision_blueprint);
      assert.ok(before.decision_blueprint!.directions.length >= 1);
      const init = await runCollectingDcTurn(before, {
        statement: "",
        source_turn_id: "init_01",
        now: NOW,
        init_only: true,
      });
      assert.equal(init.outcome, "dc_committed");
      assert.ok(init.plan, "first plan required");
      assert.ok(init.authorized_question);
      assert.ok(init.plan!.dir_ids.length >= 1);
      assert.ok(init.plan!.ddr_ids.length >= 1);
      assert.ok(init.understanding);
    });

    // M1-02 / M1-03
    let q1 = "";
    let sidTurn = "";
    await check("M1-02/03 first answer updates DC+Understanding; next Q from Need", async () => {
      sidTurn = await seedSession("02", jobDirs, {
        decision_question: "要不要离职去创业？",
      });
      // Seed an actually-sent question so answer authorization has last_sent_question.
      const before = await persistAttachedInitAsk(sidTurn, "op_m1_02_plan", "init_02");
      const beforeFacts = before.decision_context!.reality_facts.length;
      fetchCalls.length = 0;
      stubResponse = "IGNORE ME — ask something random about hobbies";
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前月薪大约 3 万，大概还能撑。",
        locale: "zh-CN",
      });
      assert.deepEqual(fetchCalls, ["/api/poju/chat"]);
      assert.ok(out.decision_context);
      assert.ok(out.decision_context!.reality_facts.length > beforeFacts);
      const fact = out.decision_context!.reality_facts.find(
        (f) => f.source_turn_id === lastUserId(out),
      );
      assert.ok(fact);
      assert.notEqual(fact!.status, "confirmed");
      assert.ok(out.decision_understanding);
      assert.ok(out.decision_understanding!.need_to_understand.items.length >= 1);
      const asst = lastAssistant(out);
      assert.ok(out.adaptive_ask_plan);
      assert.equal(asst.content, out.adaptive_ask_plan!.question_text);
      assert.notEqual(asst.content, stubResponse);
      q1 = asst.content;
      // Need ↔ plan DIR link
      const needDirs = new Set(
        out.decision_understanding!.need_to_understand.items
          .filter((n) => n.kind === "dir_based")
          .map((n) => n.dir_id),
      );
      for (const d of out.adaptive_ask_plan!.dir_ids) {
        assert.ok(needDirs.has(d) || out.decision_context!.dirs.some((x) => x.dir_id === d));
      }
      // Persist via CAS mutate so revision mirrors from C1 are respected.
      await mutatePOJUSession(sidTurn, {
        operation_id: "op_m1_02_save",
        kind: "session_patch",
        bump_dc: true,
        apply: () => out,
      });
    });

    // M1-04
    await check("M1-04 second answer changes understanding + different next Q", async () => {
      const before = await durable(sidTurn);
      stubResponse = "ANOTHER FREEFORM";
      const out = await handleUserMessage({
        session: before,
        userMessage: "硬约束是必须保留社保，预算不能低于现在的 70%。",
        locale: "zh-CN",
      });
      assert.ok(out.decision_understanding);
      assert.ok(out.adaptive_ask_plan);
      const q2 = lastAssistant(out).content;
      assert.equal(q2, out.adaptive_ask_plan!.question_text);
      // DC must absorb the second answer (facts and/or constraints).
      const dcGrew =
        out.decision_context!.reality_facts.length >
          before.decision_context!.reality_facts.length ||
        out.decision_context!.constraints.length >
          before.decision_context!.constraints.length;
      assert.equal(dcGrew, true, "second answer must write DC");
      assert.notEqual(
        out.decision_understanding!.last_answer_event_id,
        before.decision_understanding!.last_answer_event_id,
      );
      assert.ok(out.decision_understanding!.built_at >= before.decision_understanding!.built_at);
      // Plan must remain authorized from latest state (not a fixed script).
      assert.ok(out.adaptive_ask_plan!.plan_id);
      assert.ok(out.adaptive_ask_plan!.dir_ids.length >= 1);
      const sameQ = q2 === q1;
      if (sameQ) {
        assert.ok(
          (out.adaptive_ask_plan!.depth ?? 0) >=
            (before.adaptive_ask_plan?.depth ?? 0) ||
            out.adaptive_ask_plan!.candidate_id !==
              before.adaptive_ask_plan?.candidate_id ||
            JSON.stringify(out.decision_understanding!.need_to_understand.items) !==
              JSON.stringify(before.decision_understanding!.need_to_understand.items),
          "second turn must recompute plan/need even if question phrasing matches",
        );
      } else {
        assert.notEqual(q2, q1);
      }
      await mutatePOJUSession(sidTurn, {
        operation_id: "op_m1_04_save",
        kind: "session_patch",
        bump_dc: true,
        apply: () => out,
      });
    });

    // M1-05
    await check("M1-05 different decision contexts → different paths", async () => {
      const a = await seedSession("05a", jobDirs, {
        decision_question: "要不要接受创业邀请？",
      });
      const b = await seedSession("05b", moveDirs, {
        decision_question: "要不要搬去另一个城市？",
        concrete_event: "City move",
      });
      const pa = await runCollectingDcTurn(await durable(a), {
        statement: "",
        source_turn_id: "init_a",
        now: NOW,
        init_only: true,
      });
      const pb = await runCollectingDcTurn(await durable(b), {
        statement: "",
        source_turn_id: "init_b",
        now: NOW,
        init_only: true,
      });
      assert.ok(pa.plan && pb.plan);
      const bpa = pa.session.decision_blueprint!;
      const bpb = pb.session.decision_blueprint!;
      // Scopes differ by seeded Catalog-validated DIR sets (job vs move).
      assert.notDeepEqual(
        [...bpa.dir_ids].sort(),
        [...bpb.dir_ids].sort(),
        "Blueprint DIR scopes must differ across decision contexts",
      );
      assert.ok(bpa.dir_ids.includes("DIR-OPT-ON-TABLE"));
      assert.ok(bpb.dir_ids.includes("DIR-LOCALE-MOVE"));
      assert.ok(
        pa.plan!.candidate_id !== pb.plan!.candidate_id ||
          JSON.stringify(pa.plan!.dir_ids) !== JSON.stringify(pb.plan!.dir_ids) ||
          pa.authorized_question !== pb.authorized_question ||
          JSON.stringify([...bpa.dir_ids].sort()) !==
            JSON.stringify([...bpb.dir_ids].sort()),
        "different decision contexts must diverge in plan and/or Blueprint scope",
      );
    });

    // M1-06
    await check("M1-06 sent question traces Plan/Direction/DDR/DIR", async () => {
      const sid = await seedSession("06", jobDirs);
      await persistAttachedInitAsk(sid, "op_m1_06", "init_06");
      const out = await handleUserMessage({
        session: await durable(sid),
        userMessage: "可选方案是留任、内部转岗、或外部创业。",
        locale: "zh-CN",
      });
      const plan = out.adaptive_ask_plan!;
      assert.ok(plan.plan_id);
      assert.ok(plan.direction_id);
      assert.ok(plan.ddr_ids.length);
      assert.ok(plan.dir_ids.length);
      assert.equal(lastAssistant(out).content, plan.question_text);
      assert.equal(
        out.decision_understanding!.last_sent_question?.question_text,
        plan.question_text,
      );
    });

    // M1-07
    await check("M1-07 estimate/unknown/declined not promoted to confirmed", async () => {
      const sid = await seedSession("07", jobDirs);
      await persistAttachedInitAsk(sid, "op_m1_07", "init_07");
      const cases: Array<{ msg: string; expectStatus: string; expectVer?: string }> = [
        { msg: "大概还有四个月存款。", expectStatus: "unverified", expectVer: "user_estimate" },
        { msg: "不知道", expectStatus: "unknown", expectVer: "none" },
        { msg: "不想说", expectStatus: "declined", expectVer: "none" },
      ];
      let session = await durable(sid);
      for (const c of cases) {
        // Force fresh turn ids via handleUserMessage
        session = await handleUserMessage({
          session,
          userMessage: c.msg,
          locale: "zh-CN",
        });
        const turnId = lastUserId(session);
        const fact = session.decision_context!.reality_facts.find(
          (f) => f.source_turn_id === turnId,
        );
        assert.ok(fact, `fact for ${c.msg}`);
        assert.equal(fact!.status, c.expectStatus);
        if (c.expectVer) assert.equal(fact!.verification_level, c.expectVer);
        assert.equal(fact!.user_confirmed, false);
        assert.notEqual(fact!.status, "confirmed");
      }
    });

    // M1-08
    await check("M1-08 completed DIR not re-asked", async () => {
      const sid = await seedSession("08", [
        dir("DIR-OPT-ON-TABLE", "选项", ["option"]),
        dir("DIR-RISK-TOLERANCE", "风险", ["risk"]),
      ]);
      // Mark first DIR known with evidence roles satisfied via adaptive writes + manual state
      let s = await durable(sid);
      const init = await runCollectingDcTurn(s, {
        statement: "",
        source_turn_id: "init_08",
        now: NOW,
        init_only: true,
      });
      s = init.session;
      // Force DIR-OPT-ON-TABLE known
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          dirs: s.decision_context!.dirs.map((d) =>
            d.dir_id === "DIR-OPT-ON-TABLE"
              ? { ...d, current_state: "known" as const }
              : d,
          ),
        },
      };
      const planned = await runCollectingDcTurn(s, {
        statement: "",
        source_turn_id: "init_08b",
        now: NOW,
        init_only: true,
      });
      assert.ok(planned.plan);
      assert.ok(!planned.plan!.dir_ids.includes("DIR-OPT-ON-TABLE"));
      assert.ok(planned.plan!.dir_ids.includes("DIR-RISK-TOLERANCE"));
    });

    // M1-09
    await check("M1-09 out-of-scope plan rejected by scope validation", async () => {
      const { validateScopeDepthBudget } = await import(
        "../lib/poju/decision-intake/scope-budget"
      );
      const sid = await seedSession("09", jobDirs);
      const s = await durable(sid);
      const bp = s.decision_blueprint!;
      const verdict = validateScopeDepthBudget({
        blueprint: bp,
        plan: {
          dir_ids: ["DIR-NOT-IN-BLUEPRINT"],
          ddr_ids: ["DDR_X"],
          direction_id: "DIRN-DEFINITION",
          depth: 1,
          budget_cost: 1,
          gate_class: "P0",
        },
        budget: {
          soft_budget_limit: 12,
          hard_budget_limit: 15,
          session_asked_count: 0,
          review_cycle: 1,
          cycle_base_asked: 0,
          remaining_hard_budget: 15,
          depth_by_dir: {},
        },
      });
      assert.equal(verdict.ok, false);
      if (!verdict.ok) assert.equal(verdict.reason_code, "dir_out_of_blueprint_scope");
    });

    // M1-10
    await check("M1-10 depth/budget hard cap enforced", async () => {
      const { validateScopeDepthBudget } = await import(
        "../lib/poju/decision-intake/scope-budget"
      );
      const sid = await seedSession("10", jobDirs);
      const bp = (await durable(sid)).decision_blueprint!;
      const dirId = bp.dir_ids[0]!;
      const direction = bp.directions.find((d) => d.dir_ids.includes(dirId))!;
      const depthFail = validateScopeDepthBudget({
        blueprint: bp,
        plan: {
          dir_ids: [dirId],
          ddr_ids: ["DDR-01-PRIMARY"],
          direction_id: direction.direction_id,
          depth: 99,
          budget_cost: 1,
          gate_class: "P0",
        },
        budget: {
          soft_budget_limit: 12,
          hard_budget_limit: 15,
          session_asked_count: 0,
          review_cycle: 1,
          cycle_base_asked: 0,
          remaining_hard_budget: 15,
          depth_by_dir: { [dirId]: 3 },
        },
      });
      assert.equal(depthFail.ok, false);
      const hardFail = validateScopeDepthBudget({
        blueprint: bp,
        plan: {
          dir_ids: [dirId],
          ddr_ids: ["DDR-01-PRIMARY"],
          direction_id: direction.direction_id,
          depth: 1,
          budget_cost: 1,
          gate_class: "P0",
        },
        budget: {
          soft_budget_limit: 12,
          hard_budget_limit: 15,
          session_asked_count: 15,
          review_cycle: 1,
          cycle_base_asked: 0,
          remaining_hard_budget: 0,
          depth_by_dir: {},
        },
      });
      assert.equal(hardFail.ok, false);
    });

    // M1-11
    await check("M1-11 Readiness stops questions when dirs known", async () => {
      const sid = await seedSession("11", [
        dir("DIR-OPT-ON-TABLE", "选项", ["option"]),
      ]);
      let s = await durable(sid);
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            {
              fact_id: "f_ready",
              statement: "Options listed",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "collecting",
              source_turn_id: "t_ready",
              user_confirmed: false,
              fact_roles: ["option"],
              related_dir_ids: ["DIR-OPT-ON-TABLE"],
            },
          ],
          dirs: s.decision_context!.dirs.map((d) => ({
            ...d,
            current_state: "known" as const,
          })),
        },
      };
      const turn = await runCollectingDcTurn(s, {
        statement: "",
        source_turn_id: "init_11",
        now: NOW,
        init_only: true,
      });
      assert.equal(turn.outcome, "dc_committed");
      assert.equal(turn.authorized_question, null);
      assert.ok(turn.understanding);
      assert.equal(turn.understanding!.readiness.can_ask, false);
    });

    // M1-12
    await check("M1-12 same turn replay no dup facts/Qs/budget", async () => {
      const sid = await seedSession("12", jobDirs);
      await persistAttachedInitAsk(sid, "op_m1_12", "init_12");
      const first = await handleUserMessage({
        session: await durable(sid),
        userMessage: "我可以接受最多亏掉三个月存款。",
        locale: "zh-CN",
      });
      const turnId = lastUserId(first);
      const facts1 = first.decision_context!.reality_facts.filter(
        (f) => f.source_turn_id === turnId,
      ).length;
      const asked1 =
        first.decision_understanding?.budget.session_asked_count ?? 0;
      // Replay adaptive turn with same turn id
      const replay = await runCollectingDcTurn(first, {
        statement: "我可以接受最多亏掉三个月存款。",
        source_turn_id: turnId,
        now: NOW,
      });
      assert.equal(replay.outcome, "not_applied");
      const facts2 = replay.session.decision_context!.reality_facts.filter(
        (f) => f.source_turn_id === turnId,
      ).length;
      assert.equal(facts2, facts1);
      const asked2 =
        replay.session.decision_understanding?.budget.session_asked_count ?? asked1;
      assert.equal(asked2, asked1);
    });

    // M1-13
    await check("M1-13 refresh/restore consistency", async () => {
      const sid = await seedSession("13", jobDirs);
      await persistAttachedInitAsk(sid, "op_m1_13", "init_13");
      const out = await handleUserMessage({
        session: await durable(sid),
        userMessage: "现状是朝九晚六，没什么成长。",
        locale: "zh-CN",
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_13_save",
        kind: "session_patch",
        bump_dc: true,
        apply: () => out,
      });
      const reloaded = await durable(sid);
      assert.deepEqual(
        reloaded.decision_understanding?.current_understanding,
        out.decision_understanding?.current_understanding,
      );
      assert.equal(
        reloaded.adaptive_ask_plan?.question_text,
        out.adaptive_ask_plan?.question_text,
      );
      assert.equal(
        reloaded.decision_context?.version,
        out.decision_context?.version,
      );
    });

    // M1-14
    await check("M1-14 concurrent CAS conflict explicit", async () => {
      const sid = await seedSession("14", jobDirs);
      let hit = false;
      try {
        await mutatePOJUSession(
          sid,
          {
            operation_id: "op_m1_14_conflict",
            kind: "session_patch",
            bump_dc: true,
            apply: (latest) => ({
              ...latest,
              original_question: `${latest.original_question} [conflict-probe]`,
            }),
          },
          {
            casWrite: async () => {
              throw new SessionCasError(SESSION_CAS_CONFLICT, "injected concurrent conflict");
            },
            max_retries: 0,
          },
        );
      } catch (e) {
        hit = true;
        assert.ok(e instanceof SessionCasError);
        assert.equal((e as InstanceType<typeof SessionCasError>).code, SESSION_CAS_CONFLICT);
      }
      assert.equal(hit, true);
    });

    // M1-15
    await check("M1-15 UI/Session Q == Agent sent+persisted Q", async () => {
      const sid = await seedSession("15", jobDirs);
      const seeded = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: "init_15",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_15",
        kind: "session_patch",
        bump_dc: true,
        apply: () => seeded.session,
      });
      const out = await handleUserMessage({
        session: await durable(sid),
        userMessage: "家庭希望我稳定，但我更想尝试。",
        locale: "zh-CN",
      });
      const sent = lastAssistant(out).content;
      assert.equal(sent, out.adaptive_ask_plan?.question_text);
      assert.equal(
        sent,
        out.decision_understanding?.last_sent_question?.question_text,
      );
      // UI projection reads the same structured fields
      const { projectAdaptiveQuestionForUi } = await import(
        "../lib/poju/decision-intake/ui-projection"
      );
      const ui = projectAdaptiveQuestionForUi(out);
      assert.equal(ui.current_question, sent);
      assert.equal(ui.understanding_summary, out.decision_understanding?.current_understanding.summary);
    });

    // Static wiring
    await check("M1-static agent calls runM1ProductionPreLlmTurn BEFORE LLM; plan drives response", async () => {
      const src = readFileSync(join(REPO, "lib/poju/agent.ts"), "utf8");
      assert.match(src, /runCollectingDcTurn/);
      assert.match(src, /runM1ProductionPreLlmTurn/);
      assert.match(src, /from "@\/lib\/poju\/collecting-dc-turn"/);
      assert.match(src, /M1-R — Adaptive Question Loop BEFORE|M1 — Adaptive Question Loop BEFORE/);
      assert.match(src, /await runM1ProductionPreLlmTurn\(sessionForLlm,/);
      assert.match(src, /assertQuestionMatchesPlan/);
      assert.match(src, /attachAuthorizedAssistantQuestion/);
      assert.match(src, /FAIL-CLOSED|m1_fail_closed/);
      assert.equal(/persistCollectingUserTurnDc/.test(src), false);
      assert.equal(/selectNextIntakeAskForSession/.test(src), false);
      // Must NOT call collecting turn only after assistant is built (old bug).
      assert.equal(/await runCollectingDcTurn\(sessionOut,/.test(src), false);
      assert.equal(/await runM1ProductionPreLlmTurn\(sessionOut,/.test(src), false);
    });

    // Interpretation unit sanity (requires authorized answer target = last_sent / plan)
    await check("M1-interp classifier covers estimate/unknown/declined/constraint", async () => {
      const sid = await seedSession("interp", jobDirs);
      const s = await persistAttachedInitAsk(sid, "op_m1_interp_init", "init_interp");
      assert.ok(s.decision_understanding?.last_sent_question);
      assert.ok(s.adaptive_ask_plan || s.decision_understanding?.next_question_plan);
      const e1 = interpretUserAnswer({
        session: s,
        statement: "大概三个月。",
        source_turn_id: "t1",
      });
      assert.equal(e1.classification, "estimate");
      const e2 = interpretUserAnswer({
        session: s,
        statement: "不知道",
        source_turn_id: "t2",
      });
      assert.equal(e2.classification, "unknown");
      const e3 = interpretUserAnswer({
        session: s,
        statement: "预算不能低于两万",
        source_turn_id: "t3",
      });
      assert.ok(e3.proposed_writes.some((w) => w.kind === "constraint"));
    });

    // ---------- M2.4-R1 Cases A–H ----------
    async function withAuthorizedAsk(
      tag: string,
      dirs: DecisionContext["dirs"],
      definition?: Partial<DecisionContext["definition"]>,
    ) {
      const sid = await seedSession(tag, dirs, definition);
      const init = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: `init_${tag}`,
        now: NOW,
        init_only: true,
      });
      assert.ok(init.plan && init.authorized_question, `${tag} first plan`);
      // Attach last_sent so answer targeting uses the real current question.
      const { attachAuthorizedAssistantQuestion } = await import(
        "../lib/poju/decision-intake/adaptive-turn"
      );
      const attached = attachAuthorizedAssistantQuestion(
        init.session,
        init.plan!,
        `ask_${tag}`,
      );
      await mutatePOJUSession(sid, {
        operation_id: `op_m24_${tag}_init`,
        kind: "session_patch",
        bump_dc: true,
        apply: () => attached,
      });
      return { sid, plan: init.plan!, q0: init.authorized_question! };
    }

    await check("M2.4-R1 Case A: multi-fact answer → multiple ProposedWrites; no unrelated DIR", async () => {
      const { sid, plan } = await withAuthorizedAsk("m24a", jobDirs, {
        decision_question: "要不要离职去创业？",
      });
      const s = await durable(sid);
      const stmt =
        "一个真实选项是内部调岗留任。另外我目前月薪税后两万。";
      const event = interpretUserAnswer({
        session: s,
        statement: stmt,
        source_turn_id: "turn_m24a",
      });
      console.log(
        `[m24a] cls=${event.classification}; writes=${event.proposed_writes.length}; dirs=${event.targets.dir_ids.join(",")}`,
      );
      assert.ok(event.proposed_writes.length >= 2, "must split independent facts");
      for (const w of event.proposed_writes) {
        assert.equal(w.status, "unverified");
        assert.notEqual(w.status, "confirmed");
        for (const d of w.related_dir_ids) {
          assert.ok(plan.dir_ids.includes(d), `write must stay on plan DIRs, got ${d}`);
        }
        assert.equal(
          w.related_dir_ids.includes("DIR-STAKEHOLDERS"),
          false,
          "must not assign to unrelated DIR",
        );
      }
      const applied = await applyAnswerEventToSessionDc(s, event, { now: NOW });
      assert.equal(applied.applied, true);
      assert.equal(applied.fact_ids_written.length, event.proposed_writes.filter((w) => w.kind === "reality_fact").length);
      const dc = applied.session.decision_context!;
      assert.ok(dc.reality_facts.length >= 2);
      console.log(
        `[m24a] applied facts=${applied.fact_ids_written.join(",")}; dc_version=${dc.version}`,
      );
    });

    await check("M2.4-R1 Case B: estimate → user_estimate + unverified (not confirmed)", async () => {
      const { sid } = await withAuthorizedAsk("m24b", jobDirs);
      const s = await durable(sid);
      const event = interpretUserAnswer({
        session: s,
        statement: "大概需要三个月",
        source_turn_id: "turn_m24b",
      });
      assert.equal(event.classification, "estimate");
      assert.ok(event.proposed_writes.length >= 1);
      assert.equal(event.proposed_writes[0]!.verification_level, "user_estimate");
      assert.equal(event.proposed_writes[0]!.status, "unverified");
      const applied = await applyAnswerEventToSessionDc(s, event, { now: NOW });
      const fact = applied.session.decision_context!.reality_facts.find(
        (f) => f.source_turn_id === "turn_m24b",
      );
      assert.ok(fact);
      assert.equal(fact!.verification_level, "user_estimate");
      assert.equal(fact!.status, "unverified");
      assert.notEqual(fact!.status, "confirmed");
      console.log(
        `[m24b] verification_level=${fact!.verification_level}; status=${fact!.status}`,
      );
    });

    await check("M2.4-R1 Case C: unknown/declined statuses; no effective ask-budget charge on answer", async () => {
      const { sid } = await withAuthorizedAsk("m24c", jobDirs);
      let s = await durable(sid);
      const askedBefore = s.decision_understanding?.budget.session_asked_count ?? 0;

      const unk = interpretUserAnswer({
        session: s,
        statement: "不知道",
        source_turn_id: "turn_m24c_unk",
      });
      assert.equal(unk.classification, "unknown");
      assert.equal(unk.proposed_writes[0]?.status, "unknown");
      const a1 = await applyAnswerEventToSessionDc(s, unk, { now: NOW });
      assert.equal(a1.applied, true);
      const f1 = a1.session.decision_context!.reality_facts.find(
        (f) => f.source_turn_id === "turn_m24c_unk",
      );
      assert.equal(f1!.status, "unknown");
      assert.notEqual(f1!.status, "unverified");
      // Apply path must not bump ask budget.
      assert.equal(
        a1.session.decision_understanding?.budget.session_asked_count ?? askedBefore,
        askedBefore,
      );

      // Declined on a fresh turn / fresh session ask target
      const { sid: sid2 } = await withAuthorizedAsk("m24c2", jobDirs);
      const s2 = await durable(sid2);
      const asked2 = s2.decision_understanding?.budget.session_asked_count ?? 0;
      const dec = interpretUserAnswer({
        session: s2,
        statement: "不想回答",
        source_turn_id: "turn_m24c_dec",
      });
      assert.equal(dec.classification, "declined");
      assert.equal(dec.proposed_writes[0]?.status, "declined");
      const a2 = await applyAnswerEventToSessionDc(s2, dec, { now: NOW });
      const f2 = a2.session.decision_context!.reality_facts.find(
        (f) => f.source_turn_id === "turn_m24c_dec",
      );
      assert.equal(f2!.status, "declined");
      assert.equal(
        a2.session.decision_understanding?.budget.session_asked_count ?? asked2,
        asked2,
      );
      console.log(
        `[m24c] unknown_status=${f1!.status}; declined_status=${f2!.status}; askedBefore=${askedBefore}; asked2=${asked2}`,
      );
    });

    await check("M2.4-R1 Case D: correction keeps old fact; open Conflict on clear clash", async () => {
      const { sid } = await withAuthorizedAsk("m24d", jobDirs);
      let s = await durable(sid);
      const first = interpretUserAnswer({
        session: s,
        statement: "可选方案只有内部调岗",
        source_turn_id: "turn_m24d_1",
      });
      const a1 = await applyAnswerEventToSessionDc(s, first, { now: NOW });
      assert.equal(a1.applied, true);
      const oldId = a1.fact_ids_written[0]!;
      s = a1.session;
      // Keep same last_sent target for correction turn.
      const corr = interpretUserAnswer({
        session: s,
        statement: "更正：不是只有内部调岗，而是还可以外部创业",
        source_turn_id: "turn_m24d_2",
      });
      assert.ok(
        corr.classification === "correction" ||
          corr.classification === "contradiction",
        `expected correction/contradiction, got ${corr.classification}`,
      );
      const a2 = await applyAnswerEventToSessionDc(s, corr, { now: NOW });
      assert.equal(a2.applied, true);
      const dc = a2.session.decision_context!;
      const oldStill = dc.reality_facts.find((f) => f.fact_id === oldId);
      assert.ok(oldStill, "old fact must remain");
      const neu = dc.reality_facts.find((f) => f.source_turn_id === "turn_m24d_2");
      assert.ok(neu);
      assert.notEqual(neu!.fact_id, oldId);
      const open = dc.conflicts.filter((c) => c.state === "open");
      if (corr.classification === "correction") {
        // M2.4-R2: a correction keeps the before/after relation as a link, not a Conflict.
        assert.deepEqual(neu!.corrects_fact_ids, [oldId], "correction must link the corrected fact");
        assert.equal(open.length, 0, "correction must not open a Conflict");
      } else {
        assert.ok(open.length >= 1, "contradiction must open Conflict");
        assert.ok(open.some((c) => c.fact_ids.includes(oldId) && c.fact_ids.includes(neu!.fact_id)));
      }
      // Contradiction on the same DIR/role opens a Conflict and overwrites nothing.
      const contra = {
        ...corr,
        event_id: `${corr.event_id}_contra`,
        client_turn_id: "turn_m24d_3",
        source_turn_id: "turn_m24d_3",
        classification: "contradiction" as const,
        proposed_writes: corr.proposed_writes.map((w) => ({ ...w, corrects_fact_ids: undefined })),
      };
      const a3 = await applyAnswerEventToSessionDc(a2.session, contra, { now: NOW });
      assert.equal(a3.applied, true);
      const dc3 = a3.session.decision_context!;
      const contraFact = dc3.reality_facts.find((f) => f.source_turn_id === "turn_m24d_3");
      assert.ok(contraFact);
      const open3 = dc3.conflicts.filter((c) => c.state === "open");
      assert.ok(
        open3.some((c) => c.fact_ids.includes(oldId) && c.fact_ids.includes(contraFact!.fact_id)),
        "contradiction must open a Conflict against the earlier fact",
      );
      assert.ok(dc3.reality_facts.some((f) => f.fact_id === oldId), "old fact never overwritten");
      console.log(
        `[m24d] old=${oldId}; new=${neu!.fact_id}; cls=${corr.classification}; links=${(neu!.corrects_fact_ids ?? []).join(",")}; contradiction_conflicts=${open3.length}`,
      );
    });

    await check("M2.4-R1 Case E: dynamic question text differs across decision gaps", async () => {
      const a = await withAuthorizedAsk("m24e1", jobDirs, {
        decision_question: "要不要离职去创业？",
      });
      const b = await withAuthorizedAsk("m24e2", moveDirs, {
        decision_question: "要不要搬去上海？",
        concrete_event: "City move",
      });
      const sa = await durable(a.sid);
      const sb = await durable(b.sid);
      assert.notDeepEqual(
        sa.decision_blueprint!.dir_ids.slice().sort(),
        sb.decision_blueprint!.dir_ids.slice().sort(),
      );
      assert.notEqual(a.q0, b.q0);
      // Not the old fixed DIR.need template alone
      assert.equal(/请具体说明：/.test(a.q0) && a.q0 === `请具体说明：${sa.decision_context!.dirs[0]!.need}？`, false);
      console.log(
        `[m24e] qA=${a.q0.slice(0, 80)}; qB=${b.q0.slice(0, 80)}; dirsA=${a.plan.dir_ids.join(",")}; dirsB=${b.plan.dir_ids.join(",")}`,
      );
    });

    await check("M2.4-R1 Case F: satisfied role not re-asked; next role gap", async () => {
      const { sid, plan, q0 } = await withAuthorizedAsk("m24f", [
        dir("DIR-OPT-ON-TABLE", "有哪些真实可选方案", ["option", "status_quo"]),
        dir("DIR-OPT-CONSTRAINTS", "硬性约束（钱/时间/责任）", ["hard_constraint"]),
      ], { decision_question: "要不要换工作？" });
      let s = await durable(sid);
      const targetDir = plan.dir_ids[0]!;
      // Write a fact that satisfies the first required role on the active DIR.
      const roles = s.decision_context!.dirs.find((d) => d.dir_id === targetDir)?.required_fact_roles ?? ["option"];
      const role0 = roles[0]!;
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...s.decision_context!.reality_facts,
            {
              fact_id: "fact_seed_role0",
              statement: role0 === "option" ? "真实可选方案：留任或跳槽" : `seed for ${role0}`,
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "collecting",
              source_turn_id: "seed_role0",
              user_confirmed: false,
              fact_roles: [role0],
              related_dir_ids: [targetDir],
              updated_at: NOW,
            },
          ],
          version: (s.decision_context!.version ?? 1) + 1,
          updated_at: NOW,
        },
      };
      await mutatePOJUSession(sid, {
        operation_id: "op_m24f_seed",
        kind: "session_patch",
        bump_dc: true,
        apply: () => s,
      });
      s = await durable(sid);
      const u = buildUnderstandingState({
        session: s,
        blueprint: s.decision_blueprint!,
        now: NOW,
      });
      const need = u.need_to_understand.items.find(
        (n) => n.kind === "dir_based" && n.dir_id === targetDir,
      );
      if (need && need.kind === "dir_based") {
        const missingRolesMatch = /missing_roles:([^;]+)/.exec(need.missing_content);
        const missingRoles = missingRolesMatch
          ? missingRolesMatch[1]!.split(",").map((x) => x.trim()).filter(Boolean)
          : [];
        assert.equal(
          missingRoles.includes(role0),
          false,
          `role ${role0} must not remain missing; got ${need.missing_content}`,
        );
      }
      // Generate next question — should not restate the same satisfied option ask.
      const next = await runCollectingDcTurn(s, {
        statement: "补充一点：家庭希望我稳定",
        source_turn_id: "turn_m24f_next",
        now: NOW,
      });
      assert.ok(next.authorized_question || next.outcome === "ready_no_question" || next.outcome === "planned" || next.outcome === "planner_blocked");
      if (next.authorized_question) {
        assert.notEqual(next.authorized_question, q0);
        assert.equal(
          /真实可选方案：留任或跳槽/.test(next.authorized_question),
          false,
        );
      }
      console.log(
        `[m24f] targetDir=${targetDir}; role0=${role0}; need=${need && need.kind === "dir_based" ? need.missing_content : "n/a"}; nextQ=${(next.authorized_question ?? next.outcome)?.toString().slice(0, 100)}`,
      );
    });

    await check("M2.4-R1 Case G: open Conflict → Understanding conflict; DIR not known; ask resolves", async () => {
      const { sid } = await withAuthorizedAsk("m24g", jobDirs);
      let s = await durable(sid);
      const dirId = "DIR-OPT-ON-TABLE";
      // Turn 1: seed contradictory facts + open Conflict
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            {
              fact_id: "fact_g_old",
              statement: "只有一个选项：留任",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "collecting",
              source_turn_id: "g_old",
              user_confirmed: false,
              fact_roles: ["option"],
              related_dir_ids: [dirId],
              updated_at: NOW,
            },
            {
              fact_id: "fact_g_new",
              statement: "其实还有创业选项",
              status: "unverified",
              verification_level: "user_asserted",
              source_stage: "collecting",
              source_turn_id: "g_new",
              user_confirmed: false,
              fact_roles: ["option"],
              related_dir_ids: [dirId],
              updated_at: NOW,
            },
          ],
          conflicts: [
            {
              conflict_id: "cf_g_open",
              fact_ids: ["fact_g_old", "fact_g_new"],
              conflict_field: "statement",
              statements_snapshot: ["只有一个选项：留任", "其实还有创业选项"],
              source_refs: [
                { fact_id: "fact_g_old", source_stage: "collecting", source_turn_id: "g_old" },
                { fact_id: "fact_g_new", source_stage: "collecting", source_turn_id: "g_new" },
              ],
              state: "open",
              resolution: null,
              user_confirmation: false,
              affects_preferred_path: true,
              updated_at: NOW,
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            d.dir_id === dirId
              ? { ...d, current_state: "conflict" as const, partial_satisfaction: true }
              : d,
          ),
          version: (s.decision_context!.version ?? 1) + 1,
          updated_at: NOW,
        },
      };
      await mutatePOJUSession(sid, {
        operation_id: "op_m24g_seed",
        kind: "session_patch",
        bump_dc: true,
        apply: () => s,
      });
      s = await durable(sid);
      const u = buildUnderstandingState({
        session: s,
        blueprint: s.decision_blueprint!,
        now: NOW,
      });
      assert.ok(u.current_understanding.conflict_briefs.length >= 1);
      assert.equal(
        u.understood.items.some((i) => i.dir_id === dirId),
        false,
        "conflict DIR must not be Understood/known",
      );
      const need = u.need_to_understand.items.find(
        (n) => n.kind === "dir_based" && n.dir_id === dirId,
      );
      assert.ok(need && need.kind === "dir_based");
      if (need && need.kind === "dir_based") {
        assert.equal(need.gap_type, "conflict");
      }

      // Turn 2: Agent/planner emits conflict-clarification question; persist last_sent.
      const turn = await runCollectingDcTurn(s, {
        statement: "",
        source_turn_id: "turn_m24g_plan",
        now: NOW,
        init_only: true,
      });
      assert.ok(turn.plan && turn.authorized_question, "must emit clarification plan");
      if (turn.authorized_question) {
        assert.match(turn.authorized_question, /不一致的记录|请明确选择哪一条|哪一条准确|冲突|澄清/);
      }
      const { attachAuthorizedAssistantQuestion } = await import(
        "../lib/poju/decision-intake/adaptive-turn"
      );
      s = attachAuthorizedAssistantQuestion(turn.session, turn.plan!, "ask_m24g_clarify");
      await mutatePOJUSession(sid, {
        operation_id: "op_m24g_attach",
        kind: "session_patch",
        bump_dc: true,
        apply: () => s,
      });
      s = await durable(sid);
      const lastSent = s.decision_understanding?.last_sent_question;
      assert.ok(lastSent, "last_sent_question must be persisted");
      assert.ok(lastSent!.dir_ids.length >= 1);
      assert.ok(lastSent!.ddr_ids.length >= 1);
      assert.ok(
        Array.isArray(lastSent!.fact_role_codes) && lastSent!.fact_role_codes.length >= 1,
        "last_sent_question.fact_role_codes must come from sent Plan",
      );
      assert.equal(lastSent!.plan_id, turn.plan!.plan_id);
      assert.deepEqual(lastSent!.fact_role_codes, turn.plan!.fact_role_codes);

      // Turn 3: non-explicit clarification wording via real handleUserMessage.
      // Formal clarifyConflict is now wired, but this wording is not an explicit
      // choice of fact 1 or 2, so the Conflict must stay open (Cases N–T cover close).
      assert.ok(
        lastSent!.conflict_clarification &&
          lastSent!.conflict_clarification.conflict_id === "cf_g_open",
        "last_sent_question must bind the open Conflict",
      );
      const factsBefore = new Set(
        (s.decision_context?.reality_facts ?? []).map((f) => f.fact_id),
      );
      const openBefore = (s.decision_context?.conflicts ?? []).filter((c) => c.state === "open").length;
      const vBeforeG = s.decision_context!.version;
      s = await handleUserMessage({
        session: s,
        userMessage: "澄清：创业选项是真实的，留任不是唯一选项。",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(sid);
      const dc3 = s.decision_context!;
      assert.ok(dc3.reality_facts.some((f) => f.fact_id === "fact_g_old"), "old fact kept");
      assert.ok(dc3.reality_facts.some((f) => f.fact_id === "fact_g_new"), "prior conflict fact kept");
      const added = dc3.reality_facts.filter((f) => !factsBefore.has(f.fact_id));
      assert.equal(added.length, 0, "ambiguous clarification must not append a new RealityFact");
      assert.equal(dc3.version, vBeforeG, "ambiguous clarification must not bump DC version");
      if (s.decision_understanding) {
        assert.equal(s.decision_understanding.context_id, dc3.context_id);
        assert.equal(s.decision_understanding.context_version, dc3.version);
      }
      const openAfter = dc3.conflicts.filter((c) => c.state === "open");
      assert.equal(openAfter.length, openBefore, "non-explicit choice must leave Conflict open");
      const gHit = openAfter.find((c) => c.conflict_id === "cf_g_open");
      assert.ok(gHit);
      assert.equal(gHit!.user_confirmation, false);
      assert.equal(gHit!.resolution, null);
      const nextTarget =
        s.decision_understanding?.last_sent_question?.conflict_clarification ??
        s.adaptive_ask_plan?.conflict_clarification ??
        null;
      assert.ok(nextTarget, "next question must still target the same Conflict");
      assert.equal(nextTarget!.conflict_id, "cf_g_open");
      assert.equal(
        (s.decision_understanding?.understood.items ?? []).some((i) => i.dir_id === dirId),
        false,
        "unresolved conflict DIR must not enter Understood",
      );
      console.log(
        `[m24g] conflict_briefs=${u.current_understanding.conflict_briefs.length}; gap=${need && need.kind==="dir_based"?need.gap_type:"?"}; clarifyQ=${(turn.authorized_question ?? "").slice(0,80)}; last_roles=${(lastSent?.fact_role_codes ?? []).join(",")}; added=${added.length}; open_after=${openAfter.length}; path=wired_ambiguous; next_cf=${nextTarget!.conflict_id}`,
      );    });

    await check("M2.4-R1 Case H: real Agent main path ≥3 turns; Understanding advances", async () => {
      fetchCalls.length = 0;
      const llmBefore = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      // Seed collecting session so authorized Plan/roles exist from turn 1.
      const { sid, plan: plan0, q0 } = await withAuthorizedAsk("m24h", jobDirs, {
        decision_question: "要不要接受新 offer？",
      });
      let s = await durable(sid);
      stubResponse = "STUB_SHOULD_NOT_OVERRIDE_AUTH_Q";

      // Turn 1: establish decision_question via real Agent (session already has DQ).
      s = await handleUserMessage({
        session: s,
        userMessage: "决策问题就是：要不要接受新 offer？",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      const phase1 = s.agent_v2?.current_phase;
      const v1 = s.decision_context?.version ?? 0;
      const q1 = s.adaptive_ask_plan?.question_text ?? lastAssistant(s).content;
      const last1 = s.decision_understanding?.last_sent_question;
      assert.ok(last1?.fact_role_codes && last1.fact_role_codes.length >= 1, "t1 last_sent roles");
      // Re-interpret the user statement against the pre-turn target to inspect authorization.
      // (Production already applied; we rebuild targets from the plan that was active.)
      const llmAfter1 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      console.log(`[m24h-t1] phase=${phase1}; dc_v=${v1}; q=${String(q1).slice(0, 80)}; llmDelta=${llmAfter1 - llmBefore}; roles=${(last1?.fact_role_codes ?? []).join(",")}`);

      // Ensure last_sent present for turn 2 answers
      if (s.adaptive_ask_plan && !s.decision_understanding?.last_sent_question) {
        const { attachAuthorizedAssistantQuestion } = await import(
          "../lib/poju/decision-intake/adaptive-turn"
        );
        s = attachAuthorizedAssistantQuestion(s, s.adaptive_ask_plan, "ask_m24h_t2");
        await savePOJUSession(s);
      }

      const vBefore2 = s.decision_context!.version;
      const llmBefore2 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      const qPrev = s.decision_understanding?.last_sent_question?.question_text ?? s.adaptive_ask_plan?.question_text;
      const rolesBefore2 = [
        ...(s.decision_understanding?.last_sent_question?.fact_role_codes ?? []),
      ];
      const targetDirs2 = [
        ...(s.decision_understanding?.last_sent_question?.dir_ids ?? s.adaptive_ask_plan?.dir_ids ?? []),
      ];

      // Turn 2: state real options clearly
      const ans2 = "真实选项有两个：接受 offer，或留任争取加薪。";
      // Capture AnswerEvent authorization by interpreting against current last_sent
      const ev2 = interpretUserAnswer({
        session: s,
        statement: ans2,
        source_turn_id: "preview_m24h_t2",
      });
      assert.ok(ev2.targets.dir_ids.length >= 1);
      for (const d of ev2.targets.dir_ids) {
        assert.ok(targetDirs2.includes(d), `t2 target dir ${d}`);
      }
      for (const w of ev2.proposed_writes) {
        assert.ok(w.fact_roles.length >= 1);
        // Authorized roles only — must not silently expand beyond last_sent codes
        const authRoles = rolesBefore2.map((c) => {
          const m = /\/role\/([^/]+)$/.exec(c);
          return m?.[1] ?? "";
        }).filter(Boolean);
        if (authRoles.length) {
          for (const r of w.fact_roles) {
            if (r === "hard_constraint") continue; // constraint companion may add
            assert.ok(authRoles.includes(r), `t2 role ${r} must be authorized; auth=${authRoles}`);
          }
        }
      }

      s = await handleUserMessage({
        session: await durable(s.session_id),
        userMessage: ans2,
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      const v2 = s.decision_context!.version;
      if (ev2.proposed_writes.length > 0 && ev2.classification !== "invalid_input") {
        assert.equal(v2, vBefore2 + 1, "t2 DC version must increase exactly once on legal write");
      }
      if (s.decision_understanding) {
        assert.equal(s.decision_understanding.context_id, s.decision_context!.context_id);
        assert.equal(s.decision_understanding.context_version, s.decision_context!.version);
      }
      const asst2 = lastAssistant(s);
      assert.ok(s.adaptive_ask_plan?.question_text, "turn2 must have authorized plan question");
      assert.equal(asst2.content, s.adaptive_ask_plan!.question_text);
      assert.notEqual(asst2.content, stubResponse);
      assert.equal(asst2.content.includes("【系统】"), false);
      assert.ok(s.adaptive_ask_plan!.dir_ids.length >= 1);
      assert.ok(s.adaptive_ask_plan!.ddr_ids.length >= 1);
      assert.equal(s.agent_v2?.current_phase, "collecting_context");
      // Satisfied roles from t2 writes should not remain as gaps when they match authorized roles
      const u2 = s.decision_understanding!;
      const writtenRoles2 = new Set(
        s.decision_context!.reality_facts.flatMap((f) => f.fact_roles ?? []),
      );
      for (const n of u2.need_to_understand.items) {
        if (n.kind !== "dir_based") continue;
        const missingRolesMatch = /missing_roles:([^;]+)/.exec(n.missing_content);
        const missingRoles = missingRolesMatch
          ? missingRolesMatch[1]!.split(",").map((x) => x.trim()).filter(Boolean)
          : [];
        for (const r of missingRoles) {
          // A role with a fact on this DIR must not stay listed missing.
          const hasFact = s.decision_context!.reality_facts.some(
            (f) =>
              (f.related_dir_ids ?? []).includes(n.dir_id) &&
              (f.fact_roles ?? []).includes(r) &&
              f.status !== "unknown" &&
              f.status !== "declined",
          );
          assert.equal(hasFact, false, `satisfied role ${r} on ${n.dir_id} must not remain a gap`);
        }
      }
      assert.ok(
        u2.need_to_understand.items.some(
          (n) => n.kind === "dir_based" && (n.priority === "P0" || n.priority === "P1"),
        ),
        "unmet P0/P1 gaps must still exist after t2",
      );
      const llmAfter2 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      console.log(
        `[m24h-t2] dc_v=${v2}; phase=${s.agent_v2?.current_phase}; authQ=${(s.adaptive_ask_plan?.question_text ?? asst2.content).slice(0, 80)}; llmDelta=${llmAfter2 - llmBefore2}; prevQ_same=${asst2.content === qPrev}; targets=${ev2.targets.dir_ids.join(",")}; write_roles=${ev2.proposed_writes.map((w)=>w.fact_roles.join("+")).join("|")}`,
      );

      const vBefore3 = s.decision_context!.version;
      const q2 = s.adaptive_ask_plan?.question_text ?? asst2.content;
      const llmBefore3 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      const rolesBefore3 = [
        ...(s.decision_understanding?.last_sent_question?.fact_role_codes ?? s.adaptive_ask_plan?.fact_role_codes ?? []),
      ];
      const targetDirs3 = [
        ...(s.decision_understanding?.last_sent_question?.dir_ids ?? s.adaptive_ask_plan?.dir_ids ?? []),
      ];

      // Turn 3: state hard constraints clearly
      const ans3 = "硬约束是年薪不能低于现在，且三个月内要决定。";
      const ev3 = interpretUserAnswer({
        session: s,
        statement: ans3,
        source_turn_id: "preview_m24h_t3",
      });
      assert.ok(ev3.targets.dir_ids.length >= 1 || ev3.classification === "invalid_input");
      if (ev3.classification !== "invalid_input") {
        for (const d of ev3.targets.dir_ids) {
          assert.ok(targetDirs3.includes(d), `t3 target dir ${d}`);
        }
      }

      s = await handleUserMessage({
        session: await durable(s.session_id),
        userMessage: ans3,
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      const v3 = s.decision_context!.version;
      if (ev3.proposed_writes.length > 0 && ev3.classification !== "invalid_input") {
        assert.equal(v3, vBefore3 + 1, "t3 DC version must increase exactly once on legal write");
      }
      if (s.decision_understanding) {
        assert.equal(s.decision_understanding.context_id, s.decision_context!.context_id);
        assert.equal(s.decision_understanding.context_version, s.decision_context!.version);
      }
      const asst3 = lastAssistant(s);
      assert.ok(s.adaptive_ask_plan?.question_text, "turn3 must have authorized plan question");
      assert.equal(asst3.content, s.adaptive_ask_plan!.question_text);
      assert.notEqual(asst3.content, stubResponse);
      assert.equal(asst3.content.includes("【系统】"), false);
      assert.notEqual(asst3.content, q2);
      // Must not fall back to already-clear decision_question without cause
      const dqTemplate = "请把要做的决策问题说得更具体一点";
      const dqComplete =
        Boolean(s.decision_context?.definition.decision_question) &&
        String(s.decision_context!.definition.decision_question).trim().length >= 4;
      if (dqComplete) {
        assert.notEqual(
          asst3.content,
          dqTemplate,
          "t3 must not re-ask decision_question when DQ already established",
        );
        assert.equal(
          s.adaptive_ask_plan!.dir_ids.includes("decision_question"),
          false,
        );
      }
      // Question must bind a legal Need/Planner gap (DIR/DDR present)
      assert.ok(s.adaptive_ask_plan!.dir_ids.length >= 1 || s.adaptive_ask_plan!.ddr_ids.length >= 1);
      assert.ok(
        s.agent_v2?.current_phase === "collecting_context" ||
          s.agent_v2?.current_phase === "awaiting_confirmation",
      );
      const llmAfter3 = fetchCalls.filter((u) => u === "/api/poju/chat").length;
      console.log(
        `[m24h-t3] dc_v=${v3}; phase=${s.agent_v2?.current_phase}; authQ=${(s.adaptive_ask_plan?.question_text ?? asst3.content).slice(0, 80)}; llmDelta=${llmAfter3 - llmBefore3}; dirs=${s.adaptive_ask_plan!.dir_ids.join(",")}; roles=${(s.adaptive_ask_plan!.fact_role_codes ?? []).join(",")}`,
      );
      console.log(
        `[m24h] path=handleUserMessage×3; versions=${v1}->${v2}->${v3}; total_llm_fetches=${fetchCalls.filter((u)=>u==="/api/poju/chat").length}; q0=${q0.slice(0,40)}; plan0_dirs=${plan0.dir_ids.join(",")}`,
      );
    });

    // ---------- M2.4-R1-FU1 Cases I–M ----------
    await check("M2.4-R1-FU1 Case I: Plan-authorized option only; other roles remain needs", async () => {
      const optDirs = [
        dir("DIR-OPT-ON-TABLE", "有哪些真实可选方案", ["option", "status_quo", "risk"]),
        dir("DIR-OPT-CONSTRAINTS", "硬性约束（钱/时间/责任）", ["hard_constraint"]),
      ];
      const { sid, plan } = await withAuthorizedAsk("m24i", optDirs, {
        decision_question: "要不要接受 offer？",
      });
      let s = await durable(sid);
      // Force actually-sent Plan to authorize ONLY option (not full DIR required roles).
      const optionOnlyPlan = {
        ...plan,
        plan_id: `${plan.plan_id}_option_only`,
        dir_ids: ["DIR-OPT-ON-TABLE"],
        fact_role_codes: ["v1/dir/DIR-OPT-ON-TABLE/role/option"],
      };
      const { attachAuthorizedAssistantQuestion } = await import(
        "../lib/poju/decision-intake/adaptive-turn"
      );
      s = attachAuthorizedAssistantQuestion(s, optionOnlyPlan, "ask_m24i_option");
      await mutatePOJUSession(sid, {
        operation_id: "op_m24i_attach",
        kind: "session_patch",
        bump_dc: true,
        apply: () => s,
      });
      s = await durable(sid);
      assert.deepEqual(
        s.decision_understanding!.last_sent_question!.fact_role_codes,
        ["v1/dir/DIR-OPT-ON-TABLE/role/option"],
      );

      const event = interpretUserAnswer({
        session: s,
        statement: "现实中有两个选项：接受 offer，或者留任。",
        source_turn_id: "turn_m24i",
      });
      assert.deepEqual(event.targets.dir_ids, ["DIR-OPT-ON-TABLE"]);
      assert.ok(event.proposed_writes.length >= 1);
      for (const w of event.proposed_writes) {
        assert.deepEqual(w.fact_roles, ["option"]);
      }
      const applied = await applyAnswerEventToSessionDc(s, event, { now: NOW });
      assert.equal(applied.applied, true);
      const facts = applied.session.decision_context!.reality_facts.filter(
        (f) => f.source_turn_id === "turn_m24i",
      );
      assert.ok(facts.length >= 1);
      for (const f of facts) {
        assert.deepEqual(f.fact_roles, ["option"]);
      }
      const u = buildUnderstandingState({
        session: applied.session,
        blueprint: applied.session.decision_blueprint!,
        now: NOW,
      });
      const need = u.need_to_understand.items.find(
        (n) => n.kind === "dir_based" && n.dir_id === "DIR-OPT-ON-TABLE",
      );
      assert.ok(need && need.kind === "dir_based", "DIR must remain in need_to_understand");
      if (need && need.kind === "dir_based") {
        assert.match(need.missing_content, /status_quo/);
        assert.match(need.missing_content, /risk/);
        assert.equal(/missing_roles:[^;]*\boption\b/.test(need.missing_content), false);
      }
      assert.equal(
        u.understood.items.some((i) => i.dir_id === "DIR-OPT-ON-TABLE"),
        false,
        "must not mark whole DIR known from option-only fact",
      );
      // Subsequent planner can continue asking status_quo or risk
      const next = await runCollectingDcTurn(applied.session, {
        statement: "",
        source_turn_id: "turn_m24i_next",
        now: NOW,
        init_only: true,
      });
      assert.ok(next.plan, "planner must continue");
      const nextRoles = (next.plan!.fact_role_codes ?? [])
        .map((c) => {
          const m = /\/role\/([^/]+)$/.exec(c);
          return m?.[1] ?? "";
        })
        .filter(Boolean);
      assert.ok(
        nextRoles.some((r) => r === "status_quo" || r === "risk" || r === "hard_constraint" || r === "option") ||
          next.plan!.dir_ids.length >= 1,
        `subsequent plan must target remaining gaps; roles=${nextRoles.join(",")}`,
      );
      console.log(
        `[m24i] dirs=${event.targets.dir_ids.join(",")}; write_roles=${event.proposed_writes.map((w)=>w.fact_roles.join("+")).join("|")}; need=${need && need.kind==="dir_based"?need.missing_content:"?"}; next_roles=${nextRoles.join(",")}`,
      );
    });

    await check("M2.4-R1-FU1 Case J: historical last_sent missing fact_role_codes + mismatched plan_id → invalid", async () => {
      const { sid, plan } = await withAuthorizedAsk("m24j", jobDirs);
      let s = await durable(sid);
      const last = s.decision_understanding!.last_sent_question!;
      // Strip fact_role_codes and mismatch plan_id vs next_question_plan
      s = {
        ...s,
        decision_understanding: {
          ...s.decision_understanding!,
          last_sent_question: {
            question_text: last.question_text,
            plan_id: "historical_plan_without_roles",
            direction_id: last.direction_id,
            dir_ids: [...last.dir_ids],
            ddr_ids: [...last.ddr_ids],
            turn_id: last.turn_id,
            // fact_role_codes intentionally omitted
          },
          next_question_plan: {
            ...plan,
            plan_id: "different_current_plan_id",
          },
        },
        adaptive_ask_plan: {
          ...plan,
          plan_id: "different_current_plan_id",
        },
      };
      await mutatePOJUSession(sid, {
        operation_id: "op_m24j_hist",
        kind: "session_patch",
        bump_dc: true,
        apply: () => s,
      });
      s = await durable(sid);
      const vBefore = s.decision_context!.version;
      const factsBefore = s.decision_context!.reality_facts.length;
      const event = interpretUserAnswer({
        session: s,
        statement: "真实选项有两个：接受或留任。",
        source_turn_id: "turn_m24j",
      });
      assert.equal(event.classification, "invalid_input");
      assert.ok(event.notes.includes("missing_authorized_fact_roles"));
      assert.equal(event.proposed_writes.length, 0);
      const applied = await applyAnswerEventToSessionDc(s, event, { now: NOW });
      assert.equal(applied.applied, false);
      assert.equal(applied.session.decision_context!.version, vBefore);
      assert.equal(applied.session.decision_context!.reality_facts.length, factsBefore);
      console.log(
        `[m24j] cls=${event.classification}; notes=${event.notes.join(",")}; writes=${event.proposed_writes.length}; dc_v=${applied.session.decision_context!.version}`,
      );
    });

    await check("M2.4-R1-FU1 Case K: correction supplement must not create Conflict", async () => {
      const { sid } = await withAuthorizedAsk("m24k", jobDirs);
      let s = await durable(sid);
      const first = interpretUserAnswer({
        session: s,
        statement: "目前在职",
        source_turn_id: "turn_m24k_1",
      });
      const a1 = await applyAnswerEventToSessionDc(s, first, { now: NOW });
      assert.equal(a1.applied, true);
      const oldId = a1.fact_ids_written[0]!;
      s = a1.session;
      const corr = interpretUserAnswer({
        session: s,
        statement: "更正一下，我还有一份兼职收入。",
        source_turn_id: "turn_m24k_2",
      });
      assert.equal(corr.classification, "correction");
      const a2 = await applyAnswerEventToSessionDc(s, corr, { now: NOW });
      assert.equal(a2.applied, true);
      const dc = a2.session.decision_context!;
      assert.ok(dc.reality_facts.some((f) => f.fact_id === oldId), "old fact kept");
      assert.ok(dc.reality_facts.some((f) => f.source_turn_id === "turn_m24k_2"), "new fact appended");
      assert.equal(dc.conflicts.filter((c) => c.state === "open").length, 0, "supplement must not create Conflict");
      console.log(
        `[m24k] old=${oldId}; new_facts=${dc.reality_facts.filter((f)=>f.source_turn_id==="turn_m24k_2").map(f=>f.fact_id).join(",")}; open=${dc.conflicts.filter(c=>c.state==="open").length}; cls=${corr.classification}`,
      );
    });

    await check("M2.4-R1-FU1 Case L: explicit contradiction creates open Conflict", async () => {
      const { sid } = await withAuthorizedAsk("m24l", jobDirs);
      let s = await durable(sid);
      const first = interpretUserAnswer({
        session: s,
        statement: "目前没有其他工作收入",
        source_turn_id: "turn_m24l_1",
      });
      const a1 = await applyAnswerEventToSessionDc(s, first, { now: NOW });
      assert.equal(a1.applied, true);
      const oldId = a1.fact_ids_written[0]!;
      s = a1.session;
      const contra = interpretUserAnswer({
        session: s,
        statement: "之前说的不准确，我实际上还有一份固定兼职收入。",
        source_turn_id: "turn_m24l_2",
      });
      assert.equal(contra.classification, "contradiction");
      const a2 = await applyAnswerEventToSessionDc(s, contra, { now: NOW });
      assert.equal(a2.applied, true);
      const dc = a2.session.decision_context!;
      assert.ok(dc.reality_facts.some((f) => f.fact_id === oldId), "old fact kept");
      const neu = dc.reality_facts.find((f) => f.source_turn_id === "turn_m24l_2");
      assert.ok(neu);
      const open = dc.conflicts.filter((c) => c.state === "open");
      assert.ok(open.length >= 1, "explicit contradiction must open Conflict");
      const hit = open.find((c) => c.fact_ids.includes(oldId) && c.fact_ids.includes(neu!.fact_id));
      assert.ok(hit, "both fact ids in Conflict.fact_ids");
      assert.equal(hit!.state, "open");
      assert.ok(hit!.source_refs.length >= 2);
      assert.ok(hit!.source_refs.every((r) => r.fact_id && r.source_turn_id));
      console.log(
        `[m24l] old=${oldId}; new=${neu!.fact_id}; open=${open.length}; source_refs=${hit!.source_refs.length}; cls=${contra.classification}`,
      );
    });

    await check("M2.4-R1-FU1 Case M: time change must not create Conflict", async () => {
      const { sid } = await withAuthorizedAsk("m24m", jobDirs);
      let s = await durable(sid);
      const first = interpretUserAnswer({
        session: s,
        statement: "2025 年仍在职",
        source_turn_id: "turn_m24m_1",
      });
      const a1 = await applyAnswerEventToSessionDc(s, first, { now: NOW });
      assert.equal(a1.applied, true);
      const oldId = a1.fact_ids_written[0]!;
      s = a1.session;
      // Use correction framing so conflict path is evaluated; different years must not conflict.
      const corr = interpretUserAnswer({
        session: s,
        statement: "更正：2026 年初已经离职。",
        source_turn_id: "turn_m24m_2",
      });
      assert.ok(
        corr.classification === "correction" || corr.classification === "contradiction",
        `expected correction/contradiction, got ${corr.classification}`,
      );
      const a2 = await applyAnswerEventToSessionDc(s, corr, { now: NOW });
      assert.equal(a2.applied, true);
      const dc = a2.session.decision_context!;
      assert.ok(dc.reality_facts.some((f) => f.fact_id === oldId), "old fact kept");
      assert.ok(dc.reality_facts.some((f) => f.source_turn_id === "turn_m24m_2"), "new fact kept");
      assert.equal(dc.conflicts.filter((c) => c.state === "open").length, 0, "time change must not create Conflict");
      console.log(
        `[m24m] old=${oldId}; open=${dc.conflicts.filter(c=>c.state==="open").length}; cls=${corr.classification}`,
      );
    });


    const { openConflict, markOpenConflictsUnresolvedInFinal } = await import(
      "../lib/poju/decision-context/conflict-lifecycle"
    );
    const { reaggregateDirsOnSession } = await import(
      "../lib/poju/decision-context/na-validation-from-session"
    );
    type RealityFact = import("../lib/poju/decision-context/types").RealityFact;
    type Conflict = import("../lib/poju/decision-context/types").Conflict;

    function makeFact(input: {
      fact_id: string;
      statement: string;
      dir_id: string;
      role: string;
      source_turn_id: string;
      status?: RealityFact["status"];
    }): RealityFact {
      return {
        fact_id: input.fact_id,
        statement: input.statement,
        status: input.status ?? "unverified",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: input.source_turn_id,
        user_confirmed: false,
        fact_roles: [input.role],
        related_dir_ids: [input.dir_id],
        updated_at: NOW,
      };
    }

    async function persistFactsAndConflicts(
      sid: string,
      facts: RealityFact[],
      conflicts: Conflict[],
      op: string,
    ): Promise<POJUSessionState> {
      const s0 = await durable(sid);
      const reality_facts = [...s0.decision_context!.reality_facts, ...facts];
      const allConflicts = [...s0.decision_context!.conflicts, ...conflicts];
      const dirs = await reaggregateDirsOnSession(s0, s0.decision_context!.dirs, {
        realityFacts: reality_facts,
        conflicts: allConflicts,
        nowIso: NOW,
      });
      const next: POJUSessionState = {
        ...s0,
        decision_context: {
          ...s0.decision_context!,
          reality_facts,
          conflicts: allConflicts,
          dirs,
          version: (s0.decision_context!.version ?? 1) + 1,
          updated_at: NOW,
        },
      };
      await mutatePOJUSession(sid, {
        operation_id: op,
        kind: "session_patch",
        bump_dc: true,
        apply: () => next,
      });
      return durable(sid);
    }

    async function emitAndAttachClarification(sid: string, tag: string) {
      const turn = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: `plan_${tag}`,
        now: NOW,
        init_only: true,
      });
      assert.ok(turn.plan && turn.authorized_question, `${tag} must emit a plan`);
      const { attachAuthorizedAssistantQuestion } = await import(
        "../lib/poju/decision-intake/adaptive-turn"
      );
      const attached = attachAuthorizedAssistantQuestion(
        turn.session,
        turn.plan!,
        `ask_${tag}`,
      );
      await mutatePOJUSession(sid, {
        operation_id: `op_${tag}_attach`,
        kind: "session_patch",
        bump_dc: true,
        apply: () => attached,
      });
      const s = await durable(sid);
      return { s, turn, plan: turn.plan!, q: turn.authorized_question! };
    }

    async function seedSameDirConflict(tag: string) {
      const { sid } = await withAuthorizedAsk(tag, jobDirs);
      const dirId = "DIR-OPT-ON-TABLE";
      const factA = makeFact({
        fact_id: `fact_${tag}_a`,
        statement: "目前只有留任一条路",
        dir_id: dirId,
        role: "option",
        source_turn_id: `${tag}_a`,
      });
      const factB = makeFact({
        fact_id: `fact_${tag}_b`,
        statement: "其实还有外部 offer 可选",
        dir_id: dirId,
        role: "option",
        source_turn_id: `${tag}_b`,
      });
      const conflict = openConflict({
        fact_ids: [factA.fact_id, factB.fact_id],
        conflict_field: "statement",
        facts: [factA, factB],
        now: NOW,
      });
      await persistFactsAndConflicts(
        sid,
        [factA, factB],
        [conflict],
        `op_${tag}_seed`,
      );
      const emitted = await emitAndAttachClarification(sid, tag);
      const last = emitted.s.decision_understanding?.last_sent_question;
      assert.ok(last?.conflict_clarification, `${tag} last_sent must bind conflict`);
      assert.equal(last!.conflict_clarification!.conflict_id, conflict.conflict_id);
      assert.deepEqual(last!.conflict_clarification!.fact_ids, [
        factA.fact_id,
        factB.fact_id,
      ]);
      assert.match(emitted.q, /请明确选择哪一条准确/);
      return { sid, dirId, factA, factB, conflict, ...emitted };
    }

    await check("M2.4-R1-FU2 unknown/declined old fact must not create Conflict", async () => {
      for (const status of ["unknown", "declined"] as const) {
        const { sid } = await withAuthorizedAsk(`m24ud_${status}`, jobDirs);
        let s = await durable(sid);
        const last = s.decision_understanding!.last_sent_question!;
        const dirId = last.dir_ids[0]!;
        const roleCode = (last.fact_role_codes ?? [])[0] ?? "";
        const role = roleCode.includes("/role/")
          ? roleCode.split("/role/").pop()!
          : "option";
        const old = makeFact({
          fact_id: `fact_ud_${status}`,
          statement: "目前没有其他工作收入",
          dir_id: dirId,
          role,
          source_turn_id: `seed_ud_${status}`,
          status,
        });
        s = await persistFactsAndConflicts(sid, [old], [], `op_ud_${status}_seed`);
        const contra = interpretUserAnswer({
          session: s,
          statement: "之前说的不准确，我实际上还有一份固定兼职收入",
          source_turn_id: `turn_ud_${status}`,
        });
        const applied = await applyAnswerEventToSessionDc(s, contra, { now: NOW });
        assert.equal(applied.applied, true, `${status} new answer should still write`);
        const dc = applied.session.decision_context!;
        const open = dc.conflicts.filter((c) => c.state === "open");
        assert.equal(open.length, 0, `${status} old fact must not be opposing evidence`);
        console.log(
          `[m24ud] status=${status}; cls=${contra.classification}; open=${open.length}; facts=${dc.reality_facts.length}`,
        );
      }
    });

    await check("M2.4-R1-FU2 Case N: explicit choice of the first fact", async () => {
      const seeded = await seedSameDirConflict("m24n");
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      const factCountBefore = s.decision_context!.reality_facts.length;
      s = await handleUserMessage({
        session: s,
        userMessage: "第一条准确",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id);
      assert.ok(hit, "conflict must still exist");
      assert.equal(hit!.state, "clarified");
      assert.equal(hit!.user_confirmation, true);
      assert.ok(hit!.resolution, "resolution required");
      const res = JSON.parse(hit!.resolution!) as {
        selected_fact_id?: string;
        source_turn_id?: string;
      };
      assert.equal(res.selected_fact_id, seeded.factA.fact_id);
      assert.equal(res.source_turn_id, lastUserId(s));
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factA.fact_id), "fact A kept");
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factB.fact_id), "fact B kept");
      assert.equal(dc.reality_facts.length, factCountBefore, "must not invent a new RealityFact");
      assert.equal(dc.version, vBefore + 1);
      const briefs = s.decision_understanding?.current_understanding.conflict_briefs ?? [];
      assert.equal(
        briefs.some((b) => b.includes(seeded.conflict.conflict_id)),
        false,
        "Understanding must not treat clarified Conflict as open",
      );
      assert.equal(
        dc.conflicts.filter((c) => c.state === "open" && c.conflict_id === seeded.conflict.conflict_id).length,
        0,
      );
      console.log(
        `[m24n] cf=${hit!.conflict_id}; facts=${seeded.factA.fact_id},${seeded.factB.fact_id}; state=${hit!.state}; confirm=${hit!.user_confirmation}; selected=${res.selected_fact_id}; turn=${res.source_turn_id}; dc=${vBefore}->${dc.version}; fact_count=${dc.reality_facts.length}; briefs=${briefs.length}`,
      );
    });

    await check("M2.4-R1-FU2 Case O: explicit choice of the second fact", async () => {
      const seeded = await seedSameDirConflict("m24o");
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      s = await handleUserMessage({
        session: s,
        userMessage: "第二条准确",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(hit.state, "clarified");
      assert.equal(hit.user_confirmation, true);
      const res = JSON.parse(hit.resolution!) as { selected_fact_id?: string; source_turn_id?: string };
      assert.equal(res.selected_fact_id, seeded.factB.fact_id, "must select the second fact, not the first or newest by default");
      assert.notEqual(res.selected_fact_id, seeded.factA.fact_id);
      assert.equal(res.source_turn_id, lastUserId(s));
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factA.fact_id));
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factB.fact_id));
      assert.equal(dc.version, vBefore + 1);
      console.log(
        `[m24o] cf=${hit.conflict_id}; selected=${res.selected_fact_id}; expected_second=${seeded.factB.fact_id}; first=${seeded.factA.fact_id}; confirm=${hit.user_confirmation}; dc=${vBefore}->${dc.version}`,
      );
    });

    await check("M2.4-R1-FU2 Case P: vague answer must not close Conflict", async () => {
      const seeded = await seedSameDirConflict("m24p");
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      const factCountBefore = s.decision_context!.reality_facts.length;
      s = await handleUserMessage({
        session: s,
        userMessage: "不太确定",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(hit.state, "open");
      assert.equal(hit.user_confirmation, false);
      assert.equal(hit.resolution, null);
      assert.equal(dc.reality_facts.length, factCountBefore, "must not add a RealityFact");
      assert.equal(dc.version, vBefore, "must not bump DC version");
      const nextTarget =
        s.decision_understanding?.last_sent_question?.conflict_clarification ??
        s.adaptive_ask_plan?.conflict_clarification ??
        null;
      assert.ok(nextTarget, "next question must still target the same Conflict");
      assert.equal(nextTarget!.conflict_id, seeded.conflict.conflict_id);
      assert.deepEqual(nextTarget!.fact_ids, [seeded.factA.fact_id, seeded.factB.fact_id]);
      console.log(
        `[m24p] cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; resolution=${hit.resolution}; facts=${dc.reality_facts.length}; dc=${vBefore}->${dc.version}; next_cf=${nextTarget!.conflict_id}`,
      );
    });

    await check("M2.4-R1-FU2 Case Q: both-inaccurate must not auto-select or close", async () => {
      const seeded = await seedSameDirConflict("m24q");
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      const factIdsBefore = s.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      s = await handleUserMessage({
        session: s,
        userMessage: "两条都不准确",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(hit.state, "open");
      assert.equal(hit.user_confirmation, false);
      assert.equal(hit.resolution, null);
      assert.deepEqual(
        dc.reality_facts.map((f) => f.fact_id).sort(),
        factIdsBefore,
        "must not delete or add facts",
      );
      assert.equal(dc.version, vBefore);
      const nextTarget =
        s.decision_understanding?.last_sent_question?.conflict_clarification ??
        s.adaptive_ask_plan?.conflict_clarification ??
        null;
      assert.equal(nextTarget?.conflict_id, seeded.conflict.conflict_id);
      console.log(
        `[m24q] cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; resolution=${hit.resolution}; facts=${dc.reality_facts.length}; dc=${vBefore}->${dc.version}`,
      );
    });

    await check("M2.4-R1-FU2 Case R: replay same source_turn_id is idempotent", async () => {
      const seeded = await seedSameDirConflict("m24r");
      let s = seeded.s;
      const vSeed = s.decision_context!.version;
      s = await handleUserMessage({
        session: s,
        userMessage: "第一条准确",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const turnId = lastUserId(s);
      const dc1 = s.decision_context!;
      const vAfter = dc1.version;
      const asked1 = s.decision_understanding?.budget.session_asked_count ?? 0;
      const clarified1 = dc1.conflicts.filter((c) => c.state === "clarified");
      const resolution1 = clarified1[0]?.resolution ?? null;
      assert.equal(vAfter, vSeed + 1);
      assert.equal(clarified1.length, 1);
      const replay = await runCollectingDcTurn(s, {
        statement: "第一条准确",
        source_turn_id: turnId,
        now: NOW,
      });
      const dc2 = replay.session.decision_context!;
      const asked2 = replay.session.decision_understanding?.budget.session_asked_count ?? asked1;
      const clarified2 = dc2.conflicts.filter((c) => c.state === "clarified");
      assert.equal(dc2.version, vAfter, "replay must not bump DC version again");
      assert.equal(clarified2.length, 1, "must not create a duplicate clarified record");
      assert.equal(clarified2[0]!.conflict_id, clarified1[0]!.conflict_id);
      assert.equal(clarified2[0]!.resolution, resolution1);
      assert.equal(asked2, asked1, "must not consume another real question budget");
      console.log(
        `[m24r] turn=${turnId}; outcome=${replay.outcome}; persist=${replay.persist_error}; dc=${vSeed}->${vAfter}->${dc2.version}; asked=${asked1}->${asked2}; clarified=${clarified2.length}; key_skip=${String(replay.persist_error ?? "")}`,
      );
    });

    await check("M2.4-R1-FU2 Case S: stale non-open Conflict is a safe no-op", async () => {
      const seeded = await seedSameDirConflict("m24s");
      let s = seeded.s;
      const lastTarget = s.decision_understanding!.last_sent_question!.conflict_clarification!;
      const closed = markOpenConflictsUnresolvedInFinal(s.decision_context!.conflicts, NOW);
      const stale = closed.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(stale.state, "unresolved_in_final");
      const vFixture = (s.decision_context!.version ?? 1) + 1;
      const fixture: POJUSessionState = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          conflicts: closed,
          version: vFixture,
          updated_at: NOW,
        },
      };
      await mutatePOJUSession(seeded.sid, {
        operation_id: "op_m24s_stale",
        kind: "session_patch",
        bump_dc: true,
        apply: () => fixture,
      });
      s = await durable(seeded.sid);
      assert.equal(
        s.decision_understanding?.last_sent_question?.conflict_clarification?.conflict_id,
        lastTarget.conflict_id,
        "sent clarification target must remain",
      );
      const factsBefore = s.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const otherBefore = s.decision_context!.conflicts.map((c) => ({
        id: c.conflict_id,
        state: c.state,
        resolution: c.resolution,
        confirmation: c.user_confirmation,
      }));
      s = await handleUserMessage({
        session: s,
        userMessage: "第一条准确",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(hit.state, "unresolved_in_final", "must not overwrite the new non-open state");
      assert.equal(hit.resolution, stale.resolution);
      assert.equal(hit.user_confirmation, stale.user_confirmation);
      assert.equal(dc.version, vFixture, "stale target must not bump DC version");
      assert.deepEqual(dc.reality_facts.map((f) => f.fact_id).sort(), factsBefore);
      assert.equal(
        dc.conflicts.filter((c) => c.state === "clarified").length,
        0,
        "must not apply the answer to this or another Conflict via clarifyConflict",
      );
      console.log(
        `[m24s] cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; resolution=${hit.resolution}; dc=${vFixture}->${dc.version}; target=${lastTarget.conflict_id}; persist=stale_conflict_target`,
      );
      void otherBefore;
    });

    await check("M2.4-R1-FU2 Case T: other DIR Conflict is untouched", async () => {
      const { sid } = await withAuthorizedAsk("m24t", jobDirs);
      const factA1 = makeFact({
        fact_id: "fact_t_opt_a",
        statement: "目前只有留任一条路",
        dir_id: "DIR-OPT-ON-TABLE",
        role: "option",
        source_turn_id: "t_opt_a",
      });
      const factA2 = makeFact({
        fact_id: "fact_t_opt_b",
        statement: "其实还有外部 offer 可选",
        dir_id: "DIR-OPT-ON-TABLE",
        role: "option",
        source_turn_id: "t_opt_b",
      });
      const factB1 = makeFact({
        fact_id: "fact_t_sq_a",
        statement: "我还在原公司任职",
        dir_id: "DIR-STATUS-QUO",
        role: "status_quo",
        source_turn_id: "t_sq_a",
      });
      const factB2 = makeFact({
        fact_id: "fact_t_sq_b",
        statement: "我已经从原公司离职",
        dir_id: "DIR-STATUS-QUO",
        role: "status_quo",
        source_turn_id: "t_sq_b",
      });
      const cOpt = openConflict({
        fact_ids: [factA1.fact_id, factA2.fact_id],
        conflict_field: "statement",
        facts: [factA1, factA2],
        now: NOW,
      });
      const cSq = openConflict({
        fact_ids: [factB1.fact_id, factB2.fact_id],
        conflict_field: "statement",
        facts: [factB1, factB2],
        now: NOW,
      });
      await persistFactsAndConflicts(
        sid,
        [factA1, factA2, factB1, factB2],
        [cOpt, cSq],
        "op_m24t_seed",
      );
      const emitted = await emitAndAttachClarification(sid, "m24t");
      const bound = emitted.s.decision_understanding?.last_sent_question?.conflict_clarification;
      assert.ok(bound, "one Conflict must be bound to the sent question");
      const otherId = bound!.conflict_id === cOpt.conflict_id ? cSq.conflict_id : cOpt.conflict_id;
      assert.ok(
        bound!.conflict_id === cOpt.conflict_id || bound!.conflict_id === cSq.conflict_id,
      );
      const otherBefore = emitted.s.decision_context!.conflicts.find((c) => c.conflict_id === otherId)!;
      const otherSnapshot = {
        state: otherBefore.state,
        fact_ids: [...otherBefore.fact_ids],
        source_refs: otherBefore.source_refs.map((r) => ({ ...r })),
        resolution: otherBefore.resolution,
        user_confirmation: otherBefore.user_confirmation,
      };
      let s = emitted.s;
      const vBefore = s.decision_context!.version;
      s = await handleUserMessage({
        session: s,
        userMessage: "第一条准确",
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(sid);
      const dc = s.decision_context!;
      const chosen = dc.conflicts.find((c) => c.conflict_id === bound!.conflict_id)!;
      const other = dc.conflicts.find((c) => c.conflict_id === otherId)!;
      assert.equal(chosen.state, "clarified");
      assert.equal(chosen.user_confirmation, true);
      const res = JSON.parse(chosen.resolution!) as { selected_fact_id?: string };
      assert.equal(res.selected_fact_id, bound!.fact_ids[0]);
      assert.equal(other.state, otherSnapshot.state);
      assert.deepEqual(other.fact_ids, otherSnapshot.fact_ids);
      assert.deepEqual(other.source_refs, otherSnapshot.source_refs);
      assert.equal(other.resolution, otherSnapshot.resolution);
      assert.equal(other.user_confirmation, otherSnapshot.user_confirmation);
      assert.equal(dc.version, vBefore + 1);
      console.log(
        `[m24t] bound=${bound!.conflict_id}; other=${otherId}; chosen=${chosen.state}; other_state=${other.state}; selected=${res.selected_fact_id}; dc=${vBefore}->${dc.version}; other_facts=${other.fact_ids.join(",")}; other_refs=${other.source_refs.length}`,
      );
    });



    await check("M2.4-R1-FU3 Case U: negate first fact must not close Conflict", async () => {
      const seeded = await seedSameDirConflict("m24u");
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      const factCountBefore = s.decision_context!.reality_facts.length;
      const inputText = "第一条不准确";
      s = await handleUserMessage({
        session: s,
        userMessage: inputText,
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(hit.state, "open");
      assert.equal(hit.user_confirmation, false);
      assert.equal(hit.resolution, null);
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factA.fact_id), "fact A kept");
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factB.fact_id), "fact B kept");
      assert.equal(dc.reality_facts.length, factCountBefore);
      assert.equal(dc.version, vBefore, "must not bump DC version");
      const nextTarget =
        s.decision_understanding?.last_sent_question?.conflict_clarification ??
        s.adaptive_ask_plan?.conflict_clarification ??
        null;
      assert.ok(nextTarget, "next question must still target the same Conflict");
      assert.equal(nextTarget!.conflict_id, seeded.conflict.conflict_id);
      assert.notEqual(
        hit.state === "clarified" ? "first" : "none",
        "first",
        "must not select the first fact",
      );
      console.log(
        `[m24u] input=${inputText}; cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; resolution=${hit.resolution}; selected=none; facts=${dc.reality_facts.length}; dc=${vBefore}->${dc.version}; next_cf=${nextTarget!.conflict_id}`,
      );
    });

    await check("M2.4-R1-FU3 Case V: negate second fact must not close Conflict", async () => {
      const seeded = await seedSameDirConflict("m24v");
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      const factCountBefore = s.decision_context!.reality_facts.length;
      const inputText = "不是第二条";
      s = await handleUserMessage({
        session: s,
        userMessage: inputText,
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(hit.state, "open");
      assert.equal(hit.user_confirmation, false);
      assert.equal(hit.resolution, null);
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factA.fact_id));
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factB.fact_id));
      assert.equal(dc.reality_facts.length, factCountBefore);
      assert.equal(dc.version, vBefore, "must not bump DC version");
      const nextTarget =
        s.decision_understanding?.last_sent_question?.conflict_clarification ??
        s.adaptive_ask_plan?.conflict_clarification ??
        null;
      assert.ok(nextTarget, "next question must still target the same Conflict");
      assert.equal(nextTarget!.conflict_id, seeded.conflict.conflict_id);
      console.log(
        `[m24v] input=${inputText}; cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; resolution=${hit.resolution}; selected=none; facts=${dc.reality_facts.length}; dc=${vBefore}->${dc.version}; next_cf=${nextTarget!.conflict_id}`,
      );
    });

    await check("M2.4-R1-FU3 Case W: negate first and affirm second selects the second fact", async () => {
      const seeded = await seedSameDirConflict("m24w");
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      const factCountBefore = s.decision_context!.reality_facts.length;
      const inputText = "不是第一条，而是第二条准确";
      s = await handleUserMessage({
        session: s,
        userMessage: inputText,
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      if (hit.state !== "clarified") {
        // Fail-closed is acceptable if contrast cannot be parsed reliably.
        // Closing the wrong fact is not.
        assert.equal(hit.state, "open", "if contrast is not reliable, keep Conflict open");
        assert.equal(hit.user_confirmation, false);
        assert.equal(hit.resolution, null);
        assert.equal(dc.version, vBefore, "ambiguous contrast must not bump DC version");
        console.log(
          `[m24w] input=${inputText}; cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; resolution=${hit.resolution}; selected=ambiguous_fail_closed; facts=${dc.reality_facts.length}; dc=${vBefore}->${dc.version}`,
        );
        return;
      }
      assert.equal(hit.user_confirmation, true);
      const res = JSON.parse(hit.resolution!) as { selected_fact_id?: string; source_turn_id?: string };
      assert.equal(res.selected_fact_id, seeded.factB.fact_id, "must select the second fact");
      assert.notEqual(res.selected_fact_id, seeded.factA.fact_id);
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factA.fact_id));
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factB.fact_id));
      assert.equal(dc.reality_facts.length, factCountBefore);
      assert.equal(dc.version, vBefore + 1);
      console.log(
        `[m24w] input=${inputText}; cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; selected=${res.selected_fact_id}; expected_second=${seeded.factB.fact_id}; facts=${dc.reality_facts.length}; dc=${vBefore}->${dc.version}`,
      );
    });

    await check("M2.4-R1-FU3 Case X: conflicting affirm and negate must stay ambiguous", async () => {
      const seeded = await seedSameDirConflict("m24x");
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      const factIdsBefore = s.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const inputText = "第一条准确，但我不认可第一条";
      s = await handleUserMessage({
        session: s,
        userMessage: inputText,
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      assert.equal(hit.state, "open");
      assert.equal(hit.user_confirmation, false);
      assert.equal(hit.resolution, null);
      assert.deepEqual(
        dc.reality_facts.map((f) => f.fact_id).sort(),
        factIdsBefore,
        "must not add, delete, or overwrite RealityFacts",
      );
      assert.equal(dc.version, vBefore, "must not bump DC version");
      const nextTarget =
        s.decision_understanding?.last_sent_question?.conflict_clarification ??
        s.adaptive_ask_plan?.conflict_clarification ??
        null;
      assert.equal(nextTarget?.conflict_id, seeded.conflict.conflict_id);
      console.log(
        `[m24x] input=${inputText}; cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; resolution=${hit.resolution}; selected=none; facts=${dc.reality_facts.length}; dc=${vBefore}->${dc.version}; next_cf=${nextTarget?.conflict_id}`,
      );
    });

    await check("M2.4-R1-FU3 Case Y: C1 persist failure returns original uncommitted session", async () => {
      const seeded = await seedSameDirConflict("m24y");
      const original = seeded.s;
      const vBefore = original.decision_context!.version;
      const factIdsBefore = original.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const conflictBefore = original.decision_context!.conflicts.find(
        (c) => c.conflict_id === seeded.conflict.conflict_id,
      )!;
      const lastSentBefore =
        original.decision_understanding?.last_sent_question?.conflict_clarification ?? null;
      const askedBefore = original.decision_understanding?.budget.session_asked_count ?? 0;
      const inputText = "第一条准确";
      const returned = await handleUserMessage({
        session: original,
        userMessage: inputText,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          conflictClarifyPersist: async (previous) => ({
            session: previous,
            committed: false,
            error: "persist_failed",
          }),
        },
      });

      const returnedDc = returned.decision_context!;
      const returnedHit = returnedDc.conflicts.find(
        (c) => c.conflict_id === seeded.conflict.conflict_id,
      )!;
      assert.equal(returnedHit.state, "open", "returned session must keep original open Conflict");
      assert.equal(returnedHit.user_confirmation, false);
      assert.equal(returnedHit.resolution, null);
      assert.equal(returnedDc.version, vBefore, "returned DC version must be unchanged");
      assert.deepEqual(
        returnedDc.reality_facts.map((f) => f.fact_id).sort(),
        factIdsBefore,
        "returned RealityFacts must be unchanged",
      );
      assert.equal(
        returnedDc.conflicts.filter((c) => c.state === "clarified").length,
        0,
        "must not leak in-memory clarified state to the caller",
      );
      assert.equal(conflictBefore.state, "open");

      const failAsst = [...returned.messages].reverse().find((m) => m.role === "assistant");
      assert.ok(failAsst, "fail-closed assistant message required");
      const failMeta = (failAsst as { meta?: {
        m1_fail_closed?: boolean;
        m1_outcome?: string;
        m1_persist_error?: string | null;
      } }).meta;
      assert.equal(failMeta?.m1_fail_closed, true);
      assert.equal(failMeta?.m1_outcome, "persist_failed");
      assert.equal(failMeta?.m1_persist_error, "persist_failed");
      assert.notEqual(failMeta?.m1_outcome, "idempotent_replay");
      assert.match(failAsst!.content, /写入失败/);
      const askedAfter = returned.decision_understanding?.budget.session_asked_count ?? askedBefore;
      assert.equal(askedAfter, askedBefore, "must not continue next-question planning or consume budget");
      const lastSentAfter =
        returned.decision_understanding?.last_sent_question?.conflict_clarification ?? null;
      assert.equal(lastSentAfter?.conflict_id, lastSentBefore?.conflict_id);

      await savePOJUSession(returned);
      const durableSession = await durable(seeded.sid);
      const durableDc = durableSession.decision_context!;
      const durableHit = durableDc.conflicts.find(
        (c) => c.conflict_id === seeded.conflict.conflict_id,
      )!;
      assert.equal(durableHit.state, "open");
      assert.equal(durableHit.user_confirmation, false);
      assert.equal(durableHit.resolution, null);
      assert.equal(durableDc.version, vBefore);
      assert.deepEqual(
        durableDc.reality_facts.map((f) => f.fact_id).sort(),
        factIdsBefore,
      );
      assert.equal(durableDc.conflicts.filter((c) => c.state === "clarified").length, 0);
      console.log(
        `[m24y] input=${inputText}; returned_state=${returnedHit.state}; returned_confirm=${returnedHit.user_confirmation}; returned_resolution=${returnedHit.resolution}; clarified_leaked=${returnedDc.conflicts.filter((c) => c.state === "clarified").length}; dc=${vBefore}->${returnedDc.version}; persist_error=${failMeta?.m1_persist_error}; m1_outcome=${failMeta?.m1_outcome}; fail_closed=${failMeta?.m1_fail_closed}; durable_state=${durableHit.state}; durable_dc=${durableDc.version}; facts=${durableDc.reality_facts.length}; asked=${askedBefore}->${askedAfter}`,
      );
    });



    async function answerSeededConflict(tag: string, inputText: string) {
      const seeded = await seedSameDirConflict(tag);
      let s = seeded.s;
      const vBefore = s.decision_context!.version;
      const factIdsBefore = s.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const factCountBefore = s.decision_context!.reality_facts.length;
      s = await handleUserMessage({
        session: s,
        userMessage: inputText,
        locale: "zh-CN",
      });
      await savePOJUSession(s);
      s = await durable(seeded.sid);
      const dc = s.decision_context!;
      const hit = dc.conflicts.find((c) => c.conflict_id === seeded.conflict.conflict_id)!;
      const nextTarget =
        s.decision_understanding?.last_sent_question?.conflict_clarification ??
        s.adaptive_ask_plan?.conflict_clarification ??
        null;
      const selected =
        hit.resolution != null
          ? ((JSON.parse(hit.resolution) as { selected_fact_id?: string }).selected_fact_id ?? null)
          : null;
      return {
        seeded,
        s,
        dc,
        hit,
        vBefore,
        factIdsBefore,
        factCountBefore,
        nextTarget,
        selected,
        inputText,
      };
    }

    function assertAmbiguousClarification(
      label: string,
      result: Awaited<ReturnType<typeof answerSeededConflict>>,
    ) {
      const { seeded, dc, hit, vBefore, factIdsBefore, nextTarget, selected, inputText } = result;
      assert.equal(hit.state, "open");
      assert.equal(hit.user_confirmation, false);
      assert.equal(hit.resolution, null);
      assert.equal(selected, null, "must not wrongly select first or second");
      assert.deepEqual(
        dc.reality_facts.map((f) => f.fact_id).sort(),
        factIdsBefore,
        "RealityFact count and IDs must be unchanged",
      );
      assert.equal(dc.version, vBefore, "must not bump DC version");
      assert.ok(nextTarget, "next question must still target the same Conflict");
      assert.equal(nextTarget!.conflict_id, seeded.conflict.conflict_id);
      assert.deepEqual(nextTarget!.fact_ids, [seeded.factA.fact_id, seeded.factB.fact_id]);
      console.log(
        `[${label}] input=${inputText}; cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; resolution=${hit.resolution}; selected=none; facts=${dc.reality_facts.length}; ids=${factIdsBefore.join(",")}; dc=${vBefore}->${dc.version}; next_cf=${nextTarget!.conflict_id}`,
      );
    }

    function assertSelectedClarification(
      label: string,
      result: Awaited<ReturnType<typeof answerSeededConflict>>,
      expectedFactId: string,
    ) {
      const { seeded, dc, hit, vBefore, factCountBefore, selected, inputText } = result;
      assert.equal(hit.state, "clarified");
      assert.equal(hit.user_confirmation, true);
      assert.ok(hit.resolution, "resolution required");
      assert.equal(selected, expectedFactId, "selected_fact_id must be the expected fact");
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factA.fact_id), "fact A kept");
      assert.ok(dc.reality_facts.some((f) => f.fact_id === seeded.factB.fact_id), "fact B kept");
      assert.equal(dc.reality_facts.length, factCountBefore, "both original RealityFacts must be retained");
      assert.equal(dc.version, vBefore + 1, "DC version must increment once");
      console.log(
        `[${label}] input=${inputText}; cf=${hit.conflict_id}; state=${hit.state}; confirm=${hit.user_confirmation}; resolution=${hit.resolution}; selected=${selected}; expected=${expectedFactId}; facts=${dc.reality_facts.length}; dc=${vBefore}->${dc.version}`,
      );
    }

    await check("M2.4-R1-FU4 Case Z1: scoped negate first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z1", "我不认为第一条准确");
      assertAmbiguousClarification("m24z1", result);
    });

    await check("M2.4-R1-FU4 Case Z2: scoped negate second must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z2", "我不觉得第二条准确");
      assertAmbiguousClarification("m24z2", result);
    });

    await check("M2.4-R1-FU4 Case Z3: 并不认可 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z3", "我并不认可第一条是正确的");
      assertAmbiguousClarification("m24z3", result);
    });

    await check("M2.4-R1-FU4 Case Z4: 并不准确 must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z4", "第一条并不准确");
      assertAmbiguousClarification("m24z4", result);
    });

    await check("M2.4-R1-FU4 Case Z5: 未必准确 must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z5", "第一条未必准确");
      assertAmbiguousClarification("m24z5", result);
    });

    await check("M2.4-R1-FU4 Case Z6: cannot confirm first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z6", "我不能确认第一条准确");
      assertAmbiguousClarification("m24z6", result);
    });

    await check("M2.4-R1-FU4 Case Z7: contrast affirms the second fact", async () => {
      const result = await answerSeededConflict("m24z7", "不是第一条，而是第二条准确");
      assertSelectedClarification("m24z7", result, result.seeded.factB.fact_id);
    });

    await check("M2.4-R1-FU4 Case Z8: contrast affirms the first fact", async () => {
      const result = await answerSeededConflict("m24z8", "不是第二条，而是第一条准确");
      assertSelectedClarification("m24z8", result, result.seeded.factA.fact_id);
    });

    await check("M2.4-R1-FU4 Case Z9: affirm then negate same option stays ambiguous", async () => {
      const result = await answerSeededConflict("m24z9", "第一条准确，但我不认可第一条");
      assertAmbiguousClarification("m24z9", result);
    });

    await check("M2.4-R1-FU4 Case Z10: affirming both options stays ambiguous", async () => {
      const result = await answerSeededConflict("m24z10", "第一条准确，第二条也准确");
      assertAmbiguousClarification("m24z10", result);
    });

    await check("M2.4-R1-FU5 Case Z11: 不够准确 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z11", "第一条不够准确");
      assertAmbiguousClarification("m24z11", result);
    });

    await check("M2.4-R1-FU5 Case Z12: 不够准确 second must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z12", "第二条不够准确");
      assertAmbiguousClarification("m24z12", result);
    });

    await check("M2.4-R1-FU5 Case Z13: 不算准确 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z13", "第一条不算准确");
      assertAmbiguousClarification("m24z13", result);
    });

    await check("M2.4-R1-FU5 Case Z14: 准确度不高 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z14", "第一条准确度不高");
      assertAmbiguousClarification("m24z14", result);
    });

    await check("M2.4-R1-FU5 Case Z15: 准确性不足 second must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z15", "第二条准确性不足");
      assertAmbiguousClarification("m24z15", result);
    });

    await check("M2.4-R1-FU5 Case Z16: 不完全准确 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z16", "第一条不完全准确");
      assertAmbiguousClarification("m24z16", result);
    });

    await check("M2.4-R1-FU5 Case Z17: 不见得准确 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z17", "第一条不见得准确");
      assertAmbiguousClarification("m24z17", result);
    });

    await check("M2.4-R1-FU5 Case Z18: 不符合实际 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z18", "第一条不符合实际");
      assertAmbiguousClarification("m24z18", result);
    });

    await check("M2.4-R1-FU5 Case Z19: insufficient first and affirmed second selects the second fact", async () => {
      const result = await answerSeededConflict("m24z19", "第一条不够准确，但第二条准确");
      assertSelectedClarification("m24z19", result, result.seeded.factB.fact_id);
    });

    await check("M2.4-R1-FU5 Case Z20: insufficient second and affirmed first selects the first fact", async () => {
      const result = await answerSeededConflict("m24z20", "第二条不算准确，而是第一条准确");
      assertSelectedClarification("m24z20", result, result.seeded.factA.fact_id);
    });

    await check("M2.4-R1-FU6 Case Z21: 准确率不高 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z21", "第一条准确率不高");
      assertAmbiguousClarification("m24z21", result);
    });

    await check("M2.4-R1-FU6 Case Z22: 准确率偏低 second must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z22", "第二条准确率偏低");
      assertAmbiguousClarification("m24z22", result);
    });

    await check("M2.4-R1-FU6 Case Z23: 正确率不高 first must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z23", "第一条正确率不高");
      assertAmbiguousClarification("m24z23", result);
    });

    await check("M2.4-R1-FU6 Case Z24: 正确率不足 second must stay ambiguous", async () => {
      const result = await answerSeededConflict("m24z24", "第二条正确率不足");
      assertAmbiguousClarification("m24z24", result);
    });

    await check("M2.4-R1-FU6 Case Z25: accuracy-rate insufficient first and affirmed second selects the second fact", async () => {
      const result = await answerSeededConflict("m24z25", "第一条准确率不高，但第二条准确");
      assertSelectedClarification("m24z25", result, result.seeded.factB.fact_id);
    });

    // ------------------------------------------------------------------
    // M2.4-R2 — model-backed answer interpretation main path (A–F)
    // ------------------------------------------------------------------

    function authorizedFrom(session: POJUSessionState): {
      dir_ids: string[];
      ddr_ids: string[];
      fact_roles: string[];
      fact_role_codes: string[];
    } {
      const last = session.decision_understanding?.last_sent_question;
      const plan = session.decision_understanding?.next_question_plan ?? session.adaptive_ask_plan;
      const src = last && (last.dir_ids.length > 0 || last.ddr_ids.length > 0) ? last : plan;
      const codes = src && "fact_role_codes" in src ? src.fact_role_codes ?? [] : [];
      const roles = codes
        .map((c: string) => {
          const m = /\/role\/([^/]+)$/.exec(c);
          return m?.[1] ?? "";
        })
        .filter(Boolean);
      return {
        dir_ids: src ? [...src.dir_ids] : [],
        ddr_ids: src ? [...src.ddr_ids] : [],
        fact_roles: roles,
        fact_role_codes: [...codes],
      };
    }

    function roleCodeDir(code: string): string {
      const m = /^v1\/dir\/([^/]+)\/role\/([^/]+)$/.exec(code);
      return m?.[1] ?? "";
    }

    const EXTRA_JOB_ROLE_CODES = [
      "v1/dir/DIR-OPT-ON-TABLE/role/option",
      "v1/dir/DIR-STATUS-QUO/role/status_quo",
      "v1/dir/DIR-OPT-CONSTRAINTS/role/hard_constraint",
      "v1/dir/DIR-RISK-TOLERANCE/role/risk",
    ] as const;

    function withTwoAuthorizedRoleCodes(session: POJUSessionState): {
      session: POJUSessionState;
      codeA: string;
      codeB: string;
    } {
      const last = session.decision_understanding?.last_sent_question;
      assert.ok(last, "last_sent_question required for two-role authorization setup");
      const existing = [...(last.fact_role_codes ?? [])];
      const codeA = existing[0] ?? EXTRA_JOB_ROLE_CODES[0];
      const codeB =
        existing.find((c) => c !== codeA) ??
        EXTRA_JOB_ROLE_CODES.find((c) => c !== codeA) ??
        EXTRA_JOB_ROLE_CODES[1];
      const dirs = Array.from(
        new Set(
          [...last.dir_ids, roleCodeDir(codeA), roleCodeDir(codeB)].filter((d) => d.length > 0),
        ),
      );
      const patched: POJUSessionState = {
        ...session,
        decision_understanding: session.decision_understanding
          ? {
              ...session.decision_understanding,
              last_sent_question: {
                ...last,
                dir_ids: dirs,
                fact_role_codes: [codeA, codeB],
              },
            }
          : session.decision_understanding,
      };
      return { session: patched, codeA, codeB };
    }

    async function seedAnswerReadySession(tag: string): Promise<POJUSessionState> {
      const sid = await seedSession(tag, jobDirs, {
        decision_question: "要不要离职去创业？",
      });
      const seeded = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: `init_${tag}`,
        now: NOW,
        init_only: true,
      });
      assert.ok(seeded.plan && seeded.authorized_question, `${tag} first plan required`);
      const { attachAuthorizedAssistantQuestion } = await import(
        "../lib/poju/decision-intake/adaptive-turn"
      );
      const attached = attachAuthorizedAssistantQuestion(
        seeded.session,
        seeded.plan!,
        `ask_${tag}`,
      );
      await mutatePOJUSession(sid, {
        operation_id: `op_${tag}_init`,
        kind: "session_patch",
        bump_dc: true,
        apply: () => attached,
      });
      return durable(sid);
    }

    await check("M2.4-R2 Case A: three consecutive real handleUserMessage rounds", async () => {
      let s = await seedAnswerReadySession("m24r2a");
      const logs: string[] = [];

      const hookFor = (draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft) => ({
        interpretAnswerModel: () => draft,
      });

      // Round 1: two explicit facts
      const auth1 = authorizedFrom(s);
      assert.ok(auth1.dir_ids.length >= 1 && auth1.fact_roles.length >= 1, "round1 must have authorized targets");
      const v0 = s.decision_context!.version;
      const asked0 = s.decision_understanding?.budget.session_asked_count ?? 0;
      fetchCalls.length = 0;
      stubResponse = "R2A FREEFORM ROUND 1";
      const r1Text = "我目前仍在职，月薪三万。另外家里有一个孩子。";
      const out1 = await handleUserMessage({
        session: s,
        userMessage: r1Text,
        locale: "zh-CN",
        __testOnlyM1Hooks: hookFor({
          classification: "clear_answer",
          extracted_items: [
            {
              text: "我目前仍在职，月薪三万。",
              source_quote: "我目前仍在职，月薪三万。",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: auth1.fact_role_codes[0] ?? null,
              certainty: "explicit",
            },
            {
              text: "家里有一个孩子。",
              source_quote: "家里有一个孩子。",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: auth1.fact_role_codes[0] ?? null,
              certainty: "explicit",
            },
          ],
          unresolved_aspects: [],
          explanation: "two explicit facts",
        }),
      });
      await mutatePOJUSession(s.session_id, {
        operation_id: "op_m24r2a_r1",
        kind: "session_patch",
        bump_dc: true,
        apply: () => out1,
      });
      s = await durable(s.session_id);
      const facts1 = s.decision_context!.reality_facts.filter((f) => f.statement.includes("仍在职") || f.statement.includes("孩子"));
      // M2.4-R2: both items bind the same role, so they are one fact whose
      // statement is the raw answer; each item keeps its own locator.
      assert.equal(facts1.length, 1, `round1 must write one raw-answer fact, got ${facts1.length}`);
      assert.equal(facts1[0]!.statement, r1Text);
      const w1 = s.last_answer_event?.proposed_writes.find((w) => w.kind === "reality_fact");
      assert.equal(w1?.provenance?.length, 2, "both item locators must be kept");
      assert.deepEqual(
        w1!.provenance!.map((p) => r1Text.slice(p.located_start!, p.located_end!)),
        ["我目前仍在职，月薪三万。", "家里有一个孩子。"],
      );
      for (const fact of facts1) {
        assert.equal(fact.status, "unverified");
        assert.notEqual(fact.status, "confirmed");
        assert.ok(fact.related_dir_ids.some((id) => auth1.dir_ids.includes(id)));
        assert.ok(fact.fact_roles.some((role) => auth1.fact_roles.includes(role)));
        assert.equal(fact.statement.includes("two explicit facts"), false, "explanation must not become a fact");
      }
      assert.ok(s.decision_context!.version > v0, "round1 DC version must increase");
      assert.ok(s.decision_understanding);
      assert.equal(
        s.decision_understanding!.context_version,
        s.decision_context!.version,
        "round1 Understanding.context_version must match DC.version",
      );
      const asst1 = lastAssistant(s);
      assert.ok(s.adaptive_ask_plan, "round1 next question required");
      assert.equal(asst1.content, s.adaptive_ask_plan!.question_text);
      assert.notEqual(asst1.content, stubResponse);
      const needDirs1 = new Set(
        s.decision_understanding!.need_to_understand.items
          .filter((n) => n.kind === "dir_based")
          .map((n) => n.dir_id),
      );
      for (const d of s.adaptive_ask_plan!.dir_ids) {
        assert.ok(
          needDirs1.has(d) || s.decision_context!.dirs.some((x) => x.dir_id === d),
          `round1 next Q dir ${d} must come from latest NeedItem or live DIR`,
        );
      }
      const q1 = asst1.content;
      const roles1Satisfied = new Set(facts1.flatMap((f) => f.fact_roles));
      logs.push(
        `[m24r2a] round=1 input=${r1Text}; facts=${s.decision_context!.reality_facts.length}; written=${facts1.map((f) => `${f.fact_id}:${f.status}:${f.verification_level}:${f.fact_roles.join(",")}`).join("|")}; dc=${v0}->${s.decision_context!.version}; ctx_ver=${s.decision_understanding!.context_version}; next_q=${q1}; next_dirs=${s.adaptive_ask_plan!.dir_ids.join(",")}; next_roles=${(s.adaptive_ask_plan!.fact_role_codes ?? []).join(",")}; asked=${asked0}->${s.decision_understanding!.budget.session_asked_count}`,
      );

      // Round 2: estimate + explicit constraint
      const auth2 = authorizedFrom(s);
      const v1 = s.decision_context!.version;
      const asked1 = s.decision_understanding!.budget.session_asked_count;
      fetchCalls.length = 0;
      stubResponse = "R2A FREEFORM ROUND 2";
      const r2Text = "大概还能撑 6 个月。硬约束是必须保留社保。";
      const out2 = await handleUserMessage({
        session: s,
        userMessage: r2Text,
        locale: "zh-CN",
        __testOnlyM1Hooks: hookFor({
          classification: "partial_answer",
          extracted_items: [
            {
              text: "大概还能撑 6 个月。",
              source_quote: "大概还能撑 6 个月。",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: auth2.fact_role_codes[0] ?? null,
              certainty: "estimated",
            },
            {
              text: "硬约束是必须保留社保。",
              source_quote: "硬约束是必须保留社保。",
              semantic_kind: "constraint",
              role_hint: null,
              role_code_hint: auth2.fact_role_codes[0] ?? null,
              certainty: "explicit",
            },
          ],
          unresolved_aspects: [],
          explanation: "estimate plus constraint",
        }),
      });
      await mutatePOJUSession(s.session_id, {
        operation_id: "op_m24r2a_r2",
        kind: "session_patch",
        bump_dc: true,
        apply: () => out2,
      });
      s = await durable(s.session_id);
      const estimateFact = s.decision_context!.reality_facts.find((f) => f.statement.includes("撑 6 个月") || f.statement.includes("撑6个月"));
      assert.ok(estimateFact, "round2 estimate fact missing");
      assert.equal(estimateFact!.verification_level, "user_estimate");
      assert.equal(estimateFact!.status, "unverified");
      assert.notEqual(estimateFact!.status, "confirmed");
      const cst = s.decision_context!.constraints.find((c) => c.statement.includes("必须保留社保"));
      assert.ok(cst, "round2 constraint missing");
      assert.equal(cst!.status, "unverified");
      assert.equal(cst!.user_confirmed, false);
      assert.ok(s.decision_context!.version > v1);
      assert.equal(s.decision_understanding!.context_version, s.decision_context!.version);
      const asst2 = lastAssistant(s);
      assert.ok(s.adaptive_ask_plan, "round2 next question required");
      assert.equal(asst2.content, s.adaptive_ask_plan!.question_text);
      assert.notEqual(asst2.content, stubResponse);
      const nextRoles2 = (s.adaptive_ask_plan!.fact_role_codes ?? [])
        .map((c) => {
          const m = /\/role\/([^/]+)$/.exec(c);
          return m?.[1] ?? "";
        })
        .filter(Boolean);
      if (roles1Satisfied.size > 0 && nextRoles2.length > 0) {
        const onlyRepeatSatisfied =
          nextRoles2.every((role) => roles1Satisfied.has(role)) &&
          s.adaptive_ask_plan!.dir_ids.every((d) => facts1.some((f) => f.related_dir_ids.includes(d))) &&
          s.decision_understanding!.need_to_understand.items.some(
            (n) =>
              n.kind === "dir_based" &&
              !s.adaptive_ask_plan!.dir_ids.includes(n.dir_id),
          );
        assert.equal(
          onlyRepeatSatisfied,
          false,
          "round2 next question must not only repeat already-satisfied roles when other needs remain",
        );
      }
      const q2 = asst2.content;
      logs.push(
        `[m24r2a] round=2 input=${r2Text}; estimate=${estimateFact!.fact_id}:${estimateFact!.status}:${estimateFact!.verification_level}; constraint=${cst!.constraint_id}:${cst!.status}; facts=${s.decision_context!.reality_facts.length}; constraints=${s.decision_context!.constraints.length}; dc=${v1}->${s.decision_context!.version}; ctx_ver=${s.decision_understanding!.context_version}; next_q=${q2}; next_dirs=${s.adaptive_ask_plan!.dir_ids.join(",")}; next_roles=${(s.adaptive_ask_plan!.fact_role_codes ?? []).join(",")}; asked=${asked1}->${s.decision_understanding!.budget.session_asked_count}`,
      );

      // Round 3: correction + supplement, keep original fact, open Conflict if mutex holds.
      // Keep the original fact dimension in last_sent authorization so Conflict
      // evaluation can see the related old fact (shared DIR/role is required).
      const originalStay = s.decision_context!.reality_facts.find((f) => f.statement.includes("仍在职"));
      assert.ok(originalStay, "original 仍在职 fact must exist before correction");
      const lastSent = s.decision_understanding?.last_sent_question;
      if (lastSent && originalStay) {
        const roleDir = (originalStay.related_dir_ids ?? lastSent.dir_ids)[0] ?? lastSent.direction_id;
        const mergedDirs = Array.from(new Set([...lastSent.dir_ids, ...(originalStay.related_dir_ids ?? [])]));
        const extraCodes = (originalStay.fact_roles ?? []).map(
          (role) => `v1/dir/${roleDir}/role/${role}`,
        );
        const mergedCodes = Array.from(new Set([...(lastSent.fact_role_codes ?? []), ...extraCodes]));
        // FU1: capture codes after merge for role_code_hint injection below.
        s = {
          ...s,
          decision_understanding: s.decision_understanding
            ? {
                ...s.decision_understanding,
                last_sent_question: {
                  ...lastSent,
                  dir_ids: mergedDirs,
                  fact_role_codes: mergedCodes,
                },
              }
            : s.decision_understanding,
        };
      }
      const auth3 = authorizedFrom(s);
      const correctionCode =
        auth3.fact_role_codes.find((c) => (originalStay.fact_roles ?? []).some((r) => c.endsWith("/role/" + r))) ??
        auth3.fact_role_codes[0] ??
        null;
      const supplementCode =
        auth3.fact_role_codes.find((c) => c !== correctionCode && c.includes("/role/option")) ??
        auth3.fact_role_codes.find((c) => c !== correctionCode) ??
        correctionCode;
      const v2 = s.decision_context!.version;
      const factIdsBefore = s.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      fetchCalls.length = 0;
      stubResponse = "R2A FREEFORM ROUND 3";
      const r3Text = "更正一下，我已经离职了，不是仍在职。另外还有一个备选是内部转岗。";
      const out3 = await handleUserMessage({
        session: s,
        userMessage: r3Text,
        locale: "zh-CN",
        __testOnlyM1Hooks: hookFor({
          classification: "correction",
          extracted_items: [
            {
              text: "我已经离职了，不是仍在职。",
              source_quote: "我已经离职了，不是仍在职。",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: correctionCode,
              certainty: "explicit",
            },
            {
              text: "还有一个备选是内部转岗。",
              source_quote: "还有一个备选是内部转岗。",
              semantic_kind: "reality_fact",
              role_hint: null,
              role_code_hint: supplementCode,
              certainty: "explicit",
            },
          ],
          unresolved_aspects: [],
          explanation: "correction plus supplement",
        }),
      });
      await mutatePOJUSession(s.session_id, {
        operation_id: "op_m24r2a_r3",
        kind: "session_patch",
        bump_dc: true,
        apply: () => out3,
      });
      s = await durable(s.session_id);
      const stillOriginal = s.decision_context!.reality_facts.find((f) => f.fact_id === originalStay!.fact_id);
      assert.ok(stillOriginal, "original fact must not be silently deleted");
      const roleOf = (code: string | null) => (code ? /\/role\/([^/]+)$/.exec(code)?.[1] ?? "" : "");
      const r3Facts = s.decision_context!.reality_facts.filter((f) => f.statement === r3Text);
      const correctionFact = r3Facts.find((f) => f.fact_roles.includes(roleOf(correctionCode)));
      const supplementFact = r3Facts.find((f) => f.fact_roles.includes(roleOf(supplementCode)));
      assert.ok(correctionFact, "correction fact missing");
      assert.ok(supplementFact, "supplement fact missing");
      assert.notEqual(correctionFact!.fact_id, originalStay!.fact_id);
      assert.ok(s.decision_context!.version > v2);
      assert.equal(s.decision_understanding!.context_version, s.decision_context!.version);
      // M2.4-R2: correction keeps both facts and links new → old; no silent overwrite.
      assert.ok(
        (correctionFact!.corrects_fact_ids ?? []).includes(originalStay!.fact_id),
        "correction must link the corrected fact",
      );
      const openConflicts = s.decision_context!.conflicts.filter((c) => c.state === "open");
      assert.equal(
        openConflicts.some((c) => c.fact_ids.includes(originalStay!.fact_id) && c.fact_ids.includes(correctionFact!.fact_id)),
        false,
        "an explicit correction is a link, not a Conflict",
      );
      const asst3 = lastAssistant(s);
      assert.ok(s.adaptive_ask_plan, "round3 next question required");
      assert.equal(asst3.content, s.adaptive_ask_plan!.question_text);
      assert.notEqual(asst3.content, stubResponse);
      const nextCf = s.decision_understanding?.last_sent_question?.conflict_clarification
        ?? s.adaptive_ask_plan?.conflict_clarification
        ?? null;
      const needOrConflictBound =
        Boolean(nextCf) ||
        s.adaptive_ask_plan!.dir_ids.some((d) =>
          s.decision_understanding!.need_to_understand.items.some(
            (n) => n.kind === "dir_based" && n.dir_id === d,
          ),
        );
      assert.equal(needOrConflictBound, true, "round3 next Q must bind remaining need or Conflict");
      logs.push(
        `[m24r2a] round=3 input=${r3Text}; kept_original=${stillOriginal!.fact_id}; correction=${correctionFact!.fact_id}; supplement=${supplementFact!.fact_id}; conflicts=${s.decision_context!.conflicts.map((c) => `${c.conflict_id}:${c.state}:${c.fact_ids.join("+")}`).join("|")}; fact_ids_before=${factIdsBefore.join(",")}; fact_ids_after=${s.decision_context!.reality_facts.map((f) => f.fact_id).join(",")}; dc=${v2}->${s.decision_context!.version}; ctx_ver=${s.decision_understanding!.context_version}; next_q=${asst3.content}; next_dirs=${s.adaptive_ask_plan!.dir_ids.join(",")}; next_cf=${nextCf?.conflict_id ?? "none"}`,
      );

      for (const line of logs) console.log(line);
    });

    await check("M2.4-R2 Case B: unauthorized model role/DIR/DDR is rejected", async () => {
      const before = await seedAnswerReadySession("m24r2b");
      const auth = authorizedFrom(before);
      const vBefore = before.decision_context!.version;
      const factIdsBefore = before.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      stubResponse = "R2B FREEFORM";
      const out = await handleUserMessage({
        session: before,
        userMessage: "我有一个方案是留任。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "越权角色不应写入。",
                source_quote: "越权角色不应写入。",
                semantic_kind: "reality_fact",
                role_hint: "not_a_real_authorized_role",
                role_code_hint: "v1/dir/DIR-NOT-AUTHORIZED/role/not_a_real_authorized_role",
                certainty: "explicit",
              },
              {
                text: "我有一个方案是留任。",
                source_quote: "我有一个方案是留任。",
                semantic_kind: "reality_fact",
                role_hint: auth.fact_roles[0] ?? null,
                role_code_hint: auth.fact_role_codes[0] ?? null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "overreach",
            dir_ids: ["DIR-NOT-AUTHORIZED"],
            ddr_ids: ["DDR-NOT-AUTHORIZED"],
            user_confirmed: true,
          }),
        },
      });
      const dc = out.decision_context!;
      const overreach = dc.reality_facts.filter((f) => f.statement.includes("越权角色不应写入"));
      assert.equal(overreach.length, 0, "unauthorized role must not write a fact");
      const legal = dc.reality_facts.filter((f) => f.statement.includes("留任"));
      assert.ok(legal.length >= 1, "authorized item may still write");
      for (const fact of legal) {
        assert.ok(fact.related_dir_ids.every((id) => auth.dir_ids.includes(id)));
        assert.ok(fact.fact_roles.every((role) => auth.fact_roles.includes(role)));
        assert.equal(fact.related_dir_ids.includes("DIR-NOT-AUTHORIZED"), false);
      }
      assert.equal(
        out.decision_understanding?.last_sent_question?.dir_ids.includes("DIR-NOT-AUTHORIZED") ?? false,
        false,
      );
      assert.ok(dc.version >= vBefore);
      assert.deepEqual(
        dc.reality_facts.filter((f) => factIdsBefore.includes(f.fact_id)).map((f) => f.fact_id).sort(),
        factIdsBefore,
      );
      console.log(
        `[m24r2b] auth_dirs=${auth.dir_ids.join(",")}; auth_roles=${auth.fact_roles.join(",")}; overreach_facts=${overreach.length}; legal_facts=${legal.length}; dc=${vBefore}->${dc.version}`,
      );
    });

    await check("M2.4-R2 Case C: model confirmation fields cannot become confirmed facts", async () => {
      const before = await seedAnswerReadySession("m24r2c");
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "我目前月薪三万。",
                source_quote: "我目前月薪三万。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: authorizedFrom(before).fact_role_codes[0] ?? null,
                certainty: "explicit",
                user_confirmed: true,
                verification_level: "confirmed",
                confirmed: true,
              },
            ],
            unresolved_aspects: [],
            explanation: "sounds reasonable so confirmed",
            user_confirmed: true,
            confirmed: true,
            verification_level: "confirmed",
            readiness: "ready_for_final_confirm",
          }),
        },
      });
      const facts = out.decision_context!.reality_facts.filter((f) => f.statement.includes("月薪三万"));
      assert.ok(facts.length >= 1, "fact should be written");
      for (const fact of facts) {
        assert.equal(fact.status, "unverified");
        assert.notEqual(fact.status, "confirmed");
        assert.ok(fact.has_user_confirm_event !== true);
        assert.notEqual(fact.verification_level, "confirmed" as string);
      }
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, "R2C FREEFORM");
      console.log(
        `[m24r2c] facts=${facts.map((f) => `${f.fact_id}:${f.status}:${f.verification_level}:confirm=${f.has_user_confirm_event}`).join("|")}`,
      );
    });

    async function assertInterpretationFailClosed(
      tag: string,
      hookResult: unknown | Error,
    ): Promise<void> {
      const before = await seedAnswerReadySession(tag);
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.map((f) => `${f.fact_id}:${f.statement}`).sort();
      const cstBefore = before.decision_context!.constraints.map((c) => `${c.constraint_id}:${c.statement}`).sort();
      const askedBefore = before.decision_understanding?.budget.session_asked_count ?? 0;
      const lastSentBefore = before.decision_understanding?.last_sent_question ?? null;
      fetchCalls.length = 0;
      stubResponse = `${tag} FREEFORM MUST NOT APPEAR`;
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => {
            if (hookResult instanceof Error) throw hookResult;
            return hookResult;
          },
        },
      });
      const asst = lastAssistant(out);
      assert.match(asst.content, /未能完成语义理解|请稍后重试/);
      assert.notEqual(asst.content, stubResponse);
      assert.equal(asst.content === stubResponse, false);
      const meta = (asst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } }).meta;
      assert.equal(meta?.m1_fail_closed, true);
      assert.ok(
        meta?.m1_outcome === "answer_interpretation_failed" ||
          meta?.m1_outcome === "answer_interpretation_invalid_schema",
        `unexpected outcome ${meta?.m1_outcome}`,
      );
      const dc = out.decision_context!;
      assert.equal(dc.version, vBefore, `${tag} DC version must be unchanged`);
      assert.deepEqual(
        dc.reality_facts.map((f) => `${f.fact_id}:${f.statement}`).sort(),
        factsBefore,
      );
      assert.deepEqual(
        dc.constraints.map((c) => `${c.constraint_id}:${c.statement}`).sort(),
        cstBefore,
      );
      assert.equal(
        out.decision_understanding?.budget.session_asked_count ?? askedBefore,
        askedBefore,
        `${tag} must not spend question budget`,
      );
      assert.equal(
        out.decision_understanding?.last_sent_question?.plan_id ?? lastSentBefore?.plan_id,
        lastSentBefore?.plan_id,
        `${tag} must not change last_sent_question authorization`,
      );
      assert.equal(
        fetchCalls.includes("/api/poju/chat"),
        false,
        `${tag} must not fall back to free-form LLM questioning`,
      );
      console.log(
        `[${tag}] outcome=${meta?.m1_outcome}; dc=${vBefore}->${dc.version}; facts=${dc.reality_facts.length}; constraints=${dc.constraints.length}; asked=${askedBefore}; last_sent=${lastSentBefore?.plan_id}; asst=${asst.content}`,
      );
    }

    await check("M2.4-R2 Case D: timeout is fail-closed", async () => {
      await assertInterpretationFailClosed("m24r2d_timeout", new Error("llm_timeout"));
    });
    await check("M2.4-R2 Case D: invalid JSON is fail-closed", async () => {
      await assertInterpretationFailClosed("m24r2d_json", "this is not json {");
    });
    await check("M2.4-R2 Case D: missing fields are fail-closed", async () => {
      await assertInterpretationFailClosed("m24r2d_schema", { classification: "clear_answer" });
    });

    await check("M2.4-R2 Case E: uncertainty and decline are not explicit facts", async () => {
      const cases: Array<{
        tag: string;
        text: string;
        draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft;
        expect: "estimate" | "unknown" | "declined" | "unverified";
      }> = [
        {
          tag: "m24r2e_estimate",
          text: "这个数字只是估计。",
          source_quote: "这个数字只是估计。",
          draft: {
            classification: "estimate",
            extracted_items: [
              {
                text: "这个数字只是估计。",
                source_quote: "这个数字只是估计。",
                semantic_kind: "reality_fact",
                role_hint: null,
                certainty: "estimated",
              },
            ],
            unresolved_aspects: [],
            explanation: "estimate",
          },
          expect: "estimate",
        },
        {
          tag: "m24r2e_unknown",
          text: "我现在还无法确定。",
          source_quote: "我现在还无法确定。",
          draft: {
            classification: "unknown",
            extracted_items: [
              {
                text: "我现在还无法确定。",
                source_quote: "我现在还无法确定。",
                semantic_kind: "reality_fact",
                role_hint: null,
                certainty: "unclear",
              },
            ],
            unresolved_aspects: [],
            explanation: "unknown",
          },
          expect: "unknown",
        },
        {
          tag: "m24r2e_declined",
          text: "这部分我不想回答。",
          source_quote: "这部分我不想回答。",
          draft: {
            classification: "declined",
            extracted_items: [
              {
                text: "这部分我不想回答。",
                source_quote: "这部分我不想回答。",
                semantic_kind: "reality_fact",
                role_hint: null,
                certainty: "unclear",
              },
            ],
            unresolved_aspects: [],
            explanation: "declined",
          },
          expect: "declined",
        },
        {
          tag: "m24r2e_unverified",
          text: "我需要再核实一下。",
          source_quote: "我需要再核实一下。",
          draft: {
            classification: "vague_answer",
            extracted_items: [
              {
                text: "我需要再核实一下。",
                source_quote: "我需要再核实一下。",
                semantic_kind: "reality_fact",
                role_hint: null,
                certainty: "unclear",
              },
            ],
            unresolved_aspects: [],
            explanation: "needs verification",
          },
          expect: "unverified",
        },
      ];
      for (const item of cases) {
        const before = await seedAnswerReadySession(item.tag);
        const legalCode = authorizedFrom(before).fact_role_codes[0] ?? null;
        const draft = {
          ...item.draft,
          extracted_items: item.draft.extracted_items.map((row) => ({
            ...row,
            role_code_hint: row.role_code_hint ?? legalCode,
            source_quote: row.source_quote ?? row.text,
          })),
        };
        const out = await handleUserMessage({
          session: before,
          userMessage: item.text,
          locale: "zh-CN",
          __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
        });
        const written = out.decision_context!.reality_facts.filter((f) =>
          f.statement.includes(item.text.replace(/。$/, "")) || f.statement === item.text,
        );
        if (item.expect === "declined") {
          assert.ok(written.length >= 1);
          assert.ok(written.every((f) => f.status === "declined" && f.verification_level === "none"));
        } else if (item.expect === "unknown") {
          assert.ok(written.length >= 1);
          assert.ok(written.every((f) => f.status === "unknown" && f.verification_level === "none"));
        } else if (item.expect === "estimate") {
          assert.ok(written.length >= 1);
          assert.ok(written.every((f) => f.status === "unverified" && f.verification_level === "user_estimate"));
        } else {
          // FU1: certainty=unclear must not become user_estimate or user_asserted.
          assert.equal(
            written.length,
            0,
            `${item.tag} unclear certainty must not write a RealityFact`,
          );
        }
        assert.ok(written.every((f) => f.status !== "confirmed"));
        console.log(
          `[m24r2e] tag=${item.tag}; input=${item.text}; writes=${written.map((f) => `${f.status}:${f.verification_level}`).join("|") || "none"}`,
        );
      }
    });

    await check("M2.4-R2 Case F: real persist + same source_turn_id resubmit is idempotent", async () => {
      const before = await seedAnswerReadySession("m24r2f");
      stubResponse = "R2F FREEFORM 1";
      const first = await handleUserMessage({
        session: before,
        userMessage: "硬约束是必须保留社保，预算不能低于现在的 70%。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "硬约束是必须保留社保，预算不能低于现在的 70%。",
                source_quote: "硬约束是必须保留社保，预算不能低于现在的 70%。",
                semantic_kind: "constraint",
                role_hint: null,
                role_code_hint: authorizedFrom(before).fact_role_codes[0] ?? null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "constraint",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2f_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const committed = await durable(first.session_id);
      const turnId = lastUserId(committed);
      const facts1 = committed.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const cst1 = committed.decision_context!.constraints.map((c) => c.constraint_id).sort();
      const v1 = committed.decision_context!.version;
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      const q1 = lastAssistant(committed).content;
      stubResponse = "R2F FREEFORM 2 MUST NOT WIN";
      const replaySession = {
        ...committed,
        messages: [
          ...committed.messages,
          {
            role: "user" as const,
            content: "硬约束是必须保留社保，预算不能低于现在的 70%。",
            timestamp: NOW,
            client_id: turnId,
          },
        ],
      };
      const replay = await handleUserMessage({
        session: replaySession,
        userMessage: "硬约束是必须保留社保，预算不能低于现在的 70%。",
        locale: "zh-CN",
        userAlreadyAppended: true,
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "硬约束是必须保留社保，预算不能低于现在的 70%。",
                source_quote: "硬约束是必须保留社保，预算不能低于现在的 70%。",
                semantic_kind: "constraint",
                role_hint: null,
                role_code_hint: authorizedFrom(committed).fact_role_codes[0] ?? null,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "constraint replay",
          }),
        },
      });
      assert.equal(lastUserId(replay), turnId);
      const dc = replay.decision_context!;
      assert.deepEqual(dc.reality_facts.map((f) => f.fact_id).sort(), facts1);
      assert.deepEqual(dc.constraints.map((c) => c.constraint_id).sort(), cst1);
      assert.equal(dc.version, v1, "replay must not bump DC version");
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      const asst = lastAssistant(replay);
      assert.notEqual(asst.content, stubResponse);
      if (replay.adaptive_ask_plan) {
        assert.equal(asst.content, replay.adaptive_ask_plan.question_text);
      }
      // Recovered question should be the already-authorized one, not a second logical question.
      assert.equal(asst.content, q1, "replay must recover the existing authorized question");
      console.log(
        `[m24r2f] turn=${turnId}; facts=${facts1.length}; constraints=${cst1.length}; dc=${v1}->${dc.version}; asked=${asked1}; q_recovered=${asst.content === q1}`,
      );
    });

    await check("M2.4-R2-FU1 Case G: multi-role auth + null role_code_hint writes nothing", async () => {
      const seeded = await seedAnswerReadySession("m24r2g");
      const { session: before, codeA, codeB } = withTwoAuthorizedRoleCodes(seeded);
      assert.notEqual(codeA, codeB, "Case G needs two distinct authorized role codes");
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const askedBefore = before.decision_understanding?.budget.session_asked_count ?? 0;
      const lastSentBefore = before.decision_understanding?.last_sent_question ?? null;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "我目前仍在职。",
            source_quote: "我目前仍在职。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: null,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "null role under multi-role auth",
      };
      fetchCalls.length = 0;
      stubResponse = "R2G FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前仍在职。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "Case G must not write RealityFacts");
      assert.equal(dc.constraints.length, cstBefore, "Case G must not write Constraints");
      assert.equal(dc.version, vBefore, "Case G must not bump DC version");
      const bothFilled = [codeA, codeB].every((code) => {
        const role = code.split("/role/")[1] ?? "";
        const dir = roleCodeDir(code);
        return dc.reality_facts.some(
          (f) => (f.fact_roles ?? []).includes(role) && (f.related_dir_ids ?? []).includes(dir),
        );
      });
      assert.equal(bothFilled, false, "Case G must not fill both authorized roles");
      const probe = answerEventFromModelDraft({
        session: before,
        statement: "我目前仍在职。",
        source_turn_id: "probe_m24r2g",
        draft,
      });
      assert.equal(probe.proposed_writes.length, 0);
      assert.ok(
        probe.notes.some((n) => n.includes("unlocated_role_code") || n.includes("unresolved:unlocated_role_code")),
        `Case G must keep unresolved aspect, notes=${probe.notes.join("|")}`,
      );
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, stubResponse);
      if (out.adaptive_ask_plan) {
        assert.equal(asst.content, out.adaptive_ask_plan.question_text);
      }
      // FU2 behavior change: a no-write role-binding failure must keep pending
      // clarification and must NOT jump to the next unrelated NeedItem.
      const pending = out.pending_answer_resolution ?? null;
      assert.ok(pending && pending.status === "pending", "Case G must persist pending_answer_resolution");
      assert.ok(
        asst.content.includes("已授权的调查角色") || asst.content.includes("可选角色"),
        `Case G must ask a role clarification, got=${asst.content.slice(0, 120)}`,
      );
      const sentCodes = out.decision_understanding?.last_sent_question?.fact_role_codes ?? [];
      assert.deepEqual([...sentCodes].sort(), [codeA, codeB].sort(), "clarification must keep the original authorized role codes");
      const originalDirs = [...(lastSentBefore?.dir_ids ?? [])].sort();
      const nextDirs = [...(out.adaptive_ask_plan?.dir_ids ?? [])].sort();
      assert.deepEqual(nextDirs, originalDirs, "Case G must not jump to a different NeedItem DIR set");
      assert.ok(
        (out.decision_understanding?.last_sent_question?.plan_id ?? "").startsWith("qp_role_clarify_"),
        "Case G last_sent must be the clarification plan",
      );
      console.log(
        `[m24r2g] codes=${codeA}|${codeB}; facts=${factsBefore}->${dc.reality_facts.length}; constraints=${cstBefore}->${dc.constraints.length}; dc=${vBefore}->${dc.version}; asked=${askedBefore}->${out.decision_understanding?.budget.session_asked_count ?? askedBefore}; unresolved=${probe.notes.join(",")}; writes=${probe.proposed_writes.length}; next_q=${asst.content}; next_dirs=${(out.adaptive_ask_plan?.dir_ids ?? []).join(",")}; last_sent=${out.decision_understanding?.last_sent_question?.plan_id}; pending=${pending?.status}:${pending?.unresolved_items.map((i)=>i.reason).join(",")}`,
      );
    });

    await check("M2.4-R2-FU1 Case H: exact role codes bind independently", async () => {
      const seeded = await seedAnswerReadySession("m24r2h");
      const { session: before, codeA, codeB } = withTwoAuthorizedRoleCodes(seeded);
      const vBefore = before.decision_context!.version;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "事实A绑定角色A。",
            source_quote: "事实A绑定角色A。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: codeA,
            certainty: "explicit",
          },
          {
            text: "事实B绑定角色B。",
            source_quote: "事实B绑定角色B。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: codeB,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "exact role codes",
      };
      stubResponse = "R2H FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "事实A绑定角色A。另外事实B绑定角色B。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      const dirA = roleCodeDir(codeA);
      const dirB = roleCodeDir(codeB);
      const roleA = codeA.split("/role/")[1]!;
      const roleB = codeB.split("/role/")[1]!;
      const rawH = "事实A绑定角色A。另外事实B绑定角色B。";
      const factA = dc.reality_facts.find((f) => f.statement === rawH && f.fact_roles.includes(roleA));
      const factB = dc.reality_facts.find((f) => f.statement === rawH && f.fact_roles.includes(roleB));
      assert.ok(factA, "fact A missing");
      assert.ok(factB, "fact B missing");
      assert.deepEqual(factA!.fact_roles, [roleA]);
      assert.deepEqual(factA!.related_dir_ids, [dirA]);
      assert.deepEqual(factB!.fact_roles, [roleB]);
      assert.deepEqual(factB!.related_dir_ids, [dirB]);
      assert.equal(factA!.fact_roles.includes(roleB) && dirA !== dirB, false);
      assert.equal((factA!.related_dir_ids ?? []).includes(dirB) && dirA !== dirB, false);
      assert.equal((factB!.related_dir_ids ?? []).includes(dirA) && dirA !== dirB, false);
      assert.equal((factA!.related_dir_ids ?? []).includes("DIR-NOT-AUTHORIZED"), false);
      assert.equal((factB!.related_dir_ids ?? []).includes("DIR-NOT-AUTHORIZED"), false);
      assert.equal(dc.version, vBefore + 1, "DC version must increment once");
      console.log(
        `[m24r2h] codeA=${codeA}; codeB=${codeB}; factA=${factA!.fact_id}:${factA!.fact_roles.join(",")}:${(factA!.related_dir_ids ?? []).join(",")}; factB=${factB!.fact_id}:${factB!.fact_roles.join(",")}:${(factB!.related_dir_ids ?? []).join(",")}; dc=${vBefore}->${dc.version}`,
      );
    });

    await check("M2.4-R2-FU1 Case I: forged role code is rejected; legal item still writes", async () => {
      const before = await seedAnswerReadySession("m24r2i");
      const auth = authorizedFrom(before);
      const legalCode = auth.fact_role_codes[0] ?? null;
      assert.ok(legalCode, "Case I needs a legal authorized role code");
      const forged = "v1/dir/DIR-FORGED/role/forged_role";
      const vBefore = before.decision_context!.version;
      const lastPlan = before.decision_understanding?.last_sent_question?.plan_id;
      const lastCodes = [...(before.decision_understanding?.last_sent_question?.fact_role_codes ?? [])];
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "伪造角色不应写入。",
            source_quote: "伪造角色不应写入。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: forged,
            certainty: "explicit",
          },
          {
            text: "这是合法授权条目。",
            source_quote: "这是合法授权条目。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "forged role code",
      };
      stubResponse = "R2I FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "伪造角色不应写入。另外这是合法授权条目。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      const overreach = dc.reality_facts.filter(
        (f) => f.fact_roles.includes("forged_role") || (f.related_dir_ids ?? []).includes("DIR-FORGED"),
      );
      const legal = dc.reality_facts.filter(
        (f) => f.statement === "伪造角色不应写入。另外这是合法授权条目。",
      );
      assert.equal(overreach.length, 0, "forged role must not write");
      assert.ok(legal.length >= 1, "legal item should still write");
      for (const fact of legal) {
        assert.deepEqual(fact.fact_roles, [legalCode.split("/role/")[1]]);
        assert.deepEqual(fact.related_dir_ids, [roleCodeDir(legalCode)]);
        assert.equal((fact.fact_roles ?? []).includes("forged_role"), false);
        assert.equal((fact.related_dir_ids ?? []).includes("DIR-FORGED"), false);
      }
      assert.equal(
        (out.decision_understanding?.last_sent_question?.fact_role_codes ?? []).includes(forged),
        false,
      );
      // FU2: the illegal item stays pending; the next question is a role
      // clarification and must not absorb the forged role code into the Plan.
      assert.equal((lastCodes).includes(forged), false);
      assert.ok(out.pending_answer_resolution, "Case I must keep the illegal item pending");
      assert.equal(
        (out.decision_understanding?.last_sent_question?.fact_role_codes ?? []).includes(forged),
        false,
        "new last_sent must not absorb the forged role code",
      );
      assert.equal(
        (out.adaptive_ask_plan?.fact_role_codes ?? []).includes(forged),
        false,
        "next Plan must not absorb the forged role code",
      );
      const probe = answerEventFromModelDraft({
        session: before,
        statement: "伪造角色不应写入。另外这是合法授权条目。",
        source_turn_id: "probe_m24r2i",
        draft,
      });
      console.log(
        `[m24r2i] legal=${legalCode}; forged=${forged}; overreach=${overreach.length}; legal_facts=${legal.length}; legal_bind=${legal.map((f) => `${f.fact_id}:${(f.fact_roles ?? []).join(",")}:${(f.related_dir_ids ?? []).join(",")}`).join("|")}; dc=${vBefore}->${dc.version}; notes=${probe.notes.join(",")}; plan=${out.decision_understanding?.last_sent_question?.plan_id}`,
      );
    });

    await check("M2.4-R2-FU1 Case J: unclear must not become estimate", async () => {
      const before = await seedAnswerReadySession("m24r2j");
      const legalCode = authorizedFrom(before).fact_role_codes[0] ?? null;
      assert.ok(legalCode, "Case J needs a legal authorized role code");
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "partial_answer",
        extracted_items: [
          {
            text: "用户可能有一定资金储备",
            source_quote: "用户可能有一定资金储备",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "unclear",
          },
        ],
        unresolved_aspects: [],
        explanation: "unclear certainty test",
      };
      stubResponse = "R2J FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "用户可能有一定资金储备",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore);
      assert.equal(dc.constraints.length, cstBefore);
      assert.equal(dc.version, vBefore);
      assert.equal(
        dc.reality_facts.some((f) => f.verification_level === "user_estimate"),
        false,
      );
      assert.equal(
        dc.reality_facts.some((f) => f.verification_level === "user_asserted" && f.statement.includes("资金储备")),
        false,
      );
      const probe = answerEventFromModelDraft({
        session: before,
        statement: "用户可能有一定资金储备",
        source_turn_id: "probe_m24r2j",
        draft,
      });
      assert.equal(probe.proposed_writes.length, 0, "only-unclear turn must have empty proposed_writes");
      assert.ok(
        probe.notes.some((n) => n.includes("unclear_certainty")),
        `Case J must keep unclear unresolved, notes=${probe.notes.join("|")}`,
      );
      console.log(
        `[m24r2j] code=${legalCode}; facts=${factsBefore}->${dc.reality_facts.length}; constraints=${cstBefore}->${dc.constraints.length}; dc=${vBefore}->${dc.version}; writes=${probe.proposed_writes.length}; unresolved=${probe.notes.join(",")}`,
      );
    });

    await check("M2.4-R2-FU1 Case K: estimated is kept as user_estimate", async () => {
      const before = await seedAnswerReadySession("m24r2k");
      const legalCode = authorizedFrom(before).fact_role_codes[0] ?? null;
      assert.ok(legalCode, "Case K needs a legal authorized role code");
      const vBefore = before.decision_context!.version;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "estimate",
        extracted_items: [
          {
            text: "大概还能撑 6 个月。",
            source_quote: "大概还能撑 6 个月。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "estimated",
          },
        ],
        unresolved_aspects: [],
        explanation: "estimated fact",
      };
      stubResponse = "R2K FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "大概还能撑 6 个月。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const fact = out.decision_context!.reality_facts.find((f) => f.statement.includes("撑 6 个月"));
      assert.ok(fact, "estimated fact missing");
      assert.equal(fact!.status, "unverified");
      assert.equal(fact!.verification_level, "user_estimate");
      assert.notEqual(fact!.verification_level, "user_asserted");
      assert.notEqual(fact!.status, "confirmed");
      assert.deepEqual(fact!.fact_roles, [legalCode.split("/role/")[1]]);
      assert.deepEqual(fact!.related_dir_ids, [roleCodeDir(legalCode)]);
      assert.ok(out.decision_context!.version > vBefore);
      console.log(
        `[m24r2k] code=${legalCode}; fact=${fact!.fact_id}:${fact!.status}:${fact!.verification_level}:${(fact!.fact_roles ?? []).join(",")}:${(fact!.related_dir_ids ?? []).join(",")}; dc=${vBefore}->${out.decision_context!.version}`,
      );
    });

    await check("M2.4-R2-FU1 Case L: explicit is kept as user_asserted and not confirmed", async () => {
      const before = await seedAnswerReadySession("m24r2l");
      const legalCode = authorizedFrom(before).fact_role_codes[0] ?? null;
      assert.ok(legalCode, "Case L needs a legal authorized role code");
      const vBefore = before.decision_context!.version;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "我目前月薪三万。",
            source_quote: "我目前月薪三万。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "explicit fact",
      };
      stubResponse = "R2L FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const fact = out.decision_context!.reality_facts.find((f) => f.statement.includes("月薪三万"));
      assert.ok(fact, "explicit fact missing");
      assert.equal(fact!.status, "unverified");
      assert.equal(fact!.verification_level, "user_asserted");
      assert.notEqual(fact!.status, "confirmed");
      assert.equal(fact!.user_confirmed, false);
      assert.ok(fact!.has_user_confirm_event !== true);
      assert.deepEqual(fact!.fact_roles, [legalCode.split("/role/")[1]]);
      assert.deepEqual(fact!.related_dir_ids, [roleCodeDir(legalCode)]);
      assert.ok(out.decision_context!.version > vBefore);
      console.log(
        `[m24r2l] code=${legalCode}; fact=${fact!.fact_id}:${fact!.status}:${fact!.verification_level}:confirmed=${fact!.status === "confirmed"}:user_confirmed=${fact!.user_confirmed}:${(fact!.fact_roles ?? []).join(",")}:${(fact!.related_dir_ids ?? []).join(",")}; dc=${vBefore}->${out.decision_context!.version}`,
      );
    });

    await check("M2.4-R2-FU1 Case M: constraint certainty semantics", async () => {
      const variants: Array<{
        tag: string;
        certainty: "explicit" | "estimated" | "unclear";
        text: string;
      }> = [
        { tag: "m24r2m_explicit", certainty: "explicit", text: "硬约束是必须保留社保。" },
        { tag: "m24r2m_estimated", certainty: "estimated", text: "估计必须保留社保。" },
        { tag: "m24r2m_unclear", certainty: "unclear", text: "可能有必须保留社保的约束。" },
      ];
      for (const item of variants) {
        const before = await seedAnswerReadySession(item.tag);
        const legalCode = authorizedFrom(before).fact_role_codes[0] ?? null;
        assert.ok(legalCode, `${item.tag} needs a legal authorized role code`);
        const vBefore = before.decision_context!.version;
        const factsBefore = before.decision_context!.reality_facts.length;
        const cstBefore = before.decision_context!.constraints.length;
        const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
          classification: "partial_answer",
          extracted_items: [
            {
              text: item.text,
              source_quote: item.text,
              semantic_kind: "constraint",
              role_hint: null,
              role_code_hint: legalCode,
              certainty: item.certainty,
            },
          ],
          unresolved_aspects: [],
          explanation: `constraint ${item.certainty}`,
        };
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: before,
          userMessage: item.text,
          locale: "zh-CN",
          __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
        });
        const dc = out.decision_context!;
        const cst = dc.constraints.find((c) => c.statement.includes(item.text.replace(/。$/, "")) || c.statement === item.text);
        const companion = dc.reality_facts.find(
          (f) => f.statement.includes(item.text.replace(/。$/, "")) || f.statement === item.text,
        );
        const probe = answerEventFromModelDraft({
          session: before,
          statement: item.text,
          source_turn_id: `probe_${item.tag}`,
          draft,
        });
        if (item.certainty === "explicit") {
          assert.ok(cst, "explicit constraint missing");
          assert.ok(companion, "explicit companion RealityFact missing");
          assert.equal(cst!.status, "unverified");
          assert.equal(cst!.verification_level, "user_asserted");
          assert.equal(companion!.status, "unverified");
          assert.equal(companion!.verification_level, "user_asserted");
          assert.deepEqual(companion!.fact_roles, [legalCode.split("/role/")[1]]);
          assert.deepEqual(companion!.related_dir_ids, [roleCodeDir(legalCode)]);
          assert.deepEqual(cst!.related_dir_ids, [roleCodeDir(legalCode)]);
          assert.equal(cst!.verification_level, companion!.verification_level);
          assert.ok(dc.version > vBefore);
        } else if (item.certainty === "estimated") {
          // applyAnswerEventToSessionDc hardcodes Constraint verification_level
          // to user_asserted; estimated Constraint is not legally persistable
          // on this path, so FU1 fail-closes to unresolved (no disguise).
          assert.equal(cst, undefined, "estimated constraint must not persist as user_asserted");
          assert.equal(companion, undefined, "estimated constraint must not write a mismatched companion");
          assert.equal(dc.version, vBefore);
          assert.equal(dc.reality_facts.length, factsBefore);
          assert.equal(dc.constraints.length, cstBefore);
          assert.equal(probe.proposed_writes.length, 0);
          assert.ok(
            probe.notes.some((n) => n.includes("estimated_constraint_not_persistable")),
            `estimated constraint must stay unresolved, notes=${probe.notes.join("|")}`,
          );
        } else {
          assert.equal(cst, undefined, "unclear must not write a Constraint");
          assert.equal(companion, undefined, "unclear must not write a companion RealityFact");
          assert.equal(dc.version, vBefore);
          assert.equal(dc.reality_facts.length, factsBefore);
          assert.equal(dc.constraints.length, cstBefore);
          assert.equal(probe.proposed_writes.length, 0);
          assert.ok(
            probe.notes.some((n) => n.includes("unclear_certainty")),
            `unclear constraint must stay unresolved, notes=${probe.notes.join("|")}`,
          );
        }
        console.log(
          `[m24r2m] tag=${item.tag}; certainty=${item.certainty}; code=${legalCode}; cst=${cst ? `${cst.constraint_id}:${cst.status}:${cst.verification_level}:${(cst.related_dir_ids ?? []).join(",")}` : "none"}; companion=${companion ? `${companion.fact_id}:${companion.status}:${companion.verification_level}:${(companion.fact_roles ?? []).join(",")}:${(companion.related_dir_ids ?? []).join(",")}` : "none"}; same_level=${cst && companion ? cst.verification_level === companion.verification_level : "n/a"}; same_dir=${cst && companion ? JSON.stringify(cst.related_dir_ids) === JSON.stringify(companion.related_dir_ids) : "n/a"}; dc=${vBefore}->${dc.version}; notes=${probe.notes.join(",")}`,
        );
      }
    });



    async function runFu2NullRolePending(tag: string) {
      const seeded = await seedAnswerReadySession(tag);
      const { session: before, codeA, codeB } = withTwoAuthorizedRoleCodes(seeded);
      const lastSentBefore = before.decision_understanding?.last_sent_question ?? null;
      const askedBefore = before.decision_understanding?.budget.session_asked_count ?? 0;
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "我目前仍在职。",
            source_quote: "我目前仍在职。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: null,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "null role under multi-role auth",
      };
      stubResponse = `${tag} FREEFORM MUST NOT WIN`;
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前仍在职。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      return {
        before,
        out,
        codeA,
        codeB,
        lastSentBefore,
        askedBefore,
        vBefore,
        factsBefore,
        cstBefore,
        draft,
      };
    }

    await check("M2.4-R2-FU2-A: no last_sent_question cannot authorize from next plan", async () => {
      const seeded = await seedAnswerReadySession("m24r2fu2a");
      const plan =
        seeded.decision_understanding?.next_question_plan ?? seeded.adaptive_ask_plan ?? null;
      assert.ok(plan, "FU2-A needs a next_question_plan");
      assert.ok(seeded.decision_understanding?.last_sent_question, "seed should start with last_sent");
      const before = {
        ...seeded,
        decision_understanding: {
          ...seeded.decision_understanding!,
          last_sent_question: null,
          next_question_plan: plan,
        },
        adaptive_ask_plan: plan,
      };
      const targets = activeTargets(before);
      assert.equal(targets.auth_error, "missing_authorized_answer_target");
      assert.equal(targets.fact_role_codes.length, 0);
      const legalCode = plan.fact_role_codes[0] ?? null;
      assert.ok(legalCode, "FU2-A plan should have a role code that must not authorize this turn");
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "我目前仍在职。",
            source_quote: "我目前仍在职。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "should not authorize from unsent plan",
      };
      stubResponse = "FU2A FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前仍在职。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "FU2-A must not write RealityFacts");
      assert.equal(dc.constraints.length, cstBefore, "FU2-A must not write Constraints");
      assert.equal(dc.version, vBefore, "FU2-A must not bump DC version");
      const probe = answerEventFromModelDraft({
        session: before,
        statement: "我目前仍在职。",
        source_turn_id: "probe_m24r2fu2a",
        draft,
      });
      assert.equal(probe.proposed_writes.length, 0);
      assert.ok(
        probe.notes.includes("missing_authorized_answer_target") ||
          probe.notes.some((n) => n.includes("missing_authorized_answer_target")),
        `FU2-A must fail closed on missing last_sent, notes=${probe.notes.join("|")}`,
      );
      assert.equal(before.decision_understanding?.last_sent_question ?? null, null);
      const wroteFromPlan = dc.reality_facts.some((f) => f.statement.includes("我目前仍在职"));
      assert.equal(wroteFromPlan, false);
      console.log(
        `[m24r2fu2a] auth=${targets.auth_error}; plan_id=${plan.plan_id}; last_sent_before=null; last_sent_after=${out.decision_understanding?.last_sent_question?.plan_id ?? "null"}; facts=${factsBefore}->${dc.reality_facts.length}; dc=${vBefore}->${dc.version}; writes=${probe.proposed_writes.length}; notes=${probe.notes.join(",")}`,
      );
    });

    await check("M2.4-R2-FU2-B: null role_code_hint under multi-role keeps pending clarification", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu2b");
      const { out, before, codeA, codeB, lastSentBefore, askedBefore, vBefore, factsBefore, cstBefore, draft } = ctx;
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "FU2-B must not write the unbound fact");
      assert.equal(dc.constraints.length, cstBefore);
      assert.equal(dc.version, vBefore);
      const pending = out.pending_answer_resolution ?? null;
      assert.ok(pending && pending.status === "pending", "FU2-B pending_answer_resolution must be persisted on the session");
      assert.equal(pending!.source_turn_id, lastUserId(out));
      assert.ok(pending!.unresolved_items.some((i) => i.reason === "unlocated_role_code"));
      assert.deepEqual([...pending!.authorized_role_codes].sort(), [codeA, codeB].sort());
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, stubResponse);
      assert.ok(
        asst.content.includes("已授权的调查角色") || asst.content.includes("可选角色"),
        `FU2-B must ask a role clarification, got=${asst.content.slice(0, 160)}`,
      );
      assert.ok(asst.content.includes("我目前仍在职"));
      const originalDirs = [...(lastSentBefore?.dir_ids ?? [])].sort();
      const nextDirs = [...(out.adaptive_ask_plan?.dir_ids ?? [])].sort();
      assert.deepEqual(nextDirs, originalDirs, "FU2-B must not jump to the next unrelated NeedItem");
      assert.ok((out.decision_understanding?.last_sent_question?.plan_id ?? "").startsWith("qp_role_clarify_"));
      const probe = answerEventFromModelDraft({
        session: before,
        statement: "我目前仍在职。",
        source_turn_id: "probe_m24r2fu2b",
        draft,
      });
      assert.equal(probe.proposed_writes.length, 0);
      assert.ok((probe.unresolved_items ?? []).some((i) => i.reason === "unlocated_role_code"));
      console.log(
        `[m24r2fu2b] codes=${codeA}|${codeB}; facts=${factsBefore}->${dc.reality_facts.length}; constraints=${cstBefore}->${dc.constraints.length}; dc=${vBefore}->${dc.version}; asked=${askedBefore}->${out.decision_understanding?.budget.session_asked_count ?? askedBefore}; pending=${pending!.status}:${pending!.unresolved_items.map((i)=>i.reason).join(",")}; next_q=${asst.content.replace(/\n/g, " / ").slice(0, 180)}; next_dirs=${nextDirs.join(",")}; last_sent=${out.decision_understanding?.last_sent_question?.plan_id}`,
      );
    });

    await check("M2.4-R2-FU2-C: clarification binds only the chosen role and clears pending", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu2c");
      const { out: pendingSession, codeA, codeB, vBefore, factsBefore } = ctx;
      assert.ok(pendingSession.pending_answer_resolution, "FU2-C setup must have pending");
      const chosen = codeA;
      const other = codeB;
      stubResponse = "FU2C FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: pendingSession,
        userMessage: `这条信息属于 ${chosen}`,
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      const fact = dc.reality_facts.find((f) => f.statement.includes("我目前仍在职"));
      assert.ok(fact, "FU2-C must write the original unresolved item after bind");
      assert.deepEqual(fact!.fact_roles, [chosen.split("/role/")[1]]);
      assert.deepEqual(fact!.related_dir_ids, [roleCodeDir(chosen)]);
      const otherFilled = dc.reality_facts.some(
        (f) =>
          (f.fact_roles ?? []).includes(other.split("/role/")[1] ?? "") &&
          (f.related_dir_ids ?? []).includes(roleCodeDir(other)),
      );
      assert.equal(otherFilled, false, "FU2-C must not fill the other authorized role");
      assert.equal(out.pending_answer_resolution ?? null, null, "FU2-C must clear pending after successful bind");
      assert.ok(dc.version > vBefore);
      assert.ok(dc.reality_facts.length > factsBefore);
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, stubResponse);
      assert.equal(
        (out.decision_understanding?.last_sent_question?.plan_id ?? "").startsWith("qp_role_clarify_"),
        false,
        "successful bind should leave the clarification question",
      );
      console.log(
        `[m24r2fu2c] chosen=${chosen}; other=${other}; fact=${fact!.fact_id}:${(fact!.fact_roles ?? []).join(",")}:${(fact!.related_dir_ids ?? []).join(",")}; pending=${out.pending_answer_resolution ?? "null"}; dc=${vBefore}->${dc.version}; next=${out.decision_understanding?.last_sent_question?.plan_id ?? "null"}`,
      );
    });

    await check("M2.4-R2-FU2-D: unclear clarification keeps pending and does not jump NeedItem", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu2d");
      const { out: pendingSession, lastSentBefore, vBefore, factsBefore, cstBefore, askedBefore } = ctx;
      const pendingBefore = pendingSession.pending_answer_resolution!;
      const clarifyPlanId = pendingSession.decision_understanding?.last_sent_question?.plan_id;
      const askedMid = pendingSession.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU2D FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: pendingSession,
        userMessage: "不确定",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore);
      assert.equal(dc.constraints.length, cstBefore);
      assert.equal(dc.version, vBefore);
      const pending = out.pending_answer_resolution ?? null;
      assert.ok(pending && pending.status === "pending", "FU2-D must keep pending");
      assert.equal(pending!.source_turn_id, pendingBefore.source_turn_id);
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, stubResponse);
      assert.ok(
        asst.content.includes("已授权的调查角色") || asst.content.includes("可选角色"),
        "FU2-D must stay on the role clarification question",
      );
      const originalDirs = [...(lastSentBefore?.dir_ids ?? [])].sort();
      const nextDirs = [...(out.adaptive_ask_plan?.dir_ids ?? pendingSession.adaptive_ask_plan?.dir_ids ?? [])].sort();
      assert.deepEqual(nextDirs, originalDirs, "FU2-D must not jump to the next unrelated NeedItem");
      assert.equal(out.decision_understanding?.last_sent_question?.plan_id, clarifyPlanId);
      const askedAfter = out.decision_understanding?.budget.session_asked_count ?? askedMid;
      assert.equal(askedAfter, askedMid, "FU2-D must not deduct budget again for the same clarification");
      console.log(
        `[m24r2fu2d] facts=${factsBefore}->${dc.reality_facts.length}; dc=${vBefore}->${dc.version}; asked=${askedBefore}->${askedMid}->${askedAfter}; pending=${pending!.status}:${pending!.source_turn_id}; last_sent=${out.decision_understanding?.last_sent_question?.plan_id}`,
      );
    });

    await check("M2.4-R2-FU2-E: illegal role stays pending; legal item writes; plan not polluted", async () => {
      const before = await seedAnswerReadySession("m24r2fu2e");
      const auth = authorizedFrom(before);
      const legalCode = auth.fact_role_codes[0] ?? null;
      assert.ok(legalCode, "FU2-E needs a legal authorized role code");
      const forged = "v1/dir/DIR-FORGED/role/forged_role";
      const vBefore = before.decision_context!.version;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "伪造角色不应写入。",
            source_quote: "伪造角色不应写入。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: forged,
            certainty: "explicit",
          },
          {
            text: "这是合法授权条目。",
            source_quote: "这是合法授权条目。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "illegal + legal",
      };
      stubResponse = "FU2E FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "伪造角色不应写入。另外这是合法授权条目。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      const overreach = dc.reality_facts.filter(
        (f) => f.fact_roles.includes("forged_role") || (f.related_dir_ids ?? []).includes("DIR-FORGED"),
      );
      const legal = dc.reality_facts.filter(
        (f) => f.statement === "伪造角色不应写入。另外这是合法授权条目。",
      );
      assert.equal(overreach.length, 0, "illegal item must not write");
      assert.ok(legal.length >= 1, "legal item should write");
      assert.ok(dc.version > vBefore);
      const pending = out.pending_answer_resolution ?? null;
      assert.ok(pending && pending.status === "pending", "illegal item must stay pending");
      assert.ok(pending!.unresolved_items.some((i) => i.reason === "unauthorized_role_code" || i.reason === "illegal_role_code"));
      assert.equal((out.adaptive_ask_plan?.fact_role_codes ?? []).includes(forged), false);
      assert.equal((out.decision_understanding?.last_sent_question?.fact_role_codes ?? []).includes(forged), false);
      const asst = lastAssistant(out);
      assert.ok(
        asst.content.includes("已授权的调查角色") || asst.content.includes("可选角色"),
        "FU2-E next question must address the pending illegal item",
      );
      assert.ok((out.decision_understanding?.last_sent_question?.plan_id ?? "").startsWith("qp_role_clarify_"));
      console.log(
        `[m24r2fu2e] legal=${legalCode}; forged=${forged}; overreach=${overreach.length}; legal_facts=${legal.length}; pending=${pending!.status}:${pending!.unresolved_items.map((i)=>i.reason).join(",")}; dc=${vBefore}->${dc.version}; last_sent=${out.decision_understanding?.last_sent_question?.plan_id}`,
      );
    });

    await check("M2.4-R2-FU2-F: partial success writes legal item and keeps unbound pending first", async () => {
      const seeded = await seedAnswerReadySession("m24r2fu2f");
      const { session: before, codeA, codeB } = withTwoAuthorizedRoleCodes(seeded);
      const vBefore = before.decision_context!.version;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "合法事实已能绑定。",
            source_quote: "合法事实已能绑定。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: codeA,
            certainty: "explicit",
          },
          {
            text: "这条还无法定位角色。",
            source_quote: "这条还无法定位角色。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: null,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "partial success",
      };
      stubResponse = "FU2F FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "合法事实已能绑定。另外这条还无法定位角色。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      const rawF = "合法事实已能绑定。另外这条还无法定位角色。";
      const turnFacts = dc.reality_facts.filter((f) => f.statement === rawF);
      const legal = turnFacts.find((f) => f.fact_roles.includes(codeA.split("/role/")[1]!));
      // The unbound item has no role yet: nothing beyond the legal role may be written.
      const unbound = turnFacts.find((f) => !f.fact_roles.includes(codeA.split("/role/")[1]!));
      assert.equal(turnFacts.length, 1, "FU2-F only the legal role writes this turn");
      assert.ok(legal, "FU2-F legal item must write");
      assert.deepEqual(legal!.fact_roles, [codeA.split("/role/")[1]]);
      assert.deepEqual(legal!.related_dir_ids, [roleCodeDir(codeA)]);
      assert.equal(unbound, undefined, "FU2-F unbound item must not write yet");
      assert.ok(dc.version > vBefore);
      const pending = out.pending_answer_resolution ?? null;
      assert.ok(pending && pending.status === "pending", "FU2-F must keep the unbound item pending");
      assert.ok(pending!.unresolved_items.some((i) => i.text.includes("这条还无法定位角色")));
      const asst = lastAssistant(out);
      assert.ok(
        asst.content.includes("已授权的调查角色") || asst.content.includes("可选角色"),
        "FU2-F next question must address pending first",
      );
      assert.ok(asst.content.includes("这条还无法定位角色"));
      assert.ok((out.decision_understanding?.last_sent_question?.plan_id ?? "").startsWith("qp_role_clarify_"));
      console.log(
        `[m24r2fu2f] legal=${codeA}; other=${codeB}; wrote=${legal!.fact_id}:${(legal!.fact_roles ?? []).join(",")}; unbound_written=false; pending=${pending!.status}:${pending!.unresolved_items.map((i)=>i.reason).join(",")}; dc=${vBefore}->${dc.version}; last_sent=${out.decision_understanding?.last_sent_question?.plan_id}`,
      );
    });

    await check("M2.4-R2-FU2-G: pending survives reload; replay does not duplicate write/pending/budget", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu2g");
      const { out: first, askedBefore, vBefore, factsBefore, cstBefore } = ctx;
      const pendingFirst = first.pending_answer_resolution!;
      assert.ok(pendingFirst, "FU2-G first turn must create pending");
      const asked1 = first.decision_understanding?.budget.session_asked_count ?? 0;
      const q1 = lastAssistant(first).content;
      const turnId = lastUserId(first);
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu2g_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const reloaded = await durable(first.session_id);
      assert.ok(reloaded.pending_answer_resolution, "FU2-G pending must survive persist/reload");
      assert.equal(reloaded.pending_answer_resolution!.source_turn_id, pendingFirst.source_turn_id);
      assert.equal(reloaded.pending_answer_resolution!.status, "pending");
      const replaySession = {
        ...reloaded,
        messages: [
          ...reloaded.messages,
          {
            role: "user" as const,
            content: "我目前仍在职。",
            timestamp: NOW,
            client_id: turnId,
          },
        ],
      };
      stubResponse = "FU2G FREEFORM 2 MUST NOT WIN";
      const replay = await handleUserMessage({
        session: replaySession,
        userMessage: "我目前仍在职。",
        locale: "zh-CN",
        userAlreadyAppended: true,
      });
      const dc = replay.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "replay must not write DC");
      assert.equal(dc.constraints.length, cstBefore);
      assert.equal(dc.version, vBefore);
      assert.ok(replay.pending_answer_resolution, "replay must not drop pending");
      assert.equal(replay.pending_answer_resolution!.source_turn_id, pendingFirst.source_turn_id);
      const asked2 = replay.decision_understanding?.budget.session_asked_count ?? 0;
      assert.equal(asked2, asked1, "replay must not deduct budget again");
      const asst = lastAssistant(replay);
      assert.equal(asst.content, q1, "replay must restore the already-sent clarification");
      console.log(
        `[m24r2fu2g] turn=${turnId}; pending_reloaded=${Boolean(reloaded.pending_answer_resolution)}; pending_after=${replay.pending_answer_resolution?.status}; facts=${factsBefore}->${dc.reality_facts.length}; dc=${vBefore}->${dc.version}; asked=${askedBefore}->${asked1}->${asked2}; q_recovered=${asst.content === q1}`,
      );
    });

    await check("M2.4-R2-FU2-H: last_sent historical recovery only when plan_id matches", async () => {
      const matchSeeded = await seedAnswerReadySession("m24r2fu2h_match");
      const matchLast = matchSeeded.decision_understanding!.last_sent_question!;
      const matchPlan =
        matchSeeded.decision_understanding?.next_question_plan ?? matchSeeded.adaptive_ask_plan!;
      assert.equal(matchPlan.plan_id, matchLast.plan_id, "seeded last_sent and plan should share plan_id");
      const legalCode = matchPlan.fact_role_codes[0] ?? null;
      assert.ok(legalCode);
      const { fact_role_codes: _ignored, ...lastNoCodes } = matchLast;
      const matchBefore = {
        ...matchSeeded,
        decision_understanding: {
          ...matchSeeded.decision_understanding!,
          last_sent_question: lastNoCodes,
          next_question_plan: matchPlan,
        },
        adaptive_ask_plan: matchPlan,
      };
      const matchTargets = activeTargets(matchBefore);
      assert.equal(matchTargets.auth_error, undefined);
      assert.ok(matchTargets.fact_role_codes.includes(legalCode));
      const matchFactsBefore = matchBefore.decision_context!.reality_facts.length;
      const matchVBefore = matchBefore.decision_context!.version;
      const matchDraft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "历史恢复后写入合法事实。",
            source_quote: "历史恢复后写入合法事实。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "historical recover",
      };
      stubResponse = "FU2H MATCH FREEFORM MUST NOT WIN";
      const matchOut = await handleUserMessage({
        session: matchBefore,
        userMessage: "历史恢复后写入合法事实。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => matchDraft },
      });
      const matchFact = matchOut.decision_context!.reality_facts.find((f) =>
        f.statement.includes("历史恢复后写入合法事实"),
      );
      assert.ok(matchFact, "matching plan_id must allow historical role-code recovery and write");
      assert.ok(matchOut.decision_context!.version > matchVBefore);
      assert.ok(matchOut.decision_context!.reality_facts.length > matchFactsBefore);

      const mismatchSeeded = await seedAnswerReadySession("m24r2fu2h_mismatch");
      const mismatchLast = mismatchSeeded.decision_understanding!.last_sent_question!;
      const mismatchPlan =
        mismatchSeeded.decision_understanding?.next_question_plan ?? mismatchSeeded.adaptive_ask_plan!;
      const { fact_role_codes: _ignored2, ...mismatchLastNoCodes } = mismatchLast;
      const mismatchBefore = {
        ...mismatchSeeded,
        decision_understanding: {
          ...mismatchSeeded.decision_understanding!,
          last_sent_question: {
            ...mismatchLastNoCodes,
            plan_id: "historical_plan_without_roles",
          },
          next_question_plan: { ...mismatchPlan, plan_id: "different_current_plan_id" },
        },
        adaptive_ask_plan: { ...mismatchPlan, plan_id: "different_current_plan_id" },
      };
      const mismatchTargets = activeTargets(mismatchBefore);
      assert.equal(mismatchTargets.auth_error, "missing_authorized_fact_roles");
      const mmFactsBefore = mismatchBefore.decision_context!.reality_facts.length;
      const mmVBefore = mismatchBefore.decision_context!.version;
      stubResponse = "FU2H MISMATCH FREEFORM MUST NOT WIN";
      const mismatchOut = await handleUserMessage({
        session: mismatchBefore,
        userMessage: "历史恢复失败不应写入。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "历史恢复失败不应写入。",
                source_quote: "历史恢复失败不应写入。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: mismatchPlan.fact_role_codes[0] ?? null,
                certainty: "explicit" as const,
              },
            ],
            unresolved_aspects: [],
            explanation: "mismatch must not recover",
          }),
        },
      });
      assert.equal(mismatchOut.decision_context!.version, mmVBefore);
      assert.equal(mismatchOut.decision_context!.reality_facts.length, mmFactsBefore);
      assert.equal(
        mismatchOut.decision_context!.reality_facts.some((f) => f.statement.includes("历史恢复失败不应写入")),
        false,
      );

      const noneSeeded = await seedAnswerReadySession("m24r2fu2h_none");
      const nonePlan =
        noneSeeded.decision_understanding?.next_question_plan ?? noneSeeded.adaptive_ask_plan!;
      const noneBefore = {
        ...noneSeeded,
        decision_understanding: {
          ...noneSeeded.decision_understanding!,
          last_sent_question: null,
          next_question_plan: nonePlan,
        },
        adaptive_ask_plan: nonePlan,
      };
      const noneTargets = activeTargets(noneBefore);
      assert.equal(noneTargets.auth_error, "missing_authorized_answer_target");
      const noneVBefore = noneBefore.decision_context!.version;
      const noneFactsBefore = noneBefore.decision_context!.reality_facts.length;
      stubResponse = "FU2H NONE FREEFORM MUST NOT WIN";
      const noneOut = await handleUserMessage({
        session: noneBefore,
        userMessage: "没有已发送问题不得授权。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "没有已发送问题不得授权。",
                source_quote: "没有已发送问题不得授权。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: nonePlan.fact_role_codes[0] ?? null,
                certainty: "explicit" as const,
              },
            ],
            unresolved_aspects: [],
            explanation: "no last_sent",
          }),
        },
      });
      assert.equal(noneOut.decision_context!.version, noneVBefore);
      assert.equal(noneOut.decision_context!.reality_facts.length, noneFactsBefore);

      console.log(
        `[m24r2fu2h] match_auth=${matchTargets.auth_error ?? "ok"}:${matchTargets.fact_role_codes.join("|")}; match_write=${Boolean(matchFact)}; match_dc=${matchVBefore}->${matchOut.decision_context!.version}; mismatch_auth=${mismatchTargets.auth_error}; mismatch_dc=${mmVBefore}->${mismatchOut.decision_context!.version}; none_auth=${noneTargets.auth_error}; none_dc=${noneVBefore}->${noneOut.decision_context!.version}`,
      );
    });


    await check("M2.4-R2 static: production path uses model interpretation before DC write", async () => {
      const adaptive = readFileSync(join(process.cwd(), "lib/poju/decision-intake/adaptive-turn.ts"), "utf8");
      assert.match(adaptive, /interpretAnswerWithModel/);
      assert.match(adaptive, /answerEventFromModelDraft/);
      assert.match(adaptive, /answer_interpretation_failed/);
      const agentSrc = readFileSync(join(process.cwd(), "lib/poju/agent.ts"), "utf8");
      assert.match(agentSrc, /answer_interpretation_failed|未能完成语义理解/);

    function withAuthorizedRoleCodes(
      session: POJUSessionState,
      codes: string[],
    ): POJUSessionState {
      const last = session.decision_understanding?.last_sent_question;
      assert.ok(last, "last_sent_question required for authorized role setup");
      const dirs = Array.from(
        new Set(
          [...last.dir_ids, ...codes.map((c) => roleCodeDir(c))].filter((d) => d.length > 0),
        ),
      );
      return {
        ...session,
        decision_understanding: session.decision_understanding
          ? {
              ...session.decision_understanding,
              last_sent_question: {
                ...last,
                dir_ids: dirs,
                fact_role_codes: [...codes],
              },
            }
          : session.decision_understanding,
      };
    }

    function roleName(code: string): string {
      return code.split("/role/")[1] ?? "";
    }

    function factForRole(
      dc: NonNullable<POJUSessionState["decision_context"]>,
      code: string,
      text: string,
    ) {
      const role = roleName(code);
      const dir = roleCodeDir(code);
      return dc.reality_facts.find(
        (f) =>
          f.statement.includes(text) &&
          (f.fact_roles ?? []).includes(role) &&
          (f.related_dir_ids ?? []).includes(dir),
      );
    }

    await check("M2.4-R2-FU3-A: three unresolved items are bound one at a time", async () => {
      const seeded = await seedAnswerReadySession("m24r2fu3a");
      const codes = [...EXTRA_JOB_ROLE_CODES.slice(0, 3)];
      const before = withAuthorizedRoleCodes(seeded, codes);
      const texts = ["第一条待绑定事实。", "第二条待绑定事实。", "第三条待绑定事实。"];
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: texts.map((text) => ({
          text,
          source_quote: text,
          semantic_kind: "reality_fact" as const,
          role_hint: null,
          role_code_hint: null,
          certainty: "explicit" as const,
        })),
        unresolved_aspects: [],
        explanation: "three unlocated items",
      };
      stubResponse = "FU3A FREEFORM MUST NOT WIN";
      let s = await handleUserMessage({
        session: before,
        userMessage: texts.join("另外"),
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const pending0 = s.pending_answer_resolution;
      assert.ok(pending0 && pending0.status === "pending", "FU3-A must create pending");
      assert.equal(pending0!.unresolved_items.length, 3, "FU3-A must keep all three unresolved items");
      const itemIds = pending0!.unresolved_items.map((i) => i.item_id);
      assert.equal(new Set(itemIds).size, 3, "FU3-A item_id values must be unique");
      assert.equal(
        s.decision_context!.reality_facts.length,
        before.decision_context!.reality_facts.length,
        "FU3-A first turn must not write DC",
      );
      const asst0 = lastAssistant(s);
      assert.ok(
        asst0.content.includes("已授权的调查角色") || asst0.content.includes("可选角色"),
        `FU3-A must ask a role clarification, got=${asst0.content.slice(0, 160)}`,
      );
      assert.ok(
        asst0.content.includes(texts[0]!),
        "FU3-A first clarification must address the first item only",
      );
      assert.equal(asst0.content.includes(texts[1]!), false, "FU3-A first question must not bind later items");

      for (let i = 0; i < 3; i++) {
        const pendingBefore = s.pending_answer_resolution;
        assert.ok(pendingBefore, `FU3-A item ${i} must still be pending`);
        const remainingBefore = pendingBefore!.unresolved_items.length;
        const factsBefore = s.decision_context!.reality_facts.length;
        const chosen = codes[i]!;
        stubResponse = `FU3A FREEFORM ROUND ${i}`;
        s = await handleUserMessage({
          session: s,
          userMessage: `这条信息属于 ${chosen}`,
          locale: "zh-CN",
        });
        const dc = s.decision_context!;
        assert.equal(dc.reality_facts.length, factsBefore + 1, `FU3-A turn ${i} must write exactly one fact`);
        const written = factForRole(dc, chosen, texts[i]!);
        assert.ok(written, `FU3-A must write item ${i} to ${chosen}`);
        const nextPending = s.pending_answer_resolution ?? null;
        if (i < 2) {
          assert.ok(nextPending && nextPending.status === "pending", `FU3-A after item ${i} must keep pending`);
          assert.equal(
            nextPending!.unresolved_items.length,
            remainingBefore - 1,
            `FU3-A after item ${i} must shrink pending by one`,
          );
          assert.equal(
            nextPending!.unresolved_items.some((item) => item.text === texts[i]),
            false,
            `FU3-A resolved item ${i} must leave pending`,
          );
          assert.ok(
            texts.slice(i + 1).every((text) =>
              nextPending!.unresolved_items.some((item) => item.text === text),
            ),
            `FU3-A remaining texts after item ${i} must be preserved`,
          );
          const asst = lastAssistant(s);
          assert.ok(
            asst.content.includes("已授权的调查角色") || asst.content.includes("可选角色"),
            `FU3-A next question after item ${i} must stay on role clarification`,
          );
          assert.ok(
            asst.content.includes(texts[i + 1]!),
            `FU3-A next question must address the next unresolved item`,
          );
        } else {
          assert.equal(nextPending, null, "FU3-A must clear pending only after the last item");
        }
      }
    });

    await check("M2.4-R2-FU3-B: same text different item_id writes both DIR/role", async () => {
      const seeded = await seedAnswerReadySession("m24r2fu3b");
      const { session: before, codeA, codeB } = withTwoAuthorizedRoleCodes(seeded);
      const shared = "同一条文本需要分别写入两个角色。";
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: shared,
            source_quote: shared,
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: null,
            certainty: "explicit",
          },
          {
            text: shared,
            source_quote: shared,
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: null,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "same text two items",
      };
      stubResponse = "FU3B FREEFORM MUST NOT WIN";
      let s = await handleUserMessage({
        session: before,
        userMessage: shared,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const pending0 = s.pending_answer_resolution;
      assert.ok(pending0 && pending0.unresolved_items.length === 2, "FU3-B must keep both same-text items");
      assert.notEqual(
        pending0!.unresolved_items[0]!.item_id,
        pending0!.unresolved_items[1]!.item_id,
        "FU3-B same text must still have distinct item_id values",
      );
      s = await handleUserMessage({
        session: s,
        userMessage: `这条信息属于 ${codeA}`,
        locale: "zh-CN",
      });
      const first = factForRole(s.decision_context!, codeA, shared);
      assert.ok(first, "FU3-B first clarification must write role A");
      assert.ok(s.pending_answer_resolution, "FU3-B must keep the second item pending");
      s = await handleUserMessage({
        session: s,
        userMessage: `这条信息属于 ${codeB}`,
        locale: "zh-CN",
      });
      const dc = s.decision_context!;
      const second = factForRole(dc, codeB, shared);
      assert.ok(second, "FU3-B second clarification must write role B");
      assert.ok(factForRole(dc, codeA, shared), "FU3-B first write must still be present");
      assert.notEqual(first!.fact_id, second!.fact_id);
      assert.equal(s.pending_answer_resolution ?? null, null, "FU3-B must clear pending after both writes");
    });

    await check("M2.4-R2-FU3-C: unclear certainty stays pending and does not jump", async () => {
      const before = await seedAnswerReadySession("m24r2fu3c");
      const auth = authorizedFrom(before);
      const legalCode = auth.fact_role_codes[0];
      assert.ok(legalCode, "FU3-C needs an authorized role code");
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const lastSentBefore = before.decision_understanding?.last_sent_question ?? null;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "partial_answer",
        extracted_items: [
          {
            text: "目前大概还在职吧。",
            source_quote: "目前大概还在职吧。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "unclear",
          },
        ],
        unresolved_aspects: [],
        explanation: "unclear certainty",
      };
      stubResponse = "FU3C FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: before,
        userMessage: "目前大概还在职吧。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "FU3-C must not write RealityFacts");
      assert.equal(dc.constraints.length, cstBefore, "FU3-C must not write Constraints");
      assert.equal(dc.version, vBefore, "FU3-C must not bump DC version");
      const pending = out.pending_answer_resolution;
      assert.ok(pending && pending.status === "pending", "FU3-C must create pending");
      assert.equal(pending!.unresolved_items[0]?.reason, "unclear_certainty");
      const asst = lastAssistant(out);
      assert.ok(
        asst.content.includes("明确事实") && asst.content.includes("个人估计"),
        `FU3-C must ask a certainty clarification, got=${asst.content.slice(0, 200)}`,
      );
      assert.deepEqual(
        [...(out.adaptive_ask_plan?.dir_ids ?? [])].sort(),
        [...(lastSentBefore?.dir_ids ?? [])].sort(),
        "FU3-C must not jump to another NeedItem",
      );

      stubResponse = "FU3C STILL FREEFORM";
      const again = await handleUserMessage({
        session: out,
        userMessage: "不确定",
        locale: "zh-CN",
      });
      assert.equal(again.decision_context!.version, vBefore, "FU3-C uncertain follow-up must not write");
      assert.ok(again.pending_answer_resolution, "FU3-C pending must remain when still uncertain");
      assert.equal(again.pending_answer_resolution!.status, "pending");
      assert.deepEqual(
        [...(again.adaptive_ask_plan?.dir_ids ?? [])].sort(),
        [...(lastSentBefore?.dir_ids ?? [])].sort(),
        "FU3-C must still not jump after an uncertain reply",
      );
    });

    await check("M2.4-R2-FU3-D: estimated constraint writes only after explicit confirm", async () => {
      const before = await seedAnswerReadySession("m24r2fu3d");
      const legalCode = authorizedFrom(before).fact_role_codes[0];
      assert.ok(legalCode, "FU3-D needs an authorized role code");
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "estimate",
        extracted_items: [
          {
            text: "预算大概不能超过五万。",
            source_quote: "预算大概不能超过五万。",
            semantic_kind: "constraint",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "estimated",
          },
        ],
        unresolved_aspects: [],
        explanation: "estimated constraint",
      };
      stubResponse = "FU3D FREEFORM MUST NOT WIN";
      let s = await handleUserMessage({
        session: before,
        userMessage: "预算大概不能超过五万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      let dc = s.decision_context!;
      assert.equal(dc.constraints.length, cstBefore, "FU3-D must not write the estimated Constraint");
      assert.equal(dc.reality_facts.length, factsBefore, "FU3-D must not disguise an estimated constraint as a fact");
      assert.equal(dc.version, vBefore, "FU3-D must not bump DC version before confirm");
      const pending = s.pending_answer_resolution;
      assert.ok(pending && pending.status === "pending", "FU3-D must create pending");
      assert.equal(pending!.unresolved_items[0]?.reason, "estimated_constraint_not_persistable");
      assert.ok(
        lastAssistant(s).content.includes("明确约束") || lastAssistant(s).content.includes("明确陈述"),
        "FU3-D must ask the user to confirm the constraint as an explicit assertion",
      );

      stubResponse = "FU3D STILL FREEFORM";
      s = await handleUserMessage({
        session: s,
        userMessage: "仍然只是估计",
        locale: "zh-CN",
      });
      dc = s.decision_context!;
      assert.equal(dc.constraints.length, cstBefore, "FU3-D unconfirmed estimate must not write");
      assert.equal(dc.version, vBefore);
      assert.ok(s.pending_answer_resolution, "FU3-D must keep pending when still estimated");

      s = await handleUserMessage({
        session: s,
        userMessage: "确认这是明确约束",
        locale: "zh-CN",
      });
      dc = s.decision_context!;
      const cst = dc.constraints.find((c) => c.statement.includes("不能超过五万"));
      assert.ok(cst, "FU3-D must write the Constraint after explicit confirmation");
      assert.equal(cst!.verification_level, "user_asserted");
      assert.equal(s.pending_answer_resolution ?? null, null, "FU3-D must clear pending after confirm");
      assert.ok(dc.version > vBefore);
    });

    await check("M2.4-R2-FU3-E: refusal is auditable, not a fact, and survives reload", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu3e");
      const pendingSession = ctx.out;
      const vBefore = pendingSession.decision_context!.version;
      const factsBefore = pendingSession.decision_context!.reality_facts.length;
      const cstBefore = pendingSession.decision_context!.constraints.length;
      const oldClarify = lastAssistant(pendingSession).content;
      stubResponse = "FU3E FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: pendingSession,
        userMessage: "拒绝澄清",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, factsBefore, "FU3-E must not write a fact from refusal");
      assert.equal(dc.constraints.length, cstBefore, "FU3-E must not write a Constraint from refusal");
      assert.equal(dc.version, vBefore);
      const pending = out.pending_answer_resolution;
      assert.ok(pending, "FU3-E must keep an auditable rejection record");
      assert.equal(pending!.status, "rejected");
      assert.equal(pending!.clarification_plan, null, "FU3-E must not keep a resendable clarification_plan");
      assert.ok(
        (pending!.rejected_items ?? []).some((item) => item.text.includes("我目前仍在职")),
        "FU3-E must record an auditable rejected item",
      );
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, oldClarify, "FU3-E must not resend the old clarification plan");
      assert.equal(asst.content.includes("待澄清信息"), false, "FU3-E must not re-ask the refused item");
      assert.notEqual(asst.content, stubResponse);
      assert.equal(asst.content.includes("【理解确认】"), false, "FU3-E refusal must not trigger readiness confirm");
      // Honest FU4 change: after terminal refusal processing, a new legal NeedItem may be sent.
      // This no longer requires the session to remain stuck on the refused clarification.
      const nextPlan = out.adaptive_ask_plan;
      if (nextPlan) {
        assert.equal(String(nextPlan.ask_now_reason ?? "").includes("pending_answer_resolution"), false);
        assert.equal(asst.content, nextPlan.question_text);
      }

      await savePOJUSession(out);
      const reloaded = await durable(out.session_id);
      assert.ok(reloaded.pending_answer_resolution, "FU3-E refusal must survive reload");
      assert.equal(reloaded.pending_answer_resolution!.status, "rejected");
      assert.equal(reloaded.pending_answer_resolution!.clarification_plan, null);
      assert.ok((reloaded.pending_answer_resolution!.rejected_items ?? []).length >= 1);
    });
    await check("M2.4-R2-FU3-F: C1 persist failure keeps pending and retry does not duplicate", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu3f");
      const pendingSession = ctx.out;
      const vBefore = pendingSession.decision_context!.version;
      const factsBefore = pendingSession.decision_context!.reality_facts.length;
      const chosen = ctx.codeA;
      stubResponse = "FU3F FREEFORM MUST NOT WIN";
      const failed = await handleUserMessage({
        session: pendingSession,
        userMessage: `这条信息属于 ${chosen}`,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          pendingBindPersist: async (previous) => ({
            session: previous,
            committed: false,
            error: "persist_failed",
          }),
        },
      });
      const failedDc = failed.decision_context!;
      assert.equal(failedDc.version, vBefore, "FU3-F failed persist must not commit DC");
      assert.equal(failedDc.reality_facts.length, factsBefore, "FU3-F must not leave a half-committed fact");
      assert.ok(failed.pending_answer_resolution, "FU3-F pending must not be lost on persist failure");
      const failAsst = [...failed.messages].reverse().find((m) => m.role === "assistant");
      const failMeta = (failAsst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } } | undefined)?.meta;
      assert.equal(failMeta?.m1_fail_closed, true);
      assert.equal(failMeta?.m1_outcome, "persist_failed");

      await savePOJUSession(failed);
      const reloaded = await durable(failed.session_id);
      assert.ok(reloaded.pending_answer_resolution, "FU3-F pending must survive the failed persist");
      assert.equal(reloaded.decision_context!.version, vBefore);

      const retried = await handleUserMessage({
        session: reloaded,
        userMessage: `这条信息属于 ${chosen}`,
        locale: "zh-CN",
      });
      const written = retried.decision_context!.reality_facts.filter((f) =>
        f.statement.includes("我目前仍在职"),
      );
      assert.equal(written.length, 1, "FU3-F retry must write the fact once, not twice");
      assert.ok(retried.decision_context!.version > vBefore);
      assert.equal(retried.pending_answer_resolution ?? null, null);
    });

    await check("M2.4-R2-FU3-G: pending fields survive persist/reload between item binds", async () => {
      const seeded = await seedAnswerReadySession("m24r2fu3g");
      const codes = [...EXTRA_JOB_ROLE_CODES.slice(0, 3)];
      const before = withAuthorizedRoleCodes(seeded, codes);
      const texts = ["重载条目一。", "重载条目二。", "重载条目三。"];
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: texts.map((text) => ({
          text,
          source_quote: text,
          semantic_kind: "reality_fact" as const,
          role_hint: null,
          role_code_hint: null,
          certainty: "explicit" as const,
        })),
        unresolved_aspects: [],
        explanation: "reload lifecycle",
      };
      stubResponse = "FU3G FREEFORM MUST NOT WIN";
      let s = await handleUserMessage({
        session: before,
        userMessage: texts.join("另外"),
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      await savePOJUSession(s);
      s = await durable(s.session_id);
      const pending0 = s.pending_answer_resolution;
      assert.ok(pending0, "FU3-G pending must persist after the first turn");
      const originalIds = pending0!.unresolved_items.map((i) => i.item_id);
      const asked0 = s.decision_understanding?.budget.session_asked_count ?? 0;
      const plan0 = s.pending_answer_resolution!.clarification_plan_id;

      for (let i = 0; i < 2; i++) {
        const remainingBefore = s.pending_answer_resolution!.unresolved_items.map((item) => item.item_id);
        const askedBefore = s.decision_understanding?.budget.session_asked_count ?? 0;
        s = await handleUserMessage({
          session: s,
          userMessage: `这条信息属于 ${codes[i]!}`,
          locale: "zh-CN",
        });
        await savePOJUSession(s);
        s = await durable(s.session_id);
        const pending = s.pending_answer_resolution;
        assert.ok(pending, `FU3-G pending must survive reload after item ${i}`);
        const remaining = pending!.unresolved_items.map((item) => item.item_id);
        assert.equal(remaining.length, remainingBefore.length - 1);
        assert.equal(remaining.includes(remainingBefore[0]!), false);
        assert.deepEqual(remaining, remainingBefore.slice(1));
        assert.ok(
          pending!.unresolved_items.every((item) => originalIds.includes(item.item_id)),
          "FU3-G item identity must stay stable across reloads",
        );
        assert.deepEqual(
          [...pending!.authorized_role_codes].sort(),
          [...codes].sort(),
          "FU3-G authorized role codes must be preserved",
        );
        assert.ok(pending!.clarification_plan, "FU3-G must keep a clarification plan for remaining items");
        assert.notEqual(pending!.clarification_plan_id, plan0, "FU3-G next item must get its own clarification plan");
        const askedAfter = s.decision_understanding?.budget.session_asked_count ?? 0;
        assert.ok(askedAfter >= askedBefore, "FU3-G must not lose budget accounting");
        assert.ok(factForRole(s.decision_context!, codes[i]!, texts[i]!));
      }
      assert.equal(asked0 > 0, true);
    });

    await check("M2.4-R2-FU3-H: missing clarification plan fails closed and keeps pending", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu3h");
      const broken: POJUSessionState = {
        ...ctx.out,
        pending_answer_resolution: {
          ...ctx.out.pending_answer_resolution!,
          clarification_plan: null,
          clarification_plan_id: null,
          authorized_role_codes: [],
          authorized_dir_ids: [],
          unresolved_items: ctx.out.pending_answer_resolution!.unresolved_items.map((item) => ({
            ...item,
            authorized_role_codes: [],
          })),
        },
        decision_understanding: ctx.out.decision_understanding
          ? {
              ...ctx.out.decision_understanding,
              last_sent_question: null,
              next_question_plan: null,
            }
          : ctx.out.decision_understanding,
        adaptive_ask_plan: null,
      };
      const vBefore = broken.decision_context!.version;
      const factsBefore = broken.decision_context!.reality_facts.length;
      stubResponse = "FU3H FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: broken,
        userMessage: "继续下一个问题",
        locale: "zh-CN",
      });
      assert.ok(out.pending_answer_resolution, "FU3-H must keep pending");
      assert.equal(out.decision_context!.version, vBefore, "FU3-H must not write DC");
      assert.equal(out.decision_context!.reality_facts.length, factsBefore);
      const asst = lastAssistant(out);
      const meta = (asst as { meta?: { m1_planner_blocked?: boolean; m1_outcome?: string; m1_ask_error?: string; m1_fail_closed?: boolean } }).meta;
      assert.ok(
        meta?.m1_planner_blocked === true || meta?.m1_outcome === "planner_blocked" || asst.content.includes("未能生成合规的授权提问"),
        `FU3-H must return an explicit fail-closed status, got=${asst.content.slice(0, 200)} meta=${JSON.stringify(meta)}`,
      );
      assert.notEqual(asst.content, stubResponse);
      assert.equal(
        Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
        false,
        "FU3-H must not call ordinary planFromState for an unrelated NeedItem",
      );
    });

    // M2.4-R2-FU4: clarification semantic safety + terminal pending lifecycle.
    // FU3-E was updated honestly: after the last item is refused, a new legal
    // NeedItem may be sent. The refusal remains auditable, writes nothing to DC,
    // survives reload, and must not resend the old clarification plan.

    async function seedDefinitionPatchPending(tag: string) {
      const before = await seedAnswerReadySession(tag);
      const legalCode = authorizedFrom(before).fact_role_codes[0];
      assert.ok(legalCode, `${tag} needs an authorized role code`);
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const askedBefore = before.decision_understanding?.budget.session_asked_count ?? 0;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "把决策问题改成是否立刻辞职。",
            source_quote: "把决策问题改成是否立刻辞职。",
            semantic_kind: "definition_patch",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "definition patch cannot persist",
      };
      stubResponse = `${tag} FREEFORM MUST NOT WIN`;
      const out = await handleUserMessage({
        session: before,
        userMessage: "把决策问题改成是否立刻辞职。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      return { before, out, legalCode, vBefore, factsBefore, cstBefore, askedBefore, draft };
    }

    async function seedUnclearCertaintyPending(tag: string) {
      const before = await seedAnswerReadySession(tag);
      const legalCode = authorizedFrom(before).fact_role_codes[0];
      assert.ok(legalCode, `${tag} needs an authorized role code`);
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "partial_answer",
        extracted_items: [
          {
            text: "目前大概还在职吧。",
            source_quote: "目前大概还在职吧。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "unclear",
          },
        ],
        unresolved_aspects: [],
        explanation: "unclear certainty",
      };
      stubResponse = `${tag} FREEFORM MUST NOT WIN`;
      const out = await handleUserMessage({
        session: before,
        userMessage: "目前大概还在职吧。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      return { before, out, legalCode, vBefore, factsBefore, cstBefore };
    }

    async function seedEstimatedConstraintPending(tag: string) {
      const before = await seedAnswerReadySession(tag);
      const legalCode = authorizedFrom(before).fact_role_codes[0];
      assert.ok(legalCode, `${tag} needs an authorized role code`);
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "estimate",
        extracted_items: [
          {
            text: "预算大概不能超过五万。",
            source_quote: "预算大概不能超过五万。",
            semantic_kind: "constraint",
            role_hint: null,
            role_code_hint: legalCode,
            certainty: "estimated",
          },
        ],
        unresolved_aspects: [],
        explanation: "estimated constraint",
      };
      stubResponse = `${tag} FREEFORM MUST NOT WIN`;
      const out = await handleUserMessage({
        session: before,
        userMessage: "预算大概不能超过五万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      return { before, out, legalCode, vBefore, factsBefore, cstBefore };
    }

    function factWritten(
      dc: NonNullable<POJUSessionState["decision_context"]>,
      text: string,
    ) {
      return dc.reality_facts.find((f) => f.statement.includes(text));
    }

    await check("M2.4-R2-FU4-A: definition_patch creates pending and does not write DC", async () => {
      const ctx = await seedDefinitionPatchPending("m24r2fu4a");
      const dc = ctx.out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU4-A must not write RealityFacts");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU4-A must not write Constraints");
      assert.equal(dc.version, ctx.vBefore, "FU4-A must not bump DC version");
      const pending = ctx.out.pending_answer_resolution;
      assert.ok(pending && pending.status === "pending", "FU4-A must create pending");
      assert.equal(pending!.unresolved_items[0]?.reason, "definition_patch_not_persistable");
      const asst = lastAssistant(ctx.out);
      assert.ok(
        asst.content.includes("作为明确事实") || asst.content.includes("定义修订"),
        `FU4-A must ask a definition-patch clarification, got=${asst.content.slice(0, 200)}`,
      );
      assert.equal(
        Boolean(ctx.out.adaptive_ask_plan && !String(ctx.out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
        false,
        "FU4-A must not enter ordinary NeedItem planning",
      );
    });

    await check("M2.4-R2-FU4-B: user records definition_patch as an authorized fact", async () => {
      const ctx = await seedDefinitionPatchPending("m24r2fu4b");
      const pendingSession = ctx.out;
      stubResponse = "FU4B FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: pendingSession,
        userMessage: "改为作为明确事实记录",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      const written = factWritten(dc, "把决策问题改成是否立刻辞职");
      assert.ok(written, "FU4-B must write the converted RealityFact");
      assert.equal(written!.status, "unverified");
      const role = ctx.legalCode.split("/role/")[1]!;
      const dir = roleCodeDir(ctx.legalCode);
      assert.ok((written!.fact_roles ?? []).includes(role), "FU4-B must keep the authorized role");
      assert.ok((written!.related_dir_ids ?? []).includes(dir), "FU4-B must keep the authorized DIR");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU4-B must not write a Constraint");
      assert.ok(dc.version > ctx.vBefore);
      assert.equal(out.pending_answer_resolution ?? null, null, "FU4-B must clear pending after persist");
    });

    await check("M2.4-R2-FU4-C: refusal records a rejected item and does not resend the old plan", async () => {
      const ctx = await seedDefinitionPatchPending("m24r2fu4c");
      const oldClarify = lastAssistant(ctx.out).content;
      stubResponse = "FU4C FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.out,
        userMessage: "拒绝澄清",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU4-C must not write a RealityFact");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU4-C must not write a Constraint");
      assert.equal(dc.version, ctx.vBefore);
      const pending = out.pending_answer_resolution;
      assert.ok(pending, "FU4-C must keep an auditable rejection record");
      assert.equal(pending!.status, "rejected");
      assert.equal(pending!.unresolved_items.length, 0);
      assert.equal(pending!.clarification_plan, null, "FU4-C must not keep a resendable clarification_plan");
      assert.ok(
        (pending!.rejected_items ?? []).some((item) => item.text.includes("把决策问题改成是否立刻辞职")),
        "FU4-C must record the rejected item",
      );
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, oldClarify, "FU4-C must not resend the old clarification plan");
      assert.equal(asst.content.includes("待澄清信息"), false, "FU4-C must not re-ask the refused item");
      assert.notEqual(asst.content, stubResponse);
      assert.equal(asst.content.includes("【理解确认】"), false, "FU4-C refusal must not trigger readiness confirm");
      const nextPlan = out.adaptive_ask_plan;
      if (nextPlan) {
        assert.equal(String(nextPlan.ask_now_reason ?? "").includes("pending_answer_resolution"), false);
        assert.equal(asst.content, nextPlan.question_text);
      }
    });

    await check("M2.4-R2-FU4-D: uncertain definition_patch stays pending and does not jump", async () => {
      const ctx = await seedDefinitionPatchPending("m24r2fu4d");
      const oldClarify = lastAssistant(ctx.out).content;
      stubResponse = "FU4D FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.out,
        userMessage: "不确定",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      assert.equal(dc.version, ctx.vBefore, "FU4-D must not change DC");
      assert.equal(dc.reality_facts.length, ctx.factsBefore);
      assert.equal(dc.constraints.length, ctx.cstBefore);
      const pending = out.pending_answer_resolution;
      assert.ok(pending && pending.status === "pending", "FU4-D must keep pending");
      assert.equal(pending!.unresolved_items[0]?.reason, "definition_patch_not_persistable");
      const asst = lastAssistant(out);
      assert.equal(asst.content, oldClarify, "FU4-D must keep the current clarification");
      assert.equal(
        Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
        false,
        "FU4-D must not enter ordinary NeedItem planning",
      );
    });

    await check("M2.4-R2-FU4-E: persist failure keeps definition_patch pending and retry is not duplicated", async () => {
      const ctx = await seedDefinitionPatchPending("m24r2fu4e");
      stubResponse = "FU4E FREEFORM MUST NOT WIN";
      const failed = await handleUserMessage({
        session: ctx.out,
        userMessage: "改为作为明确事实记录",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          pendingBindPersist: async (previous) => ({
            session: previous,
            committed: false,
            error: "persist_failed",
          }),
        },
      });
      const failedDc = failed.decision_context!;
      assert.equal(failedDc.version, ctx.vBefore, "FU4-E failed persist must not commit DC");
      assert.equal(failedDc.reality_facts.length, ctx.factsBefore, "FU4-E must not leave a half-committed fact");
      assert.ok(failed.pending_answer_resolution, "FU4-E pending must not be lost on persist failure");
      const failAsst = [...failed.messages].reverse().find((m) => m.role === "assistant");
      const failMeta = (failAsst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } } | undefined)?.meta;
      assert.equal(failMeta?.m1_fail_closed, true);
      assert.equal(failMeta?.m1_outcome, "persist_failed");

      await savePOJUSession(failed);
      const reloaded = await durable(failed.session_id);
      assert.ok(reloaded.pending_answer_resolution, "FU4-E pending must survive the failed persist");
      assert.equal(reloaded.decision_context!.version, ctx.vBefore);

      const retried = await handleUserMessage({
        session: reloaded,
        userMessage: "改为作为明确事实记录",
        locale: "zh-CN",
      });
      const written = retried.decision_context!.reality_facts.filter((f) =>
        f.statement.includes("把决策问题改成是否立刻辞职"),
      );
      assert.equal(written.length, 1, "FU4-E retry must write the fact once, not twice");
      assert.ok(retried.decision_context!.version > ctx.vBefore);
      assert.equal(retried.pending_answer_resolution ?? null, null);
    });

    await check("M2.4-R2-FU4-N1: certainty parser is negation-first on the production path", async () => {
      const cases: Array<{ tag: string; phrase: string; expect: "write_explicit" | "write_estimated" | "pending_unclear" }> = [
        { tag: "fu4n1a", phrase: "明确事实", expect: "write_explicit" },
        { tag: "fu4n1b", phrase: "这是明确事实", expect: "write_explicit" },
        { tag: "fu4n1c", phrase: "个人估计", expect: "write_estimated" },
        { tag: "fu4n1d", phrase: "仍然只是估计", expect: "write_estimated" },
        { tag: "fu4n1e", phrase: "不确定", expect: "pending_unclear" },
        { tag: "fu4n1f", phrase: "不明确", expect: "pending_unclear" },
        { tag: "fu4n1g", phrase: "我不认为这是明确事实", expect: "pending_unclear" },
        { tag: "fu4n1h", phrase: "不是明确事实", expect: "pending_unclear" },
      ];
      for (const item of cases) {
        const ctx = await seedUnclearCertaintyPending(`m24r2${item.tag}`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        const written = factWritten(dc, "目前大概还在职吧");
        if (item.expect === "write_explicit") {
          assert.ok(written, `${item.phrase} must write an explicit fact`);
          assert.equal(written!.verification_level, "user_asserted", `${item.phrase} must be user_asserted`);
          assert.equal(out.pending_answer_resolution ?? null, null);
        } else if (item.expect === "write_estimated") {
          assert.ok(written, `${item.phrase} must write an estimated fact`);
          assert.equal(written!.verification_level, "user_estimate", `${item.phrase} must be user_estimate`);
        } else {
          assert.equal(written, undefined, `${item.phrase} must not be classified as explicit or write DC`);
          assert.equal(dc.version, ctx.vBefore, `${item.phrase} must not bump DC`);
          assert.ok(out.pending_answer_resolution, `${item.phrase} must keep pending`);
          assert.equal(out.pending_answer_resolution!.status, "pending");
        }
      }
    });

    await check("M2.4-R2-FU4-N2: constraint confirmation is negation-first on the production path", async () => {
      const cases: Array<{ tag: string; phrase: string; expect: "confirmed" | "not_confirmed" | "still_uncertain" }> = [
        { tag: "fu4n2a", phrase: "确认这是明确约束", expect: "confirmed" },
        { tag: "fu4n2b", phrase: "1", expect: "confirmed" },
        { tag: "fu4n2c", phrase: "仍然只是估计", expect: "not_confirmed" },
        { tag: "fu4n2d", phrase: "目前无法确定", expect: "still_uncertain" },
        { tag: "fu4n2e", phrase: "我不确认这是明确约束", expect: "not_confirmed" },
        { tag: "fu4n2f", phrase: "不是明确约束", expect: "not_confirmed" },
        { tag: "fu4n2g", phrase: "不可以写入", expect: "not_confirmed" },
      ];
      for (const item of cases) {
        const ctx = await seedEstimatedConstraintPending(`m24r2${item.tag}`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        const cst = dc.constraints.find((c) => c.statement.includes("不能超过五万"));
        if (item.expect === "confirmed") {
          assert.ok(cst, `${item.phrase} must write the Constraint`);
          assert.equal(cst!.verification_level, "user_asserted");
          assert.equal(out.pending_answer_resolution ?? null, null);
        } else {
          assert.equal(cst, undefined, `${item.phrase} must not confirm or write the Constraint`);
          assert.equal(dc.version, ctx.vBefore, `${item.phrase} must not bump DC`);
          assert.equal(dc.reality_facts.length, ctx.factsBefore);
          assert.ok(out.pending_answer_resolution, `${item.phrase} must keep pending`);
          assert.equal(out.pending_answer_resolution!.status, "pending");
        }
      }
    });

    async function runFu4WorkRolePending(tag: string) {
      const seeded = await seedAnswerReadySession(tag);
      const last = seeded.decision_understanding?.last_sent_question;
      assert.ok(last, `${tag} needs last_sent_question`);
      const workCode = "v1/dir/DIR-STATUS-QUO/role/status_quo";
      const otherCode =
        (last.fact_role_codes ?? []).find((c) => c !== workCode) ??
        EXTRA_JOB_ROLE_CODES.find((c) => c !== workCode) ??
        "v1/dir/DIR-OPT-ON-TABLE/role/option";
      assert.ok(otherCode && otherCode !== workCode, `${tag} needs a second authorized role`);
      const dirs = Array.from(
        new Set(
          [...last.dir_ids, roleCodeDir(workCode), roleCodeDir(otherCode)].filter((d) => d.length > 0),
        ),
      );
      const before: POJUSessionState = {
        ...seeded,
        decision_understanding: seeded.decision_understanding
          ? {
              ...seeded.decision_understanding,
              last_sent_question: {
                ...last,
                dir_ids: dirs,
                fact_role_codes: [workCode, otherCode],
              },
            }
          : seeded.decision_understanding,
      };
      const lastSentBefore = before.decision_understanding?.last_sent_question ?? null;
      const askedBefore = before.decision_understanding?.budget.session_asked_count ?? 0;
      const vBefore = before.decision_context!.version;
      const factsBefore = before.decision_context!.reality_facts.length;
      const cstBefore = before.decision_context!.constraints.length;
      const draft: import("../lib/poju/decision-intake/types").ModelAnswerDraft = {
        classification: "clear_answer",
        extracted_items: [
          {
            text: "我目前仍在职。",
            source_quote: "我目前仍在职。",
            semantic_kind: "reality_fact",
            role_hint: null,
            role_code_hint: null,
            certainty: "explicit",
          },
        ],
        unresolved_aspects: [],
        explanation: "null role under work/other authorization",
      };
      stubResponse = `${tag} FREEFORM MUST NOT WIN`;
      const out = await handleUserMessage({
        session: before,
        userMessage: "我目前仍在职。",
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      return {
        before,
        out,
        codeA: workCode,
        codeB: otherCode,
        lastSentBefore,
        askedBefore,
        vBefore,
        factsBefore,
        cstBefore,
        draft,
      };
    }

    await check("M2.4-R2-FU4-N3: role choice does not bind a role named only in a negated clause", async () => {
      const { authorizedRoleOptions } = await import("../lib/poju/decision-intake/pending-answer-resolution");
      const ctx = await runFu4WorkRolePending("m24r2fu4n3seed");
      const options = authorizedRoleOptions(ctx.out, [ctx.codeA, ctx.codeB]);
      const work = options.find((o) => o.aliases.includes("工作角色"));
      const other = options.find((o) => o.role_code !== work?.role_code) ?? options.find((o) => o.role_code === ctx.codeB);
      assert.ok(work, "FU4-N3 needs a unique work-role option among the authorized codes");
      assert.ok(other && other.role_code !== work!.role_code, "FU4-N3 needs a second authorized role");

      async function roleReply(tag: string, phrase: string) {
        const seeded = await runFu4WorkRolePending(tag);
        stubResponse = `${tag} FREEFORM MUST NOT WIN`;
        return handleUserMessage({
          session: seeded.out,
          userMessage: phrase,
          locale: "zh-CN",
        });
      }

      const bindWork = await roleReply("m24r2fu4n3a", "工作角色");
      const workFact = factForRole(bindWork.decision_context!, work!.role_code, "我目前仍在职");
      assert.ok(workFact, "工作角色 must bind the unique work role");
      assert.equal(factForRole(bindWork.decision_context!, other!.role_code, "我目前仍在职"), undefined);

      const notWork = await roleReply("m24r2fu4n3b", "不是工作角色");
      assert.equal(notWork.decision_context!.version, ctx.vBefore, "不是工作角色 must not write DC");
      assert.ok(notWork.pending_answer_resolution && notWork.pending_answer_resolution.status === "pending");
      assert.equal(factWritten(notWork.decision_context!, "我目前仍在职"), undefined);

      const contrast = await roleReply("m24r2fu4n3c", `不是${work!.role}，是${other!.role}`);
      assert.ok(factForRole(contrast.decision_context!, other!.role_code, "我目前仍在职"), "不是A，是B must bind only B");
      assert.equal(factForRole(contrast.decision_context!, work!.role_code, "我目前仍在职"), undefined);

      const unsure = await roleReply("m24r2fu4n3d", `我不确定是不是${work!.role}`);
      assert.equal(unsure.decision_context!.version, ctx.vBefore, "我不确定是不是A must not write DC");
      assert.ok(unsure.pending_answer_resolution && unsure.pending_answer_resolution.status === "pending");

      const both = await roleReply("m24r2fu4n3e", `${work!.role}和${other!.role}`);
      assert.equal(both.decision_context!.version, ctx.vBefore, "mentioning two authorized roles must stay unclear");
      assert.ok(both.pending_answer_resolution && both.pending_answer_resolution.status === "pending");
    });

    await check("M2.4-R2-FU4-T: last-item refusal completes terminal processing and can resume investigation", async () => {
      const ctx = await runFu2NullRolePending("m24r2fu4t");
      const pendingSession = ctx.out;
      const oldClarify = lastAssistant(pendingSession).content;
      const originalTurnId = lastUserId(pendingSession);
      const askedAfterClarify = pendingSession.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU4T FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: pendingSession,
        userMessage: "拒绝澄清",
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU4-T refusal must not write a fact");
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.equal(dc.version, ctx.vBefore);
      const pending = out.pending_answer_resolution;
      assert.ok(pending, "FU4-T must keep the auditable rejection record");
      assert.equal(pending!.status, "rejected");
      assert.equal(pending!.clarification_plan, null);
      assert.equal(pending!.unresolved_items.length, 0);
      assert.ok((pending!.rejected_items ?? []).length >= 1);
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, oldClarify, "FU4-T must not resend the old clarification");
      assert.equal(asst.content.includes("待澄清信息"), false);
      assert.notEqual(asst.content, stubResponse);
      assert.equal(asst.content.includes("【理解确认】"), false, "FU4-T must not trigger readiness confirm");
      const nextPlan = out.adaptive_ask_plan;
      assert.ok(nextPlan, "FU4-T may resume ordinary investigation after terminal refusal");
      assert.equal(String(nextPlan!.ask_now_reason ?? "").includes("pending_answer_resolution"), false);
      assert.equal(asst.content, nextPlan!.question_text);
      const lastSent = out.decision_understanding?.last_sent_question;
      assert.ok(lastSent && lastSent.plan_id === nextPlan!.plan_id);
      const askedAfterTerminal = out.decision_understanding?.budget.session_asked_count ?? 0;
      assert.ok(
        askedAfterTerminal === askedAfterClarify || askedAfterTerminal === askedAfterClarify + 1,
        "FU4-T may deduct budget once for the newly sent NeedItem",
      );

      await savePOJUSession(out);
      const reloaded = await durable(out.session_id);
      assert.equal(reloaded.pending_answer_resolution!.status, "rejected");
      assert.equal(reloaded.pending_answer_resolution!.clarification_plan, null);

      const replaySession = {
        ...reloaded,
        messages: [
          ...reloaded.messages,
          {
            role: "user" as const,
            content: "我目前仍在职。",
            timestamp: NOW,
            client_id: originalTurnId,
          },
        ],
      };
      stubResponse = "FU4T REPLAY FREEFORM MUST NOT WIN";
      const replay = await handleUserMessage({
        session: replaySession,
        userMessage: "我目前仍在职。",
        locale: "zh-CN",
        userAlreadyAppended: true,
      });
      assert.equal(replay.decision_context!.version, ctx.vBefore, "FU4-T original-turn replay must not write DC");
      assert.equal(replay.decision_context!.reality_facts.length, ctx.factsBefore);
      const askedReplay = replay.decision_understanding?.budget.session_asked_count ?? 0;
      assert.equal(askedReplay, askedAfterTerminal, "FU4-T original pending replay must not recount budget");
      const replayAsst = lastAssistant(replay);
      assert.notEqual(replayAsst.content, oldClarify, "FU4-T replay must not restore the refused clarification");
      assert.equal(replayAsst.content.includes("待澄清信息"), false);
      if (replay.adaptive_ask_plan) {
        assert.equal(String(replay.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution"), false);
      }
    });

    // M2.4-R2-FU5: clarification negation safety closure.
    // A meaningful negation of the proposed action must never be classified
    // as affirmative merely because an affirmative keyword also appears.

    await check("M2.4-R2-FU5-DP-N: definition-patch negatives never write as fact", async () => {
      const cases = [
        { tag: "fu5dpna", phrase: "我不想把它作为明确事实记录" },
        { tag: "fu5dpnb", phrase: "不要将它作为明确事实" },
        { tag: "fu5dpnc", phrase: "我不认为应该把它作为明确事实" },
        { tag: "fu5dpnd", phrase: "我不愿意把它改为事实" },
        { tag: "fu5dpne", phrase: "不应该记录为事实" },
        { tag: "fu5dpnf", phrase: "不是要作为事实记录" },
      ];
      for (const item of cases) {
        const ctx = await seedDefinitionPatchPending(`m24r2${item.tag}`);
        const itemId = ctx.out.pending_answer_resolution?.unresolved_items[0]?.item_id;
        assert.ok(itemId, `${item.phrase} seed must have a pending item_id`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        assert.equal(dc.reality_facts.length, ctx.factsBefore, `${item.phrase} must not write a RealityFact`);
        assert.equal(dc.constraints.length, ctx.cstBefore, `${item.phrase} must not write a Constraint`);
        assert.equal(dc.version, ctx.vBefore, `${item.phrase} must not bump DC version`);
        const pending = out.pending_answer_resolution;
        assert.ok(pending && pending.status === "pending", `${item.phrase} must keep pending active`);
        assert.ok(
          pending!.unresolved_items.some((u) => u.item_id === itemId),
          `${item.phrase} must not silently remove the pending item`,
        );
        assert.equal(
          pending!.unresolved_items.find((u) => u.item_id === itemId)?.reason,
          "definition_patch_not_persistable",
        );
        const asst = lastAssistant(out);
        assert.notEqual(asst.content, stubResponse, `${item.phrase} must not be replaced by a free-form model response`);
        assert.ok(
          asst.content.includes("待澄清信息") || asst.content.includes("作为明确事实") || asst.content.includes("定义修订"),
          `${item.phrase} must keep the pending clarification, got=${asst.content.slice(0, 200)}`,
        );
        assert.equal(
          Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
          false,
          `${item.phrase} must not enter ordinary NeedItem planning`,
        );
      }
    });

    await check("M2.4-R2-FU5-DP-P: definition-patch affirmatives still write through DC C1", async () => {
      const cases = [
        { tag: "fu5dppa", phrase: "改为作为明确事实记录" },
        { tag: "fu5dppb", phrase: "作为明确事实" },
      ];
      for (const item of cases) {
        const ctx = await seedDefinitionPatchPending(`m24r2${item.tag}`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        const written = factWritten(dc, "把决策问题改成是否立刻辞职");
        assert.ok(written, `${item.phrase} must write the converted RealityFact`);
        const role = ctx.legalCode.split("/role/")[1]!;
        const dirId = roleCodeDir(ctx.legalCode);
        assert.ok((written!.fact_roles ?? []).includes(role), `${item.phrase} must keep the authorized role`);
        assert.ok((written!.related_dir_ids ?? []).includes(dirId), `${item.phrase} must keep the authorized DIR`);
        assert.equal(dc.constraints.length, ctx.cstBefore, `${item.phrase} must not write a Constraint`);
        assert.ok(dc.version > ctx.vBefore, `${item.phrase} must persist through DC C1`);
        assert.equal(out.pending_answer_resolution ?? null, null, `${item.phrase} must clear pending after persist`);
        assert.notEqual(lastAssistant(out).content, stubResponse);
      }
    });

    await check("M2.4-R2-FU5-CC-N: constraint-confirm negatives never confirm a write", async () => {
      const cases = [
        { tag: "fu5ccna", phrase: "我不认为可以写入" },
        { tag: "fu5ccnb", phrase: "我不觉得可以写入" },
        { tag: "fu5ccnc", phrase: "并非可以写入" },
        { tag: "fu5ccnd", phrase: "我认为不能写入" },
        { tag: "fu5ccne", phrase: "我不同意将它作为明确约束" },
        { tag: "fu5ccnf", phrase: "我不接受这个约束作为明确约束" },
      ];
      for (const item of cases) {
        const ctx = await seedEstimatedConstraintPending(`m24r2${item.tag}`);
        const itemId = ctx.out.pending_answer_resolution?.unresolved_items[0]?.item_id;
        assert.ok(itemId, `${item.phrase} seed must have a pending item_id`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        const cst = dc.constraints.find((c) => c.statement.includes("不能超过五万"));
        assert.equal(cst, undefined, `${item.phrase} must not write a Constraint`);
        assert.equal(dc.reality_facts.length, ctx.factsBefore, `${item.phrase} must not write a RealityFact`);
        assert.equal(dc.version, ctx.vBefore, `${item.phrase} must not bump DC version`);
        const pending = out.pending_answer_resolution;
        assert.ok(pending && pending.status === "pending", `${item.phrase} must remain pending`);
        const kept = pending!.unresolved_items.find((u) => u.item_id === itemId);
        assert.ok(kept, `${item.phrase} must keep the pending item`);
        assert.notEqual(kept!.certainty, "explicit", `${item.phrase} must not be marked confirmed`);
        const asst = lastAssistant(out);
        assert.notEqual(asst.content, stubResponse, `${item.phrase} must not be replaced by a free-form model response`);
        assert.equal(
          Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
          false,
          `${item.phrase} must not enter ordinary NeedItem planning`,
        );
      }
    });

    await check("M2.4-R2-FU5-CC-P: constraint-confirm affirmatives still write user_asserted", async () => {
      const cases = [
        { tag: "fu5ccpa", phrase: "确认这是明确约束" },
        { tag: "fu5ccpb", phrase: "1" },
      ];
      for (const item of cases) {
        const ctx = await seedEstimatedConstraintPending(`m24r2${item.tag}`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        const cst = dc.constraints.find((c) => c.statement.includes("不能超过五万"));
        assert.ok(cst, `${item.phrase} must write the Constraint`);
        assert.equal(cst!.verification_level, "user_asserted", `${item.phrase} must be user_asserted`);
        // Align with FU4-N2 confirmation cases: assert the authorized Constraint
        // write and pending clear, without a stricter RealityFact prohibition
        // than the existing C1 confirmation path.
        assert.ok(dc.constraints.length > ctx.cstBefore, `${item.phrase} must add a Constraint`);
        assert.ok(dc.version > ctx.vBefore, `${item.phrase} must persist through DC C1`);
        assert.equal(out.pending_answer_resolution ?? null, null, `${item.phrase} must clear pending after persist`);
        assert.notEqual(lastAssistant(out).content, stubResponse);
      }
    });

    // M2.4-R2-FU6: remaining negation-to-affirmation write-path closure.
    // Negative-action detection must fire before affirmative keyword matching.
    // Every case below goes through handleUserMessage().

    await check("M2.4-R2-FU6-DP-N: remaining definition-patch negatives never write as fact", async () => {
      const cases = [
        { tag: "fu6dpna", phrase: "我不希望把它作为明确事实" },
        { tag: "fu6dpnb", phrase: "我不打算把它作为明确事实" },
        { tag: "fu6dpnc", phrase: "我不准备把它作为明确事实" },
        { tag: "fu6dpnd", phrase: "我不赞成把它作为明确事实" },
        { tag: "fu6dpne", phrase: "我不接受把它作为明确事实" },
        { tag: "fu6dpnf", phrase: "我不认可把它作为明确事实" },
        { tag: "fu6dpng", phrase: "我不希望将它记录为事实" },
        { tag: "fu6dpnh", phrase: "我不打算改为事实" },
      ];
      for (const item of cases) {
        const ctx = await seedDefinitionPatchPending(`m24r2${item.tag}`);
        const itemId = ctx.out.pending_answer_resolution?.unresolved_items[0]?.item_id;
        assert.ok(itemId, `${item.phrase} seed must have a pending item_id`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        assert.equal(dc.reality_facts.length, ctx.factsBefore, `${item.phrase} must not write a RealityFact`);
        assert.equal(dc.constraints.length, ctx.cstBefore, `${item.phrase} must not write a Constraint`);
        assert.equal(dc.version, ctx.vBefore, `${item.phrase} must not bump DC version`);
        const pending = out.pending_answer_resolution;
        assert.ok(pending && pending.status === "pending", `${item.phrase} must keep pending active`);
        assert.ok(
          pending!.unresolved_items.some((u) => u.item_id === itemId),
          `${item.phrase} must not silently remove the pending item`,
        );
        assert.equal(
          pending!.unresolved_items.find((u) => u.item_id === itemId)?.reason,
          "definition_patch_not_persistable",
        );
        const asst = lastAssistant(out);
        assert.notEqual(asst.content, stubResponse, `${item.phrase} must not be replaced by a free-form model response`);
        assert.ok(
          asst.content.includes("待澄清信息") || asst.content.includes("作为明确事实") || asst.content.includes("定义修订"),
          `${item.phrase} must keep the pending clarification, got=${asst.content.slice(0, 200)}`,
        );
        assert.equal(
          Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
          false,
          `${item.phrase} must not enter ordinary NeedItem planning`,
        );
      }
    });

    await check("M2.4-R2-FU6-DP-M: mixed definition-patch polarity fails closed", async () => {
      const phrase = "我不希望把它作为明确事实，请作为明确事实记录";
      const ctx = await seedDefinitionPatchPending("m24r2fu6dpnm");
      const itemId = ctx.out.pending_answer_resolution?.unresolved_items[0]?.item_id;
      assert.ok(itemId, `${phrase} seed must have a pending item_id`);
      stubResponse = "fu6dpnm FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.out,
        userMessage: phrase,
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, `${phrase} must not write a RealityFact`);
      assert.equal(dc.constraints.length, ctx.cstBefore, `${phrase} must not write a Constraint`);
      assert.equal(dc.version, ctx.vBefore, `${phrase} must not bump DC version`);
      const pending = out.pending_answer_resolution;
      assert.ok(pending && pending.status === "pending", `${phrase} must keep pending active`);
      assert.ok(
        pending!.unresolved_items.some((u) => u.item_id === itemId),
        `${phrase} must not silently remove the pending item`,
      );
      assert.equal(
        pending!.unresolved_items.find((u) => u.item_id === itemId)?.reason,
        "definition_patch_not_persistable",
      );
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, stubResponse, `${phrase} must not be replaced by a free-form model response`);
      assert.ok(
        asst.content.includes("待澄清信息") || asst.content.includes("作为明确事实") || asst.content.includes("定义修订"),
        `${phrase} must keep the pending clarification, got=${asst.content.slice(0, 200)}`,
      );
      assert.equal(
        Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
        false,
        `${phrase} must not enter ordinary NeedItem planning`,
      );
    });

    await check("M2.4-R2-FU6-CC-N: remaining constraint-confirm negatives never confirm a write", async () => {
      const cases = [
        { tag: "fu6ccna", phrase: "我不赞成可以写入" },
        { tag: "fu6ccnb", phrase: "我不希望可以写入" },
        { tag: "fu6ccnc", phrase: "我不打算确认这是明确约束" },
        { tag: "fu6ccnd", phrase: "我不接受将它作为明确约束" },
        { tag: "fu6ccne", phrase: "我不认可把它作为明确约束" },
        { tag: "fu6ccnf", phrase: "我不准备把它作为明确约束写入" },
      ];
      for (const item of cases) {
        const ctx = await seedEstimatedConstraintPending(`m24r2${item.tag}`);
        const itemId = ctx.out.pending_answer_resolution?.unresolved_items[0]?.item_id;
        assert.ok(itemId, `${item.phrase} seed must have a pending item_id`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        const cst = dc.constraints.find((c) => c.statement.includes("不能超过五万"));
        assert.equal(cst, undefined, `${item.phrase} must not write a Constraint`);
        assert.equal(dc.reality_facts.length, ctx.factsBefore, `${item.phrase} must not write a RealityFact`);
        assert.equal(dc.version, ctx.vBefore, `${item.phrase} must not bump DC version`);
        const pending = out.pending_answer_resolution;
        assert.ok(pending && pending.status === "pending", `${item.phrase} must remain pending`);
        const kept = pending!.unresolved_items.find((u) => u.item_id === itemId);
        assert.ok(kept, `${item.phrase} must keep the pending item`);
        assert.notEqual(kept!.certainty, "explicit", `${item.phrase} must not be marked confirmed`);
        const asst = lastAssistant(out);
        assert.notEqual(asst.content, stubResponse, `${item.phrase} must not be replaced by a free-form model response`);
        assert.equal(
          Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
          false,
          `${item.phrase} must not enter ordinary NeedItem planning`,
        );
      }
    });

    await check("M2.4-R2-FU6-CC-M: mixed constraint-confirm polarity fails closed", async () => {
      const phrase = "我不赞成可以写入，确认这是明确约束";
      const ctx = await seedEstimatedConstraintPending("m24r2fu6ccnm");
      const itemId = ctx.out.pending_answer_resolution?.unresolved_items[0]?.item_id;
      assert.ok(itemId, `${phrase} seed must have a pending item_id`);
      stubResponse = "fu6ccnm FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.out,
        userMessage: phrase,
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      const cst = dc.constraints.find((c) => c.statement.includes("不能超过五万"));
      assert.equal(cst, undefined, `${phrase} must not write a Constraint`);
      assert.equal(dc.reality_facts.length, ctx.factsBefore, `${phrase} must not write a RealityFact`);
      assert.equal(dc.version, ctx.vBefore, `${phrase} must not bump DC version`);
      const pending = out.pending_answer_resolution;
      assert.ok(pending && pending.status === "pending", `${phrase} must remain pending`);
      const kept = pending!.unresolved_items.find((u) => u.item_id === itemId);
      assert.ok(kept, `${phrase} must keep the pending item`);
      assert.notEqual(kept!.certainty, "explicit", `${phrase} must not be marked confirmed`);
      const asst = lastAssistant(out);
      assert.notEqual(asst.content, stubResponse, `${phrase} must not be replaced by a free-form model response`);
      assert.equal(
        Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
        false,
        `${phrase} must not enter ordinary NeedItem planning`,
      );
    });



    // M2.4-R2-FU7: replace whitelist negation checks with a conservative
    // action polarity gate. Unknown negative verbs and mixed polarity must
    // never produce an affirmative write. Every case goes through
    // handleUserMessage().

    await check("M2.4-R2-FU7-DP-N: polarity gate blocks definition-patch negatives", async () => {
      const cases = [
        { tag: "fu7dpna", phrase: "我不赞同把它作为明确事实" },
        { tag: "fu7dpnb", phrase: "我反对把它作为明确事实" },
        { tag: "fu7dpnc", phrase: "我拒绝把它作为明确事实" },
        { tag: "fu7dpnd", phrase: "我不支持把它作为明确事实" },
        { tag: "fu7dpne", phrase: "我不希望把它作为明确事实，请作为明确事实记录" },
      ];
      for (const item of cases) {
        const ctx = await seedDefinitionPatchPending(`m24r2${item.tag}`);
        const itemId = ctx.out.pending_answer_resolution?.unresolved_items[0]?.item_id;
        assert.ok(itemId, `${item.phrase} seed must have a pending item_id`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        assert.equal(dc.reality_facts.length, ctx.factsBefore, `${item.phrase} must not write a RealityFact`);
        assert.equal(dc.constraints.length, ctx.cstBefore, `${item.phrase} must not write a Constraint`);
        assert.equal(dc.version, ctx.vBefore, `${item.phrase} must not bump DC version`);
        const pending = out.pending_answer_resolution;
        assert.ok(pending && pending.status === "pending", `${item.phrase} must keep pending active`);
        assert.ok(
          pending!.unresolved_items.some((u) => u.item_id === itemId),
          `${item.phrase} must not silently remove the pending item`,
        );
        assert.equal(
          pending!.unresolved_items.find((u) => u.item_id === itemId)?.reason,
          "definition_patch_not_persistable",
        );
        const asst = lastAssistant(out);
        assert.notEqual(asst.content, stubResponse, `${item.phrase} must not be replaced by a free-form model response`);
        assert.ok(
          asst.content.includes("待澄清信息") || asst.content.includes("作为明确事实") || asst.content.includes("定义修订"),
          `${item.phrase} must keep the pending clarification, got=${asst.content.slice(0, 200)}`,
        );
        assert.equal(
          Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
          false,
          `${item.phrase} must not enter ordinary NeedItem planning`,
        );
      }
    });

    await check("M2.4-R2-FU7-CC-N: polarity gate blocks constraint-confirm negatives", async () => {
      const cases = [
        { tag: "fu7ccna", phrase: "我不赞同可以写入" },
        { tag: "fu7ccnb", phrase: "我反对可以写入" },
        { tag: "fu7ccnc", phrase: "我拒绝确认这是明确约束" },
        { tag: "fu7ccnd", phrase: "我不支持将它作为明确约束" },
        { tag: "fu7ccne", phrase: "我不赞成可以写入，确认这是明确约束" },
      ];
      for (const item of cases) {
        const ctx = await seedEstimatedConstraintPending(`m24r2${item.tag}`);
        const itemId = ctx.out.pending_answer_resolution?.unresolved_items[0]?.item_id;
        assert.ok(itemId, `${item.phrase} seed must have a pending item_id`);
        stubResponse = `${item.tag} FREEFORM MUST NOT WIN`;
        const out = await handleUserMessage({
          session: ctx.out,
          userMessage: item.phrase,
          locale: "zh-CN",
        });
        const dc = out.decision_context!;
        const cst = dc.constraints.find((c) => c.statement.includes("不能超过五万"));
        assert.equal(cst, undefined, `${item.phrase} must not write a Constraint`);
        assert.equal(dc.reality_facts.length, ctx.factsBefore, `${item.phrase} must not write a RealityFact`);
        assert.equal(dc.version, ctx.vBefore, `${item.phrase} must not bump DC version`);
        const pending = out.pending_answer_resolution;
        assert.ok(pending && pending.status === "pending", `${item.phrase} must remain pending`);
        const kept = pending!.unresolved_items.find((u) => u.item_id === itemId);
        assert.ok(kept, `${item.phrase} must keep the pending item`);
        assert.notEqual(kept!.certainty, "explicit", `${item.phrase} must not be marked confirmed`);
        const asst = lastAssistant(out);
        assert.notEqual(asst.content, stubResponse, `${item.phrase} must not be replaced by a free-form model response`);
        assert.equal(
          Boolean(out.adaptive_ask_plan && !String(out.adaptive_ask_plan.ask_now_reason ?? "").includes("pending_answer_resolution")),
          false,
          `${item.phrase} must not enter ordinary NeedItem planning`,
        );
      }
    });

    await check("M2.4-R2-FU7-DP-P: clearly affirmative natural language still writes through DC C1", async () => {
      const phrase = "请把它作为明确事实记录";
      const ctx = await seedDefinitionPatchPending("m24r2fu7dpp");
      stubResponse = "fu7dpp FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.out,
        userMessage: phrase,
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      const written = factWritten(dc, "把决策问题改成是否立刻辞职");
      assert.ok(written, `${phrase} must write the converted RealityFact`);
      const role = ctx.legalCode.split("/role/")[1]!;
      const dirId = roleCodeDir(ctx.legalCode);
      assert.ok((written!.fact_roles ?? []).includes(role), `${phrase} must keep the authorized role`);
      assert.ok((written!.related_dir_ids ?? []).includes(dirId), `${phrase} must keep the authorized DIR`);
      assert.equal(dc.constraints.length, ctx.cstBefore, `${phrase} must not write a Constraint`);
      assert.ok(dc.version > ctx.vBefore, `${phrase} must persist through DC C1`);
      assert.equal(out.pending_answer_resolution ?? null, null, `${phrase} must clear pending after persist`);
      assert.notEqual(lastAssistant(out).content, stubResponse);
    });

    await check("M2.4-R2-FU7-CC-P: clearly affirmative natural language still writes user_asserted", async () => {
      const phrase = "可以写入";
      const ctx = await seedEstimatedConstraintPending("m24r2fu7ccp");
      stubResponse = "fu7ccp FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.out,
        userMessage: phrase,
        locale: "zh-CN",
      });
      const dc = out.decision_context!;
      const cst = dc.constraints.find((c) => c.statement.includes("不能超过五万"));
      assert.ok(cst, `${phrase} must write the Constraint`);
      assert.equal(cst!.verification_level, "user_asserted", `${phrase} must be user_asserted`);
      assert.ok(dc.constraints.length > ctx.cstBefore, `${phrase} must add a Constraint`);
      assert.ok(dc.version > ctx.vBefore, `${phrase} must persist through DC C1`);
      assert.equal(out.pending_answer_resolution ?? null, null, `${phrase} must clear pending after persist`);
      assert.notEqual(lastAssistant(out).content, stubResponse);
    });


    // M2.4-R2-FU8: source-grounded model extractions, unresolved-aspect
    // scheduling, and explicit goal_change / insight_mismatch control flow.
    function blueprintSnapshot(session: POJUSessionState) {
      const bp = session.decision_blueprint;
      return {
        blueprint_id: bp?.blueprint_id ?? null,
        blueprint_version: bp?.blueprint_version ?? null,
        decision_question: bp?.decision_question ?? null,
        dir_ids: [...(bp?.dir_ids ?? [])].sort(),
        ddr_ids: [...(bp?.ddr_ids ?? [])].sort(),
        scope_locked: bp?.scope_locked ?? null,
      };
    }
    function definitionQuestion(session: POJUSessionState) {
      return session.decision_context?.definition?.decision_question ?? null;
    }
    function isOrdinaryNeedItemPlan(plan: import("../lib/poju/decision-intake/types").AdaptiveQuestionPlan | null | undefined) {
      if (!plan) return false;
      const reason = String(plan.ask_now_reason ?? "");
      return !reason.includes("pending_answer_resolution") && !reason.includes("pending_intake_control");
    }
    async function seedFu8Ready(tag: string) {
      const before = await seedAnswerReadySession(tag);
      const legalCode = authorizedFrom(before).fact_role_codes[0] ?? null;
      assert.ok(legalCode, `${tag} needs a legal authorized role code`);
      return {
        before,
        legalCode,
        role: legalCode.split("/role/")[1]!,
        dirId: roleCodeDir(legalCode),
        vBefore: before.decision_context!.version,
        factsBefore: before.decision_context!.reality_facts.length,
        cstBefore: before.decision_context!.constraints.length,
        bpBefore: blueprintSnapshot(before),
        dqBefore: definitionQuestion(before),
      };
    }
    function assertRolesAndDirs(
      written: { fact_roles?: string[]; related_dir_ids?: string[] },
      role: string,
      dirId: string,
      label: string,
    ) {
      assert.ok((written.fact_roles ?? []).includes(role), `${label} must keep the authorized role`);
      assert.ok((written.related_dir_ids ?? []).includes(dirId), `${label} must keep the authorized DIR`);
    }

    await check("M2.4-R2-FU8-A1: exact source quote writes a legal RealityFact", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a1");
      const statement = "我目前月薪三万。";
      stubResponse = "FU8A1 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: statement,
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: statement,
              },
            ],
            unresolved_aspects: [],
            explanation: "grounded fact",
          }),
        },
      });
      const dc = out.decision_context!;
      const fact = dc.reality_facts.find((f) => f.statement.includes("月薪三万"));
      assert.ok(fact, "FU8-A1 must write the grounded RealityFact");
      assert.equal(fact!.status, "unverified");
      assert.equal(fact!.verification_level, "user_asserted");
      assert.notEqual(fact!.status, "confirmed");
      assertRolesAndDirs(fact!, ctx.role, ctx.dirId, "FU8-A1");
      assert.ok(dc.version > ctx.vBefore, "FU8-A1 must bump DC version");
      assert.equal(dc.reality_facts.length, ctx.factsBefore + 1);
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU8-A1 must not write a Constraint");
    });

    await check("M2.4-R2-FU8-A2: exact source quote writes a legal Constraint path", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a2");
      const statement = "硬约束是必须保留社保。";
      stubResponse = "FU8A2 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: statement,
                semantic_kind: "constraint",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: statement,
              },
            ],
            unresolved_aspects: [],
            explanation: "grounded constraint",
          }),
        },
      });
      const dc = out.decision_context!;
      const cst = dc.constraints.find((c) => c.statement.includes("必须保留社保"));
      const companion = dc.reality_facts.find((f) => f.statement.includes("必须保留社保"));
      assert.ok(cst, "FU8-A2 must write the Constraint");
      assert.ok(companion, "FU8-A2 must also write the companion RealityFact");
      assert.equal(cst!.status, "unverified");
      assert.equal(cst!.verification_level, "user_asserted");
      assert.ok((cst!.related_dir_ids ?? []).includes(ctx.dirId), "FU8-A2 constraint must keep the authorized DIR");
      assertRolesAndDirs(companion!, ctx.role, ctx.dirId, "FU8-A2 companion");
      assert.ok(dc.version > ctx.vBefore);
      assert.ok(dc.constraints.length > ctx.cstBefore);
    });

    await check("M2.4-R2-FU8-A3: model fact absent from the user statement does not write DC", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a3");
      const statement = "我目前月薪三万。";
      stubResponse = "FU8A3 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "家里有一套房子。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "家里有一套房子。",
              },
            ],
            unresolved_aspects: [],
            explanation: "invented fact",
          }),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU8-A3 must not write a RealityFact");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU8-A3 must not write a Constraint");
      assert.equal(dc.version, ctx.vBefore, "FU8-A3 must not bump DC version");
    });

    await check("M2.4-R2-FU8-A4: partial overlapping quote that changes meaning does not write DC", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a4");
      const statement = "我目前月薪三万，但不想现在离职。";
      stubResponse = "FU8A4 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "月薪三万，想现在离职",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "月薪三万，想现在离职",
              },
            ],
            unresolved_aspects: [],
            explanation: "spliced meaning-changing quote",
          }),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU8-A4 must not write a RealityFact");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU8-A4 must not write a Constraint");
      assert.equal(dc.version, ctx.vBefore, "FU8-A4 must not bump DC version");
    });

    await check("M2.4-R2-FU8-A5: only the grounded item may write when mixed with an ungrounded item", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a5");
      const statement = "我目前月薪三万。家里有一个孩子。";
      stubResponse = "FU8A5 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "我目前月薪三万。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "我目前月薪三万。",
              },
              {
                text: "我已经买了房子。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "我已经买了房子。",
              },
            ],
            unresolved_aspects: [],
            explanation: "mixed grounding",
          }),
        },
      });
      const dc = out.decision_context!;
      const grounded = dc.reality_facts.filter((f) => f.statement.includes("月薪三万"));
      const invented = dc.reality_facts.filter((f) => f.statement.includes("买了房子"));
      assert.equal(grounded.length, 1, "FU8-A5 must write the grounded item");
      assert.equal(invented.length, 0, "FU8-A5 must not write the ungrounded item");
      assert.equal(dc.reality_facts.length, ctx.factsBefore + 1);
      assert.equal(grounded[0]!.verification_level, "user_asserted");
      assertRolesAndDirs(grounded[0]!, ctx.role, ctx.dirId, "FU8-A5");
      assert.ok(dc.version > ctx.vBefore);
      assert.equal(dc.constraints.length, ctx.cstBefore);
    });

    await check("M2.4-R2-FU8-A6: missing source_quote rejects the draft and never writes", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a6");
      stubResponse = "FU8A6 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "我目前月薪三万。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "missing source_quote",
          }),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU8-A6 must not write a RealityFact");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU8-A6 must not write a Constraint");
      assert.equal(dc.version, ctx.vBefore, "FU8-A6 must not bump DC version");
    });

    await check("M2.4-R2-FU8-A7: replay of a grounded write does not duplicate", async () => {
      const ctx = await seedFu8Ready("m24r2fu8a7");
      const statement = "我目前月薪三万。";
      const draft = {
        classification: "clear_answer" as const,
        extracted_items: [
          {
            text: statement,
            semantic_kind: "reality_fact" as const,
            role_hint: null,
            role_code_hint: ctx.legalCode,
            certainty: "explicit" as const,
            source_quote: statement,
          },
        ],
        unresolved_aspects: [] as string[],
        explanation: "grounded replay",
      };
      stubResponse = "FU8A7 FREEFORM 1";
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8a7_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const committed = await durable(first.session_id);
      const turnId = lastUserId(committed);
      const facts1 = committed.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const cst1 = committed.decision_context!.constraints.map((c) => c.constraint_id).sort();
      const v1 = committed.decision_context!.version;
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU8A7 FREEFORM 2 MUST NOT WIN";
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            { role: "user" as const, content: statement, timestamp: NOW, client_id: turnId },
          ],
        },
        userMessage: statement,
        locale: "zh-CN",
        userAlreadyAppended: true,
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = replay.decision_context!;
      assert.deepEqual(dc.reality_facts.map((f) => f.fact_id).sort(), facts1);
      assert.deepEqual(dc.constraints.map((c) => c.constraint_id).sort(), cst1);
      assert.equal(dc.version, v1, "FU8-A7 replay must not bump DC version");
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.equal(dc.reality_facts.length, ctx.factsBefore + 1);
    });

    await check("M2.4-R2-FU8-B1: empty extracted_items plus unresolved_aspects are scheduled, not written", async () => {
      const ctx = await seedFu8Ready("m24r2fu8b1");
      stubResponse = "FU8B1 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: "这件事我只能说一部分。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "partial_answer",
            extracted_items: [],
            unresolved_aspects: ["具体薪资还没说清"],
            explanation: "aspect only",
          }),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU8-B1 must not write facts");
      assert.equal(dc.constraints.length, ctx.cstBefore, "FU8-B1 must not write constraints");
      assert.equal(dc.version, ctx.vBefore, "FU8-B1 must not bump DC version");
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending", "FU8-B1 must schedule the aspect");
      assert.equal(control!.items.length, 1);
      assert.equal(control!.items[0]!.kind, "unresolved_aspect");
      assert.equal(control!.items[0]!.text.includes("具体薪资"), true);
      const asst = lastAssistant(out);
      assert.ok(asst.content.includes("具体薪资"), "FU8-B1 must ask about the unresolved aspect");
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false, "FU8-B1 must not jump to an ordinary NeedItem");
      assert.notEqual(asst.content, stubResponse);
    });

    await check("M2.4-R2-FU8-B2: grounded fact plus unresolved aspect writes only the fact and schedules the aspect", async () => {
      const ctx = await seedFu8Ready("m24r2fu8b2");
      const statement = "我目前月薪三万。";
      stubResponse = "FU8B2 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "partial_answer",
            extracted_items: [
              {
                text: statement,
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: statement,
              },
            ],
            unresolved_aspects: ["家庭负担还没说清"],
            explanation: "fact plus aspect",
          }),
        },
      });
      const dc = out.decision_context!;
      const fact = dc.reality_facts.find((f) => f.statement.includes("月薪三万"));
      assert.ok(fact, "FU8-B2 must write the grounded fact");
      assert.equal(dc.reality_facts.length, ctx.factsBefore + 1);
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.ok(dc.version > ctx.vBefore);
      assertRolesAndDirs(fact!, ctx.role, ctx.dirId, "FU8-B2");
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending", "FU8-B2 must keep the aspect pending");
      assert.equal(control!.items.some((i) => i.kind === "unresolved_aspect" && i.text.includes("家庭负担")), true);
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false, "FU8-B2 must ask the aspect before ordinary planning");
      assert.ok(lastAssistant(out).content.includes("家庭负担"));
    });

    await check("M2.4-R2-FU8-B3: multiple unresolved aspects are scheduled one at a time", async () => {
      const ctx = await seedFu8Ready("m24r2fu8b3");
      stubResponse = "FU8B3 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: "我只能先说这些。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "partial_answer",
            extracted_items: [],
            unresolved_aspects: ["时间窗口还不清楚", "退出成本还不清楚"],
            explanation: "two aspects",
          }),
        },
      });
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending");
      assert.equal(control!.items.length, 2, "FU8-B3 must preserve both aspects");
      assert.ok(control!.items.every((i) => i.kind === "unresolved_aspect"));
      assert.equal(out.decision_context!.version, ctx.vBefore);
      const asst = lastAssistant(out);
      assert.ok(asst.content.includes("时间窗口还不清楚"), "FU8-B3 must ask the first aspect first");
      assert.equal(asst.content.includes("退出成本还不清楚"), false, "FU8-B3 must not merge both aspects into one question");
    });

    await check("M2.4-R2-FU8-B4: replay of an aspect-scheduling turn is idempotent", async () => {
      const ctx = await seedFu8Ready("m24r2fu8b4");
      const statement = "我只能先说这些。";
      const draft = {
        classification: "partial_answer" as const,
        extracted_items: [] as Array<never>,
        unresolved_aspects: ["时间窗口还不清楚"],
        explanation: "aspect replay",
      };
      stubResponse = "FU8B4 FREEFORM 1";
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8b4_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const committed = await durable(first.session_id);
      const turnId = lastUserId(committed);
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      const q1 = lastAssistant(committed).content;
      const itemIds = (committed.pending_intake_control?.items ?? []).map((i) => i.item_id);
      stubResponse = "FU8B4 FREEFORM 2 MUST NOT WIN";
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            { role: "user" as const, content: statement, timestamp: NOW, client_id: turnId },
          ],
        },
        userMessage: statement,
        locale: "zh-CN",
        userAlreadyAppended: true,
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      assert.equal(replay.decision_context!.version, committed.decision_context!.version);
      assert.equal(replay.decision_context!.reality_facts.length, ctx.factsBefore);
      assert.deepEqual((replay.pending_intake_control?.items ?? []).map((i) => i.item_id), itemIds);
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.equal(lastAssistant(replay).content, q1, "FU8-B4 must recover the same aspect question");
    });

    await check("M2.4-R2-FU8-B5: clarification resolves only its intended aspect", async () => {
      const ctx = await seedFu8Ready("m24r2fu8b5");
      stubResponse = "FU8B5 FREEFORM 1";
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: "我只能先说这些。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "partial_answer",
            extracted_items: [],
            unresolved_aspects: ["时间窗口还不清楚", "退出成本还不清楚"],
            explanation: "two aspects",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8b5_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const pending = (await durable(first.session_id)).pending_intake_control;
      assert.ok(pending && pending.items.length === 2);
      const firstId = pending!.resolving_item_id ?? pending!.items[0]!.item_id;
      const secondId = pending!.items.find((i) => i.item_id !== firstId)!.item_id;
      const clarify = "最晚必须在今年六月前决定。";
      stubResponse = "FU8B5 FREEFORM 2 MUST NOT WIN";
      const second = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: clarify,
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: clarify,
              },
            ],
            unresolved_aspects: [],
            explanation: "clarified first aspect",
          }),
        },
      });
      const control = second.pending_intake_control;
      assert.ok(control, "FU8-B5 must keep the remaining aspect");
      const resolved = control!.items.find((i) => i.item_id === firstId);
      const remaining = control!.items.find((i) => i.item_id === secondId);
      assert.equal(resolved?.status, "clarified", "FU8-B5 must resolve only the intended aspect");
      assert.ok(remaining && (remaining.status === "pending" || remaining.status === "uncertain"));
      const fact = second.decision_context!.reality_facts.find((f) => f.statement.includes("今年六月"));
      assert.ok(fact, "FU8-B5 may write the grounded clarification");
      assertRolesAndDirs(fact!, ctx.role, ctx.dirId, "FU8-B5");
      assert.ok(lastAssistant(second).content.includes("退出成本还不清楚"));
      assert.equal(isOrdinaryNeedItemPlan(second.adaptive_ask_plan), false);
    });

    await check("M2.4-R2-FU8-C1: proposed goal change is captured without mutating Blueprint or DC definition", async () => {
      const ctx = await seedFu8Ready("m24r2fu8c1");
      const statement = "我想把决策目标改成要不要立刻出国读书。";
      stubResponse = "FU8C1 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "goal_change",
            extracted_items: [
              {
                text: "我想把决策目标改成要不要立刻出国读书",
                semantic_kind: "definition_patch",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "我想把决策目标改成要不要立刻出国读书",
              },
            ],
            unresolved_aspects: [],
            explanation: "proposed target change",
          }),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU8-C1 must not write the new goal as a fact");
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.equal(dc.version, ctx.vBefore, "FU8-C1 must not write a confirmed DC definition");
      assert.deepEqual(blueprintSnapshot(out), ctx.bpBefore, "FU8-C1 must not mutate Blueprint");
      assert.equal(definitionQuestion(out), ctx.dqBefore, "FU8-C1 must retain the original decision target");
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending");
      assert.equal(control!.items[0]!.kind, "goal_change");
      assert.equal(control!.entered_controlled_blueprint_update ?? false, false);
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false, "FU8-C1 must not emit an old-target NeedItem");
      assert.ok(lastAssistant(out).content.includes("确认更换决策目标"));
    });

    await check("M2.4-R2-FU8-C4: explicit confirmation runs the formal Blueprint update with history", async () => {
      const ctx = await seedFu8Ready("m24r2fu8c4");
      const statement = "我想把决策目标改成要不要立刻出国读书。";
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "goal_change",
            extracted_items: [
              {
                text: "我想把决策目标改成要不要立刻出国读书",
                semantic_kind: "definition_patch",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "我想把决策目标改成要不要立刻出国读书",
              },
            ],
            unresolved_aspects: [],
            explanation: "proposed target change",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8c4_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      stubResponse = "FU8C4 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: "1",
        locale: "zh-CN",
      });
      const target = "要不要立刻出国读书";
      const bpOld = first.decision_blueprint!;
      const bpNew = out.decision_blueprint!;
      assert.equal(bpNew.blueprint_version, bpOld.blueprint_version + 1, "FU8-C4 Blueprint version +1");
      assert.equal(bpNew.decision_question, target, "FU8-C4 Blueprint follows the confirmed target");
      assert.equal(definitionQuestion(out), target, "FU8-C4 DC definition follows the confirmed target");
      assert.equal(out.decision_context!.version, ctx.vBefore + 1, "FU8-C4 one committed DC version");
      const history = out.decision_blueprint_history ?? [];
      assert.equal(history.length, 1, "FU8-C4 old Blueprint kept in history");
      assert.equal(history[0]!.blueprint_version, bpOld.blueprint_version);
      assert.equal(history[0]!.decision_question, bpOld.decision_question);
      const log = out.blueprint_change_log ?? [];
      assert.equal(log.length, 1, "FU8-C4 one change record");
      assert.equal(log[0]!.old_decision_target, ctx.dqBefore);
      assert.equal(log[0]!.new_decision_target, target);
      assert.equal(log[0]!.confirmation_statement, "1");
      assert.equal(log[0]!.from_blueprint_version, bpOld.blueprint_version);
      assert.equal(log[0]!.to_blueprint_version, bpNew.blueprint_version);
      assert.equal(log[0]!.dc_version_after, out.decision_context!.version);
      const control = out.pending_intake_control;
      assert.ok(control, "FU8-C4 must keep the control record");
      assert.equal(control!.items[0]!.status, "confirmed");
      assert.equal(control!.blueprint_update?.change_id, log[0]!.change_id);
      assert.equal(out.decision_understanding?.blueprint_version, bpNew.blueprint_version, "FU8-C4 Understanding rebuilt on the new Blueprint");
      assert.equal(out.decision_understanding?.context_version, out.decision_context!.version);
      assert.ok(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), "FU8-C4 next question comes from the new plan");
      assert.equal(lastAssistant(out).content, out.adaptive_ask_plan!.question_text);
      assert.ok(out.adaptive_ask_plan!.dir_ids.every((d) => bpNew.dir_ids.includes(d)), "FU8-C4 next question bound to the new scope");
    });

    await check("M2.4-R2-FU8-C5: explicit refusal preserves the original target and resumes investigation", async () => {
      const ctx = await seedFu8Ready("m24r2fu8c5");
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: "我想把决策目标改成要不要立刻出国读书。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "goal_change",
            extracted_items: [
              {
                text: "我想把决策目标改成要不要立刻出国读书",
                semantic_kind: "definition_patch",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "我想把决策目标改成要不要立刻出国读书",
              },
            ],
            unresolved_aspects: [],
            explanation: "proposed target change",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8c5_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const oldClarify = lastAssistant(first).content;
      stubResponse = "FU8C5 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: "2",
        locale: "zh-CN",
      });
      assert.deepEqual(blueprintSnapshot(out), ctx.bpBefore);
      assert.equal(definitionQuestion(out), ctx.dqBefore);
      const control = out.pending_intake_control;
      assert.ok(control);
      assert.equal(control!.items[0]!.status, "declined");
      assert.equal(control!.entered_controlled_blueprint_update ?? false, false);
      assert.notEqual(lastAssistant(out).content, oldClarify, "FU8-C5 must not resend the confirmation question");
      assert.ok(isOrdinaryNeedItemPlan(out.adaptive_ask_plan) || out.adaptive_ask_plan, "FU8-C5 may resume original-target investigation");
    });

    await check("M2.4-R2-FU8-C6: uncertain confirmation keeps the control item pending", async () => {
      const ctx = await seedFu8Ready("m24r2fu8c6");
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: "我想把决策目标改成要不要立刻出国读书。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "goal_change",
            extracted_items: [
              {
                text: "我想把决策目标改成要不要立刻出国读书",
                semantic_kind: "definition_patch",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "我想把决策目标改成要不要立刻出国读书",
              },
            ],
            unresolved_aspects: [],
            explanation: "proposed target change",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8c6_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const oldClarify = lastAssistant(first).content;
      const asked1 = first.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU8C6 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: "我不确定",
        locale: "zh-CN",
      });
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending");
      assert.ok(control!.items[0]!.status === "pending" || control!.items[0]!.status === "uncertain");
      assert.equal(control!.entered_controlled_blueprint_update ?? false, false);
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false);
      assert.equal(lastAssistant(out).content, oldClarify, "FU8-C6 must keep the confirmation question");
      assert.equal(out.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.deepEqual(blueprintSnapshot(out), ctx.bpBefore);
    });

    await check("M2.4-R2-FU8-C7: replay does not repeat a confirmed target-change operation", async () => {
      const ctx = await seedFu8Ready("m24r2fu8c7");
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: "我想把决策目标改成要不要立刻出国读书。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "goal_change",
            extracted_items: [
              {
                text: "我想把决策目标改成要不要立刻出国读书",
                semantic_kind: "definition_patch",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "我想把决策目标改成要不要立刻出国读书",
              },
            ],
            unresolved_aspects: [],
            explanation: "proposed target change",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8c7_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const confirmed = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: "1",
        locale: "zh-CN",
      });
      await mutatePOJUSession(confirmed.session_id, {
        operation_id: "op_m24r2fu8c7_confirm",
        kind: "session_patch",
        bump_dc: true,
        apply: () => confirmed,
      });
      const committed = await durable(confirmed.session_id);
      const turnId = lastUserId(committed);
      const q1 = lastAssistant(committed).content;
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU8C7 FREEFORM MUST NOT WIN";
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            { role: "user" as const, content: "1", timestamp: NOW, client_id: turnId },
          ],
        },
        userMessage: "1",
        locale: "zh-CN",
        userAlreadyAppended: true,
      });
      assert.equal(replay.pending_intake_control?.entered_controlled_blueprint_update, true);
      assert.deepEqual(blueprintSnapshot(replay), blueprintSnapshot(committed), "replay must not rebuild the Blueprint again");
      assert.equal(definitionQuestion(replay), definitionQuestion(committed));
      assert.equal(replay.decision_context!.version, committed.decision_context!.version);
      assert.equal((replay.blueprint_change_log ?? []).length, 1, "replay must not append a second change record");
      assert.equal((replay.decision_blueprint_history ?? []).length, 1);
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.equal(lastAssistant(replay).content, q1);
    });

    await check("M2.4-R2-FU8-D1: insight_mismatch is captured as a control item and does not write inferred facts", async () => {
      const ctx = await seedFu8Ready("m24r2fu8d1");
      const statement = "你刚才的分析跟我的实际情况不一致，我并不是怕风险。";
      stubResponse = "FU8D1 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "insight_mismatch",
            extracted_items: [
              {
                text: "用户其实是风险偏好型人格",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctx.legalCode,
                certainty: "explicit",
                source_quote: "我并不是怕风险",
              },
            ],
            unresolved_aspects: [],
            explanation: "psychological inference",
          }),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore, "FU8-D1 must not write inferred RealityFacts");
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.equal(dc.version, ctx.vBefore);
      assert.deepEqual(blueprintSnapshot(out), ctx.bpBefore);
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending");
      assert.equal(control!.items[0]!.kind, "insight_mismatch");
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false, "FU8-D1 must not silently resume ordinary planning");
      assert.ok(lastAssistant(out).content.includes("不一致"));
    });

    await check("M2.4-R2-FU8-D2: insight_mismatch clarification and replay are idempotent", async () => {
      const ctx = await seedFu8Ready("m24r2fu8d2");
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: "你刚才的分析跟我的实际情况不一致。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "insight_mismatch",
            extracted_items: [],
            unresolved_aspects: [],
            explanation: "mismatch",
          }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu8d2_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const factsBeforeClarify = first.decision_context!.reality_facts.length;
      const clarify = "不一致的地方是我并不是因为怕风险才犹豫。";
      const clarifyDraft = {
        classification: "clear_answer" as const,
        extracted_items: [] as import("../lib/poju/decision-intake/types").ModelAnswerDraft["extracted_items"],
        unresolved_aspects: [] as string[],
        explanation: "no persistable user-authored fact in this clarification",
      };
      stubResponse = "FU8D2 FREEFORM MUST NOT WIN";
      const clarified = await handleUserMessage({
        session: await durable(first.session_id),
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => clarifyDraft },
      });
      assert.equal(
        clarified.decision_context!.reality_facts.length,
        factsBeforeClarify,
        "FU8-D2 clarification must not write inferred facts",
      );
      await mutatePOJUSession(clarified.session_id, {
        operation_id: "op_m24r2fu8d2_clarify",
        kind: "session_patch",
        bump_dc: true,
        apply: () => clarified,
      });
      const committed = await durable(clarified.session_id);
      const turnId = lastUserId(committed);
      const v1 = committed.decision_context!.version;
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      const q1 = lastAssistant(committed).content;
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            {
              role: "user" as const,
              content: clarify,
              timestamp: NOW,
              client_id: turnId,
            },
          ],
        },
        userMessage: clarify,
        locale: "zh-CN",
        userAlreadyAppended: true,
        __testOnlyM1Hooks: { interpretAnswerModel: () => clarifyDraft },
      });
      assert.equal(replay.decision_context!.version, v1);
      assert.equal(replay.decision_context!.reality_facts.length, factsBeforeClarify);
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.equal(lastAssistant(replay).content, q1);
    });


    // M2.4-R2-FU9: persisted content must be user-authored; insight_mismatch
    // clarifications are interpreted and retained; goal_change extracts an
    // exact target phrase instead of the entire original sentence.
    function fu9Item(
      text: string,
      opts: {
        legalCode: string;
        kind?: "reality_fact" | "constraint" | "definition_patch";
        source_quote?: string;
        certainty?: "explicit" | "estimated" | "unclear";
      },
    ) {
      return {
        text,
        semantic_kind: opts.kind ?? "reality_fact",
        role_hint: null,
        role_code_hint: opts.legalCode,
        certainty: opts.certainty ?? "explicit",
        source_quote: opts.source_quote ?? text,
      };
    }
    function fu9Draft(
      items: ReturnType<typeof fu9Item>[],
      extra?: Partial<import("../lib/poju/decision-intake/types").ModelAnswerDraft>,
    ): import("../lib/poju/decision-intake/types").ModelAnswerDraft {
      return {
        classification: "clear_answer",
        extracted_items: items,
        unresolved_aspects: [],
        explanation: "fu9",
        ...extra,
      };
    }
    function groundingRejectionsOf(session: POJUSessionState) {
      return session.last_answer_event?.grounding_rejections ?? [];
    }
    function proposedWritesOf(session: POJUSessionState) {
      return session.last_answer_event?.proposed_writes ?? [];
    }
    async function seedFu9Mismatch(
      tag: string,
      statement = "你刚才的分析跟我的实际情况不一致，我并不是怕风险。",
    ) {
      const ctx = await seedFu8Ready(tag);
      stubResponse = `${tag} FREEFORM 1 MUST NOT WIN`;
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft(
              [
                fu9Item("用户其实是风险偏好型人格", {
                  legalCode: ctx.legalCode,
                  source_quote: "我并不是怕风险",
                }),
              ],
              {
                classification: "insight_mismatch",
                explanation: "psychological inference",
              },
            ),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: `op_${tag}_mismatch`,
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      return { ctx, first, committed: await durable(first.session_id) };
    }

    await check("M2.4-R2-FU9-A1: exact user statement as text and source_quote is accepted", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a1");
      const statement = "我目前月薪三万。";
      stubResponse = "FU9A1 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft([fu9Item(statement, { legalCode: ctx.legalCode })]),
        },
      });
      const dc = out.decision_context!;
      const fact = dc.reality_facts.find((f) => f.statement === statement);
      assert.ok(fact, "FU9-A1 must persist the original unnormalized quote");
      assert.equal(fact!.verification_level, "user_asserted");
      assert.equal(fact!.status, "unverified");
      assertRolesAndDirs(fact!, ctx.role, ctx.dirId, "FU9-A1");
      assert.equal(dc.reality_facts.length, ctx.factsBefore + 1);
      assert.equal(dc.constraints.length, ctx.cstBefore);
      assert.ok(dc.version > ctx.vBefore);
      assert.equal(groundingRejectionsOf(out).length, 0);
    });

    // M2.4-R2 source authority: the DC statement is the raw user answer; the
    // model's extracted text is only an audit label on the write's provenance.
    function assertRawAnswerWrite(
      out: POJUSessionState,
      ctx: Awaited<ReturnType<typeof seedFu8Ready>>,
      statement: string,
      modelTexts: string[],
      label: string,
    ) {
      const dc = out.decision_context!;
      const fact = dc.reality_facts.find((f) => f.statement === statement.trim());
      assert.ok(fact, `${label} must persist the raw user answer`);
      assertRolesAndDirs(fact!, ctx.role, ctx.dirId, label);
      for (const text of modelTexts) {
        if (statement.includes(text)) continue;
        assert.equal(
          dc.reality_facts.some((f) => f.statement.includes(text)) ||
            dc.constraints.some((c) => c.statement.includes(text)),
          false,
          `${label} model text must never become a DC statement`,
        );
      }
      for (const w of proposedWritesOf(out)) {
        assert.equal(w.statement, statement.trim(), `${label} every write states the raw answer`);
        assert.ok((w.provenance ?? []).length >= 1, `${label} write keeps per-item provenance`);
        for (const p of w.provenance ?? []) {
          assert.equal(p.statement_basis, "raw_user_statement");
          assert.equal(
            statement.trim().slice(p.located_start!, p.located_end!).length > 0,
            true,
            `${label} provenance locates the quote in the raw answer`,
          );
        }
      }
      return fact!;
    }

    await check("M2.4-R2-FU9-A2: a meaning-changing model text never enters DC; the raw answer does", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a2");
      const statement = "我并不是怕风险。";
      stubResponse = "FU9A2 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("我其实愿意承担风险。", {
                legalCode: ctx.legalCode,
                source_quote: "我并不是怕风险",
              }),
            ]),
        },
      });
      const fact = assertRawAnswerWrite(out, ctx, statement, ["我其实愿意承担风险"], "FU9-A2");
      assert.equal(fact.verification_level, "user_asserted");
      assert.equal(proposedWritesOf(out)[0]!.provenance![0]!.extracted_text, "我其实愿意承担风险。");
      assert.equal(groundingRejectionsOf(out).length, 0);
    });

    await check("M2.4-R2-FU9-A3: an inferred personality label is only an audit label", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a3");
      const statement = "我并不是怕风险。";
      stubResponse = "FU9A3 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("用户其实是风险偏好型人格", {
                legalCode: ctx.legalCode,
                source_quote: "我并不是怕风险",
              }),
            ]),
        },
      });
      assertRawAnswerWrite(out, ctx, statement, ["风险偏好型人格"], "FU9-A3");
    });

    await check("M2.4-R2-FU9-A4: a polarity-cut quote stores the full raw answer with its negation", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a4");
      const statement = "我不想离职。";
      stubResponse = "FU9A4 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("我想离职", {
                legalCode: ctx.legalCode,
                source_quote: "想离职",
              }),
            ]),
        },
      });
      assertRawAnswerWrite(out, ctx, statement, ["我想离职"], "FU9-A4");
      assert.equal(out.decision_context!.reality_facts.some((f) => f.statement === "我想离职" || f.statement === "想离职"), false);
    });

    await check("M2.4-R2-FU9-A5: mixed exact and paraphrased items store one raw-answer fact", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a5");
      const statement = "我目前月薪三万。我并不是怕风险。";
      stubResponse = "FU9A5 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("我目前月薪三万。", { legalCode: ctx.legalCode }),
              fu9Item("用户其实是风险偏好型人格", {
                legalCode: ctx.legalCode,
                source_quote: "我并不是怕风险",
              }),
            ]),
        },
      });
      assertRawAnswerWrite(out, ctx, statement, ["风险偏好"], "FU9-A5");
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.length, ctx.factsBefore + 1);
      assert.equal(proposedWritesOf(out)[0]!.provenance!.length, 2, "FU9-A5 both item locators kept");
    });

    await check("M2.4-R2-FU9-A6: missing, blank, and oversized source quotes never write DC", async () => {
      const ctxMissing = await seedFu8Ready("m24r2fu9a6m");
      stubResponse = "FU9A6M FREEFORM MUST NOT WIN";
      const missing = await handleUserMessage({
        session: ctxMissing.before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "clear_answer",
            extracted_items: [
              {
                text: "我目前月薪三万。",
                semantic_kind: "reality_fact",
                role_hint: null,
                role_code_hint: ctxMissing.legalCode,
                certainty: "explicit",
              },
            ],
            unresolved_aspects: [],
            explanation: "missing source_quote",
          }),
        },
      });
      assert.equal(missing.decision_context!.reality_facts.length, ctxMissing.factsBefore);
      assert.equal(missing.decision_context!.constraints.length, ctxMissing.cstBefore);
      assert.equal(missing.decision_context!.version, ctxMissing.vBefore);

      const ctxBlank = await seedFu8Ready("m24r2fu9a6b");
      stubResponse = "FU9A6B FREEFORM MUST NOT WIN";
      const blank = await handleUserMessage({
        session: ctxBlank.before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("我目前月薪三万。", { legalCode: ctxBlank.legalCode, source_quote: "   " }),
            ]),
        },
      });
      assert.equal(blank.decision_context!.reality_facts.length, ctxBlank.factsBefore);
      assert.equal(blank.decision_context!.version, ctxBlank.vBefore);
      assert.ok(groundingRejectionsOf(blank).some((r) => r.reason === "source_quote_empty"));
      assert.equal(proposedWritesOf(blank).length, 0);

      const ctxLong = await seedFu8Ready("m24r2fu9a6l");
      const tooLong = `${"x".repeat(2001)}`;
      stubResponse = "FU9A6L FREEFORM MUST NOT WIN";
      const oversized = await handleUserMessage({
        session: ctxLong.before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("我目前月薪三万。", { legalCode: ctxLong.legalCode, source_quote: tooLong }),
            ]),
        },
      });
      assert.equal(oversized.decision_context!.reality_facts.length, ctxLong.factsBefore);
      assert.equal(oversized.decision_context!.version, ctxLong.vBefore);
      assert.ok(groundingRejectionsOf(oversized).some((r) => r.reason === "source_quote_too_long"));
      assert.equal(proposedWritesOf(oversized).length, 0);
    });

    await check("M2.4-R2-FU9-A7: an ungrounded quote never receives user_asserted or user_estimate", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a7");
      const statement = "我并不是怕风险。";
      stubResponse = "FU9A7 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("用户其实是风险偏好型人格", {
                legalCode: ctx.legalCode,
                source_quote: "用户其实是风险偏好型人格",
                certainty: "explicit",
              }),
            ]),
        },
      });
      assert.equal(out.decision_context!.version, ctx.vBefore);
      assert.equal(proposedWritesOf(out).length, 0);
      assert.equal(
        out.decision_context!.reality_facts.some(
          (f) =>
            !ctx.before.decision_context!.reality_facts.some((b) => b.fact_id === f.fact_id) &&
            (f.verification_level === "user_asserted" || f.verification_level === "user_estimate"),
        ),
        false,
      );
    });

    await check("M2.4-R2-FU9-A8: rejected items have structured inspectable rejection reasons", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a8");
      stubResponse = "FU9A8 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: "我并不是怕风险。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("用户其实是风险偏好型人格", {
                legalCode: ctx.legalCode,
                source_quote: "用户其实是风险偏好型人格",
              }),
            ]),
        },
      });
      const rejections = groundingRejectionsOf(out);
      assert.ok(rejections.length >= 1, "FU9-A8 must expose grounding_rejections on the session");
      assert.equal(rejections[0]!.reason, "source_quote_not_grounded");
      assert.equal(rejections[0]!.source_quote, "用户其实是风险偏好型人格");
      assert.equal(rejections[0]!.text.includes("风险偏好型人格"), true);
      assert.equal(typeof rejections[0]!.extracted_index, "number");
    });

    await check("M2.4-R2-FU9-A9: replay does not duplicate writes or rejection records", async () => {
      const ctx = await seedFu8Ready("m24r2fu9a9");
      const statement = "我目前月薪三万。我并不是怕风险。";
      const draft = fu9Draft([
        fu9Item("我目前月薪三万。", { legalCode: ctx.legalCode }),
        fu9Item("用户其实是风险偏好型人格", {
          legalCode: ctx.legalCode,
          source_quote: "用户其实是风险偏好型人格",
        }),
      ]);
      stubResponse = "FU9A9 FREEFORM 1";
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2fu9a9_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const committed = await durable(first.session_id);
      const turnId = lastUserId(committed);
      const facts1 = committed.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const rejections1 = groundingRejectionsOf(committed);
      assert.equal(committed.decision_context!.reality_facts.length, ctx.factsBefore + 1);
      assert.ok(rejections1.some((r) => r.reason === "source_quote_not_grounded"));
      const v1 = committed.decision_context!.version;
      stubResponse = "FU9A9 FREEFORM 2 MUST NOT WIN";
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            { role: "user" as const, content: statement, timestamp: NOW, client_id: turnId },
          ],
        },
        userMessage: statement,
        locale: "zh-CN",
        userAlreadyAppended: true,
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      const dc = replay.decision_context!;
      assert.deepEqual(dc.reality_facts.map((f) => f.fact_id).sort(), facts1);
      assert.equal(dc.version, v1);
      assert.equal(groundingRejectionsOf(replay).length, rejections1.length);
    });

    await check("M2.4-R2-FU9-B1: initial mismatch creates a pending control item", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b1");
      const control = seeded.first.pending_intake_control;
      assert.ok(control && control.status === "pending", "FU9-B1 must create a pending control item");
      assert.equal(control!.items[0]!.kind, "insight_mismatch");
      assert.equal(control!.items[0]!.status, "pending");
      assert.equal(seeded.first.decision_context!.reality_facts.length, seeded.ctx.factsBefore);
      assert.equal(seeded.first.decision_context!.version, seeded.ctx.vBefore);
      assert.equal(isOrdinaryNeedItemPlan(seeded.first.adaptive_ask_plan), false);
      assert.ok(lastAssistant(seeded.first).content.includes("不一致"));
    });

    await check("M2.4-R2-FU9-B2: concrete clarification is passed through model interpretation", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b2");
      const clarify = "我并不是怕风险，我只是还在比较时间窗口。";
      const hookCalls: string[] = [];
      stubResponse = "FU9B2 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: ({ statement }) => {
            hookCalls.push(statement);
            return fu9Draft(
              [fu9Item("我只是还在比较时间窗口。", { legalCode: seeded.ctx.legalCode })],
              { classification: "correction", explanation: "clarification" },
            );
          },
        },
      });
      assert.deepEqual(hookCalls, [clarify], "FU9-B2 must interpret the clarification through the model hook");
      assert.ok(out.last_answer_event, "FU9-B2 must produce an AnswerEvent");
      assert.equal(out.last_answer_event!.raw_text.includes("比较时间窗口"), true);
    });

    await check("M2.4-R2-FU9-B3: exact user-authored clarification can enter the legal DC path", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b3");
      const clarify = "我只是还在比较时间窗口。";
      stubResponse = "FU9B3 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft([fu9Item(clarify, { legalCode: seeded.ctx.legalCode })]),
        },
      });
      const dc = out.decision_context!;
      const fact = dc.reality_facts.find((f) => f.statement === clarify);
      assert.ok(fact, "FU9-B3 must persist the exact clarification quote");
      assert.equal(fact!.verification_level, "user_asserted");
      assertRolesAndDirs(fact!, seeded.ctx.role, seeded.ctx.dirId, "FU9-B3");
      assert.ok(dc.version > seeded.ctx.vBefore);
      const item = out.pending_intake_control?.items.find((row) => row.kind === "insight_mismatch");
      assert.equal(item?.status, "clarified");
    });

    await check("M2.4-R2-FU9-B4: a model-generated inference on a clarification is only an audit label", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b4");
      const clarify = "我并不是怕风险。";
      stubResponse = "FU9B4 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([
              fu9Item("用户其实是风险偏好型人格", {
                legalCode: seeded.ctx.legalCode,
                source_quote: "我并不是怕风险",
              }),
            ]),
        },
      });
      const dc = out.decision_context!;
      assert.equal(dc.reality_facts.some((f) => f.statement.includes("风险偏好型人格")), false);
      const fact = dc.reality_facts.find((f) => f.statement === clarify);
      assert.ok(fact, "FU9-B4 the clarification's raw text is what enters DC");
      assert.equal(
        out.pending_intake_control?.items.find((i) => i.kind === "insight_mismatch")?.status,
        "clarified",
      );
    });

    await check("M2.4-R2-FU9-B5: clarification text and source turn are retained in the resolution record", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b5");
      const clarify = "我只是还在比较时间窗口。";
      stubResponse = "FU9B5 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft([fu9Item(clarify, { legalCode: seeded.ctx.legalCode })]),
        },
      });
      const records = out.pending_intake_control?.resolution_records ?? [];
      assert.equal(records.length, 1, "FU9-B5 must retain one resolution record");
      const rec = records[0]!;
      const mismatch = seeded.first.pending_intake_control!.items[0]!;
      assert.equal(rec.original_mismatch_item_id, mismatch.item_id);
      assert.equal(rec.original_mismatch_source_turn_id, mismatch.source_turn_id);
      assert.equal(rec.clarification_turn_id, lastUserId(out));
      assert.equal(rec.original_mismatch_text, mismatch.text);
      assert.equal(rec.clarification_text, clarify);
      assert.ok(rec.answer_event_id);
      assert.ok(rec.resolution_status === "clarified" || rec.resolution_status === "clarified_without_dc_write");
    });

    await check("M2.4-R2-FU9-B6: model call failure leaves the control item pending", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b6");
      stubResponse = "FU9B6 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: "我只是还在比较时间窗口。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => {
            throw new Error("fu9_model_call_failed");
          },
        },
      });
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending", "FU9-B6 must keep the control pending");
      assert.equal(control!.items[0]!.status === "pending" || control!.items[0]!.status === "uncertain", true);
      assert.equal(out.decision_context!.version, seeded.ctx.vBefore);
      assert.equal((control!.resolution_records ?? []).length, 0);
      const failAsst = [...out.messages].reverse().find((m) => m.role === "assistant");
      const failMeta = (failAsst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } } | undefined)?.meta;
      assert.equal(failMeta?.m1_fail_closed, true);
      assert.equal(failMeta?.m1_outcome, "answer_interpretation_failed");
    });

    await check("M2.4-R2-FU9-B7: invalid model schema leaves the control item pending", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b7");
      stubResponse = "FU9B7 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: "我只是还在比较时间窗口。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            classification: "not_a_real_class",
            extracted_items: [],
            unresolved_aspects: [],
            explanation: "invalid schema",
          }),
        },
      });
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending", "FU9-B7 must keep the control pending");
      assert.equal(control!.items[0]!.kind, "insight_mismatch");
      assert.notEqual(control!.items[0]!.status, "clarified");
      assert.equal(out.decision_context!.version, seeded.ctx.vBefore);
      assert.equal((control!.resolution_records ?? []).length, 0);
      const failAsst = [...out.messages].reverse().find((m) => m.role === "assistant");
      const failMeta = (failAsst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } } | undefined)?.meta;
      assert.equal(failMeta?.m1_fail_closed, true);
      assert.equal(failMeta?.m1_outcome, "answer_interpretation_invalid_schema");
    });

    await check("M2.4-R2-FU9-B8: DC persistence failure leaves the control item pending", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b8");
      const clarify = "我只是还在比较时间窗口。";
      stubResponse = "FU9B8 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft([fu9Item(clarify, { legalCode: seeded.ctx.legalCode })]),
          intakeControlPersist: async (previous) => ({
            session: previous,
            committed: false,
            error: "persist_failed",
          }),
        },
      });
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending", "FU9-B8 must keep the control pending");
      assert.notEqual(control!.items[0]!.status, "clarified");
      assert.equal(out.decision_context!.version, seeded.ctx.vBefore);
      assert.equal(out.decision_context!.reality_facts.length, seeded.ctx.factsBefore);
      assert.equal((control!.resolution_records ?? []).length, 0);
      const failAsst = [...out.messages].reverse().find((m) => m.role === "assistant");
      const failMeta = (failAsst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } } | undefined)?.meta;
      assert.equal(failMeta?.m1_fail_closed, true);
      assert.equal(failMeta?.m1_outcome, "persist_failed");
    });

    await check("M2.4-R2-FU9-B9: successful clarification resolves only its own mismatch item", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b9");
      const beforeIds = (seeded.committed.pending_intake_control?.items ?? []).map((item) => item.item_id);
      assert.equal(beforeIds.length, 1);
      const clarify = "我只是还在比较时间窗口。";
      stubResponse = "FU9B9 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft([fu9Item(clarify, { legalCode: seeded.ctx.legalCode })]),
        },
      });
      const items = out.pending_intake_control?.items ?? [];
      assert.equal(items.length, 1, "FU9-B9 must not invent additional control items");
      assert.equal(items[0]!.item_id, beforeIds[0]);
      assert.equal(items[0]!.status, "clarified");
      assert.equal(items[0]!.kind, "insight_mismatch");
    });

    await check("M2.4-R2-FU9-B10: ordinary planning resumes only after successful resolution", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b10");
      assert.equal(isOrdinaryNeedItemPlan(seeded.first.adaptive_ask_plan), false);
      stubResponse = "FU9B10 FAIL FREEFORM MUST NOT WIN";
      const failed = await handleUserMessage({
        session: seeded.committed,
        userMessage: "我只是还在比较时间窗口。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => {
            throw new Error("fu9_b10_model_failed");
          },
        },
      });
      assert.ok(failed.pending_intake_control && failed.pending_intake_control.status === "pending");
      assert.equal(isOrdinaryNeedItemPlan(failed.adaptive_ask_plan), false, "FU9-B10 must not resume after failure");

      const clarify = "我只是还在比较时间窗口。";
      stubResponse = "FU9B10 OK FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft([fu9Item(clarify, { legalCode: seeded.ctx.legalCode })]),
        },
      });
      const item = out.pending_intake_control?.items[0];
      assert.equal(item?.status, "clarified");
      assert.ok(
        isOrdinaryNeedItemPlan(out.adaptive_ask_plan) || out.adaptive_ask_plan,
        "FU9-B10 may resume ordinary investigation after success",
      );
      assert.equal(
        String(out.adaptive_ask_plan?.ask_now_reason ?? "").includes("pending_intake_control"),
        false,
        "FU9-B10 must leave the mismatch follow-up",
      );
    });

    await check("M2.4-R2-FU9-B11: replay does not duplicate DC writes or resolution records", async () => {
      const seeded = await seedFu9Mismatch("m24r2fu9b11");
      const clarify = "我只是还在比较时间窗口。";
      const draft = fu9Draft([fu9Item(clarify, { legalCode: seeded.ctx.legalCode })]);
      stubResponse = "FU9B11 FREEFORM 1";
      const clarified = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      await mutatePOJUSession(clarified.session_id, {
        operation_id: "op_m24r2fu9b11_clarify",
        kind: "session_patch",
        bump_dc: true,
        apply: () => clarified,
      });
      const committed = await durable(clarified.session_id);
      const turnId = lastUserId(committed);
      const facts1 = committed.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const v1 = committed.decision_context!.version;
      const records1 = committed.pending_intake_control?.resolution_records ?? [];
      assert.equal(records1.length, 1);
      const q1 = lastAssistant(committed).content;
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU9B11 FREEFORM 2 MUST NOT WIN";
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            { role: "user" as const, content: clarify, timestamp: NOW, client_id: turnId },
          ],
        },
        userMessage: clarify,
        locale: "zh-CN",
        userAlreadyAppended: true,
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      assert.deepEqual(replay.decision_context!.reality_facts.map((f) => f.fact_id).sort(), facts1);
      assert.equal(replay.decision_context!.version, v1);
      assert.equal((replay.pending_intake_control?.resolution_records ?? []).length, 1);
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.equal(lastAssistant(replay).content, q1);
    });

    async function seedFu9GoalChange(
      tag: string,
      opts?: {
        statement?: string;
        extracted_items?: import("../lib/poju/decision-intake/types").ModelAnswerDraft["extracted_items"];
      },
    ) {
      const ctx = await seedFu8Ready(tag);
      const statement = opts?.statement ?? "我想换个方向，改成要不要立刻出国读书。";
      const extracted_items =
        opts?.extracted_items ??
        [
          fu9Item("改成要不要立刻出国读书", {
            legalCode: ctx.legalCode,
            kind: "definition_patch",
          }),
        ];
      stubResponse = `${tag} FREEFORM 1 MUST NOT WIN`;
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft(extracted_items, {
              classification: "goal_change",
              explanation: "proposed target change",
            }),
        },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: `op_${tag}_goal`,
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      return { ctx, first, committed: await durable(first.session_id), statement };
    }

    await check("M2.4-R2-FU9-C1: proposed target is extracted separately from introductory wording", async () => {
      const seeded = await seedFu9GoalChange("m24r2fu9c1");
      const control = seeded.first.pending_intake_control;
      assert.ok(control && control.status === "pending");
      assert.equal(control!.items[0]!.kind, "goal_change");
      assert.equal(control!.items[0]!.proposed_decision_target, "要不要立刻出国读书");
      assert.notEqual(control!.items[0]!.proposed_decision_target, seeded.statement);
      assert.equal(isOrdinaryNeedItemPlan(seeded.first.adaptive_ask_plan), false);
      assert.ok(lastAssistant(seeded.first).content.includes("要不要立刻出国读书"));
      assert.ok(lastAssistant(seeded.first).content.includes("确认更换决策目标"));
      assert.equal(lastAssistant(seeded.first).content.includes("请直接重述"), false);
    });

    await check("M2.4-R2-FU9-C2: the exact target phrase is retained", async () => {
      const seeded = await seedFu9GoalChange("m24r2fu9c2");
      assert.equal(
        seeded.first.pending_intake_control!.items[0]!.proposed_decision_target,
        "要不要立刻出国读书",
      );
      assert.ok(lastAssistant(seeded.first).content.includes("「要不要立刻出国读书」"));
    });

    await check("M2.4-R2-FU9-C3: a paraphrased target label is ignored; the located user wording is the candidate", async () => {
      const ctx = await seedFu8Ready("m24r2fu9c3");
      const statement = "我想换个方向，改成要不要立刻出国读书。";
      stubResponse = "FU9C3 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft(
              [
                fu9Item("是否立即赴海外留学", {
                  legalCode: ctx.legalCode,
                  kind: "definition_patch",
                  source_quote: "要不要立刻出国读书",
                }),
              ],
              { classification: "goal_change", explanation: "paraphrased target" },
            ),
        },
      });
      const item = out.pending_intake_control?.items[0];
      assert.ok(item && item.kind === "goal_change");
      assert.equal(item!.proposed_decision_target, "要不要立刻出国读书", "FU9-C3 candidate is the user's own wording");
      assert.equal(item!.source_statement, statement, "FU9-C3 raw proposal statement kept");
      assert.equal(lastAssistant(out).content.includes("是否立即赴海外留学"), false);
      assert.ok(lastAssistant(out).content.includes("确认更换决策目标"));
      assert.deepEqual(blueprintSnapshot(out), ctx.bpBefore, "FU9-C3 nothing changes before confirmation");
      assert.equal(definitionQuestion(out), ctx.dqBefore);
      assert.equal(out.decision_context!.version, ctx.vBefore);
    });

    await check("M2.4-R2-FU9-C4: missing target phrase asks the user to restate, not to confirm", async () => {
      const ctx = await seedFu8Ready("m24r2fu9c4");
      stubResponse = "FU9C4 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: "我想换一个决策目标。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([], { classification: "goal_change", explanation: "no target phrase" }),
        },
      });
      const item = out.pending_intake_control?.items[0];
      assert.ok(item && item.kind === "goal_change" && item.status === "pending");
      assert.equal(item!.proposed_decision_target, undefined);
      const q = lastAssistant(out).content;
      assert.ok(q.includes("请直接重述"));
      assert.equal(q.includes("确认更换决策目标"), false);
      assert.equal(q.includes("1. 确认更换决策目标"), false);
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false);
      assert.ok(String(out.adaptive_ask_plan?.ask_now_reason ?? "").includes("goal_change_restate"));
    });

    await check("M2.4-R2-FU9-C5: explicit confirmation updates Blueprint and DC definition through the formal entry", async () => {
      const seeded = await seedFu9GoalChange("m24r2fu9c5");
      stubResponse = "FU9C5 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: "1",
        locale: "zh-CN",
      });
      const target = "要不要立刻出国读书";
      assert.equal(out.decision_blueprint!.decision_question, target);
      assert.equal(out.decision_blueprint!.blueprint_version, seeded.committed.decision_blueprint!.blueprint_version + 1);
      assert.equal(definitionQuestion(out), target);
      assert.equal(out.pending_intake_control?.items[0]!.status, "confirmed");
      assert.equal(out.pending_intake_control?.items[0]!.proposed_decision_target, target);
      assert.equal(out.decision_context!.version, seeded.ctx.vBefore + 1);
      const change = (out.blueprint_change_log ?? [])[0];
      assert.ok(change, "FU9-C5 change record");
      assert.equal(change!.proposal_statement, seeded.statement);
      assert.equal(change!.old_decision_target, seeded.ctx.dqBefore);
      assert.ok(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), "FU9-C5 next question re-planned on the new target");
    });

    await check("M2.4-R2-FU9-C6: explicit refusal retains the original target", async () => {
      const seeded = await seedFu9GoalChange("m24r2fu9c6");
      const oldClarify = lastAssistant(seeded.first).content;
      stubResponse = "FU9C6 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: "2",
        locale: "zh-CN",
      });
      assert.deepEqual(blueprintSnapshot(out), seeded.ctx.bpBefore);
      assert.equal(definitionQuestion(out), seeded.ctx.dqBefore);
      assert.equal(out.pending_intake_control?.items[0]!.status, "declined");
      assert.equal(out.pending_intake_control?.entered_controlled_blueprint_update ?? false, false);
      assert.notEqual(lastAssistant(out).content, oldClarify);
      assert.ok(isOrdinaryNeedItemPlan(out.adaptive_ask_plan) || out.adaptive_ask_plan);
    });

    await check("M2.4-R2-FU9-C7: uncertainty keeps the control item pending", async () => {
      const seeded = await seedFu9GoalChange("m24r2fu9c7");
      const oldClarify = lastAssistant(seeded.first).content;
      const asked1 = seeded.first.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU9C7 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: "我不确定",
        locale: "zh-CN",
      });
      const control = out.pending_intake_control;
      assert.ok(control && control.status === "pending");
      assert.ok(control!.items[0]!.status === "pending" || control!.items[0]!.status === "uncertain");
      assert.equal(control!.entered_controlled_blueprint_update ?? false, false);
      assert.equal(isOrdinaryNeedItemPlan(out.adaptive_ask_plan), false);
      assert.equal(lastAssistant(out).content, oldClarify);
      assert.equal(out.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.deepEqual(blueprintSnapshot(out), seeded.ctx.bpBefore);
    });

    await check("M2.4-R2-FU9-C8: replay does not repeat the target-change operation", async () => {
      const seeded = await seedFu9GoalChange("m24r2fu9c8");
      const confirmed = await handleUserMessage({
        session: seeded.committed,
        userMessage: "1",
        locale: "zh-CN",
      });
      await mutatePOJUSession(confirmed.session_id, {
        operation_id: "op_m24r2fu9c8_confirm",
        kind: "session_patch",
        bump_dc: true,
        apply: () => confirmed,
      });
      const committed = await durable(confirmed.session_id);
      const turnId = lastUserId(committed);
      const q1 = lastAssistant(committed).content;
      const asked1 = committed.decision_understanding?.budget.session_asked_count ?? 0;
      stubResponse = "FU9C8 FREEFORM MUST NOT WIN";
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            { role: "user" as const, content: "1", timestamp: NOW, client_id: turnId },
          ],
        },
        userMessage: "1",
        locale: "zh-CN",
        userAlreadyAppended: true,
      });
      assert.equal(replay.pending_intake_control?.entered_controlled_blueprint_update, true);
      assert.deepEqual(blueprintSnapshot(replay), blueprintSnapshot(committed));
      assert.equal(definitionQuestion(replay), definitionQuestion(committed));
      assert.equal(replay.decision_context!.version, committed.decision_context!.version);
      assert.equal((replay.blueprint_change_log ?? []).length, 1);
      assert.equal(replay.decision_understanding?.budget.session_asked_count ?? asked1, asked1);
      assert.equal(lastAssistant(replay).content, q1);
    });

    // M2.4-R2 source authority (replaces the FU10 clause-boundary rules): a
    // located source_quote authorizes nothing by itself and is never what is
    // stored. Every accepted item writes the raw answer; offsets only locate
    // and must verify exactly. All cases run the real handleUserMessage() path
    // with the test-only interpretAnswerModel hook (not a real model).
    function fu10Item(
      text: string,
      opts: {
        legalCode: string;
        kind?: "reality_fact" | "constraint" | "definition_patch";
        source_quote?: string;
        certainty?: "explicit" | "estimated" | "unclear";
        source_start?: number | null;
        source_end?: number | null;
      },
    ) {
      return {
        ...fu9Item(text, opts),
        ...(opts.source_start !== undefined ? { source_start: opts.source_start } : {}),
        ...(opts.source_end !== undefined ? { source_end: opts.source_end } : {}),
      };
    }
    async function runFu10Turn(
      tag: string,
      statement: string,
      items: (legalCode: string) => ReturnType<typeof fu10Item>[],
      extra?: Partial<import("../lib/poju/decision-intake/types").ModelAnswerDraft>,
    ) {
      const ctx = await seedFu8Ready(tag);
      stubResponse = `${tag} FREEFORM MUST NOT WIN`;
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => fu9Draft(items(ctx.legalCode), extra),
        },
      });
      return { ctx, out, dc: out.decision_context! };
    }
    function assertNoFu10Write(run: Awaited<ReturnType<typeof runFu10Turn>>, label: string) {
      assert.equal(run.dc.reality_facts.length, run.ctx.factsBefore, `${label} must not write a RealityFact`);
      assert.equal(run.dc.constraints.length, run.ctx.cstBefore, `${label} must not write a Constraint`);
      assert.equal(run.dc.version, run.ctx.vBefore, `${label} must not bump DC version`);
      assert.equal(proposedWritesOf(run.out).length, 0, `${label} must not create a ProposedWrite`);
    }
    function fu10Reasons(session: POJUSessionState) {
      return groundingRejectionsOf(session).map((r) => r.reason);
    }
    /** Raw answer stored verbatim; no fragment of it stored on its own. */
    function assertRawOnly(
      run: Awaited<ReturnType<typeof runFu10Turn>>,
      statement: string,
      fragments: string[],
      label: string,
    ) {
      const raw = statement.trim();
      const fact = run.dc.reality_facts.find((f) => f.statement === raw);
      assert.ok(fact, `${label} must persist the raw answer`);
      for (const fragment of fragments) {
        assert.equal(
          run.dc.reality_facts.some((f) => f.statement === fragment) ||
            run.dc.constraints.some((c) => c.statement === fragment),
          false,
          `${label} fragment ${fragment} must never be stored on its own`,
        );
      }
      for (const w of proposedWritesOf(run.out)) assert.equal(w.statement, raw);
      assert.ok(run.dc.version > run.ctx.vBefore);
      return fact!;
    }

    await check("M2.4-R2-SA-A1: 我不想离职 with a cut quote stores the whole negated answer", async () => {
      const run = await runFu10Turn("m24r2saa1", "我不想离职。", (code) => [
        fu10Item("想离职", { legalCode: code }),
      ]);
      const fact = assertRawOnly(run, "我不想离职。", ["想离职", "我想离职"], "SA-A1");
      assert.equal(fact.verification_level, "user_asserted");
      const p = proposedWritesOf(run.out)[0]!.provenance![0]!;
      assert.equal("我不想离职。".slice(p.located_start!, p.located_end!), "想离职", "offset only locates");
      assert.equal(groundingRejectionsOf(run.out).length, 0);
    });

    await check("M2.4-R2-SA-A2: 我并不打算创业 stores the whole negated answer", async () => {
      const run = await runFu10Turn("m24r2saa2", "我并不打算创业。", (code) => [
        fu10Item("打算创业", { legalCode: code }),
      ]);
      assertRawOnly(run, "我并不打算创业。", ["打算创业"], "SA-A2");
    });

    await check("M2.4-R2-SA-A3: 我没有决定是否搬家 — ungrounded quote rejected, grounded one stores the raw answer", async () => {
      const run = await runFu10Turn("m24r2saa3", "我没有决定是否搬家。", (code) => [
        fu10Item("决定搬家", { legalCode: code }),
        fu10Item("决定是否搬家", { legalCode: code }),
      ]);
      assert.deepEqual(fu10Reasons(run.out), ["source_quote_not_grounded"]);
      assertRawOnly(run, "我没有决定是否搬家。", ["决定搬家", "决定是否搬家"], "SA-A3");
    });

    await check("M2.4-R2-SA-B1: 我想离职，但还没有决定时间 keeps its qualifier", async () => {
      const statement = "我想离职，但还没有决定时间。";
      const run = await runFu10Turn("m24r2sab1", statement, (code) => [
        fu10Item("我想离职", { legalCode: code }),
      ]);
      assertRawOnly(run, statement, ["我想离职"], "SA-B1");
    });

    await check("M2.4-R2-SA-B2: 我可以接受降薪，前提是保留现有福利 keeps its condition", async () => {
      const statement = "我可以接受降薪，前提是保留现有福利。";
      const run = await runFu10Turn("m24r2sab2", statement, (code) => [
        fu10Item("我可以接受降薪", { legalCode: code, kind: "constraint" }),
      ]);
      const cst = run.dc.constraints.find((c) => c.statement === statement);
      assert.ok(cst, "SA-B2 constraint states the whole raw answer");
      assertRawOnly(run, statement, ["我可以接受降薪"], "SA-B2");
    });

    await check("M2.4-R2-SA-B3: an estimated qualified answer stays user_estimate", async () => {
      const statement = "我可能会搬家，但目前没有决定。";
      const run = await runFu10Turn("m24r2sab3", statement, (code) => [
        fu10Item("我可能会搬家", { legalCode: code, certainty: "estimated" }),
      ]);
      const fact = assertRawOnly(run, statement, ["我可能会搬家"], "SA-B3");
      assert.equal(fact.verification_level, "user_estimate");
      assert.equal(fact.status, "unverified");
    });

    await check("M2.4-R2-SA-C1: fact + constraint in one answer both state the raw answer", async () => {
      const statement = "我目前月薪三万，预算上限五万。";
      const run = await runFu10Turn("m24r2sac1", statement, (code) => [
        fu10Item("我目前月薪三万", { legalCode: code }),
        fu10Item("预算上限五万", { legalCode: code, kind: "constraint" }),
      ]);
      assert.equal(groundingRejectionsOf(run.out).length, 0);
      assertRawOnly(run, statement, ["我目前月薪三万", "预算上限五万"], "SA-C1");
      assert.ok(run.dc.constraints.some((c) => c.statement === statement));
      assert.equal(run.dc.constraints.length, run.ctx.cstBefore + 1);
    });

    await check("M2.4-R2-SA-C2: 我月薪三万，税前计算 / 我年收入二十万，税前口径 keep their basis", async () => {
      for (const [tag, statement, quote] of [
        ["m24r2sac2a", "我月薪三万，税前计算。", "我月薪三万"],
        ["m24r2sac2b", "我年收入二十万，税前口径。", "我年收入二十万"],
      ] as const) {
        const run = await runFu10Turn(tag, statement, (code) => [fu10Item(quote, { legalCode: code })]);
        assertRawOnly(run, statement, [quote], tag);
      }
    });

    await check("M2.4-R2-SA-C3: 预算五万，包含搬迁费用 keeps its scope", async () => {
      const statement = "预算五万，包含搬迁费用。";
      const run = await runFu10Turn("m24r2sac3", statement, (code) => [
        fu10Item("预算五万", { legalCode: code, kind: "constraint" }),
      ]);
      assert.ok(run.dc.constraints.some((c) => c.statement === statement));
      assertRawOnly(run, statement, ["预算五万"], "SA-C3");
    });

    await check("M2.4-R2-FU10-D2: out-of-range offsets are rejected and audited", async () => {
      const run = await runFu10Turn("m24r2fu10d2", "我目前月薪三万，预算上限五万。", (code) => [
        fu10Item("预算上限五万", { legalCode: code, source_start: 8, source_end: 999 }),
      ]);
      assertNoFu10Write(run, "FU10-D2");
      const rejection = groundingRejectionsOf(run.out)[0]!;
      assert.equal(rejection.reason, "source_offset_out_of_range");
      assert.equal(rejection.source_start, 8);
      assert.equal(rejection.source_end, 999);
    });

    await check("M2.4-R2-FU10-D3: offsets that do not match source_quote are rejected without search fallback", async () => {
      const statement = "我目前月薪三万，预算上限五万。";
      const run = await runFu10Turn("m24r2fu10d3", statement, (code) => [
        fu10Item("预算上限五万", { legalCode: code, source_start: 0, source_end: 7 }),
        fu10Item("我目前月薪三万", { legalCode: code, source_start: 0, source_end: 7 }),
      ]);
      assert.deepEqual(fu10Reasons(run.out), ["source_offset_quote_mismatch"]);
      assertRawOnly(run, statement, [], "FU10-D3 verified item");
      assert.equal(proposedWritesOf(run.out)[0]!.provenance!.length, 1, "only the verified item is a locator");
      assert.equal(run.dc.reality_facts.length, run.ctx.factsBefore + 1);
    });

    await check("M2.4-R2-FU10-D5: a match that breaks a Unicode cluster is rejected", async () => {
      const midCluster = await runFu10Turn("m24r2fu10d5a", "我每年发⑫个月工资。", (code) => [
        fu10Item("2个月工资", { legalCode: code }),
      ]);
      assertNoFu10Write(midCluster, "FU10-D5 mid-cluster");
      assert.deepEqual(fu10Reasons(midCluster.out), ["source_quote_unicode_boundary_mismatch"]);
    });

    await check("M2.4-R2-FU10-D6: a normalized quote locates; the stored text is the original answer", async () => {
      const statement = "我目前月薪三万，预算上限五万。";
      const run = await runFu10Turn("m24r2fu10d6", statement, (code) => [
        fu10Item("我目前月薪三万,预算上限五万", { legalCode: code }),
      ]);
      assert.equal(groundingRejectionsOf(run.out).length, 0);
      assertRawOnly(run, statement, ["我目前月薪三万,预算上限五万"], "FU10-D6");
    });

    await check("M2.4-R2-FU10-D7: non-numeric offsets fail the draft closed", async () => {
      const ctx = await seedFu8Ready("m24r2fu10d7");
      stubResponse = "FU10D7 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: ctx.before,
        userMessage: "我目前月薪三万。",
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () => ({
            ...fu9Draft([fu9Item("我目前月薪三万。", { legalCode: ctx.legalCode })]),
            extracted_items: [
              { ...fu9Item("我目前月薪三万。", { legalCode: ctx.legalCode }), source_start: "0", source_end: "8" },
            ],
          }),
        },
      });
      assert.equal(out.decision_context!.version, ctx.vBefore);
      assert.equal(out.decision_context!.reality_facts.length, ctx.factsBefore);
      const failAsst = [...out.messages].reverse().find((m) => m.role === "assistant");
      const failMeta = (failAsst as { meta?: { m1_fail_closed?: boolean; m1_outcome?: string } } | undefined)?.meta;
      assert.equal(failMeta?.m1_fail_closed, true);
      assert.equal(failMeta?.m1_outcome, "answer_interpretation_invalid_schema");
    });

    await check("M2.4-R2-SA-D8: English negation and qualifier stay in the stored answer", async () => {
      const neg = await runFu10Turn("m24r2sad8a", "I don't want to quit.", (code) => [
        fu10Item("want to quit", { legalCode: code }),
      ]);
      assertRawOnly(neg, "I don't want to quit.", ["want to quit"], "SA-D8 negation");
      const qualified = await runFu10Turn("m24r2sad8b", "I want to quit, but I haven't decided when.", (code) => [
        fu10Item("I want to quit", { legalCode: code }),
      ]);
      assertRawOnly(qualified, "I want to quit, but I haven't decided when.", ["I want to quit"], "SA-D8 qualified");
    });

    await check("M2.4-R2-SA-D9: an answer over the fact limit fails closed instead of being truncated", async () => {
      const statement = `我目前月薪三万。${"补充说明".repeat(130)}`;
      const run = await runFu10Turn("m24r2sad9", statement, (code) => [
        fu10Item("我目前月薪三万", { legalCode: code }),
      ]);
      assertNoFu10Write(run, "SA-D9");
      assert.deepEqual(fu10Reasons(run.out), ["source_statement_exceeds_fact_limit"]);
      const control = run.out.pending_intake_control;
      assert.ok(control && control.status === "pending", "SA-D9 must ask for shorter answers, not drop the answer");
      assert.ok(lastAssistant(run.out).content.includes("较长"));
    });

    await check("M2.4-R2-SA-E1: goal_change candidate comes from the located wording and needs confirmation", async () => {
      const statement = "我想换个方向，改成要不要立刻出国读书。";
      const run = await runFu10Turn(
        "m24r2sae1",
        statement,
        (code) => [fu10Item("要不要立刻出国读书", { legalCode: code, kind: "definition_patch" })],
        { classification: "goal_change", explanation: "target" },
      );
      const item = run.out.pending_intake_control?.items[0];
      assert.ok(item && item.kind === "goal_change");
      assert.equal(item!.proposed_decision_target, "要不要立刻出国读书");
      assert.equal(item!.source_statement, statement);
      assert.ok(lastAssistant(run.out).content.includes("确认更换决策目标"));
      assert.deepEqual(blueprintSnapshot(run.out), run.ctx.bpBefore);
      assert.equal(definitionQuestion(run.out), run.ctx.dqBefore);
      assert.equal(run.dc.version, run.ctx.vBefore);
    });

    await check("M2.4-R2-SA-E2: a negated goal statement never changes the target without explicit confirmation", async () => {
      const statement = "我不想把决策目标改成要不要立刻出国读书。";
      const run = await runFu10Turn(
        "m24r2sae2",
        statement,
        (code) => [fu10Item("要不要立刻出国读书", { legalCode: code, kind: "definition_patch" })],
        { classification: "goal_change", explanation: "negated target" },
      );
      const item = run.out.pending_intake_control?.items[0];
      assert.ok(item && item.kind === "goal_change" && item.status === "pending");
      assert.equal(item!.source_statement, statement, "the raw negated statement is kept for the user to judge");
      assert.deepEqual(blueprintSnapshot(run.out), run.ctx.bpBefore);
      assert.equal(definitionQuestion(run.out), run.ctx.dqBefore);
      assert.equal(run.dc.version, run.ctx.vBefore);
      stubResponse = "SAE2 DECLINE FREEFORM MUST NOT WIN";
      const declined = await handleUserMessage({ session: run.out, userMessage: "2", locale: "zh-CN" });
      assert.equal(declined.pending_intake_control?.items[0]!.status, "declined");
      assert.equal(definitionQuestion(declined), run.ctx.dqBefore, "declining keeps the original target");
      assert.equal((declined.blueprint_change_log ?? []).length, 0);
    });

    await check("M2.4-R2-SA-E3: an insight_mismatch clarification stores the whole clarification", async () => {
      const seeded = await seedFu9Mismatch("m24r2sae3");
      const clarify = "我并不是怕风险，我只是还在比较时间窗口。";
      stubResponse = "SAE3 FREEFORM MUST NOT WIN";
      const out = await handleUserMessage({
        session: seeded.committed,
        userMessage: clarify,
        locale: "zh-CN",
        __testOnlyM1Hooks: {
          interpretAnswerModel: () =>
            fu9Draft([fu9Item("还在比较时间窗口", { legalCode: seeded.ctx.legalCode })]),
        },
      });
      assert.ok(out.decision_context!.reality_facts.some((f) => f.statement === clarify));
      assert.equal(out.decision_context!.reality_facts.some((f) => f.statement === "还在比较时间窗口"), false);
      assert.equal(
        out.pending_intake_control?.items.find((i) => i.kind === "insight_mismatch")?.status,
        "clarified",
      );
    });

    await check("M2.4-R2-SA-E4: replay of a mixed grounded/rejected turn does not duplicate", async () => {
      const ctx = await seedFu8Ready("m24r2sae4");
      const statement = "我目前月薪三万，预算上限五万。";
      const draft = fu9Draft([
        fu10Item("月薪四万", { legalCode: ctx.legalCode }),
        fu10Item("我目前月薪三万", { legalCode: ctx.legalCode }),
      ]);
      stubResponse = "SAE4 FREEFORM 1";
      const first = await handleUserMessage({
        session: ctx.before,
        userMessage: statement,
        locale: "zh-CN",
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      await mutatePOJUSession(first.session_id, {
        operation_id: "op_m24r2sae4_first",
        kind: "session_patch",
        bump_dc: true,
        apply: () => first,
      });
      const committed = await durable(first.session_id);
      const turnId = lastUserId(committed);
      const facts1 = committed.decision_context!.reality_facts.map((f) => f.fact_id).sort();
      const v1 = committed.decision_context!.version;
      const rejections1 = groundingRejectionsOf(committed);
      assert.equal(committed.decision_context!.reality_facts.length, ctx.factsBefore + 1);
      assert.deepEqual(rejections1.map((r) => r.reason), ["source_quote_not_grounded"]);
      stubResponse = "SAE4 FREEFORM 2 MUST NOT WIN";
      const replay = await handleUserMessage({
        session: {
          ...committed,
          messages: [
            ...committed.messages,
            { role: "user" as const, content: statement, timestamp: NOW, client_id: turnId },
          ],
        },
        userMessage: statement,
        locale: "zh-CN",
        userAlreadyAppended: true,
        __testOnlyM1Hooks: { interpretAnswerModel: () => draft },
      });
      assert.deepEqual(replay.decision_context!.reality_facts.map((f) => f.fact_id).sort(), facts1);
      assert.equal(replay.decision_context!.version, v1);
      assert.equal(groundingRejectionsOf(replay).length, rejections1.length);
    });

    const modelSrc = readFileSync(
        join(process.cwd(), "lib/poju/decision-intake/answer-interpretation-model.ts"),
        "utf8",
      );
      assert.match(modelSrc, /openRouterChatCompletion/);
      assert.match(modelSrc, /Decision Intake Answer Interpretation/);
      assert.match(modelSrc, /timeout_ms: ANSWER_INTERPRETATION_MODEL_TIMEOUT_MS/);
      assert.equal(/OPENROUTER_API_KEY|fetch\(OPENROUTER/.test(modelSrc), false);
    });

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log(`\nM1 done. PASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
