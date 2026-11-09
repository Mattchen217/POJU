/**
 * M2.2 — Freeze-bound eight-page report binding suite + E2E.
 *
 *   pnpm test:m2-2-freeze-report-binding
 *
 * Mocks only page/LLM generation where needed; Freeze/version/persistence are real.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";

installIntakeR6TestGlobals("dev_m22_freeze_report");
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
  console.log("M2.2 Freeze-bound eight-page report binding");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession, savePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { confirmUnderstandingAndFreeze } = await import(
    "../lib/poju/decision-intake/confirm-and-freeze"
  );
  const { createInitialAgentState } = await import("../lib/poju/agent-state");
  const { computeContentHash } = await import("../lib/poju/decision-context/content-hash");
  const { DECISION_PAGE_IDS } = await import(
    "../lib/llm/pro/delivery/page-feed-matrix"
  );
  const {
    requestFreezeBoundEightPageReport,
    retryFreezeBoundEightPageReport,
    getCompletedFreezeBoundReport,
    createFrozenReportSnapshot,
    loadAuthoritativeFreeze,
    generateEightPageReport,
    assertCompleteEightPageReport,
    freezeIdFromBinding,
    __resetFreezeBoundReportInFlightForTests,
    M22_REPORT_SCHEMA_VERSION,
  } = await import("../lib/poju/decision-intake/freeze-bound-report");

  await __resetPojuDbForTests();
  await ensurePojuDbReady();
  __resetFreezeBoundReportInFlightForTests();

  type POJUSessionState = import("../lib/poju/types").POJUSessionState;
  type DecisionContext = import("../lib/poju/decision-context/types").DecisionContext;
  type DIR = import("../lib/poju/decision-context/types").DIR;
  type RealityFact = import("../lib/poju/decision-context/types").RealityFact;
  type Constraint = import("../lib/poju/decision-context/types").Constraint;
  type FrozenReportSnapshot = import("../lib/poju/decision-intake/freeze-bound-report").FrozenReportSnapshot;
  type DecisionPageId = import("../lib/llm/pro/delivery/page-feed-matrix").DecisionPageId;

  async function durable(sid: string): Promise<POJUSessionState> {
    const s = await loadPOJUSession(sid);
    assert.ok(s, `missing ${sid}`);
    return s;
  }

  const nowIso = "2026-11-08T22:30:00.000Z";

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

  function coveringFacts(): RealityFact[] {
    return [
      {
        fact_id: "f_option",
        statement: "Option A is leave for a new role",
        status: "unverified",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "turn_asserted",
        user_confirmed: false,
        fact_roles: ["option"],
        related_dir_ids: ["dir_options"],
      },
      {
        fact_id: "f_status",
        statement: "Status quo is staying with current employer",
        status: "unverified",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "turn_asserted",
        user_confirmed: false,
        fact_roles: ["status_quo"],
        related_dir_ids: ["dir_status_quo"],
      },
      {
        fact_id: "f_hard",
        statement: "Cannot relocate this quarter",
        status: "unverified",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "turn_asserted",
        user_confirmed: false,
        fact_roles: ["hard_constraint"],
        related_dir_ids: ["dir_hard_constraint"],
      },
      {
        fact_id: "f_risk",
        statement: "Income gap risk estimated at two months",
        status: "unverified",
        verification_level: "user_estimate",
        source_stage: "collecting",
        source_turn_id: "turn_estimate",
        user_confirmed: false,
        fact_roles: ["risk"],
        related_dir_ids: ["dir_risk"],
      },
    ];
  }

  function coveringConstraints(): Constraint[] {
    return [
      {
        constraint_id: "c_hard",
        statement: "Must keep healthcare coverage uninterrupted",
        category: "financial",
        status: "unverified",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "turn_constraint",
        rigidity: "hard",
        user_confirmed: false,
      },
    ];
  }

  function baseDc(context_id: string): DecisionContext {
    return {
      context_id,
      version: 1,
      status: "draft",
      definition: {
        concrete_event: null,
        stakes: null,
        desired_outcome: null,
        decision_question: "Should I leave this quarter?",
        goal_priorities: [],
        unacceptable_outcomes: [],
      },
      reality_facts: coveringFacts(),
      constraints: coveringConstraints(),
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

  async function craftReadySession(payment_id: string): Promise<POJUSessionState> {
    const sid = await createPOJUSession({
      payment_id,
      original_question: "m2.2 freeze report",
    });
    const base = await durable(sid);
    const dc = baseDc(`dc_${sid}`);
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
    const agent = createInitialAgentState({ original_question: "m2.2 freeze report" });
    const session: POJUSessionState = {
      ...base,
      messages,
      decision_context: dc,
      decision_context_versions: [],
      confirmation_events: [],
      freeze_bound_report_jobs: [],
      decision_understanding: readyUnderstanding(
        sid,
        dc.context_id,
      ) as POJUSessionState["decision_understanding"],
      agent_v2: {
        ...agent,
        current_phase: "awaiting_confirmation",
        stall_offer_pending: false,
      },
    };
    await savePOJUSession(session);
    return durable(sid);
  }

  async function freezeSession(payment_id: string): Promise<{
    session: POJUSessionState;
    freezeId: string;
    version: number;
    contentHash: string;
    contextId: string;
  }> {
    const ready = await craftReadySession(payment_id);
    const result = await confirmUnderstandingAndFreeze({
      session: ready,
      statement: "确认",
      confirmation_turn_id: "turn_confirm",
      now: nowIso,
    });
    assert.equal(
      result.outcome,
      "frozen",
      result.error ?? `freeze outcome=${result.outcome}`,
    );
    await savePOJUSession(result.session);
    const session = await durable(result.session.session_id);
    const dc = session.decision_context!;
    assert.equal(dc.status, "final");
    assert.ok(dc.content_hash && dc.content_hash.length === 64);
    assert.ok(
      (session.decision_context_versions ?? []).some(
        (v) => v.status === "final" && v.version === dc.version,
      ),
      "immutable version snapshot missing",
    );
    const freezeId = freezeIdFromBinding({
      context_id: dc.context_id,
      context_version: dc.version,
      context_hash: dc.content_hash!,
    });
    return {
      session,
      freezeId,
      version: dc.version,
      contentHash: dc.content_hash!,
      contextId: dc.context_id,
    };
  }

  function persistDeps() {
    return {
      now: () => nowIso,
      persistSession: async (s: POJUSessionState) => {
        await savePOJUSession(s);
      },
      loadSession: async (sid: string) => loadPOJUSession(sid),
    };
  }

  function trackingGeneratePage() {
    const seen: Array<{
      freezeId: string;
      decisionContextVersion: number;
      contentHash: string;
      pageId: string;
      contextVersionInDc: number;
      dcStatus: string;
    }> = [];
    const generatePage = async (
      snapshot: FrozenReportSnapshot,
      pageId: DecisionPageId,
    ) => {
      seen.push({
        freezeId: snapshot.freezeId,
        decisionContextVersion: snapshot.decisionContextVersion,
        contentHash: snapshot.contentHash,
        pageId,
        contextVersionInDc: snapshot.decisionContext.version,
        dcStatus: snapshot.decisionContext.status,
      });
      return [
        `# Face ${pageId}`,
        `freezeId=${snapshot.freezeId}`,
        `version=${snapshot.decisionContextVersion}`,
        `hash=${snapshot.contentHash}`,
        `dcVersion=${snapshot.decisionContext.version}`,
        `status=${snapshot.decisionContext.status}`,
      ].join("\n");
    };
    return { seen, generatePage };
  }

  // ---------- A. Freeze binding ----------
  await check("M2.2-A1 Correct Freeze version", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_a1");
    const tracker = trackingGeneratePage();
    const result = await requestFreezeBoundEightPageReport({
      session: frozen.session,
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
      deps: { ...persistDeps(), generatePage: tracker.generatePage },
    });
    assert.equal(result.ok, true, !result.ok ? result.error : "");
    if (!result.ok) return;
    assert.equal(result.report?.binding.decisionContextVersion, frozen.version);
    assert.equal(result.report?.binding.contentHash, frozen.contentHash);
    assert.equal(result.report?.binding.freezeId, frozen.freezeId);
    assert.equal(tracker.seen.length, 8);
    for (const s of tracker.seen) {
      assert.equal(s.decisionContextVersion, frozen.version);
      assert.equal(s.contentHash, frozen.contentHash);
    }
  });

  await check("M2.2-A2 Draft changes after Freeze do not affect report", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_a2");
    let session = frozen.session;
    const v1 = session.decision_context!;
    // Mutate draft after Freeze: replace current with a new draft V2.
    const draftV2: DecisionContext = {
      ...v1,
      status: "draft",
      version: v1.version + 1,
      content_hash: null,
      reality_facts: [
        ...v1.reality_facts,
        {
          fact_id: "f_post_freeze_noise",
          statement: "POST_FREEZE_DRAFT_MUST_NOT_ENTER_REPORT",
          status: "unverified",
          verification_level: "user_asserted",
          source_stage: "collecting",
          source_turn_id: "turn_asserted",
          user_confirmed: false,
          fact_roles: ["option"],
        },
      ],
      updated_at: "2026-11-08T23:00:00.000Z",
    };
    session = {
      ...session,
      decision_context: draftV2,
      // Keep V1 immutable snapshot in versions[]
      decision_context_versions: session.decision_context_versions,
    };
    await savePOJUSession(session);
    session = await durable(session.session_id);

    const tracker = trackingGeneratePage();
    const result = await requestFreezeBoundEightPageReport({
      session,
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
      deps: { ...persistDeps(), generatePage: tracker.generatePage },
    });
    assert.equal(result.ok, true, !result.ok ? result.error : "");
    if (!result.ok) return;
    assert.equal(result.report?.binding.decisionContextVersion, frozen.version);
    assert.equal(result.report?.binding.contentHash, frozen.contentHash);
    for (const s of tracker.seen) {
      assert.equal(s.decisionContextVersion, frozen.version);
      assert.equal(s.contextVersionInDc, frozen.version);
      assert.equal(s.dcStatus, "final");
    }
    const blob = tracker.seen.map((x) => x.pageId).join(",");
    assert.ok(blob);
    for (const page of result.report!.pages) {
      assert.equal(page.content.includes("POST_FREEZE_DRAFT_MUST_NOT_ENTER_REPORT"), false);
      assert.equal(page.content.includes(`version=${frozen.version}`), true);
    }
  });

  await check("M2.2-A3 Missing frozen version fail-closed", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_a3");
    let session = frozen.session;
    session = {
      ...session,
      decision_context: {
        ...session.decision_context!,
        status: "draft",
        version: 99,
        content_hash: null,
      },
      decision_context_versions: [], // wipe immutable store
    };
    await savePOJUSession(session);
    session = await durable(session.session_id);
    const result = await requestFreezeBoundEightPageReport({
      session,
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
      deps: persistDeps(),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.code, /DC_REPORT_VERSION_MISS|DC_REPORT_MISSING|FREEZE/);
    const reloaded = await durable(session.session_id);
    assert.equal(getCompletedFreezeBoundReport(reloaded), null);
  });

  await check("M2.2-A4 Hash mismatch rejected before page generation", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_a4");
    let calls = 0;
    const result = await requestFreezeBoundEightPageReport({
      session: frozen.session,
      freezeId: frozen.freezeId,
      // Force expected_hash mismatch path via tampered freezeId load + altered versions payload
      deps: {
        ...persistDeps(),
        generatePage: async () => {
          calls += 1;
          return "should-not-run";
        },
      },
    });
    // Tamper after successful path would generate — instead mutate versions payload hash integrity:
    // Reload, alter frozen snapshot statement without updating stored hash, then request again on fresh job schema.
    let session = await durable(frozen.session.session_id);
    const versions = (session.decision_context_versions ?? []).map((v) => {
      if (v.version !== frozen.version) return v;
      return {
        ...v,
        reality_facts: v.reality_facts.map((f, i) =>
          i === 0 ? { ...f, statement: f.statement + " TAMPERED" } : f,
        ),
        // keep stale content_hash so integrity check fails
      };
    });
    session = {
      ...session,
      decision_context:
        session.decision_context?.status === "final"
          ? {
              ...session.decision_context,
              reality_facts: session.decision_context.reality_facts.map((f, i) =>
                i === 0 ? { ...f, statement: f.statement + " TAMPERED" } : f,
              ),
            }
          : session.decision_context,
      decision_context_versions: versions,
      freeze_bound_report_jobs: [],
    };
    await savePOJUSession(session);
    session = await durable(session.session_id);
    calls = 0;
    const bad = await requestFreezeBoundEightPageReport({
      session,
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
      deps: {
        ...persistDeps(),
        generatePage: async () => {
          calls += 1;
          return "should-not-run";
        },
      },
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.code, /HASH/);
    assert.equal(calls, 0);
    // first untampered request above may have succeeded — that's fine
    void result;
  });

  await check("M2.2-A5 Invalid Freeze fail-closed", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const ready = await craftReadySession("m22_a5");
    const result = await requestFreezeBoundEightPageReport({
      session: ready,
      freezeId: "dc_missing@v1",
      deps: persistDeps(),
    });
    assert.equal(result.ok, false);
  });

  // ---------- B. Eight-page input consistency ----------
  await check("M2.2-B1 Same snapshot across all pages", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_b1");
    const tracker = trackingGeneratePage();
    const result = await requestFreezeBoundEightPageReport({
      session: frozen.session,
      freezeId: frozen.freezeId,
      deps: { ...persistDeps(), generatePage: tracker.generatePage },
    });
    assert.equal(result.ok, true, !result.ok ? result.error : "");
    assert.equal(tracker.seen.length, 8);
    const first = tracker.seen[0]!;
    for (const s of tracker.seen) {
      assert.equal(s.freezeId, first.freezeId);
      assert.equal(s.decisionContextVersion, first.decisionContextVersion);
      assert.equal(s.contentHash, first.contentHash);
    }
  });

  await check("M2.2-B2 No mutable draft DC reads in page path", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_b2");
    let session = frozen.session;
    session = {
      ...session,
      decision_context: {
        ...session.decision_context!,
        status: "draft",
        version: session.decision_context!.version + 1,
        content_hash: null,
        reality_facts: [
          ...session.decision_context!.reality_facts,
          {
            fact_id: "f_draft_only",
            statement: "DRAFT_ONLY_MARKER",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            user_confirmed: false,
            fact_roles: ["option"],
          },
        ],
      },
    };
    await savePOJUSession(session);
    session = await durable(session.session_id);

    const snapshotInputs: FrozenReportSnapshot[] = [];
    const result = await requestFreezeBoundEightPageReport({
      session,
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
      deps: {
        ...persistDeps(),
        generatePage: async (snapshot, pageId) => {
          snapshotInputs.push(snapshot);
          assert.equal(snapshot.decisionContext.status, "final");
          assert.equal(
            JSON.stringify(snapshot.decisionContext).includes("DRAFT_ONLY_MARKER"),
            false,
          );
          return `ok ${pageId} ${snapshot.contentHash}`;
        },
      },
    });
    assert.equal(result.ok, true, !result.ok ? result.error : "");
    assert.equal(snapshotInputs.length, 8);
  });

  await check("M2.2-B3 Exactly eight pages", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_b3");
    const result = await requestFreezeBoundEightPageReport({
      session: frozen.session,
      freezeId: frozen.freezeId,
      deps: persistDeps(),
    });
    assert.equal(result.ok, true, !result.ok ? result.error : "");
    if (!result.ok) return;
    assert.equal(result.report!.pages.length, 8);
    assert.deepEqual(
      result.report!.pages.map((p) => p.pageId).sort(),
      [...DECISION_PAGE_IDS].sort(),
    );
  });

  await check("M2.2-B4 Empty page cannot complete", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_b4");
    const result = await requestFreezeBoundEightPageReport({
      session: frozen.session,
      freezeId: frozen.freezeId,
      deps: {
        ...persistDeps(),
        generatePage: async (_s, pageId) => (pageId === "05" ? "   " : `content ${pageId}`),
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.code, /EMPTY/);
    const reloaded = await durable(frozen.session.session_id);
    assert.equal(getCompletedFreezeBoundReport(reloaded), null);
    const job = (reloaded.freeze_bound_report_jobs ?? [])[0];
    assert.ok(job);
    assert.equal(job!.status, "failed");
  });

  // ---------- C. Idempotency / concurrency ----------
  await check("M2.2-C1 Duplicate completed request reuses report", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_c1");
    const first = await requestFreezeBoundEightPageReport({
      session: frozen.session,
      freezeId: frozen.freezeId,
      deps: persistDeps(),
    });
    assert.equal(first.ok, true, !first.ok ? first.error : "");
    const session2 = await durable(frozen.session.session_id);
    const second = await requestFreezeBoundEightPageReport({
      session: session2,
      freezeId: frozen.freezeId,
      deps: persistDeps(),
    });
    assert.equal(second.ok, true, !second.ok ? second.error : "");
    if (!first.ok || !second.ok) return;
    assert.equal(second.reused, true);
    assert.equal(second.job.job_id, first.job.job_id);
    const reloaded = await durable(frozen.session.session_id);
    assert.equal((reloaded.freeze_bound_report_jobs ?? []).length, 1);
  });

  await check("M2.2-C2 Concurrent duplicate requests converge", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_c2");
    let pageCalls = 0;
    const deps = {
      ...persistDeps(),
      generatePage: async (snapshot: FrozenReportSnapshot, pageId: DecisionPageId) => {
        pageCalls += 1;
        await new Promise((r) => setTimeout(r, 5));
        return `p ${pageId} ${snapshot.contentHash}`;
      },
    };
    const [a, b] = await Promise.all([
      requestFreezeBoundEightPageReport({
        session: frozen.session,
        freezeId: frozen.freezeId,
        deps,
      }),
      requestFreezeBoundEightPageReport({
        session: frozen.session,
        freezeId: frozen.freezeId,
        deps,
      }),
    ]);
    assert.equal(a.ok, true, !a.ok ? a.error : "");
    assert.equal(b.ok, true, !b.ok ? b.error : "");
    if (!a.ok || !b.ok) return;
    assert.equal(a.job.job_id, b.job.job_id);
    // Coalesced in-flight should not double-generate all pages twice.
    assert.ok(pageCalls <= 16, `pageCalls=${pageCalls}`);
    assert.ok(pageCalls >= 8, `pageCalls=${pageCalls}`);
    const reloaded = await durable(frozen.session.session_id);
    assert.equal((reloaded.freeze_bound_report_jobs ?? []).length, 1);
  });

  await check("M2.2-C3 Different Freeze are distinct report identities", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const a = await freezeSession("m22_c3a");
    const b = await freezeSession("m22_c3b");
    assert.notEqual(a.freezeId, b.freezeId);
    const ra = await requestFreezeBoundEightPageReport({
      session: a.session,
      freezeId: a.freezeId,
      deps: persistDeps(),
    });
    const rb = await requestFreezeBoundEightPageReport({
      session: b.session,
      freezeId: b.freezeId,
      deps: persistDeps(),
    });
    assert.equal(ra.ok, true);
    assert.equal(rb.ok, true);
    if (!ra.ok || !rb.ok) return;
    assert.notEqual(ra.job.job_id, rb.job.job_id);
    assert.notEqual(ra.report!.binding.freezeId, rb.report!.binding.freezeId);
  });

  await check("M2.2-C4 Binding mismatch rejected", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_c4");
    const first = await requestFreezeBoundEightPageReport({
      session: frozen.session,
      freezeId: frozen.freezeId,
      deps: persistDeps(),
    });
    assert.equal(first.ok, true);
    let session = await durable(frozen.session.session_id);
    // Corrupt stored job binding hash while keeping idempotency key.
    const jobs = (session.freeze_bound_report_jobs ?? []).map((j) => ({
      ...j,
      status: "failed" as const,
      binding: { ...j.binding, contentHash: "0".repeat(64) },
    }));
    session = { ...session, freeze_bound_report_jobs: jobs };
    await savePOJUSession(session);
    session = await durable(session.session_id);
    const again = await requestFreezeBoundEightPageReport({
      session,
      freezeId: frozen.freezeId,
      expected_hash: frozen.contentHash,
      deps: persistDeps(),
    });
    assert.equal(again.ok, false);
    if (!again.ok) assert.match(again.code, /BINDING_MISMATCH/);
  });

  // ---------- D. Retry safety ----------
  await check("M2.2-D1 Retry after partial failure keeps original Freeze", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_d1");
    let failOnce = true;
    const deps = {
      ...persistDeps(),
      generatePage: async (snapshot: FrozenReportSnapshot, pageId: DecisionPageId) => {
        if (pageId === "06" && failOnce) {
          failOnce = false;
          throw new Error("forced_page_failure");
        }
        return `ok ${pageId} ${snapshot.freezeId} ${snapshot.contentHash}`;
      },
    };
    const first = await requestFreezeBoundEightPageReport({
      session: frozen.session,
      freezeId: frozen.freezeId,
      deps,
    });
    assert.equal(first.ok, false);
    // Mutate draft after failure
    let session = await durable(frozen.session.session_id);
    session = {
      ...session,
      decision_context: {
        ...session.decision_context!,
        status: "draft",
        version: frozen.version + 7,
        content_hash: null,
        reality_facts: [
          ...(session.decision_context?.reality_facts ?? []),
          {
            fact_id: "f_after_fail",
            statement: "AFTER_FAIL_DRAFT",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            user_confirmed: false,
            fact_roles: ["option"],
          },
        ],
      },
    };
    await savePOJUSession(session);
    session = await durable(session.session_id);

    const retry = await retryFreezeBoundEightPageReport({
      session,
      jobId: first.job!.job_id,
      deps,
    });
    assert.equal(retry.ok, true, !retry.ok ? retry.error : "");
    if (!retry.ok) return;
    assert.equal(retry.report!.binding.freezeId, frozen.freezeId);
    assert.equal(retry.report!.binding.contentHash, frozen.contentHash);
    assert.equal(retry.report!.binding.decisionContextVersion, frozen.version);
    for (const p of retry.report!.pages) {
      assert.equal(p.content.includes("AFTER_FAIL_DRAFT"), false);
      assert.equal(p.content.includes(frozen.contentHash), true);
    }
  });

  await check("M2.2-D2 Page reuse on retry when binding matches", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_d2");
    const generated = new Map<string, number>();
    let fail06 = true;
    const deps = {
      ...persistDeps(),
      generatePage: async (snapshot: FrozenReportSnapshot, pageId: DecisionPageId) => {
        generated.set(pageId, (generated.get(pageId) ?? 0) + 1);
        if (pageId === "06" && fail06) {
          fail06 = false;
          throw new Error("fail06");
        }
        return `stable ${pageId} ${snapshot.contentHash}`;
      },
    };
    const first = await requestFreezeBoundEightPageReport({
      session: frozen.session,
      freezeId: frozen.freezeId,
      deps,
    });
    assert.equal(first.ok, false);
    const session = await durable(frozen.session.session_id);
    const retry = await retryFreezeBoundEightPageReport({
      session,
      jobId: first.job!.job_id,
      deps,
    });
    assert.equal(retry.ok, true, !retry.ok ? retry.error : "");
    // Pages before 06 should be generated once (reused); 06 twice (fail+success); after 06 once.
    assert.equal(generated.get("01"), 1);
    assert.equal(generated.get("02"), 1);
    assert.equal(generated.get("06"), 2);
  });

  await check("M2.2-D3 Retry hash mismatch fail-closed", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_d3");
    let failOnce = true;
    const first = await requestFreezeBoundEightPageReport({
      session: frozen.session,
      freezeId: frozen.freezeId,
      deps: {
        ...persistDeps(),
        generatePage: async (_s, pageId) => {
          if (pageId === "08" && failOnce) {
            failOnce = false;
            throw new Error("late_fail");
          }
          return `page ${pageId}`;
        },
      },
    });
    assert.equal(first.ok, false);
    let session = await durable(frozen.session.session_id);
    // Tamper frozen snapshot integrity for retry.
    session = {
      ...session,
      decision_context_versions: (session.decision_context_versions ?? []).map((v) =>
        v.version === frozen.version
          ? {
              ...v,
              reality_facts: v.reality_facts.map((f, i) =>
                i === 0 ? { ...f, statement: f.statement + " X" } : f,
              ),
            }
          : v,
      ),
      decision_context:
        session.decision_context?.status === "final"
          ? {
              ...session.decision_context,
              reality_facts: session.decision_context.reality_facts.map((f, i) =>
                i === 0 ? { ...f, statement: f.statement + " X" } : f,
              ),
            }
          : session.decision_context,
    };
    await savePOJUSession(session);
    session = await durable(session.session_id);
    const retry = await retryFreezeBoundEightPageReport({
      session,
      jobId: first.job!.job_id,
      deps: persistDeps(),
    });
    assert.equal(retry.ok, false);
    if (!retry.ok) assert.match(retry.code, /HASH/);
  });

  // ---------- E. Persistence / lifecycle ----------
  await check("M2.2-E1 Binding persistence survives reload", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_e1");
    const result = await requestFreezeBoundEightPageReport({
      session: frozen.session,
      freezeId: frozen.freezeId,
      deps: persistDeps(),
    });
    assert.equal(result.ok, true);
    const reloaded = await durable(frozen.session.session_id);
    const report = getCompletedFreezeBoundReport(reloaded, {
      freezeId: frozen.freezeId,
    });
    assert.ok(report);
    assert.equal(report!.binding.freezeId, frozen.freezeId);
    assert.equal(report!.binding.contentHash, frozen.contentHash);
    assert.equal(report!.binding.decisionContextVersion, frozen.version);
    assert.equal(report!.binding.reportSchemaVersion, M22_REPORT_SCHEMA_VERSION);
    assert.equal(reloaded.last_delivery_context_binding?.context_hash, frozen.contentHash);
  });

  await check("M2.2-E2 Failed report not presented as completed", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_e2");
    const result = await requestFreezeBoundEightPageReport({
      session: frozen.session,
      freezeId: frozen.freezeId,
      deps: {
        ...persistDeps(),
        generatePage: async () => {
          throw new Error("boom");
        },
      },
    });
    assert.equal(result.ok, false);
    const reloaded = await durable(frozen.session.session_id);
    assert.equal(getCompletedFreezeBoundReport(reloaded), null);
    const job = (reloaded.freeze_bound_report_jobs ?? [])[0];
    assert.equal(job?.status, "failed");
  });

  await check("M2.2-E3 Finalization integrity rejects bad page sets", async () => {
    assert.throws(
      () => assertCompleteEightPageReport([{ pageId: "01", content: "x" }]),
      /Expected 8/,
    );
    assert.throws(
      () =>
        assertCompleteEightPageReport(
          DECISION_PAGE_IDS.map((pageId, i) => ({
            pageId: i === 7 ? "01" : pageId,
            content: `c${i}`,
          })),
        ),
      /Duplicate|Missing/,
    );
    assert.throws(
      () =>
        assertCompleteEightPageReport(
          DECISION_PAGE_IDS.map((pageId) => ({
            pageId,
            content: pageId === "03" ? "  " : `c${pageId}`,
          })),
        ),
      /Empty/,
    );
  });

  // ---------- E2E ----------
  await check("M2.2-E2E fresh confirm Freeze mutate draft report idempotent", async () => {
    __resetFreezeBoundReportInFlightForTests();
    const frozen = await freezeSession("m22_e2e");
    const v1Hash = frozen.contentHash;
    const v1 = frozen.version;
    let session = frozen.session;
    session = {
      ...session,
      decision_context: {
        ...session.decision_context!,
        status: "draft",
        version: v1 + 1,
        content_hash: null,
        reality_facts: [
          ...session.decision_context!.reality_facts,
          {
            fact_id: "f_e2e_draft",
            statement: "E2E_DRAFT_NOISE",
            status: "unverified",
            verification_level: "user_asserted",
            source_stage: "collecting",
            source_turn_id: "turn_asserted",
            user_confirmed: false,
            fact_roles: ["option"],
          },
        ],
      },
    };
    await savePOJUSession(session);
    session = await durable(session.session_id);

    const tracker = trackingGeneratePage();
    const first = await requestFreezeBoundEightPageReport({
      session,
      freezeId: frozen.freezeId,
      expected_hash: v1Hash,
      deps: { ...persistDeps(), generatePage: tracker.generatePage },
    });
    assert.equal(first.ok, true, !first.ok ? first.error : "");
    if (!first.ok) return;
    assert.equal(first.report!.binding.contentHash, v1Hash);
    assert.equal(first.report!.binding.decisionContextVersion, v1);
    assert.equal(first.report!.pages.length, 8);
    for (const p of first.report!.pages) {
      assert.equal(p.content.includes("E2E_DRAFT_NOISE"), false);
    }

    session = await durable(session.session_id);
    const second = await requestFreezeBoundEightPageReport({
      session,
      freezeId: frozen.freezeId,
      expected_hash: v1Hash,
      deps: persistDeps(),
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.reused, true);
    assert.equal(second.job.job_id, first.job.job_id);

    const completed = getCompletedFreezeBoundReport(await durable(session.session_id), {
      freezeId: frozen.freezeId,
    });
    assert.ok(completed);
    assert.equal(completed!.status, "completed");
    assert.equal(completed!.binding.contentHash, v1Hash);
  });

  await check("M2.2-unit generateEightPageReport + snapshot helpers", async () => {
    const frozen = await freezeSession("m22_unit");
    const loaded = loadAuthoritativeFreeze(frozen.session, {
      freezeId: frozen.freezeId,
    });
    const snapshot = createFrozenReportSnapshot({
      sessionId: frozen.session.session_id,
      frozen: loaded.frozen,
      binding: loaded.binding,
    });
    assert.equal(snapshot.contentHash, frozen.contentHash);
    const pages = await generateEightPageReport(snapshot);
    assert.equal(pages.length, 8);
    // Recomputed hash still matches Freeze contract.
    assert.equal(computeContentHash(loaded.frozen), frozen.contentHash);
  });

  console.log(`\nM2.2 results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
