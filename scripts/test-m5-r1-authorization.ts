/**
 * M5-R1 — report charge authorization and client job binding.
 *
 *   pnpm test:m5-r1-authorization
 *
 * Real: the route body (`handleDecisionReportAction`, JSON round-trip through a fetch
 * stub), service / runner / dispatch / store, the charge authorization state machine
 * and execution grants, execution fence, continue lease, dispatch marker, the legacy
 * stage router, M4 Freeze authority (in-process transport), production device Freeze
 * wire, session-manager CAS writes on IndexedDB (fake-indexeddb), the browser client.
 * Replaced: the model network call (test hooks feed raw JSON into the production
 * validators), the background host (`after()` → run / drop / queue), and the pass
 * charge — a ledger stub with the consume RPC's semantics: idempotent on the ref
 * (`already_consumed` before the balance check), one debit per new ref, refusal on an
 * empty balance; it can be paused, can lose its answer after debiting (RPC error) or
 * fail before reaching the ledger.
 * Storage: process-memory KV (`durableKv()` MemoryKv / ephemeral MemoryKv) with
 * method patches for write faults. This is NOT an Upstash, Supabase RPC, real HTTP,
 * real Inngest/QStash, multi-browser or real OpenRouter validation.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";

import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import {
  di2AnalysisJson,
  di2Blueprint,
  di2ConfirmationEvents,
  di2DraftDc,
  di2PageJson,
  DI2_FIXTURE_BIRTH,
  DI2_FIXTURE_QUESTION,
} from "./fixtures/di2-report-fixture";

installIntakeR6TestGlobals("dev_m5_r1_authorization");

const ENDPOINT = "/api/poju/decision-report";

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

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function until(pred: () => boolean, label: string, ms = 5_000): Promise<void> {
  const t0 = Date.now();
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 1));
  }
}

async function main() {
  console.log("M5-R1 — report charge authorization & client job binding");

  const { kv, durableKv } = await import("../lib/kv/client");
  const { runWithEphemeralXhighKv, getXhighJob, findLatestXhighJobForSession } = await import(
    "../lib/poju/xhigh-job-store"
  );
  const pa = await import("../lib/poju/decision-intake/personal-analysis");
  const pagesMod = await import("../lib/poju/decision-intake/decision-report-pages");
  const store = await import("../lib/poju/decision-intake/decision-report-store");
  const service = await import("../lib/poju/decision-intake/decision-report-service");
  const runner = await import("../lib/poju/decision-intake/decision-report-runner");
  const dispatch = await import("../lib/poju/decision-intake/decision-report-dispatch");
  const api = await import("../lib/poju/decision-intake/decision-report-api");
  const auth = await import("../lib/poju/decision-intake/decision-report-charge");
  const client = await import("../lib/poju/decision-intake/decision-report-client");
  const fdRunner = await import("../lib/poju/final-delivery-stage-runner");
  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const sm = await import("../lib/poju/session-manager");
  const wire = await import("../lib/poju/decision-context/production-freeze-wire");

  type POJUSessionState = import("../lib/poju/types").POJUSessionState;
  type DecisionPageId = import("../lib/llm/pro/delivery/page-feed-matrix").DecisionPageId;
  type JobInput = import("../lib/poju/decision-intake/decision-report-types").DecisionReportJobInput;
  type ApiDeps = import("../lib/poju/decision-intake/decision-report-api").DecisionReportApiDeps;
  type ChargeAuthorization = import("../lib/poju/decision-intake/decision-report-charge").ChargeAuthorization;
  type Json = Record<string, unknown>;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  // ─── model hooks (network replacement only) ───────────────────────────────

  let analysisCalls = 0;
  const pageCalls: DecisionPageId[] = [];
  let onAnalysisCall: (() => Promise<void>) | null = null;
  pa.__setPersonalAnalysisModelForTests(async () => {
    analysisCalls += 1;
    if (onAnalysisCall) await onAnalysisCall();
    return { content: di2AnalysisJson(), model: "test-hook", tokens_used: 10 };
  });
  pagesMod.__setDecisionReportPageModelForTests(async ({ pageId }) => {
    pageCalls.push(pageId);
    return { content: di2PageJson(pageId), model: "test-hook", tokens_used: 5 };
  });

  // ─── pass ledger stub (consume RPC semantics) ─────────────────────────────

  type ChargeMode = "ok" | "rpc_error_after_debit" | "throw_before_debit";
  const ledger = {
    balance: 0,
    consumed: new Set<string>(),
    debits: [] as string[],
    calls: [] as string[],
    modes: [] as ChargeMode[],
    gates: [] as Array<Promise<void>>,
  };
  const passRefusal = () =>
    new Response(JSON.stringify({ ok: false, error: "pass_required", reason: "insufficient_balance" }), {
      status: 402,
      headers: { "content-type": "application/json" },
    });

  // ─── background host (the route's `after()`) ─────────────────────────────

  type BgMode = "run" | "drop" | "queue";
  const bg = { mode: "run" as BgMode, hosted: 0, queue: [] as Array<() => Promise<void>> };
  const inflight = new Set<Promise<void>>();
  const deps: ApiDeps = {
    background: (task) => {
      bg.hosted += 1;
      if (bg.mode === "drop") return;
      if (bg.mode === "queue") {
        bg.queue.push(task);
        return;
      }
      const p: Promise<void> = new Promise<void>((r) => setTimeout(r, 0)).then(task);
      inflight.add(p);
      void p.finally(() => inflight.delete(p));
    },
    attachWaitMs: 50,
    charge: async ({ sessionId, jointPassRef }) => {
      const ref = jointPassRef || sessionId;
      ledger.calls.push(ref);
      const gate = ledger.gates.shift();
      if (gate) await gate;
      const mode = ledger.modes.shift() ?? "ok";
      if (mode === "throw_before_debit") throw new Error("test: pass service unreachable");
      if (!ledger.consumed.has(ref)) {
        if (ledger.balance < 1) return { ok: false, response: passRefusal() };
        ledger.balance -= 1;
        ledger.consumed.add(ref);
        ledger.debits.push(ref);
      }
      if (mode === "rpc_error_after_debit") return { ok: false, uncertain: true, response: passRefusal() };
      return { ok: true };
    },
    modelConfigured: () => true,
  };
  async function drain(): Promise<void> {
    while (inflight.size) await Promise.all([...inflight]);
  }

  // ─── fetch → route body (JSON round-trip) ─────────────────────────────────

  let tamperStatus: ((p: Json) => Json) | null = null;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url !== ENDPOINT) throw new Error(`unexpected fetch ${url}`);
    const body = JSON.parse(String(init?.body ?? "{}")) as Json;
    const reply = await api.handleDecisionReportAction(body, deps);
    if (reply.kind === "response") return reply.response;
    let out = JSON.parse(JSON.stringify(reply.body)) as Json;
    if (tamperStatus && body.action === "status") out = tamperStatus(out);
    return new Response(JSON.stringify(out), { status: reply.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  async function call(body: Json): Promise<{ status: number; body: Json }> {
    const r = await fetch(ENDPOINT, { method: "POST", body: JSON.stringify(body) });
    return { status: r.status, body: (await r.json()) as Json };
  }

  // ─── device Session: draft → production Freeze wire → server receipts ────

  async function deviceSession(tag: string): Promise<POJUSessionState> {
    const sid = await sm.createPOJUSession({ payment_id: `pay_r1_${tag}`, original_question: DI2_FIXTURE_QUESTION });
    const s = (await sm.loadPOJUSession(sid))!;
    const dc = di2DraftDc(`ctx_r1_${tag}`);
    await sm.savePOJUSessionCore({
      ...s,
      decision_blueprint: di2Blueprint(sid, dc),
      confirmation_events: di2ConfirmationEvents(dc),
      selected_stored_profile_id: "p_r1",
      has_profile: true,
      decision_context: dc,
    } as POJUSessionState);
    const r = await wire.ensureSessionFrozenForDelivery((await sm.loadPOJUSession(sid))!, {
      trigger: "sufficiency_end_confirm",
      profile: { profile_id: "p_r1", birth_info: DI2_FIXTURE_BIRTH },
    });
    assert.ok(r.ok && !r.skipped, JSON.stringify(r).slice(0, 400));
    return (await sm.loadPOJUSession(sid))!;
  }

  function startBody(s: POJUSessionState, regenerate = false, joint_pass_ref?: string): Json {
    return {
      action: "start",
      session_id: s.session_id,
      locale: "zh",
      regenerate,
      writer_token: s.dc_ledger!.writer_token,
      freeze_receipt: s.dc_freeze_receipts![0],
      profile_receipt: s.dc_profile_receipts![0],
      ...(joint_pass_ref ? { joint_pass_ref } : {}),
    };
  }

  async function statusOf(s: POJUSessionState, job_id: string): Promise<Json> {
    return (await call({ action: "status", session_id: s.session_id, job_id })).body;
  }

  async function latestJobId(s: POJUSessionState): Promise<string> {
    const j = await findLatestXhighJobForSession("decision_report", s.session_id);
    assert.ok(j, "job exists");
    return j!.job_id;
  }

  async function authOf(s: POJUSessionState): Promise<ChargeAuthorization | null> {
    return auth.loadChargeAuthorization(s.session_id);
  }

  /** Nothing of this job ran: no model call, no analysis, no page, no completed record. */
  async function assertNeverRan(s: POJUSessionState, job_id: string): Promise<void> {
    assert.equal(analysisCalls, 0, "no Personal Analysis call");
    assert.equal(pageCalls.length, 0, "no page call");
    const job = await getXhighJob(job_id);
    const input = job?.input as JobInput | undefined;
    if (input) assert.equal(await store.loadAnalysis(input.analysis_key), null, "no analysis record");
    assert.equal((await store.loadAllPages(job_id)).length, 0, "no page record");
    assert.equal(await store.loadCompletedReport(s.session_id, job_id), null, "no completed record");
    assert.notEqual(job?.status, "completed");
  }

  /** The claim's request died: its claim ages past the takeover window. */
  async function ageClaim(s: POJUSessionState): Promise<void> {
    const key = auth.di2ChargeAuthorizationKey(s.session_id);
    const rec = (await durableKv().get<ChargeAuthorization>(key))!;
    assert.equal(rec.state, "pending");
    await durableKv().set(key, { ...rec, claimed_at: Date.now() - auth.DI2_CHARGE_CLAIM_MS - 1 }, { ex: 3600 });
  }

  function reset(balance: number): void {
    analysisCalls = 0;
    pageCalls.length = 0;
    onAnalysisCall = null;
    bg.mode = "run";
    bg.hosted = 0;
    bg.queue.length = 0;
    tamperStatus = null;
    ledger.balance = balance;
    ledger.calls.length = 0;
    ledger.debits.length = 0;
    ledger.modes.length = 0;
    ledger.gates.length = 0;
  }

  await runWithEphemeralXhighKv(
    async () => {
      // ═══ A1 / A4 — failed-charge race ═══════════════════════════════════════

      await check("R1-01 failed-charge race: B reuses during A's charge → no dispatch; A refused → job never runs, queued worker refused", async () => {
        reset(0);
        const s = await deviceSession("r01");
        const gate = deferred();
        ledger.gates.push(gate.promise);
        const pA = call(startBody(s));
        await until(() => ledger.calls.length === 1, "A inside the charge");
        const job_id = await latestJobId(s);
        assert.equal((await authOf(s))?.state, "pending");

        const rB = await call(startBody(s));
        assert.equal(rB.status, 200, JSON.stringify(rB.body));
        assert.equal(rB.body.job_id, job_id);
        assert.equal(rB.body.reused, true);
        assert.equal(rB.body.worker, "awaiting_charge");
        const cB = await call({ action: "continue", session_id: s.session_id, job_id });
        assert.equal(cB.body.code, "CHARGE_PENDING", JSON.stringify(cB.body));
        assert.equal(bg.hosted, 0, "nothing dispatched while the charge is pending");
        assert.equal(await store.loadDecisionReportDispatch(job_id), null, "no dispatch marker");
        assert.equal(ledger.calls.length, 1, "B did not open a second charge");

        // A worker that reached the job before the charge settled (relay redelivery).
        await runner.runDecisionReportStage(job_id, "finalize");
        assert.equal(analysisCalls, 0, "unauthorized worker refused at entry");

        gate.resolve();
        const rA = await pA;
        assert.equal(rA.status, 402);
        assert.equal(rA.body.error, "pass_required");
        const job = await getXhighJob(job_id);
        assert.equal(job?.status, "failed");
        assert.equal(job?.failure_reason, "charge_refused");
        assert.equal(job?.retryable, false);
        assert.equal((await authOf(s))?.state, "refused");
        assert.equal((await auth.verifyDecisionReportExecution(job!)).ok, false);

        // A previously queued worker starts after the refusal.
        await runner.runDecisionReportStage(job_id, "finalize");
        await runner.runDecisionReportStage(job_id, "segments");
        await runner.runDecisionReportStage(job_id, "assemble");
        const cAfter = await call({ action: "continue", session_id: s.session_id, job_id });
        assert.equal(cAfter.status, 402);
        assert.equal(cAfter.body.code, "CHARGE_REFUSED");
        assert.equal(bg.hosted, 0);
        assert.equal(ledger.debits.length, 0, "nothing debited");
        await assertNeverRan(s, job_id);
        const st = await statusOf(s, job_id);
        assert.equal(st.status, "failed");
        assert.equal(st.retryable, false);
      });

      await check("R1-02 success race: A charges and confirms, B reuses → one worker, one pass, report completes", async () => {
        reset(1);
        const s = await deviceSession("r02");
        const gate = deferred();
        ledger.gates.push(gate.promise);
        const pA = call(startBody(s));
        await until(() => ledger.calls.length === 1, "A inside the charge");
        const job_id = await latestJobId(s);
        const rB = await call(startBody(s));
        assert.equal(rB.body.worker, "awaiting_charge");
        assert.equal(bg.hosted, 0);

        gate.resolve();
        const rA = await pA;
        assert.equal(rA.status, 200, JSON.stringify(rA.body));
        assert.equal(rA.body.job_id, job_id);
        assert.equal((await authOf(s))?.state, "authorized");
        // B's driver asks for a worker: the live one is kept.
        const cB = await call({ action: "continue", session_id: s.session_id, job_id });
        assert.equal(cB.body.ok, true, JSON.stringify(cB.body));
        assert.notEqual(cB.body.worker, "dispatched");
        await drain();
        assert.equal((await getXhighJob(job_id))?.status, "completed");
        assert.ok(await store.loadCompletedReport(s.session_id, job_id));
        assert.equal(bg.hosted, 1, "one worker hosted");
        assert.equal(analysisCalls, 1);
        assert.equal(new Set(pageCalls).size, pageCalls.length, "no page ran twice");
        assert.deepEqual(ledger.debits, [s.session_id], "one pass for the session");
        assert.equal(ledger.calls.length, 1);
      });

      // ═══ A3 — Regenerate is free only after a confirmed charge ════════════════

      await check("R1-03 Regenerate after a failed first charge is charged; free only once authorized", async () => {
        reset(0);
        const s = await deviceSession("r03");
        const r1 = await call(startBody(s));
        assert.equal(r1.status, 402);
        const j1 = await latestJobId(s);
        assert.equal((await getXhighJob(j1))?.failure_reason, "charge_refused");

        const r2 = await call(startBody(s, true));
        assert.equal(r2.status, 402, "a prior job is not a prior charge");
        assert.equal(ledger.calls.length, 2, "Regenerate went through the charge");
        const j2 = await latestJobId(s);
        assert.notEqual(j2, j1);
        assert.equal((await getXhighJob(j2))?.failure_reason, "charge_refused");
        assert.equal(bg.hosted, 0);
        assert.equal(analysisCalls, 0);

        ledger.balance = 1;
        const r3 = await call(startBody(s, true));
        assert.equal(r3.status, 200, JSON.stringify(r3.body));
        await drain();
        const j3 = r3.body.job_id as string;
        assert.equal((await getXhighJob(j3))?.status, "completed");
        assert.deepEqual(ledger.debits, [s.session_id]);

        const callsBefore = ledger.calls.length;
        const r4 = await call(startBody(s, true));
        assert.equal(r4.status, 200);
        await drain();
        assert.equal((await getXhighJob(r4.body.job_id as string))?.status, "completed");
        assert.equal(ledger.calls.length, callsBefore, "Regenerate after a confirmed charge is free");
        assert.deepEqual(ledger.debits, [s.session_id], "still one pass");
      });

      await check("R1-04 Regenerate with an existing authorized record is free (no charge call)", async () => {
        reset(1);
        const s = await deviceSession("r04");
        const r1 = await call(startBody(s));
        await drain();
        assert.equal((await getXhighJob(r1.body.job_id as string))?.status, "completed");
        const calls = ledger.calls.length;
        const r2 = await call(startBody(s, true));
        assert.equal(r2.status, 200);
        assert.equal(r2.body.reused, false);
        await drain();
        assert.equal((await getXhighJob(r2.body.job_id as string))?.status, "completed");
        assert.equal(ledger.calls.length, calls);
        assert.equal(ledger.debits.length, 1);
      });

      // ═══ A2 — authorization record states ═════════════════════════════════════

      await check("R1-05 charge succeeded but the authorization write failed → nothing runs; reconcile with the same ref, no second debit", async () => {
        reset(1);
        const s = await deviceSession("r05");
        const key = auth.di2ChargeAuthorizationKey(s.session_id);
        const d = durableKv() as unknown as {
          compareAndSetExact: (k: string, e: string | null, n: unknown, o?: { ex?: number }) => Promise<boolean>;
        };
        const orig = d.compareAndSetExact;
        let lost = 0;
        d.compareAndSetExact = async function patched(k, e, n, o) {
          if (k === key && (n as ChargeAuthorization).state === "authorized" && lost === 0) {
            lost += 1;
            throw new Error("test: KV write lost");
          }
          return orig.call(durableKv(), k, e, n, o);
        };
        let r1;
        try {
          r1 = await call(startBody(s));
        } finally {
          d.compareAndSetExact = orig;
        }
        assert.equal(lost, 1);
        assert.equal(r1.status, 503, JSON.stringify(r1.body));
        assert.equal(r1.body.code, "CHARGE_UNCONFIRMED");
        assert.deepEqual(ledger.debits, [s.session_id], "the pass was debited");
        const job_id = await latestJobId(s);
        assert.equal((await authOf(s))?.state, "pending", "record never reached authorized");
        assert.equal(bg.hosted, 0);
        await runner.runDecisionReportStage(job_id, "finalize");
        assert.equal(analysisCalls, 0, "unconfirmed charge → worker refused");

        const r2 = await call(startBody(s));
        assert.equal(r2.body.worker, "awaiting_charge", "live claim: wait, do not charge");
        assert.equal(ledger.calls.length, 1);

        await ageClaim(s);
        const r3 = await call(startBody(s));
        assert.equal(r3.status, 200, JSON.stringify(r3.body));
        assert.equal(ledger.calls.length, 2, "reconciled through the ledger");
        assert.deepEqual(ledger.calls, [s.session_id, s.session_id], "same idempotency ref");
        assert.deepEqual(ledger.debits, [s.session_id], "no second debit");
        assert.equal((await authOf(s))?.state, "authorized");
        await drain();
        assert.equal((await getXhighJob(job_id))?.status, "completed");
        assert.equal(analysisCalls, 1);
      });

      await check("R1-06 uncertain → reconciled: RPC error after debit (start) and failure before the ledger (continue); stored ref wins", async () => {
        reset(1);
        const s = await deviceSession("r06a");
        ledger.modes.push("rpc_error_after_debit");
        const r1 = await call(startBody(s, false, "joint:r06-first"));
        assert.equal(r1.status, 503);
        assert.equal(r1.body.code, "CHARGE_UNCONFIRMED");
        assert.equal((await authOf(s))?.state, "uncertain");
        assert.equal((await authOf(s))?.charge_ref, "joint:r06-first");
        const job_id = await latestJobId(s);
        await runner.runDecisionReportStage(job_id, "finalize");
        assert.equal(analysisCalls, 0);
        assert.equal(bg.hosted, 0);
        // A later start with another joint ref still reconciles the stored ref.
        const r2 = await call(startBody(s, false, "joint:r06-other"));
        assert.equal(r2.status, 200, JSON.stringify(r2.body));
        assert.deepEqual(ledger.calls, ["joint:r06-first", "joint:r06-first"]);
        assert.deepEqual(ledger.debits, ["joint:r06-first"], "one debit");
        await drain();
        assert.equal((await getXhighJob(job_id))?.status, "completed");

        reset(1);
        const t = await deviceSession("r06b");
        ledger.modes.push("throw_before_debit");
        const q1 = await call(startBody(t));
        assert.equal(q1.body.code, "CHARGE_UNCONFIRMED");
        assert.equal(ledger.debits.length, 0);
        const tj = await latestJobId(t);
        const c = await call({ action: "continue", session_id: t.session_id, job_id: tj });
        assert.equal(c.body.ok, true, JSON.stringify(c.body));
        assert.equal(c.body.worker, "dispatched");
        assert.deepEqual(ledger.debits, [t.session_id], "first real debit, once");
        await drain();
        assert.equal((await getXhighJob(tj))?.status, "completed");
      });

      await check("R1-07 concurrent starts enter the charge boundary → one charge call, one job, one worker", async () => {
        reset(5);
        const s = await deviceSession("r07");
        const gate = deferred();
        ledger.gates.push(gate.promise);
        const pA = call(startBody(s));
        const pB = call(startBody(s));
        await until(() => ledger.calls.length === 1, "one request inside the charge");
        await Promise.race([pA, pB]);
        gate.resolve();
        const [rA, rB] = await Promise.all([pA, pB]);
        const bodies = [rA.body, rB.body];
        assert.equal(ledger.calls.length, 1, JSON.stringify(bodies));
        assert.deepEqual(ledger.debits, [s.session_id]);
        const ids = new Set(bodies.map((b) => b.job_id).filter(Boolean));
        assert.equal(ids.size, 1, "one job");
        assert.ok(
          bodies.some((b) => b.worker === "awaiting_charge" || b.code === "REPORT_JOB_BUSY"),
          JSON.stringify(bodies),
        );
        await drain();
        const job_id = [...ids][0] as string;
        assert.equal((await getXhighJob(job_id))?.status, "completed");
        assert.equal(bg.hosted, 1);
        assert.equal(analysisCalls, 1);
      });

      await check("R1-08 settle state machine: five concurrent settles → one charge; others pending; then authorized without a call", async () => {
        reset(0);
        const sid = "r1_settle_concurrency";
        let calls = 0;
        const gate = deferred();
        const charge: import("../lib/poju/decision-intake/decision-report-charge").DecisionReportCharge = async () => {
          calls += 1;
          await gate.promise;
          return { ok: true };
        };
        const runs = Array.from({ length: 5 }, () =>
          auth.settleDecisionReportCharge({ session_id: sid, question: "q", joint_pass_ref: null, allowNewCharge: true, charge }),
        );
        await until(() => calls === 1, "one claimant charging");
        await new Promise((r) => setTimeout(r, 5));
        gate.resolve();
        const out = await Promise.all(runs);
        assert.equal(calls, 1);
        assert.equal(out.filter((o) => o.state === "authorized").length, 1);
        assert.equal(out.filter((o) => o.state === "pending").length, 4);
        const again = await auth.settleDecisionReportCharge({ session_id: sid, question: "q", joint_pass_ref: null, allowNewCharge: true, charge });
        assert.equal(again.state, "authorized");
        assert.equal(calls, 1);
        // Continue never opens a first charge.
        const fresh = await auth.settleDecisionReportCharge({
          session_id: "r1_settle_none",
          question: "",
          joint_pass_ref: null,
          allowNewCharge: false,
          charge,
        });
        assert.equal(fresh.state, "required");
        assert.equal(calls, 1);
      });

      // ═══ A1 — every dispatch / run entry requires the grant ═══════════════════

      await check("R1-09 every entry refuses an unauthorized job: dispatcher, ensure, runner (all stages), legacy stage router", async () => {
        reset(0);
        const s = await deviceSession("r09");
        const gate = deferred();
        ledger.gates.push(gate.promise);
        const pA = call(startBody(s));
        await until(() => ledger.calls.length === 1, "charge pending");
        const job_id = await latestJobId(s);

        await assert.rejects(
          dispatch.dispatchDecisionReportStage(job_id, s.session_id, "finalize", deps),
          (e: unknown) => e instanceof auth.DecisionReportNotAuthorizedError,
        );
        assert.equal(await store.loadDecisionReportDispatch(job_id), null);
        const ensured = await dispatch.ensureDecisionReportWorker({ job_id, session_id: s.session_id, deps });
        assert.equal(ensured.ok, false);
        assert.equal(!ensured.ok && ensured.code, "CHARGE_NOT_AUTHORIZED");
        for (const stage of ["finalize", "segments", "assemble"] as const) {
          await runner.runDecisionReportStage(job_id, stage);
          await fdRunner.runFinalDeliveryStage(job_id, stage);
        }
        assert.equal(bg.hosted, 0);
        assert.equal(analysisCalls, 0);

        gate.resolve();
        assert.equal((await pA).status, 402);
        await assertNeverRan(s, job_id);
      });

      await check("R1-10 abort before the queued worker starts → the worker is refused; nothing runs", async () => {
        reset(1);
        const s = await deviceSession("r10");
        bg.mode = "queue";
        const r = await call(startBody(s));
        assert.equal(r.status, 200);
        const job_id = r.body.job_id as string;
        assert.equal(bg.queue.length, 1, "worker queued, not started");
        await service.abortDecisionReportJob((await getXhighJob(job_id))!, "pass_required");
        await bg.queue.shift()!();
        await runner.runDecisionReportStage(job_id, "finalize");
        assert.equal((await getXhighJob(job_id))?.status, "failed");
        assert.equal(await kv.get(auth.di2ExecutionGrantKey(job_id)), null, "grant revoked");
        assert.equal(await store.loadDecisionReportDispatch(job_id), null, "marker cleared");
        await assertNeverRan(s, job_id);
      });

      await check("R1-11 grant revoked while a worker is inside the model call → no checkpoint, no page, no record", async () => {
        reset(1);
        const s = await deviceSession("r11");
        bg.mode = "queue";
        const r = await call(startBody(s));
        const job_id = r.body.job_id as string;
        onAnalysisCall = async () => {
          await service.abortDecisionReportJob((await getXhighJob(job_id))!, "pass_required");
        };
        await bg.queue.shift()!();
        assert.equal(analysisCalls, 1, "the worker was already inside the model call");
        const input = (await getXhighJob(job_id))!.input as JobInput;
        assert.notEqual((await store.loadAnalysis(input.analysis_key))?.record.status, "completed", "result not committed");
        assert.equal(pageCalls.length, 0);
        assert.equal(await store.loadCompletedReport(s.session_id, job_id), null);
        assert.equal((await getXhighJob(job_id))?.status, "failed");
      });

      // ═══ B — client binds the completed payload to the polled job ═════════════

      await check("R1-12 client: correct job completes through the real driver", async () => {
        reset(1);
        const s = await deviceSession("r12");
        const out = await client.runDecisionReportForSession(s, "zh", { pollMs: 5 });
        assert.equal(out.main_delivery_done, true);
        const stored = (await sm.loadPOJUSession(s.session_id))!;
        assert.equal(stored.main_delivery_done, true);
        assert.equal(stored.pending_decision_report_job_id ?? null, null);
      });

      await check("R1-13 client: tampered completed payloads are rejected (other job, other report_job_id, other page job, other generation); a correct refetch completes", async () => {
        reset(1);
        const s = await deviceSession("r13");
        const r1 = await call(startBody(s));
        await drain();
        const j1 = r1.body.job_id as string;
        const r2 = await call(startBody(s, true));
        await drain();
        const j2 = r2.body.job_id as string;
        const st1 = await statusOf(s, j1);
        const st2 = await statusOf(s, j2);
        assert.equal(st1.status, "completed");
        assert.equal(st2.status, "completed");
        assert.notEqual(st1.execution_generation, st2.execution_generation);

        await sm.savePOJUSession({ ...(await sm.loadPOJUSession(s.session_id))!, pending_decision_report_job_id: j2 });
        const clone = (p: Json): Json => JSON.parse(JSON.stringify(p)) as Json;
        const tampers: Array<[string, (p: Json) => Json]> = [
          ["another job's completed payload", () => clone(st1)],
          [
            "result.report_job_id (and payload.report_job_id) of another report",
            (p) => {
              const t = clone(p);
              (t.result as Json).report_job_id = st1.report_job_id;
              t.report_job_id = st1.report_job_id;
              return t;
            },
          ],
          [
            "only result.report_job_id of another report",
            (p) => {
              const t = clone(p);
              (t.result as Json).report_job_id = st1.report_job_id;
              return t;
            },
          ],
          [
            "one page from another job",
            (p) => {
              const t = clone(p);
              ((t.pages as Json[])[2] as Json).job_id = j1;
              return t;
            },
          ],
          [
            "another execution generation (payload and result)",
            (p) => {
              const t = clone(p);
              t.execution_generation = st1.execution_generation;
              (t.result as Json).execution_generation = st1.execution_generation;
              return t;
            },
          ],
        ];
        for (const [label, fn] of tampers) {
          tamperStatus = (p) => (p.job_id === j2 ? fn(p) : p);
          const before = (await sm.loadPOJUSession(s.session_id))!;
          await assert.rejects(
            client.runDecisionReportForSession(before, "zh", { pollMs: 5 }),
            (e: unknown) => (e as { code?: string }).code === "REPORT_BINDING_MISMATCH",
            label,
          );
          const after = (await sm.loadPOJUSession(s.session_id))!;
          assert.equal(after.pending_decision_report_job_id, j2, `${label}: pending job kept`);
          assert.ok(!after.main_delivery_done, `${label}: not delivered`);
          assert.ok(
            !(after.freeze_bound_report_jobs ?? []).some((r) => r.status === "completed"),
            `${label}: no completed row`,
          );
        }

        tamperStatus = null;
        const done = await client.runDecisionReportForSession((await sm.loadPOJUSession(s.session_id))!, "zh", { pollMs: 5 });
        assert.equal(done.main_delivery_done, true);
        const stored = (await sm.loadPOJUSession(s.session_id))!;
        assert.equal(stored.pending_decision_report_job_id ?? null, null);
        const row = (stored.freeze_bound_report_jobs ?? []).find((r) => r.status === "completed");
        assert.equal(row?.xhigh_job_id, j2);
        assert.equal(row?.execution_generation, st2.execution_generation);
      });
    },
    { deadlineMs: 20 * 60_000 },
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
