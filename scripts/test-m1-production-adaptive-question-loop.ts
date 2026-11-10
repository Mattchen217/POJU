/**
 * M1 — Production Adaptive Question Loop E2E (real production Agent path).
 * M2.4-R1-FU1: role authorization, conservative conflicts, Cases I–M + G/H.
 * M2.4-R1-FU2: formal Conflict Resolution wired into the production answer path (Cases N–T).
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
  const { handleUserMessage } = await import("../lib/poju/agent");
  const { runCollectingDcTurn } = await import("../lib/poju/collecting-dc-turn");
  const { createInitialAgentState } = await import("../lib/poju/agent-state");
  const { createDefaultControlPlane } = await import(
    "../lib/poju/decision-context/control-plane"
  );
  const { ensureDecisionBlueprint } = await import(
    "../lib/poju/decision-intake/blueprint"
  );
  const { interpretUserAnswer } = await import(
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
      // Seed an active plan targeting constraints so interpretation binds roles.
      const seeded = await runCollectingDcTurn(await durable(sidTurn), {
        statement: "",
        source_turn_id: "init_02",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sidTurn, {
        operation_id: "op_m1_02_plan",
        kind: "session_patch",
        bump_dc: true,
        apply: () => seeded.session,
      });
      const before = await durable(sidTurn);
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
      const seeded = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: "init_06",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_06",
        kind: "session_patch",
        bump_dc: true,
        apply: () => seeded.session,
      });
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
      const seeded = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: "init_07",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_07",
        kind: "session_patch",
        bump_dc: true,
        apply: () => seeded.session,
      });
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
      const seeded = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: "init_12",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_12",
        kind: "session_patch",
        bump_dc: true,
        apply: () => seeded.session,
      });
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
      const seeded = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: "init_13",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_13",
        kind: "session_patch",
        bump_dc: true,
        apply: () => seeded.session,
      });
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
      const init = await runCollectingDcTurn(await durable(sid), {
        statement: "",
        source_turn_id: "init_interp",
        now: NOW,
        init_only: true,
      });
      await mutatePOJUSession(sid, {
        operation_id: "op_m1_interp_init",
        kind: "session_patch",
        bump_dc: true,
        apply: () => init.session,
      });
      const s = await durable(sid);
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
      assert.ok(open.length >= 1, "clear conflict must open Conflict");
      assert.ok(open.some((c) => c.fact_ids.includes(oldId) && c.fact_ids.includes(neu!.fact_id)));
      console.log(
        `[m24d] old=${oldId}; new=${neu!.fact_id}; open_conflicts=${open.length}; cls=${corr.classification}`,
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
