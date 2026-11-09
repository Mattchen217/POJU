/**
 * M2.1 — Readiness → user confirm → Freeze (real production entry E2E).
 *
 *   pnpm test:m2-1-readiness-confirm-freeze
 *
 * Proves continuous chain beyond M1-R:
 * 1) Fresh createPOJUSession (no seeded DC)
 * 2) Adaptive Q&A until readiness ready_for_final_confirm (coverage, not forged DIR known)
 * 3) User 确认 → Confirmation Events + legal fact promotion → DIR reaggregate
 * 4) evaluateDecisionSufficiency.canStop → ensureSessionFrozenForDelivery
 * 5) decision_context.status === final + content_hash; no freeform leak; no fake known pre-confirm
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
  console.log("M2.1 readiness confirm → Freeze");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession, savePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { handleUserMessage } = await import("../lib/poju/agent");
  const { evaluateDecisionSufficiency } = await import(
    "../lib/poju/decision-context/stop-criteria"
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

  let stubResponse = "MODEL FREEFORM MUST NEVER REACH USER";
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
      assert.doesNotMatch(mod, /current_state:\s*"known"/);
    });

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
        // Before confirm, critical DIRs must not be forged to known.
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
      // Still draft + not sufficient for freeze without confirm promotion
      assert.equal(session!.decision_context!.status, "draft");
      const suf = evaluateDecisionSufficiency(session!.decision_context!);
      assert.equal(
        suf.canStop,
        false,
        "pre-confirm sufficiency must remain false (unverified facts)",
      );
      console.log(
        "    readiness",
        session!.decision_understanding!.readiness.verdict,
        session!.decision_understanding!.readiness.reasons?.slice(0, 4),
      );
    });

    await check("M21-03 user 确认 → promote → Freeze final + hash", async () => {
      assert.ok(session);
      stubResponse = "FREEFORM_CONFIRM_MUST_NOT_SHOW";
      const beforeFacts = session!.decision_context!.reality_facts.length;
      assert.ok(beforeFacts >= 1);

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
      assert.equal(dc.status, "final", "DC must be frozen final");
      assert.ok(dc.content_hash && dc.content_hash.length > 8, "content_hash required");
      assert.ok(
        (session.decision_context_versions ?? []).some((v) => v.status === "final"),
        "version snapshot must include final",
      );

      // After confirm, critical DIRs should be known|n_a via real aggregation
      const critical = dc.dirs.filter(
        (d) => d.id_lifecycle === "active" && d.may_affect_p5_ranking !== false,
      );
      for (const d of critical) {
        assert.ok(
          d.current_state === "known" || d.current_state === "n_a",
          `critical DIR ${d.dir_id} should be known|n_a after confirm, got ${d.current_state}`,
        );
      }

      const confirmed = dc.reality_facts.filter((f) => f.status === "confirmed");
      assert.ok(confirmed.length >= 1, "facts promoted to confirmed");
      assert.ok(
        (session.confirmation_events ?? []).length >= 1,
        "Confirmation Events required",
      );

      const suf = evaluateDecisionSufficiency(dc);
      assert.equal(suf.canStop, true);

      console.log("    frozen", dc.context_id, "v" + dc.version, dc.content_hash.slice(0, 12));
    });

    await check("M21-04 freeze is fail-closed without readiness", async () => {
      // Brand-new session: confirm without readiness must not freeze.
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

      // Force not-ready path: confirm while still can_ask
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
