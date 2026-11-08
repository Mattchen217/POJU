/**
 * M1 — Production Adaptive Question Loop E2E (real production Agent path).
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
      assert.notEqual(pa.plan!.candidate_id, pb.plan!.candidate_id);
      assert.notDeepEqual(pa.plan!.dir_ids, pb.plan!.dir_ids);
      assert.notEqual(pa.authorized_question, pb.authorized_question);
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
          ddr_ids: [`DDR_FOR_${dirId}`],
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
          ddr_ids: [`DDR_FOR_${dirId}`],
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
    await check("M1-static agent calls runCollectingDcTurn BEFORE LLM; plan drives response", async () => {
      const src = readFileSync(join(REPO, "lib/poju/agent.ts"), "utf8");
      assert.match(src, /import \{ runCollectingDcTurn \} from "@\/lib\/poju\/collecting-dc-turn";/);
      assert.match(src, /M1 — Adaptive Question Loop BEFORE/);
      assert.match(src, /await runCollectingDcTurn\(sessionForLlm,/);
      assert.match(src, /assertQuestionMatchesPlan/);
      assert.match(src, /attachAuthorizedAssistantQuestion/);
      assert.equal(/persistCollectingUserTurnDc/.test(src), false);
      assert.equal(/selectNextIntakeAskForSession/.test(src), false);
      // Must NOT call collecting turn only after assistant is built (old bug).
      assert.equal(/await runCollectingDcTurn\(sessionOut,/.test(src), false);
    });

    // Interpretation unit sanity
    await check("M1-interp classifier covers estimate/unknown/declined/constraint", async () => {
      const sid = await seedSession("interp", jobDirs);
      const s = await durable(sid);
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
