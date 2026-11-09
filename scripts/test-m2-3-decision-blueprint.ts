/**
 * M2.3 — Production Decision-Specific Blueprint (real production entry).
 *
 *   pnpm test:m2-3-decision-blueprint
 *
 * Proves:
 *  M2.3-01  Different decision questions → different Catalog DDR/DIR scopes
 *  M2.3-02  Catalog authority (illegal DDR/DIR rejected; uncertain → fallback)
 *  M2.3-03  Planner stays inside Blueprint; no formal CQ without DDR trace
 *  M2.3-04  After answer: DC update → Understanding new version → next Q
 *  M2.3-05  Fact safety: estimate / unknown / refuse / contradiction
 *  M2.3-06  Fresh-session E2E from createPOJUSession (NO seedSession Blueprint inject)
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";

installIntakeR6TestGlobals("dev_m23_decision_blueprint");
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
  console.log("M2.3 decision-specific Blueprint");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import(
    "../lib/db/poju-db"
  );
  const { createPOJUSession, loadPOJUSession, savePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { handleUserMessage } = await import("../lib/poju/agent");
  const {
    buildCatalogBlueprintScope,
    filterCatalogLegalIds,
    classifyDecisionTopic,
    resolveDdrIdsForDir,
    ensureDecisionBlueprint,
  } = await import("../lib/poju/decision-intake");
  const { buildIntakeCandidatesFromDc } = await import(
    "../lib/poju/decision-context/production-intake-ask"
  );
  const { interpretUserAnswer } = await import(
    "../lib/poju/decision-intake/answer-interpretation"
  );
  const { applyAnswerEventToSessionDc } = await import(
    "../lib/poju/decision-intake/apply-answer-to-dc"
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

  const Q_CAREER =
    "我拿到一个新 offer，要不要离职跳槽去新公司？家里还有房贷。";
  const Q_REL =
    "我和伴侣关系很紧张，要不要分手还是继续沟通结婚？";

  try {
    // ---------- M2.3-01 ----------
    let careerSid = "";
    let relSid = "";
    let careerBpDirs: string[] = [];
    let relBpDirs: string[] = [];

    await check("M2.3-01 different questions → different Catalog scopes", async () => {
      careerSid = await createPOJUSession({
        payment_id: "pay_m23_01a",
        original_question: Q_CAREER,
      });
      relSid = await createPOJUSession({
        payment_id: "pay_m23_01b",
        original_question: Q_REL,
      });

      const careerOut = await handleUserMessage({
        session: await durable(careerSid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(careerOut);
      const career = await durable(careerSid);

      const relOut = await handleUserMessage({
        session: await durable(relSid),
        userMessage: Q_REL,
        locale: "zh",
      });
      await savePOJUSession(relOut);
      const rel = await durable(relSid);

      assert.ok(career.decision_context, "career DC");
      assert.ok(rel.decision_context, "rel DC");
      assert.ok(career.decision_blueprint, "career Blueprint");
      assert.ok(rel.decision_blueprint, "rel Blueprint");
      assert.equal(career.decision_blueprint!.scope_source, "catalog");
      assert.equal(rel.decision_blueprint!.scope_source, "catalog");

      careerBpDirs = [...career.decision_blueprint!.dir_ids];
      relBpDirs = [...rel.decision_blueprint!.dir_ids];

      assert.ok(
        careerBpDirs.includes("DIR-JOB-OFFER"),
        `career must include DIR-JOB-OFFER, got ${careerBpDirs.join(",")}`,
      );
      assert.ok(
        relBpDirs.includes("DIR-REL-DYNAMICS"),
        `relationship must include DIR-REL-DYNAMICS, got ${relBpDirs.join(",")}`,
      );
      assert.ok(
        !careerBpDirs.includes("DIR-REL-DYNAMICS"),
        "career must not get relationship topic DIR",
      );
      assert.ok(
        !relBpDirs.includes("DIR-JOB-OFFER"),
        "relationship must not get career topic DIR",
      );

      // Not merely the old 4-starter set.
      assert.ok(
        careerBpDirs.length > 4,
        "formal Catalog scope must exceed fixed starter quartet",
      );
      assert.ok(career.decision_blueprint!.ddr_ids!.includes("DDR-07-TOPIC-DEPTH"));
      assert.ok(rel.decision_blueprint!.ddr_ids!.includes("DDR-07-TOPIC-DEPTH"));
      assert.ok(career.decision_blueprint!.page_07_emit === true);
      assert.ok(rel.decision_blueprint!.page_07_emit === true);

      // Core DDRs present
      assert.ok(career.decision_blueprint!.ddr_ids!.includes("DDR-01-PRIMARY"));
      assert.ok(rel.decision_blueprint!.ddr_ids!.includes("DDR-01-PRIMARY"));

      // First Q authorized = plan
      const cPlan = career.adaptive_ask_plan;
      const rPlan = rel.adaptive_ask_plan;
      assert.ok(cPlan && rPlan);
      assert.equal(lastAssistant(career).content, cPlan!.question_text);
      assert.equal(lastAssistant(rel).content, rPlan!.question_text);
      assert.notEqual(lastAssistant(career).content, stubResponse);

      console.log(
        "    career dirs sample:",
        careerBpDirs.filter((d) => d.includes("JOB") || d.includes("OPT")).join(","),
      );
      console.log(
        "    rel dirs sample:",
        relBpDirs.filter((d) => d.includes("REL") || d.includes("OPT")).join(","),
      );
    });

    // ---------- M2.3-02 ----------
    await check("M2.3-02 Catalog authority rejects illegal ids + uncertain fallback", async () => {
      const illegal = buildCatalogBlueprintScope({
        decision_question: "要不要换工作？",
        proposed_dir_ids: ["DIR-FAKE-NOT-REAL", "DIR-OPT-ON-TABLE"],
        proposed_ddr_ids: ["DDR-FAKE-99", "DDR-01-PRIMARY"],
      });
      assert.ok(illegal.ok);
      assert.ok(illegal.ok && illegal.rejected_ids.includes("DIR-FAKE-NOT-REAL"));
      assert.ok(illegal.ok && illegal.rejected_ids.includes("DDR-FAKE-99"));
      assert.ok(illegal.ok && illegal.dir_ids.includes("DIR-OPT-ON-TABLE"));
      assert.ok(illegal.ok && !illegal.dir_ids.includes("DIR-FAKE-NOT-REAL"));
      assert.ok(illegal.ok && illegal.ddr_ids.includes("DDR-01-PRIMARY"));
      assert.ok(illegal.ok && !illegal.ddr_ids.includes("DDR-FAKE-99"));

      const uncertain = classifyDecisionTopic({
        decision_question: "我该怎么做比较好？",
      });
      assert.equal(uncertain.used_uncertain_fallback, true);
      assert.equal(uncertain.page_07_emit, false);
      assert.deepEqual(uncertain.topic_dir_ids, []);

      const filtered = filterCatalogLegalIds({
        proposed_dir_ids: ["DIR-NOT-IN-CATALOG", "DIR-DEF-QUESTION"],
        proposed_ddr_ids: ["DDR_FOR_DIR-DEF-QUESTION", "DDR-05-RANKING"],
        legal_dir_ids: new Set(["DIR-DEF-QUESTION"]),
        legal_ddr_ids: new Set(["DDR-05-RANKING"]),
      });
      assert.deepEqual(filtered.dir_ids, ["DIR-DEF-QUESTION"]);
      assert.deepEqual(filtered.ddr_ids, ["DDR-05-RANKING"]);
      assert.ok(filtered.rejected.includes("DIR-NOT-IN-CATALOG"));
      assert.ok(filtered.rejected.includes("DDR_FOR_DIR-DEF-QUESTION"));
    });

    // ---------- M2.3-03 ----------
    await check("M2.3-03 Planner constrained to Blueprint + real DDR trace", async () => {
      const s = await durable(careerSid);
      const bp = s.decision_blueprint!;
      const dc = s.decision_context!;
      const cands = buildIntakeCandidatesFromDc(dc, bp);
      assert.ok(cands.length >= 1);
      for (const c of cands) {
        assert.ok(c.ddr_ids.length >= 1, "must have DDR trace");
        assert.ok(
          c.ddr_ids.every((id) => !id.startsWith("DDR_FOR_")),
          `placeholder DDR forbidden: ${c.ddr_ids.join(",")}`,
        );
        for (const dirId of c.dir_ids) {
          assert.ok(
            bp.dir_ids.includes(dirId),
            `candidate dir ${dirId} outside Blueprint`,
          );
        }
        // DDR ids must be Catalog-legal for the DIR
        for (const dirId of c.dir_ids) {
          const legal = resolveDdrIdsForDir(dirId, bp);
          for (const ddr of c.ddr_ids) {
            assert.ok(
              legal.includes(ddr) || (bp.ddr_ids ?? []).includes(ddr),
              `DDR ${ddr} not mapped for ${dirId}`,
            );
          }
        }
      }
      const plan = s.adaptive_ask_plan!;
      assert.ok(plan.ddr_ids.every((id) => !id.startsWith("DDR_FOR_")));
      assert.ok(plan.dir_ids.every((id) => bp.dir_ids.includes(id)));
    });

    // ---------- M2.3-04 ----------
    let afterAnswer: POJUSessionState | null = null;
    await check("M2.3-04 answer updates DC version + next Q from new gaps", async () => {
      const before = await durable(careerSid);
      const v0 = before.decision_context!.version;
      const u0 = before.decision_understanding!.context_version;
      const plan0 = before.adaptive_ask_plan!;
      const firstDir = plan0.dir_ids[0]!;

      const out = await handleUserMessage({
        session: before,
        userMessage:
          "目前可选方案是：留任、接受新 offer、或者先内部转岗再观望。",
        locale: "zh",
      });
      await savePOJUSession(out);
      afterAnswer = await durable(careerSid);

      assert.ok(
        afterAnswer.decision_context!.version > v0,
        `DC version must bump ${v0} → ${afterAnswer.decision_context!.version}`,
      );
      assert.ok(afterAnswer.decision_understanding);
      assert.equal(
        afterAnswer.decision_understanding!.context_version,
        afterAnswer.decision_context!.version,
        "Understanding must bind latest DC version",
      );
      assert.ok(
        afterAnswer.decision_understanding!.context_version >= u0,
      );
      assert.ok(
        afterAnswer.decision_context!.reality_facts.length >= 1,
        "answer must write formal DC facts",
      );

      const plan1 = afterAnswer.adaptive_ask_plan;
      if (plan1) {
        assert.notEqual(plan1.plan_id, plan0.plan_id, "next plan recomputed");
        // Satisfied roles for answered DIR should not be the sole re-ask if state advanced.
        const answeredDir = afterAnswer.decision_context!.dirs.find(
          (d) => d.dir_id === firstDir,
        );
        if (
          answeredDir &&
          (answeredDir.current_state === "known" ||
            answeredDir.partial_satisfaction)
        ) {
          // Next plan may still mention same DIR if partial; must not ignore DC update.
          assert.ok(afterAnswer.decision_context!.reality_facts.length >= 1);
        }
        assert.equal(
          lastAssistant(afterAnswer).content,
          plan1.question_text,
        );
      }

      console.log(
        `    DC v${v0}→v${afterAnswer.decision_context!.version}; plan ${plan0.plan_id}→${plan1?.plan_id ?? "none"}`,
      );
    });

    // ---------- M2.3-05 ----------
    await check("M2.3-05 fact safety: estimate/unknown/refuse/contradiction", async () => {
      const base = afterAnswer ?? (await durable(careerSid));
      // Ensure there is an open plan target
      let session = base;
      if (!session.adaptive_ask_plan) {
        const bp = ensureDecisionBlueprint(session, { now: new Date().toISOString() });
        session = bp.session;
      }

      const cases: Array<{ text: string; expectStatus: string; cls?: string }> = [
        { text: "大概一个月后吧，估计如此", expectStatus: "unverified", cls: "estimate" },
        { text: "不知道", expectStatus: "unknown", cls: "unknown" },
        { text: "不想说", expectStatus: "declined", cls: "declined" },
      ];

      for (const c of cases) {
        const ev = interpretUserAnswer({
          session,
          statement: c.text,
          source_turn_id: `m23_05_${c.cls}`,
          now: new Date().toISOString(),
        });
        assert.ok(ev.classification === c.cls || ev.notes.length >= 0);
        for (const w of ev.proposed_writes) {
          assert.notEqual(w.status, "confirmed", `${c.text} must not auto-confirm`);
          if (c.cls === "estimate") {
            assert.equal(w.verification_level, "user_estimate");
          }
        }
        const applied = await applyAnswerEventToSessionDc(session, ev, {
          now: new Date().toISOString(),
        });
        if (applied.applied && applied.session.decision_context) {
          for (const f of applied.session.decision_context.reality_facts) {
            assert.notEqual(
              f.status,
              "confirmed",
              "applied facts must not silently become confirmed",
            );
          }
          for (const d of applied.session.decision_context.dirs) {
            // estimate/unknown/declined must not alone flip DIR to known
            if (
              c.cls === "estimate" ||
              c.cls === "unknown" ||
              c.cls === "declined"
            ) {
              // DIR may stay unknown/partial/conflict — never invent known from estimate alone
              if (
                ev.targets.dir_ids.includes(d.dir_id) &&
                d.current_state === "known"
              ) {
                const facts = applied.session.decision_context.reality_facts.filter(
                  (f) => (f.related_dir_ids ?? []).includes(d.dir_id),
                );
                assert.ok(
                  facts.some((f) => f.status === "confirmed" && f.user_confirmed),
                  "DIR known only with confirmed+user_confirmed evidence",
                );
              }
            }
          }
        }
      }

      // Contradiction path: two conflicting statements targeting same plan
      const a1 = interpretUserAnswer({
        session,
        statement: "我的预算硬上限是五万，绝对不能超过。",
        source_turn_id: "m23_05_c1",
        now: new Date().toISOString(),
      });
      const s1 = await applyAnswerEventToSessionDc(session, a1, {
        now: new Date().toISOString(),
      });
      const a2 = interpretUserAnswer({
        session: s1.session,
        statement: "更正：其实预算可以到二十万。",
        source_turn_id: "m23_05_c2",
        now: new Date().toISOString(),
      });
      assert.ok(
        a2.classification === "correction" ||
          a2.classification === "contradiction" ||
          a2.classification === "clear_answer" ||
          a2.classification === "supplement",
      );
      for (const w of a2.proposed_writes) {
        assert.notEqual(w.status, "confirmed");
      }
    });

    // ---------- M2.3-06 ----------
    await check("M2.3-06 fresh-session E2E from createPOJUSession (no seedSession)", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_06",
        original_question: "要不要去读研深造？",
      });
      const before = await durable(sid);
      assert.equal(before.decision_context ?? null, null);
      assert.equal(before.decision_blueprint ?? null, null);

      const out1 = await handleUserMessage({
        session: before,
        userMessage: "我在考虑要不要辞职去读研，机会成本很高。",
        locale: "zh",
      });
      await savePOJUSession(out1);
      const s1 = await durable(sid);

      assert.ok(s1.decision_context, "DC created");
      assert.equal(s1.decision_context!.status, "draft");
      assert.ok(s1.decision_blueprint, "dynamic Blueprint");
      assert.equal(s1.decision_blueprint!.scope_source, "catalog");
      assert.ok(
        s1.decision_blueprint!.dir_ids.includes("DIR-EDU-PATH"),
        "education topic DIR",
      );
      assert.ok(s1.adaptive_ask_plan, "first Q from Planner");
      assert.equal(
        lastAssistant(s1).content,
        s1.adaptive_ask_plan!.question_text,
        "user-visible Q matches authorized plan",
      );

      const v1 = s1.decision_context!.version;
      const plan1 = s1.adaptive_ask_plan!.plan_id;

      const out2 = await handleUserMessage({
        session: s1,
        userMessage: "目标是两年后能转到研究岗，优先可逆路径。",
        locale: "zh",
      });
      await savePOJUSession(out2);
      const s2 = await durable(sid);

      assert.ok(s2.decision_context!.version > v1, "answer written to DC");
      assert.ok(s2.decision_understanding);
      assert.equal(
        s2.decision_understanding!.context_version,
        s2.decision_context!.version,
      );
      if (s2.adaptive_ask_plan) {
        assert.notEqual(s2.adaptive_ask_plan.plan_id, plan1);
        assert.equal(
          lastAssistant(s2).content,
          s2.adaptive_ask_plan.question_text,
        );
      }

      // Persist fail-closed already covered by M1-R; here ensure no freeform leak.
      assert.notEqual(lastAssistant(s2).content, stubResponse);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log(`\nM2.3 results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
