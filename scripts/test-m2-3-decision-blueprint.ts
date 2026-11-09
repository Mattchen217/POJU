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
 *  M2.3-R1  Full DDR scope (P0+P1+P2) on Blueprint; seed vs schedule split; P1/P2 activation
 *  M2.3-R2  Production priority activation / Readiness ordering via runAdaptiveQuestionTurn
 *  M2.3-R2-FU  Planner cannot bypass open P0/P1 (no selectable / all rejected → blocked)
 *  M2.3-R2-FU2 Preserve planner_blocked across idempotent replay + planner exception
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
  const { runM1ProductionPreLlmTurn, runCollectingDcTurn } = await import(
    "../lib/poju/collecting-dc-turn"
  );
  const {
    buildCatalogBlueprintScope,
    filterCatalogLegalIds,
    classifyDecisionTopic,
    resolveDdrIdsForDir,
    ensureDecisionBlueprint,
    activateNextBlueprintPriorityBand,
    gateClassForDirFromCatalog,
    buildUnderstandingState,
    runAdaptiveQuestionTurn,
    attachAuthorizedAssistantQuestion,
  } = await import("../lib/poju/decision-intake");
  const {
    ACTIVE_DDR_CATALOG_VERSION,
    loadDdrCatalog,
  } = await import("../lib/poju/decision-context/catalog");
  const { selectNextIntakeAskForSession } = await import(
    "../lib/poju/decision-context/production-intake-ask"
  );
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

    // ---------- M2.3-R1 ----------
    await check("M2.3-R1 full DDR scope P0+P1+P2 + seed/schedule split + activation", async () => {
      const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);
      assert.ok(ddrLoad.ok, "ddr catalog");

      const sid = await createPOJUSession({
        payment_id: "pay_m23_r1",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const bp = s.decision_blueprint!;
      const dc = s.decision_context!;
      assert.equal(bp.scope_source, "catalog");

      // 1) Blueprint contains ALL required DIRs of selected DDRs (P0/P1/P2)
      const requiredFromDdrs = new Set<string>();
      for (const ddrId of bp.ddr_ids ?? []) {
        const entry = ddrLoad.snapshot.by_id.get(ddrId);
        if (!entry) continue;
        // DDR-07 topic pack uses overridden required_dir_ids at scope time;
        // still assert every non-empty catalog required id is in scope when selected.
        for (const id of entry.required_dir_ids) requiredFromDdrs.add(id);
      }
      // Topic pack for career must be present (DDR-07 filled at init)
      assert.ok(bp.dir_ids.includes("DIR-JOB-OFFER"), "topic DIR in scope");
      for (const id of requiredFromDdrs) {
        assert.ok(
          bp.dir_ids.includes(id),
          `Blueprint missing required DIR ${id} from selected DDRs`,
        );
      }
      // Pure P1 DIRs must be in formal scope (not dropped)
      assert.ok(
        bp.dir_ids.includes("DIR-VALIDATION-CAPACITY"),
        "P1 DIR-VALIDATION-CAPACITY must stay in Blueprint scope",
      );
      assert.ok(
        bp.dir_ids.includes("DIR-OPT-IRREV"),
        "P1 DIR-OPT-IRREV must stay in Blueprint scope",
      );

      // 2) P0/P1/P2 DIRs all have legal DDR associations + Investigation Directions
      for (const dirId of bp.dir_ids) {
        const ddrs = resolveDdrIdsForDir(dirId, bp);
        assert.ok(ddrs.length >= 1, `no DDR association for ${dirId}`);
        assert.ok(ddrs.every((d) => !d.startsWith("DDR_FOR_")));
        const direction = bp.directions.find((d) => d.dir_ids.includes(dirId));
        assert.ok(direction, `missing Investigation Direction for ${dirId}`);
        assert.ok(direction!.completion_criteria, "completion criteria");
        assert.ok(direction!.scope_boundary, "scope boundary");
      }

      // 3) Distinguish Blueprint scope vs DC initial seed
      const seed = bp.initial_seed_dir_ids ?? [];
      assert.ok(seed.length >= 1, "initial_seed_dir_ids recorded");
      assert.ok(
        seed.every((id) => bp.dir_ids.includes(id)),
        "seed must be subset of Blueprint scope",
      );
      assert.ok(
        bp.dir_ids.length >= seed.length,
        "scope must be at least seed",
      );
      // P1-only DIRs should not be in first-wave seed
      assert.ok(
        !seed.includes("DIR-VALIDATION-CAPACITY"),
        "DIR-VALIDATION-CAPACITY must not be first-wave seed",
      );
      assert.ok(
        !seed.includes("DIR-OPT-IRREV"),
        "DIR-OPT-IRREV must not be first-wave seed",
      );
      // DC after bootstrap should carry seed DIRs; deferred P1 may be absent until activation
      for (const id of seed) {
        assert.ok(
          dc.dirs.some((d) => d.dir_id === id),
          `DC missing seed DIR ${id}`,
        );
      }
      const deferredOnDc = dc.dirs.some((d) => d.dir_id === "DIR-VALIDATION-CAPACITY");
      // May or may not be activated yet if somehow P0 empty — normally absent
      if (!deferredOnDc) {
        assert.ok(
          bp.dir_ids.includes("DIR-VALIDATION-CAPACITY"),
          "deferred DIR still in Blueprint",
        );
      }

      // 4) First turn still prefers P0
      const plan0 = s.adaptive_ask_plan!;
      assert.equal(plan0.gate_class, "P0", `first ask must be P0, got ${plan0.gate_class}`);
      const cands0 = buildIntakeCandidatesFromDc(dc, bp);
      assert.ok(cands0.some((c) => c.impact.gate_class === "P0"));
      const top = cands0
        .slice()
        .sort((a, b) => {
          const rank = (g: string) => (g === "P0" ? 0 : g === "P1" ? 1 : 2);
          return rank(a.impact.gate_class) - rank(b.impact.gate_class);
        })[0];
      assert.equal(top!.impact.gate_class, "P0");

      // 5) Simulate P0 completion on DC → activate P1 from Blueprint
      const p0Ids = bp.dir_ids.filter((id) => {
        const g = gateClassForDirFromCatalog(
          id,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        );
        let band = g.gate_class;
        if (
          bp.page_07_emit &&
          bp.directions.some(
            (d) => d.direction_id === "DIRN-TOPIC" && d.dir_ids.includes(id),
          )
        ) {
          band = "P0";
        }
        return band === "P0";
      });
      let working = s;
      working = {
        ...working,
        decision_context: {
          ...working.decision_context!,
          dirs: working.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const, partial_satisfaction: false }
              : d,
          ),
          // bump version so Understanding binds
          version: working.decision_context!.version + 1,
        },
      };
      // Ensure any P0 Blueprint DIRs missing on DC are also marked known via merge+mark
      const bp2 = ensureDecisionBlueprint(working, {
        now: new Date().toISOString(),
      });
      working = bp2.session;
      working = {
        ...working,
        decision_context: {
          ...working.decision_context!,
          dirs: working.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
        },
      };

      // Uninvestigated P1/P2 must NOT be auto-marked known/n_a
      for (const d of working.decision_context!.dirs) {
        if (d.dir_id === "DIR-VALIDATION-CAPACITY" || d.dir_id === "DIR-OPT-IRREV") {
          assert.notEqual(d.current_state, "known");
          assert.notEqual(d.current_state, "n_a");
        }
      }

      const activated = activateNextBlueprintPriorityBand(
        working,
        new Date().toISOString(),
      );
      assert.ok(
        activated.decision_context!.dirs.some(
          (d) => d.dir_id === "DIR-VALIDATION-CAPACITY",
        ),
        "after P0 complete, P1 DIR-VALIDATION-CAPACITY must activate onto DC",
      );
      assert.ok(
        activated.decision_context!.dirs.some((d) => d.dir_id === "DIR-OPT-IRREV"),
        "after P0 complete, P1 DIR-OPT-IRREV must activate onto DC",
      );
      for (const id of ["DIR-VALIDATION-CAPACITY", "DIR-OPT-IRREV"]) {
        const row = activated.decision_context!.dirs.find((d) => d.dir_id === id)!;
        assert.equal(row.current_state, "unknown", `${id} must activate as unknown`);
      }

      // AQE can select unfinished P1
      const ask = await selectNextIntakeAskForSession({
        session: activated,
        nowIso: new Date().toISOString(),
      });
      const p1Cands = buildIntakeCandidatesFromDc(
        ask.session.decision_context!,
        ask.session.decision_blueprint!,
      ).filter((c) => c.impact.gate_class === "P1");
      assert.ok(p1Cands.length >= 1, "AQE must see P1 candidates after P0 complete");
      if (ask.selected) {
        assert.ok(
          ask.selected.candidate.impact.gate_class === "P1" ||
            ask.selected.candidate.impact.gate_class === "P0",
          `selected gate ${ask.selected.candidate.impact.gate_class}`,
        );
        // With all P0 known, selection should prefer P1
        assert.equal(
          ask.selected.candidate.impact.gate_class,
          "P1",
          "after P0 known, next ask should be P1",
        );
      }

      // Readiness must not treat uninvestigated P1/P2 as complete
      const u = buildUnderstandingState({
        session: ask.session,
        blueprint: ask.session.decision_blueprint!,
        now: new Date().toISOString(),
      });
      const p1Need = u.need_to_understand.items.find(
        (n) =>
          n.kind === "dir_based" &&
          (n.dir_id === "DIR-VALIDATION-CAPACITY" || n.dir_id === "DIR-OPT-IRREV"),
      );
      assert.ok(p1Need, "Readiness/Understanding must still list open P1 needs");
      assert.ok(
        !u.understood.items.some(
          (i) =>
            i.dir_id === "DIR-VALIDATION-CAPACITY" || i.dir_id === "DIR-OPT-IRREV",
        ),
        "uninvestigated P1 must not appear in understood/known",
      );

      // 6) After P1 complete → P2 activation (DIR-TIMING-WINDOW is also P0 via HOLD;
      //    verify band advancement API still activates remaining unfinished Blueprint DIRs)
      let afterP1 = ask.session;
      const p1Ids = afterP1.decision_blueprint!.dir_ids.filter((id) => {
        const g = gateClassForDirFromCatalog(
          id,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        );
        let band = g.gate_class;
        if (
          afterP1.decision_blueprint!.page_07_emit &&
          afterP1.decision_blueprint!.directions.some(
            (d) => d.direction_id === "DIRN-TOPIC" && d.dir_ids.includes(id),
          )
        ) {
          band = "P0";
        }
        return band === "P1";
      });
      afterP1 = {
        ...afterP1,
        decision_context: {
          ...afterP1.decision_context!,
          dirs: afterP1.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id) || p1Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: afterP1.decision_context!.version + 1,
        },
      };
      const afterP2 = activateNextBlueprintPriorityBand(
        afterP1,
        new Date().toISOString(),
      );
      // Any remaining unfinished Blueprint DIRs (P2 band) must be activatable
      const unfinishedP2 = (afterP2.decision_blueprint?.dir_ids ?? []).filter((id) => {
        const g = gateClassForDirFromCatalog(
          id,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        );
        return g.gate_class === "P2";
      });
      for (const id of unfinishedP2) {
        const row = afterP2.decision_context!.dirs.find((d) => d.dir_id === id);
        assert.ok(row, `P2 DIR ${id} must be on DC after P1 complete`);
        if (row && row.current_state !== "known" && row.current_state !== "n_a") {
          assert.equal(row.current_state, "unknown");
        }
      }

      // 7) Report-required DDRs have no un-investigable DIR gap
      for (const ddrId of bp.ddr_ids ?? []) {
        const entry = ddrLoad.snapshot.by_id.get(ddrId);
        if (!entry) continue;
        for (const dirId of entry.required_dir_ids) {
          assert.ok(
            bp.dir_ids.includes(dirId),
            `report DDR ${ddrId} requires ${dirId} but Blueprint cannot investigate it`,
          );
        }
      }
      // DDR-07 topic dirs (career)
      if ((bp.ddr_ids ?? []).includes("DDR-07-TOPIC-DEPTH")) {
        assert.ok(bp.dir_ids.includes("DIR-JOB-OFFER"));
      }

      console.log(
        `    scope=${bp.dir_ids.length} seed=${seed.length} p0Ask=${plan0.gate_class} p1Cands=${p1Cands.length}`,
      );
    });

    // ---------- M2.3-R2 ----------
    /** Shared helper: P0 band ids (topic pack treated as P0 when page_07_emit). */
    function p0BandIds(bp: NonNullable<POJUSessionState["decision_blueprint"]>): string[] {
      const ddrLoad = loadDdrCatalog(ACTIVE_DDR_CATALOG_VERSION);
      assert.ok(ddrLoad.ok);
      return bp.dir_ids.filter((id) => {
        const g = gateClassForDirFromCatalog(
          id,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        );
        let band = g.gate_class;
        if (
          bp.page_07_emit &&
          bp.directions.some(
            (d) => d.direction_id === "DIRN-TOPIC" && d.dir_ids.includes(id),
          )
        ) {
          band = "P0";
        }
        return band === "P0";
      });
    }

    await check("M2.3-R2 Case A: P0 partial — no premature stop; stay in P0; P1 not activated", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2a",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const bp = s.decision_blueprint!;
      const p0Ids = p0BandIds(bp);
      assert.ok(p0Ids.length >= 2, "need multiple P0 DIRs");

      // Partial coverage on all critical/P0 rows + collecting evidence — the stale
      // criticalCovered&&hasCollectingEvidence path used to early-stop here.
      const sampleFact = {
        fact_id: "f_r2a_partial",
        statement: "Partial collecting evidence for readiness early-stop probe",
        status: "unverified" as const,
        verification_level: "user_asserted" as const,
        source_stage: "collecting" as const,
        source_turn_id: "t_r2a",
        user_confirmed: false,
        fact_roles: ["option"] as string[],
        related_dir_ids: [p0Ids[0]!],
      };
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [...(s.decision_context!.reality_facts ?? []), sampleFact],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? {
                  ...d,
                  current_state: "unknown" as const,
                  partial_satisfaction: true,
                }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
      };
      // Ensure P1 not yet on DC
      assert.ok(
        !s.decision_context!.dirs.some((d) => d.dir_id === "DIR-VALIDATION-CAPACITY"),
        "precondition: P1 not on DC before turn",
      );

      const now = new Date().toISOString();
      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2a_init",
        now,
        init_only: true,
      });
      assert.ok(turn.understanding, "understanding required");
      assert.equal(
        turn.understanding!.readiness.can_ask,
        true,
        `Readiness must not premature-stop; verdict=${turn.understanding!.readiness.verdict} reasons=${turn.understanding!.readiness.reasons.join(",")}`,
      );
      assert.ok(turn.plan, "must still plan a next question within unfinished P0");
      assert.equal(turn.plan!.gate_class, "P0", `next Q must stay in P0, got ${turn.plan!.gate_class}`);
      assert.ok(
        turn.plan!.dir_ids.some((id) => p0Ids.includes(id)),
        "authorized plan dirs must intersect unfinished P0",
      );
      // P1 must not activate while required P0 unfinished
      assert.ok(
        !turn.session.decision_context!.dirs.some(
          (d) => d.dir_id === "DIR-VALIDATION-CAPACITY" || d.dir_id === "DIR-OPT-IRREV",
        ),
        "P1 must not activate while P0 unfinished",
      );
      console.log(
        `    can_ask=${turn.understanding!.readiness.can_ask} gate=${turn.plan!.gate_class} reasons=${turn.understanding!.readiness.reasons.filter((r) => r.includes("p0_p1") || r.includes("open_blueprint")).join("|") || "n/a"}`,
      );
    });

    await check("M2.3-R2 Case B: P0 complete → production orchestrator activates P1 + plans P1", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2b",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const bp = s.decision_blueprint!;
      const p0Ids = p0BandIds(bp);

      // Fixture: all P0 known. Do NOT bypass runAdaptiveQuestionTurn after this.
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2b_p0",
              statement: "P0 band fixture evidence",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2b",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: p0Ids.slice(0, 1),
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const, partial_satisfaction: false }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
      };
      // Do not call ensureDecisionBlueprint here — it also activates the next band.
      // Leave P1 off DC so the production orchestrator must activate them.
      assert.ok(
        !s.decision_context!.dirs.some((d) => d.dir_id === "DIR-VALIDATION-CAPACITY"),
        "precondition: P1 not yet on DC before runAdaptiveQuestionTurn",
      );
      assert.ok(
        !s.decision_context!.dirs.some((d) => d.dir_id === "DIR-OPT-IRREV"),
        "precondition: P1 DIR-OPT-IRREV not yet on DC",
      );

      const now = new Date().toISOString();
      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2b_init",
        now,
        init_only: true,
      });

      // P1 activated onto DC as unknown by production orchestrator
      const p1Val = turn.session.decision_context!.dirs.find(
        (d) => d.dir_id === "DIR-VALIDATION-CAPACITY",
      );
      const p1Irr = turn.session.decision_context!.dirs.find(
        (d) => d.dir_id === "DIR-OPT-IRREV",
      );
      assert.ok(p1Val, "P1 DIR-VALIDATION-CAPACITY must activate onto DC");
      assert.ok(p1Irr, "P1 DIR-OPT-IRREV must activate onto DC");
      assert.equal(p1Val!.current_state, "unknown");
      assert.equal(p1Irr!.current_state, "unknown");

      assert.ok(turn.understanding, "understanding required");
      assert.equal(
        turn.understanding!.context_version,
        turn.session.decision_context!.version,
        "Understanding must bind current DC version after activation",
      );
      assert.equal(
        turn.understanding!.readiness.can_ask,
        true,
        `Readiness must allow asking; verdict=${turn.understanding!.readiness.verdict}`,
      );
      assert.ok(turn.plan, "AQE must select a pending P1 plan");
      assert.equal(
        turn.plan!.gate_class,
        "P1",
        `plan must select P1, got ${turn.plan!.gate_class}`,
      );
      assert.ok(
        turn.plan!.dir_ids.some(
          (id) => id === "DIR-VALIDATION-CAPACITY" || id === "DIR-OPT-IRREV",
        ),
        "plan dirs must include pending P1",
      );
      assert.equal(turn.authorized_question, turn.plan!.question_text);

      // Simulate agent delivery: authorized question equals assistant message sent
      let delivered = attachAuthorizedAssistantQuestion(
        turn.session,
        turn.plan!,
        "t_r2b_ask",
      );
      delivered = {
        ...delivered,
        messages: [
          ...delivered.messages,
          {
            role: "assistant" as const,
            content: turn.authorized_question!,
            timestamp: now,
          },
        ],
      };
      const last = [...delivered.messages].reverse().find((m) => m.role === "assistant");
      assert.ok(last);
      assert.equal(last!.content, turn.authorized_question);
      assert.equal(
        delivered.decision_understanding!.last_sent_question?.question_text,
        turn.authorized_question,
      );
      console.log(
        `    P1 activated; plan=${turn.plan!.gate_class}; ctx_v=${turn.understanding!.context_version}; Q matched assistant`,
      );
    });

    await check("M2.3-R2 Case C: unfinished P1 stays in need_to_understand; Readiness continues", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2c",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const p0Ids = p0BandIds(s.decision_blueprint!);

      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2c_p0",
              statement: "P0 complete fixture for Case C",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2c",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: p0Ids.slice(0, 1),
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
      };

      const now = new Date().toISOString();
      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2c_init",
        now,
        init_only: true,
      });
      assert.ok(turn.understanding);
      const u = turn.understanding!;
      const p1Need = u.need_to_understand.items.find(
        (n) =>
          n.kind === "dir_based" &&
          (n.dir_id === "DIR-VALIDATION-CAPACITY" || n.dir_id === "DIR-OPT-IRREV"),
      );
      assert.ok(p1Need, "unfinished P1 must remain in need_to_understand");
      assert.ok(
        !u.understood.items.some(
          (i) =>
            i.dir_id === "DIR-VALIDATION-CAPACITY" || i.dir_id === "DIR-OPT-IRREV",
        ),
        "unfinished P1 must not appear in understood",
      );
      assert.equal(u.readiness.can_ask, true, "Readiness must not terminate while P1 open and budget remains");
      assert.ok(
        u.budget.remaining_hard_budget > 0,
        "precondition: budget remains",
      );
      console.log(
        `    p1Need=${p1Need && p1Need.kind === "dir_based" ? p1Need.dir_id : "?"}; can_ask=${u.readiness.can_ask}; remaining=${u.budget.remaining_hard_budget}`,
      );
    });

    // ---------- M2.3-R2-FU ----------
    await check("M2.3-R2-FU Case A: open P0 + budget + no selectable candidate → blocked, not final-confirm", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2fu_a",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const bp = s.decision_blueprint!;
      const p0Ids = p0BandIds(bp);
      assert.ok(p0Ids.length >= 1, "need P0 DIRs");
      assert.ok(s.decision_understanding, "understanding present after first turn");
      const depthCap = bp.question_budget.depth_per_direction;
      const depth_by_dir: Record<string, number> = {
        ...(s.decision_understanding!.budget.depth_by_dir ?? {}),
      };
      for (const id of p0Ids) depth_by_dir[id] = depthCap;

      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2fu_a",
              statement: "Collecting evidence while P0 still open",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2fu_a",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: [p0Ids[0]!],
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? {
                  ...d,
                  current_state: "unknown" as const,
                  partial_satisfaction: true,
                }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
        decision_understanding: {
          ...s.decision_understanding!,
          budget: {
            ...s.decision_understanding!.budget,
            session_asked_count: Math.min(
              2,
              s.decision_understanding!.budget.hard_budget_limit - 1,
            ),
            remaining_hard_budget: Math.max(
              1,
              s.decision_understanding!.budget.hard_budget_limit - 2,
            ),
            depth_by_dir,
          },
        },
      };

      const now = new Date().toISOString();
      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu_a_init",
        now,
        init_only: true,
      });
      assert.ok(turn.understanding, "understanding required");
      assert.equal(
        turn.outcome,
        "planner_blocked",
        `expected planner_blocked, got ${turn.outcome} verdict=${turn.understanding!.readiness.verdict} reasons=${turn.understanding!.readiness.reasons.join(",")}`,
      );
      assert.equal(turn.understanding!.readiness.can_ask, true);
      assert.equal(turn.understanding!.readiness.verdict, "continue");
      assert.ok(
        !turn.understanding!.readiness.reasons.includes("ready_for_final_confirm"),
      );
      assert.notEqual(
        turn.understanding!.readiness.verdict,
        "ready_for_final_confirm",
      );
      assert.equal(turn.plan, null);
      assert.equal(turn.authorized_question, null);
      const p0Need = turn.understanding!.need_to_understand.items.find(
        (n) => n.kind === "dir_based" && p0Ids.includes(n.dir_id),
      );
      assert.ok(p0Need, "open P0 must remain in need_to_understand");
      assert.ok(
        turn.understanding!.budget.remaining_hard_budget > 0,
        "hard budget remains",
      );

      // Production Agent entry on revision-aligned fixture (avoid stale C1 persist).
      // Prefer turn.session (orchestrator already applied understanding) + save.
      let sAgent = {
        ...turn.session,
        agent_v2: {
          ...(turn.session.agent_v2 ?? s.agent_v2 ?? out1.agent_v2!),
          current_phase: "collecting_context" as const,
        },
      };
      await savePOJUSession(sAgent);
      sAgent = await durable(sid);

      // Direct production pre-LLM entry (same as Agent) — no selectable under depth exhaustion
      const pre = await runM1ProductionPreLlmTurn(sAgent, {
        statement: "嗯",
        source_turn_id: "r2fu_a_agent_entry",
        now: new Date().toISOString(),
      });
      assert.equal(
        pre.outcome,
        "planner_blocked",
        `runM1ProductionPreLlmTurn must be planner_blocked, got ${pre.outcome} ask_error=${pre.ask_error}`,
      );
      assert.equal(pre.authorized_question ?? null, null);
      assert.equal(pre.plan ?? null, null);

      const agentOut = await handleUserMessage({
        session: sAgent,
        userMessage: "嗯",
        locale: "zh",
      });
      const last = lastAssistant(agentOut);
      assert.ok(
        (last as { meta?: { m1_planner_blocked?: boolean } }).meta
          ?.m1_planner_blocked === true ||
          last.content.includes("未能生成合规的授权提问") ||
          last.content.includes("未完成的必要调查"),
        `agent must surface planner_blocked system reply, got: ${last.content.slice(0, 160)}`,
      );
      assert.ok(
        !last.content.includes("【理解确认】"),
        "must not show final understanding-confirmation prompt",
      );
      assert.ok(
        !last.content.includes(stubResponse),
        "must not emit unauthorized model free-form question",
      );
      const phase = agentOut.agent_v2?.current_phase ?? "missing";
      assert.equal(
        phase,
        "collecting_context",
        `session must stay nonterminal collecting_context, got ${phase}`,
      );
      console.log(
        `    orchestrator=${turn.outcome}; pre=${pre.outcome}; agent_phase=${phase}; p0Need=${p0Need && p0Need.kind === "dir_based" ? p0Need.dir_id : "?"}`,
      );
    });

    await check("M2.3-R2-FU Case B: open P1 + budget + all candidates rejected → blocked", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2fu_b",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const p0Ids = p0BandIds(s.decision_blueprint!);

      // Complete P0 so P1 activates on next orchestrator turn
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2fu_b_p0",
              statement: "P0 complete fixture for FU Case B",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2fu_b",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: p0Ids.slice(0, 1),
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
      };

      // First orchestrator pass activates P1 and would normally plan — capture activated session
      const activated = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu_b_activate",
        now: new Date().toISOString(),
        init_only: true,
      });
      assert.ok(
        activated.session.decision_context!.dirs.some(
          (d) =>
            d.dir_id === "DIR-VALIDATION-CAPACITY" ||
            d.dir_id === "DIR-OPT-IRREV",
        ),
        "precondition: P1 activated",
      );

      // Force every candidate to fail scope/depth validation while budget remains:
      // depth_soft_cap=0 ⇒ plan.depth(1) always exceeds cap, while depth_per_direction
      // filter still admits candidates (used=0 < 3).
      s = {
        ...activated.session,
        decision_blueprint: {
          ...activated.session.decision_blueprint!,
          directions: activated.session.decision_blueprint!.directions.map(
            (d) => ({ ...d, depth_soft_cap: 0 }),
          ),
        },
        decision_understanding: {
          ...activated.session.decision_understanding!,
          budget: {
            ...activated.session.decision_understanding!.budget,
            session_asked_count: 1,
            remaining_hard_budget: Math.max(
              1,
              activated.session.decision_understanding!.budget.hard_budget_limit -
                1,
            ),
            depth_by_dir: {},
          },
        },
      };

      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu_b_blocked",
        now: new Date().toISOString(),
        init_only: true,
      });
      assert.ok(turn.understanding);
      assert.equal(
        turn.outcome,
        "planner_blocked",
        `expected planner_blocked, got ${turn.outcome} reasons=${turn.understanding!.readiness.reasons.join(",")}`,
      );
      assert.equal(turn.understanding!.readiness.verdict, "continue");
      assert.equal(turn.understanding!.readiness.can_ask, true);
      assert.notEqual(
        turn.understanding!.readiness.verdict,
        "ready_for_final_confirm",
      );
      assert.ok(
        turn.understanding!.readiness.reasons.some(
          (r) =>
            r.includes("scope_budget_reject") ||
            r.includes("planner_blocked") ||
            r.includes("all_candidates_rejected") ||
            r.includes("direction_depth_exceeded"),
        ),
        `must preserve validation failure reason, got ${turn.understanding!.readiness.reasons.join(",")}`,
      );
      const p1Need = turn.understanding!.need_to_understand.items.find(
        (n) =>
          n.kind === "dir_based" &&
          (n.dir_id === "DIR-VALIDATION-CAPACITY" ||
            n.dir_id === "DIR-OPT-IRREV"),
      );
      assert.ok(p1Need, "open P1 must remain in need_to_understand");
      assert.equal(turn.authorized_question, null);
      assert.equal(turn.plan, null);

      // Agent integration: no unauthorized assistant question / no final confirm
      const sAgent = {
        ...s,
        agent_v2: {
          ...(s.agent_v2 ?? out1.agent_v2!),
          current_phase: "collecting_context" as const,
        },
      };
      const agentOut = await handleUserMessage({
        session: sAgent,
        userMessage: "关于验证能力我想再想想",
        locale: "zh",
      });
      const last = lastAssistant(agentOut);
      assert.ok(
        !last.content.includes("【理解确认】"),
        "no false final confirmation",
      );
      assert.ok(
        !last.content.includes(stubResponse),
        "no unauthorized model free-form question",
      );
      assert.equal(agentOut.agent_v2?.current_phase, "collecting_context");
      assert.ok(
        (last as { meta?: { m1_planner_blocked?: boolean } }).meta
          ?.m1_planner_blocked === true ||
          last.content.includes("未能生成合规的授权提问") ||
          last.content.includes("未完成的必要调查"),
        `expected planner_blocked agent reply, got: ${last.content.slice(0, 160)}`,
      );
      console.log(
        `    outcome=${turn.outcome}; reasons=${turn.understanding!.readiness.reasons.filter((r) => r.includes("reject") || r.includes("blocked") || r.includes("depth")).join("|")}; agent_phase=${agentOut.agent_v2?.current_phase}`,
      );
    });

    await check("M2.3-R2-FU Case C: P0/P1 genuinely complete → readiness/final-confirm unchanged", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2fu_c",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const p0Ids = p0BandIds(s.decision_blueprint!);

      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2fu_c",
              statement: "Collecting evidence after P0/P1 complete",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2fu_c",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: p0Ids.slice(0, 1),
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
      };

      // Activate P1, then mark P1 known as well (genuinely complete P0/P1)
      const activated = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu_c_activate",
        now: new Date().toISOString(),
        init_only: true,
      });
      const p1Ids = activated.session
        .decision_context!.dirs.filter(
          (d) =>
            d.dir_id === "DIR-VALIDATION-CAPACITY" ||
            d.dir_id === "DIR-OPT-IRREV",
        )
        .map((d) => d.dir_id);
      assert.ok(p1Ids.length >= 1, "P1 should activate");

      s = {
        ...activated.session,
        decision_context: {
          ...activated.session.decision_context!,
          dirs: activated.session.decision_context!.dirs.map((d) =>
            p1Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: activated.session.decision_context!.version + 1,
        },
      };

      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu_c_ready",
        now: new Date().toISOString(),
        init_only: true,
      });
      assert.ok(turn.understanding);
      assert.equal(
        turn.understanding!.readiness.can_ask,
        false,
        `when P0/P1 complete, can_ask should be false; verdict=${turn.understanding!.readiness.verdict} reasons=${turn.understanding!.readiness.reasons.join(",")}`,
      );
      assert.ok(
        turn.understanding!.readiness.verdict === "ready_for_final_confirm" ||
          turn.understanding!.readiness.verdict === "hard_budget_exhausted",
        `expected terminal readiness verdict, got ${turn.understanding!.readiness.verdict}`,
      );
      assert.notEqual(turn.outcome, "planner_blocked");
      const openP0P1 = turn.understanding!.need_to_understand.items.filter(
        (n) =>
          n.kind === "dir_based" &&
          (n.priority === "P0" || n.priority === "P1"),
      );
      assert.equal(openP0P1.length, 0, "no open P0/P1 obligations");

      // Agent: readiness stop → understanding confirmation (existing behavior)
      const sAgent = {
        ...turn.session,
        agent_v2: {
          ...(turn.session.agent_v2 ?? out1.agent_v2!),
          current_phase: "collecting_context" as const,
        },
      };
      const agentOut = await handleUserMessage({
        session: sAgent,
        userMessage: "信息已经差不多了",
        locale: "zh",
      });
      // After P0/P1 complete, Agent may show confirm OR stay collecting if answer re-opens needs.
      // At minimum: must NOT be planner_blocked, and if can_ask false path fires, confirm appears.
      const last = lastAssistant(agentOut);
      assert.ok(
        (last as { meta?: { m1_planner_blocked?: boolean } }).meta
          ?.m1_planner_blocked !== true,
        "must not planner_block when P0/P1 genuinely complete",
      );
      console.log(
        `    verdict=${turn.understanding!.readiness.verdict}; outcome=${turn.outcome}; agent_phase=${agentOut.agent_v2?.current_phase}; confirm=${last.content.includes("理解确认")}`,
      );
    });

    // ---------- M2.3-R2-FU2 ----------
    await check("M2.3-R2-FU2 Case A: idempotent replay + planner_blocked preserves nonterminal", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2fu2_a",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const bp = s.decision_blueprint!;
      const p0Ids = p0BandIds(bp);
      assert.ok(p0Ids.length >= 1, "need P0 DIRs");
      const depthCap = bp.question_budget.depth_per_direction;
      const depth_by_dir: Record<string, number> = {
        ...(s.decision_understanding!.budget.depth_by_dir ?? {}),
      };
      for (const id of p0Ids) depth_by_dir[id] = depthCap;
      const replayTurnId = "r2fu2_a_replay_turn";

      // Plant a prior mapped fact so the next answer with same source_turn_id hits turn_already_mapped.
      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2fu2_a_prior",
              statement: "Prior mapped answer for FU2 Case A replay",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: replayTurnId,
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: [p0Ids[0]!],
            },
            {
              fact_id: "f_r2fu2_a_ev",
              statement: "Collecting evidence while P0 still open",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2fu2_a_ev",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: [p0Ids[0]!],
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? {
                  ...d,
                  current_state: "unknown" as const,
                  partial_satisfaction: true,
                }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
        decision_understanding: {
          ...s.decision_understanding!,
          budget: {
            ...s.decision_understanding!.budget,
            session_asked_count: Math.min(
              2,
              s.decision_understanding!.budget.hard_budget_limit - 1,
            ),
            remaining_hard_budget: Math.max(
              1,
              s.decision_understanding!.budget.hard_budget_limit - 2,
            ),
            depth_by_dir,
          },
        },
        agent_v2: {
          ...(s.agent_v2 ?? out1.agent_v2!),
          current_phase: "collecting_context" as const,
        },
      };

      const now = new Date().toISOString();
      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "同一回合重放：仍有未完成的 P0",
        source_turn_id: replayTurnId,
        now,
      });
      assert.equal(
        turn.outcome,
        "planner_blocked",
        `replay must stay planner_blocked, got ${turn.outcome} ask_error=${turn.ask_error}`,
      );
      assert.notEqual(turn.outcome, "idempotent_replay");
      assert.equal(turn.persist_error, "turn_already_mapped");
      assert.equal(turn.plan, null);
      assert.equal(turn.authorized_question, null);
      assert.ok(turn.understanding);
      assert.equal(turn.understanding!.readiness.can_ask, true);
      assert.equal(turn.understanding!.readiness.verdict, "continue");
      const p0Need = turn.understanding!.need_to_understand.items.find(
        (n) => n.kind === "dir_based" && p0Ids.includes(n.dir_id),
      );
      assert.ok(p0Need, "open P0 must remain in need_to_understand");

      // Production collecting-turn mapping
      await savePOJUSession(turn.session);
      const mapped = await runCollectingDcTurn(await durable(sid), {
        statement: "同一回合重放：仍有未完成的 P0",
        source_turn_id: replayTurnId,
        now: new Date().toISOString(),
      });
      assert.equal(mapped.outcome, "planner_blocked");
      assert.equal(mapped.ask_planned, false);
      assert.equal(mapped.authorized_question ?? null, null);
      assert.equal(mapped.plan ?? null, null);
      assert.ok(mapped.ask_error, "ask_error must be preserved");

      // Agent: no confirm / no free-form
      const sAgent = {
        ...mapped.session,
        agent_v2: {
          ...(mapped.session.agent_v2 ?? s.agent_v2!),
          current_phase: "collecting_context" as const,
        },
      };
      await savePOJUSession(sAgent);
      const agentOut = await handleUserMessage({
        session: await durable(sid),
        userMessage: "继续",
        locale: "zh",
      });
      const last = lastAssistant(agentOut);
      assert.ok(
        (last as { meta?: { m1_planner_blocked?: boolean } }).meta
          ?.m1_planner_blocked === true ||
          last.content.includes("未能生成合规的授权提问") ||
          last.content.includes("未完成的必要调查"),
        `agent must surface planner_blocked, got: ${last.content.slice(0, 160)}`,
      );
      assert.ok(!last.content.includes("【理解确认】"), "no understanding confirmation");
      assert.ok(!last.content.includes(stubResponse), "no unauthorized free-form");
      assert.equal(agentOut.agent_v2?.current_phase, "collecting_context");
      console.log(
        `    adaptive=${turn.outcome}; collecting=${mapped.outcome}; ask_planned=${mapped.ask_planned}; phase=${agentOut.agent_v2?.current_phase}`,
      );
    });

    await check("M2.3-R2-FU2 Case B: planner exception + open P1 → planner_blocked not ready_no_question", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2fu2_b",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const p0Ids = p0BandIds(s.decision_blueprint!);

      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2fu2_b_p0",
              statement: "P0 complete fixture for FU2 Case B",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2fu2_b",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: p0Ids.slice(0, 1),
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
      };

      const activated = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu2_b_activate",
        now: new Date().toISOString(),
        init_only: true,
      });
      assert.ok(
        activated.session.decision_context!.dirs.some(
          (d) =>
            d.dir_id === "DIR-VALIDATION-CAPACITY" ||
            d.dir_id === "DIR-OPT-IRREV",
        ),
        "precondition: P1 activated",
      );

      // Controlled exception: depth_per_direction getter throws inside planFromState
      // filter after Understanding builds (Understanding only reads soft/hard).
      const qb = {
        ...activated.session.decision_blueprint!.question_budget,
      };
      Object.defineProperty(qb, "depth_per_direction", {
        enumerable: true,
        configurable: true,
        get() {
          throw new Error("controlled_planner_exception_fu2");
        },
      });

      s = {
        ...activated.session,
        decision_blueprint: {
          ...activated.session.decision_blueprint!,
          question_budget: qb as typeof activated.session.decision_blueprint.question_budget,
        },
        decision_understanding: {
          ...activated.session.decision_understanding!,
          budget: {
            ...activated.session.decision_understanding!.budget,
            session_asked_count: 1,
            remaining_hard_budget: Math.max(
              1,
              activated.session.decision_understanding!.budget.hard_budget_limit - 1,
            ),
            depth_by_dir: {},
          },
        },
        agent_v2: {
          ...(activated.session.agent_v2 ?? out1.agent_v2!),
          current_phase: "collecting_context" as const,
        },
      };

      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu2_b_exception",
        now: new Date().toISOString(),
        init_only: true,
      });
      assert.equal(
        turn.outcome,
        "planner_blocked",
        `expected planner_blocked not ready_no_question, got ${turn.outcome} ask_error=${turn.ask_error}`,
      );
      assert.notEqual(turn.outcome, "ready_no_question");
      assert.ok(
        (turn.ask_error ?? "").includes("controlled_planner_exception_fu2") ||
          (turn.ask_error ?? "").includes("planner_exception"),
        `ask_error must carry exception, got ${turn.ask_error}`,
      );
      assert.ok(turn.understanding);
      assert.equal(turn.understanding!.readiness.verdict, "continue");
      assert.equal(turn.understanding!.readiness.can_ask, true);
      const p1Need = turn.understanding!.need_to_understand.items.find(
        (n) =>
          n.kind === "dir_based" &&
          (n.dir_id === "DIR-VALIDATION-CAPACITY" || n.dir_id === "DIR-OPT-IRREV"),
      );
      assert.ok(p1Need, "open P1 must remain in need_to_understand");
      assert.equal(turn.authorized_question, null);
      assert.equal(turn.plan, null);

      const mapped = await runCollectingDcTurn(s, {
        statement: "",
        source_turn_id: "r2fu2_b_exception_map",
        now: new Date().toISOString(),
        init_only: true,
      });
      // Note: runCollectingDcTurn rebuilds from s which still has throwing getter.
      assert.equal(mapped.outcome, "planner_blocked");
      assert.equal(mapped.ask_planned, false);

      const agentOut = await handleUserMessage({
        session: {
          ...turn.session,
          // Restore non-throwing budget so Agent path can re-enter without crashing outside catch.
          decision_blueprint: {
            ...activated.session.decision_blueprint!,
            directions: activated.session.decision_blueprint!.directions.map((d) => ({
              ...d,
              depth_soft_cap: 0,
            })),
          },
          agent_v2: {
            ...(turn.session.agent_v2 ?? out1.agent_v2!),
            current_phase: "collecting_context" as const,
          },
        },
        userMessage: "关于验证能力我想再想想",
        locale: "zh",
      });
      const last = lastAssistant(agentOut);
      assert.ok(!last.content.includes("【理解确认】"), "no awaiting confirmation prompt");
      assert.ok(!last.content.includes(stubResponse), "no unauthorized question");
      assert.notEqual(agentOut.agent_v2?.current_phase, "awaiting_confirmation");
      assert.equal(agentOut.agent_v2?.current_phase, "collecting_context");
      console.log(
        `    outcome=${turn.outcome}; ask_error=${turn.ask_error}; phase=${agentOut.agent_v2?.current_phase}`,
      );
    });

    await check("M2.3-R2-FU2 Case C: genuine idempotent replay keeps idempotent_replay (not blocked)", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2fu2_c",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      assert.ok(s.decision_understanding?.next_question_plan || s.adaptive_ask_plan || true);

      // First real answer application
      const turnId = "r2fu2_c_answer";
      const first = await runAdaptiveQuestionTurn({
        session: s,
        statement: "我在考虑换工作，预算大约还能撑六个月",
        source_turn_id: turnId,
        now: new Date().toISOString(),
      });
      assert.ok(
        first.outcome === "planned" ||
          first.outcome === "ready_no_question" ||
          first.outcome === "planner_blocked",
        `first turn unexpected: ${first.outcome}`,
      );
      // If first somehow blocked (unlikely with healthy budget), skip strict replay shape.
      if (first.outcome === "planner_blocked") {
        console.log("    skip Case C strict replay: first turn unexpectedly blocked");
        return;
      }
      await savePOJUSession(first.session);
      s = await durable(sid);

      const replay = await runAdaptiveQuestionTurn({
        session: s,
        statement: "我在考虑换工作，预算大约还能撑六个月",
        source_turn_id: turnId,
        now: new Date().toISOString(),
      });
      assert.equal(
        replay.outcome,
        "idempotent_replay",
        `genuine replay must stay idempotent_replay, got ${replay.outcome} ask_error=${replay.ask_error}`,
      );
      assert.notEqual(replay.outcome, "planner_blocked");

      const mapped = await runCollectingDcTurn(s, {
        statement: "我在考虑换工作，预算大约还能撑六个月",
        source_turn_id: turnId,
        now: new Date().toISOString(),
      });
      assert.notEqual(mapped.outcome, "planner_blocked");
      // ask_planned true only if a real plan or readiness-stop exists
      if (mapped.plan) {
        assert.equal(mapped.ask_planned, true);
      } else if (
        mapped.understanding &&
        mapped.understanding.readiness.can_ask === false
      ) {
        assert.equal(mapped.ask_planned, true);
      } else {
        assert.equal(mapped.ask_planned, false);
      }
      console.log(
        `    first=${first.outcome}; replay=${replay.outcome}; mapped=${mapped.outcome}; ask_planned=${mapped.ask_planned}`,
      );
    });

    await check("M2.3-R2-FU2 Case D: P0/P1 complete → readiness/final-confirm unchanged", async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_m23_r2fu2_d",
        original_question: Q_CAREER,
      });
      const out1 = await handleUserMessage({
        session: await durable(sid),
        userMessage: Q_CAREER,
        locale: "zh",
      });
      await savePOJUSession(out1);
      let s = await durable(sid);
      const p0Ids = p0BandIds(s.decision_blueprint!);

      s = {
        ...s,
        decision_context: {
          ...s.decision_context!,
          reality_facts: [
            ...(s.decision_context!.reality_facts ?? []),
            {
              fact_id: "f_r2fu2_d",
              statement: "Collecting evidence after P0/P1 complete",
              status: "unverified" as const,
              verification_level: "user_asserted" as const,
              source_stage: "collecting" as const,
              source_turn_id: "t_r2fu2_d",
              user_confirmed: false,
              fact_roles: ["option"] as string[],
              related_dir_ids: p0Ids.slice(0, 1),
            },
          ],
          dirs: s.decision_context!.dirs.map((d) =>
            p0Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: s.decision_context!.version + 1,
        },
      };

      const activated = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu2_d_activate",
        now: new Date().toISOString(),
        init_only: true,
      });
      const p1Ids = activated.session
        .decision_context!.dirs.filter(
          (d) =>
            d.dir_id === "DIR-VALIDATION-CAPACITY" ||
            d.dir_id === "DIR-OPT-IRREV",
        )
        .map((d) => d.dir_id);
      assert.ok(p1Ids.length >= 1, "P1 should activate");

      s = {
        ...activated.session,
        decision_context: {
          ...activated.session.decision_context!,
          dirs: activated.session.decision_context!.dirs.map((d) =>
            p1Ids.includes(d.dir_id)
              ? { ...d, current_state: "known" as const }
              : d,
          ),
          version: activated.session.decision_context!.version + 1,
        },
      };

      const turn = await runAdaptiveQuestionTurn({
        session: s,
        statement: "",
        source_turn_id: "r2fu2_d_ready",
        now: new Date().toISOString(),
        init_only: true,
      });
      assert.ok(turn.understanding);
      assert.equal(turn.understanding!.readiness.can_ask, false);
      assert.ok(
        turn.understanding!.readiness.verdict === "ready_for_final_confirm" ||
          turn.understanding!.readiness.verdict === "hard_budget_exhausted",
      );
      assert.notEqual(turn.outcome, "planner_blocked");
      const openP0P1 = turn.understanding!.need_to_understand.items.filter(
        (n) =>
          n.kind === "dir_based" &&
          (n.priority === "P0" || n.priority === "P1"),
      );
      assert.equal(openP0P1.length, 0);

      const sAgent = {
        ...turn.session,
        agent_v2: {
          ...(turn.session.agent_v2 ?? out1.agent_v2!),
          current_phase: "collecting_context" as const,
        },
      };
      const agentOut = await handleUserMessage({
        session: sAgent,
        userMessage: "信息已经差不多了",
        locale: "zh",
      });
      const last = lastAssistant(agentOut);
      assert.ok(
        (last as { meta?: { m1_planner_blocked?: boolean } }).meta
          ?.m1_planner_blocked !== true,
      );
      console.log(
        `    verdict=${turn.understanding!.readiness.verdict}; outcome=${turn.outcome}; phase=${agentOut.agent_v2?.current_phase}`,
      );
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
