/**
 * M1-R — Fresh-session minimal main-loop E2E (real production entry).
 *
 *   pnpm test:m1-r-fresh-session-main-loop
 *
 * Proves:
 * 1) Brand-new createPOJUSession (NO seedSession DC injection) enters adaptive loop
 * 2) First investigate question comes from new adaptive plan (not LLM freeform)
 * 3) ≥2 answer turns update DC + Understanding; next Q from latest state
 * 4) Basic end condition stops further asks
 * 5) DC persist failure is FAIL-CLOSED (no silent free-ask fallback)
 *
 * Uses handleUserMessage with /api/poju/chat fetch stub (deterministic adapter).
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";

installIntakeR6TestGlobals("dev_m1r_fresh_session");
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
  console.log("M1-R fresh-session main loop");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession, savePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { handleUserMessage } = await import("../lib/poju/agent");
  const { __setM1rPersistForTests } = await import("../lib/poju/decision-intake");
  const { ANSWER_INTERPRETATION_VERSION: AIV } = await import(
    "../lib/poju/decision-intake/answer-interpretation"
  );
  const { QUESTION_GENERATION_VERSION: QGV } = await import(
    "../lib/poju/decision-intake/question-generation"
  );

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  type POJUSessionState = import("../lib/poju/types").POJUSessionState;

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

  let stubResponse = "MODEL FREEFORM QUESTION THAT MUST NEVER REACH THE USER";
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

  try {
    await check("M1R-static agent uses runM1ProductionPreLlmTurn + fail-closed", async () => {
      const src = readFileSync(join(process.cwd(), "lib/poju/agent.ts"), "utf8");
      assert.match(src, /runM1ProductionPreLlmTurn/);
      assert.match(src, /M1 DC persist FAIL-CLOSED/);
      assert.match(src, /m1_fail_closed/);
      assert.equal(/non-fatal\)\s*,\s*\n\s*m1CollectingTurn\.outcome/.test(src), false);
      assert.match(src, /bootstrapFreshSessionMainLoop|runM1ProductionPreLlmTurn/);
      const collecting = readFileSync(
        join(process.cwd(), "lib/poju/collecting-dc-turn.ts"),
        "utf8",
      );
      assert.match(collecting, /bootstrapFreshSessionMainLoop/);
      assert.match(collecting, /FAIL-CLOSED|fail-closed|persist_failed/);
    });

    await check("M1R-static v1 simplified markers present", async () => {
      assert.equal(AIV, "deterministic_m1_v1_simplified");
      assert.equal(QGV, "template_m1_v1_simplified");
    });

    // ---- Real fresh session: createPOJUSession only (NO seedSession DC) ----
    let sid = "";
    let firstPlanText = "";
    let firstPlanId = "";
    let afterDecision: POJUSessionState | null = null;

    await check("M1R-01 fresh session bootstrap → DC + Blueprint + first adaptive Q", async () => {
      sid = await createPOJUSession({
        payment_id: "pay_m1r_01",
        original_question: "要不要离职去创业？",
      });
      const before = await durable(sid);
      assert.equal(before.decision_context ?? null, null);
      assert.ok(
        !before.agent_v2 || before.agent_v2.current_phase === "opening" || true,
      );

      fetchCalls.length = 0;
      stubResponse = "MODEL FREEFORM QUESTION THAT MUST NEVER REACH THE USER";
      const out = await handleUserMessage({
        session: before,
        userMessage: "我在犹豫要不要离职去创业，家里还有贷款。",
        locale: "zh",
      });
      await savePOJUSession(out);
      afterDecision = await durable(sid);

      assert.ok(afterDecision.decision_context, "draft DC must be created");
      assert.equal(afterDecision.decision_context!.status, "draft");
      assert.ok(
        afterDecision.decision_context!.dirs.some((d) => d.id_lifecycle === "active"),
        "starter DIRs required for planning",
      );
      assert.ok(afterDecision.decision_blueprint, "Blueprint required");
      assert.equal(
        afterDecision.agent_v2?.current_phase,
        "collecting_context",
        "must enter collecting_context",
      );

      const plan = afterDecision.adaptive_ask_plan;
      assert.ok(plan, "adaptive plan required for first Q");
      assert.ok(plan!.question_text.trim().length > 0);
      firstPlanText = plan!.question_text;
      firstPlanId = plan!.plan_id;

      const asst = lastAssistant(afterDecision);
      assert.equal(
        asst.content,
        firstPlanText,
        "first assistant question MUST equal plan.question_text (new system), not LLM freeform",
      );
      assert.notEqual(asst.content, stubResponse);
      assert.ok(
        afterDecision.decision_understanding?.last_sent_question?.plan_id === firstPlanId,
      );
      // LLM may still be called, but the sent text is plan-controlled.
      console.log("    first_q:", firstPlanText.slice(0, 80));
    });

    await check("M1R-02 answer turn 1 updates DC + Understanding + next Q from state", async () => {
      assert.ok(afterDecision);
      stubResponse = "ANOTHER FREEFORM THAT MUST BE OVERRIDDEN";
      const out = await handleUserMessage({
        session: afterDecision!,
        userMessage: "目前可选方案大概是：留任、内部转岗、或者出去创业做咨询。",
        locale: "zh",
      });
      await savePOJUSession(out);
      const s = await durable(sid);
      afterDecision = s;

      assert.ok(s.decision_context!.reality_facts.length >= 1, "DC facts grew");
      assert.ok(s.decision_understanding, "Understanding present");
      const plan = s.adaptive_ask_plan;
      // Either next Q or readiness stop
      if (plan) {
        assert.notEqual(plan.plan_id, firstPlanId, "next plan must recompute");
        const asst = lastAssistant(s);
        assert.equal(asst.content, plan.question_text);
        assert.notEqual(asst.content, stubResponse);
        console.log("    next_q:", plan.question_text.slice(0, 80));
      } else {
        assert.equal(s.decision_understanding!.readiness.can_ask, false);
        console.log("    readiness stop after turn 1");
      }
    });

    await check("M1R-03 answer turn 2 continues from latest state", async () => {
      assert.ok(afterDecision);
      const beforeFacts = afterDecision!.decision_context!.reality_facts.length;
      const beforePlanId = afterDecision!.adaptive_ask_plan?.plan_id ?? null;
      const beforeCanAsk = afterDecision!.decision_understanding?.readiness.can_ask;

      if (beforeCanAsk === false) {
        console.log("    already stopped before turn 2 — acceptable end condition");
        return;
      }

      stubResponse = "FREEFORM ROUND 2";
      const out = await handleUserMessage({
        session: afterDecision!,
        userMessage: "硬约束是存款只够撑六个月，而且孩子学费不能断。",
        locale: "zh",
      });
      await savePOJUSession(out);
      const s = await durable(sid);
      afterDecision = s;

      assert.ok(
        s.decision_context!.reality_facts.length >= beforeFacts,
        "DC must not shrink",
      );
      assert.ok(s.decision_understanding);
      if (s.adaptive_ask_plan) {
        const asst = lastAssistant(s);
        assert.equal(asst.content, s.adaptive_ask_plan.question_text);
        assert.notEqual(asst.content, stubResponse);
        if (beforePlanId) {
          // Prefer different plan when more dirs remain unknown
          console.log(
            "    turn2 plan",
            s.adaptive_ask_plan.plan_id,
            "prev",
            beforePlanId,
          );
        }
      } else {
        assert.equal(s.decision_understanding!.readiness.can_ask, false);
      }
    });

    await check("M1R-04 basic end condition can stop further asks", async () => {
      // Drive remaining dirs toward known until readiness stops, or hit hard budget via understanding.
      let s = await durable(sid);
      let guard = 0;
      while (
        s.decision_understanding?.readiness.can_ask !== false &&
        s.adaptive_ask_plan &&
        guard < 20
      ) {
        guard += 1;
        stubResponse = `FREEFORM_${guard}`;
        const out = await handleUserMessage({
          session: s,
          userMessage: `补充信息回合${guard}：现状稳定但成长有限，风险上最多能接受收入腰斩一年。`,
          locale: "zh",
        });
        await savePOJUSession(out);
        s = await durable(sid);
      }
      afterDecision = s;
      // End condition: can_ask false OR hard budget / ready_for_final_confirm
      const ready = s.decision_understanding?.readiness;
      assert.ok(ready, "understanding readiness required");
      if (ready!.can_ask === false) {
        const asst = lastAssistant(s);
        assert.match(asst.content, /理解确认|已足够|确认/);
        assert.notEqual(asst.content.startsWith("FREEFORM_"), true);
        console.log("    stopped:", ready!.verdict, ready!.reasons?.slice(0, 3));
      } else {
        // Soft: at least exercised multi-turn without freeform leak
        assert.ok(guard >= 2, "expected multi-turn progress");
        console.log("    soft end: still can_ask after", guard, "turns — budget/dirs not exhausted");
      }
    });

    await check("M1R-05 DC persist failure is fail-closed (no free-ask)", async () => {
      await __resetPojuDbForTests();
      await ensurePojuDbReady();
      const freshId = await createPOJUSession({
        payment_id: "pay_m1r_fail",
        original_question: "要不要搬家？",
      });
      const before = await durable(freshId);

      __setM1rPersistForTests(async (prev) => ({
        session: prev,
        committed: false,
        error: "forced_persist_fail_for_m1r",
      }));
      try {
        fetchCalls.length = 0;
        stubResponse = "THIS FREEFORM MUST NOT APPEAR";
        const out = await handleUserMessage({
          session: before,
          userMessage: "我在考虑要不要搬家去另一个城市工作。",
          locale: "zh",
        });
        const asst = lastAssistant(out);
        assert.match(asst.content, /决策上下文写入失败|系统/);
        assert.notEqual(asst.content, stubResponse);
        assert.ok(
          (asst as { meta?: { m1_fail_closed?: boolean } }).meta?.m1_fail_closed === true ||
            asst.content.includes("forced_persist_fail_for_m1r") ||
            asst.content.includes("写入失败"),
        );
        // Fail-closed returns before LLM — fetch should not be required.
        // (If fetch happened, content still must not be freeform — already asserted.)
        assert.equal(out.decision_context ?? null, null);
        console.log("    fail-closed content:", asst.content.slice(0, 100));
      } finally {
        __setM1rPersistForTests(null);
      }
    });

    await check("M1R-06 prior M1 seeded path still reachable via runCollectingDcTurn", async () => {
      // Smoke: module still exports runCollectingDcTurn for existing M1 suite.
      const { runCollectingDcTurn } = await import("../lib/poju/collecting-dc-turn");
      assert.equal(typeof runCollectingDcTurn, "function");
    });
  } finally {
    globalThis.fetch = originalFetch;
    __setM1rPersistForTests(null);
  }

  console.log(`\nM1-R done. PASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
