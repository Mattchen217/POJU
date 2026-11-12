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
 * fail before reaching the ledger. A test-only step hook pauses or stops (simulated
 * process death) the refusal abort between its termination steps; claim windows are
 * crossed by shifting `Date.now`, not by waiting.
 * Storage: process-memory KV (`durableKv()` MemoryKv / ephemeral MemoryKv) with
 * method patches for read / write faults. This is NOT an Upstash, Supabase RPC, real HTTP,
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
/** `--only=FU1` runs the M5-R1-FU1 subset (`pnpm test:m5-r1-fu1`). */
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? null;

async function check(label: string, fn: () => void | Promise<void>) {
  if (ONLY && !label.startsWith(ONLY)) return;
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

/** Controllable clock: `Date.now` runs `ms` ahead until the returned restore is called. */
function advanceClock(ms: number): () => void {
  const real = Date.now;
  Date.now = () => real() + ms;
  return () => {
    Date.now = real;
  };
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
  const { xhighSessionLockKey } = await import("../lib/poju/xhigh-job-types");
  const lockMod = await import("../lib/poju/decision-intake/decision-report-lock");
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

  /** `refuse`: a definite refusal whatever the ledger holds (e.g. the caller's login expired). */
  type ChargeMode = "ok" | "refuse" | "rpc_error_after_debit" | "throw_before_debit";
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
      // Gate and mode belong to this call (taken on entry, in call order).
      const gate = ledger.gates.shift();
      const mode = ledger.modes.shift() ?? "ok";
      if (gate) await gate;
      if (mode === "throw_before_debit") throw new Error("test: pass service unreachable");
      if (mode === "refuse") return { ok: false, response: passRefusal() };
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
    service.__setRefusalAbortStepHookForTests(null);
    startGates.clear();
    startTrace.length = 0;
  }

  // ─── FU3 start-boundary gates (production hook points) ─────────────────────

  type StartPoint = import("../lib/poju/decision-intake/decision-report-service").ReportStartHookPoint;
  type StartGate = { arrived: boolean; owner: string | null; release: () => void; promise: Promise<void> };
  const startGates = new Map<StartPoint, StartGate[]>();
  const startTrace: Array<{ point: StartPoint; owner: string | null }> = [];
  /** The next request reaching `point` waits here until `release()`. */
  function gateAt(point: StartPoint): StartGate {
    const d = deferred();
    const g: StartGate = { arrived: false, owner: null, release: d.resolve, promise: d.promise };
    startGates.set(point, [...(startGates.get(point) ?? []), g]);
    return g;
  }
  service.__setReportStartHookForTests(async (point, ctx) => {
    startTrace.push({ point, owner: ctx.owner_attempt_id });
    const q = startGates.get(point);
    const g = q?.shift();
    if (g) {
      g.arrived = true;
      g.owner = ctx.owner_attempt_id;
      await g.promise;
    }
  });

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
        const refusedRec = (await authOf(s))!;
        assert.equal(refusedRec.state, "abort_completed", "refusal final: its abort completed");
        assert.equal(refusedRec.abort_job_id, job_id);
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

      // ═══ FU1 — a claimant whose claim was taken over has no say ═══════════════
      // A claims and is paused inside the charge; the clock runs past the claim window
      // only while B re-claims (same session, same ref); then the old answers arrive.

      const STALE = auth.DI2_CHARGE_CLAIM_MS + 1_000;

      /** A claims and pauses; B takes the claim over after the window and pauses or runs. */
      async function staleTakeover(s: POJUSessionState): Promise<{
        pA: Promise<{ status: number; body: Json }>;
        pB: Promise<{ status: number; body: Json }>;
        job_id: string;
        claimA: ChargeAuthorization;
        claimB: ChargeAuthorization;
      }> {
        const pA = call(startBody(s));
        await until(() => ledger.calls.length === 1, "A inside the charge");
        const job_id = await latestJobId(s);
        const claimA = (await authOf(s))!;
        assert.equal(claimA.state, "pending");
        const restore = advanceClock(STALE);
        let pB: Promise<{ status: number; body: Json }>;
        try {
          pB = call(startBody(s));
          await until(() => ledger.calls.length === 2, "B re-claimed and inside the charge");
        } finally {
          restore();
        }
        const claimB = (await authOf(s))!;
        assert.notEqual(claimB.attempt_id, claimA.attempt_id, "B owns a new claim");
        assert.equal(claimB.charge_ref, claimA.charge_ref, "same charge_ref");
        assert.deepEqual(ledger.calls, [s.session_id, s.session_id], "same idempotency ref, no new ref");
        assert.equal(await latestJobId(s), job_id, "B reused A's job");
        return { pA, pB, job_id, claimA, claimB };
      }

      async function hasGrant(job_id: string): Promise<boolean> {
        return (await kv.get(auth.di2ExecutionGrantKey(job_id))) != null;
      }

      await check("FU1-01 stale A refused while B is still charging → B's pending kept, no abort; B authorizes → one debit, report completes", async () => {
        reset(0);
        const s = await deviceSession("fu101");
        const gateA = deferred();
        const gateB = deferred();
        ledger.gates.push(gateA.promise, gateB.promise);
        const { pA, pB, job_id, claimB } = await staleTakeover(s);
        assert.equal(claimB.state, "pending");

        gateA.resolve();
        const rA = await pA;
        assert.equal(rA.status, 200, JSON.stringify(rA.body));
        assert.equal(rA.body.worker, "awaiting_charge", "stale A follows the job, it does not refuse it");
        const afterA = (await authOf(s))!;
        assert.equal(afterA.state, "pending", "A did not write refused over B's claim");
        assert.equal(afterA.attempt_id, claimB.attempt_id, "B still owns the claim");
        const jobAfterA = await getXhighJob(job_id);
        assert.notEqual(jobAfterA?.status, "failed");
        assert.notEqual(jobAfterA?.failure_reason, "charge_refused");
        assert.equal(bg.hosted, 0, "A dispatched nothing");
        assert.equal(await store.loadDecisionReportDispatch(job_id), null);
        assert.equal(analysisCalls, 0);

        ledger.balance = 1;
        gateB.resolve();
        const rB = await pB;
        assert.equal(rB.status, 200, JSON.stringify(rB.body));
        assert.equal(rB.body.job_id, job_id);
        assert.equal(rB.body.worker, "dispatched");
        await drain();
        const done = (await authOf(s))!;
        assert.equal(done.state, "authorized");
        assert.equal(done.attempt_id, claimB.attempt_id);
        assert.equal((await getXhighJob(job_id))?.status, "completed");
        assert.ok(await hasGrant(job_id), "grant kept");
        const input = (await getXhighJob(job_id))!.input as JobInput;
        assert.equal((await store.loadAnalysis(input.analysis_key))?.record.status, "completed", "Personal Analysis completed");
        assert.ok(await store.loadCompletedReport(s.session_id, job_id), "report completed");
        assert.equal((await store.loadAllPages(job_id)).length, 8, "8 pages");
        assert.equal(analysisCalls, 1);
        assert.equal(new Set(pageCalls).size, pageCalls.length, "no page ran twice");
        assert.deepEqual(ledger.debits, [s.session_id], "exactly one debit");
        assert.equal(bg.hosted, 1);
      });

      await check("FU1-02 B authorizes, then stale A's late answer arrives (refusal; success) → authorized kept, no abort, worker unaffected, one debit", async () => {
        for (const late of ["refuse", "ok"] as const) {
          reset(1);
          const s = await deviceSession(`fu102_${late}`);
          const gateA = deferred();
          ledger.gates.push(gateA.promise);
          ledger.modes.push(late);
          bg.mode = "queue";
          const { pA, pB, job_id, claimB } = await staleTakeover(s);
          const rB = await pB;
          assert.equal(rB.status, 200, `${late}: ${JSON.stringify(rB.body)}`);
          assert.equal(rB.body.worker, "dispatched");
          assert.equal((await authOf(s))?.state, "authorized");
          assert.equal(bg.queue.length, 1, `${late}: B's worker queued`);

          gateA.resolve();
          const rA = await pA;
          assert.notEqual(rA.status, 402, `${late}: ${JSON.stringify(rA.body)}`);
          const rec = (await authOf(s))!;
          assert.equal(rec.state, "authorized", `${late}: authorized not downgraded`);
          assert.equal(rec.attempt_id, claimB.attempt_id);
          assert.ok(await hasGrant(job_id), `${late}: grant not revoked`);
          assert.notEqual((await getXhighJob(job_id))?.failure_reason, "charge_refused");

          await bg.queue.shift()!();
          await drain();
          assert.equal((await getXhighJob(job_id))?.status, "completed", `${late}: dispatched worker completed`);
          assert.ok(await store.loadCompletedReport(s.session_id, job_id));
          assert.equal(analysisCalls, 1);
          assert.deepEqual(ledger.debits, [s.session_id], `${late}: no second debit`);
          assert.equal(ledger.calls.length, 2);
        }
      });

      await check("FU1-03 stale A refused → no abort; then B (current claim) refused → abort: grant revoked, workers refused, Continue refused", async () => {
        reset(0);
        const s = await deviceSession("fu103");
        const gateA = deferred();
        const gateB = deferred();
        ledger.gates.push(gateA.promise, gateB.promise);
        const { pA, pB, job_id, claimB } = await staleTakeover(s);

        gateA.resolve();
        const rA = await pA;
        assert.equal(rA.body.worker, "awaiting_charge", JSON.stringify(rA.body));
        assert.notEqual((await getXhighJob(job_id))?.status, "failed", "A's refusal did not abort");
        assert.equal((await authOf(s))?.state, "pending");

        gateB.resolve();
        const rB = await pB;
        assert.equal(rB.status, 402, JSON.stringify(rB.body));
        assert.equal(rB.body.error, "pass_required");
        const rec = (await authOf(s))!;
        assert.equal(rec.state, "abort_completed", "B's refusal is the final one");
        assert.equal(rec.attempt_id, claimB.attempt_id);
        assert.equal(rec.abort_job_id, job_id);
        const job = await getXhighJob(job_id);
        assert.equal(job?.status, "failed");
        assert.equal(job?.failure_reason, "charge_refused");
        assert.equal(job?.retryable, false);
        assert.equal(await hasGrant(job_id), false, "grant revoked");
        assert.equal(await store.loadDecisionReportDispatch(job_id), null);

        for (const stage of ["finalize", "segments", "assemble"] as const) {
          await runner.runDecisionReportStage(job_id, stage);
        }
        const c = await call({ action: "continue", session_id: s.session_id, job_id });
        assert.equal(c.status, 402);
        assert.equal(c.body.code, "CHARGE_REFUSED", "Continue does not bypass the refusal");
        assert.equal(bg.hosted, 0);
        assert.equal(ledger.debits.length, 0);
        assert.equal(ledger.calls.length, 2);
        await assertNeverRan(s, job_id);
      });

      await check("FU1-04 A's CAS fails and the latest record cannot be read → uncertain, no abort, no dispatch, no new charge_ref", async () => {
        reset(0);
        const s = await deviceSession("fu104");
        const gateA = deferred();
        ledger.gates.push(gateA.promise);
        const pA = call(startBody(s));
        await until(() => ledger.calls.length === 1, "A inside the charge");
        const job_id = await latestJobId(s);
        const claimA = (await authOf(s))!;
        const key = auth.di2ChargeAuthorizationKey(s.session_id);
        const d = durableKv() as unknown as {
          compareAndSetExact: (k: string, e: string | null, n: unknown, o?: { ex?: number }) => Promise<boolean>;
          get: <T>(k: string) => Promise<T | null>;
        };
        const origCas = d.compareAndSetExact;
        const origGet = d.get;
        let casFailed = 0;
        let readFailed = 0;
        d.compareAndSetExact = async function patched(k, e, n, o) {
          if (k === key) {
            casFailed += 1;
            return false;
          }
          return origCas.call(durableKv(), k, e, n, o);
        };
        d.get = async function patched<T>(k: string): Promise<T | null> {
          if (k === key && casFailed > 0) {
            readFailed += 1;
            throw new Error("test: KV read failed");
          }
          return origGet.call(durableKv(), k) as Promise<T | null>;
        };
        let rA;
        try {
          gateA.resolve();
          rA = await pA;
        } finally {
          d.compareAndSetExact = origCas;
          d.get = origGet;
        }
        assert.ok(casFailed >= 1 && readFailed >= 1, `cas=${casFailed} read=${readFailed}`);
        assert.equal(rA.status, 503, JSON.stringify(rA.body));
        assert.equal(rA.body.code, "CHARGE_UNCONFIRMED");
        const job = await getXhighJob(job_id);
        assert.notEqual(job?.status, "failed", "no abort");
        assert.notEqual(job?.failure_reason, "charge_refused");
        assert.equal(bg.hosted, 0, "no dispatch");
        assert.equal(await store.loadDecisionReportDispatch(job_id), null);
        assert.equal(await hasGrant(job_id), false);
        await runner.runDecisionReportStage(job_id, "finalize");
        assert.equal(analysisCalls, 0);
        const rec = (await authOf(s))!;
        assert.deepEqual(rec, claimA, "record untouched");
        assert.equal(rec.charge_ref, s.session_id);
        assert.deepEqual(ledger.calls, [s.session_id], "no new charge_ref");
      });

      await check("FU1-05 own refusal written but the abort claim cannot read the record → no abort (uncertain); a later claimed refusal aborts", async () => {
        reset(0);
        const s = await deviceSession("fu105");
        const key = auth.di2ChargeAuthorizationKey(s.session_id);
        const d = durableKv() as unknown as {
          compareAndSetExact: (k: string, e: string | null, n: unknown, o?: { ex?: number }) => Promise<boolean>;
          get: <T>(k: string) => Promise<T | null>;
        };
        const origCas = d.compareAndSetExact;
        const origGet = d.get;
        let refusedWritten = false;
        let readFailed = 0;
        d.compareAndSetExact = async function patched(k, e, n, o) {
          const ok = await origCas.call(durableKv(), k, e, n, o);
          if (ok && k === key && (n as ChargeAuthorization).state === "refused") refusedWritten = true;
          return ok;
        };
        d.get = async function patched<T>(k: string): Promise<T | null> {
          if (k === key && refusedWritten) {
            readFailed += 1;
            throw new Error("test: KV read failed");
          }
          return origGet.call(durableKv(), k) as Promise<T | null>;
        };
        let r1;
        try {
          r1 = await call(startBody(s));
        } finally {
          d.compareAndSetExact = origCas;
          d.get = origGet;
        }
        assert.ok(refusedWritten && readFailed >= 1);
        assert.equal(r1.status, 503, JSON.stringify(r1.body));
        assert.equal(r1.body.code, "CHARGE_UNCONFIRMED");
        const job_id = await latestJobId(s);
        assert.notEqual((await getXhighJob(job_id))?.status, "failed", "unclaimed refusal does not abort");
        assert.equal((await authOf(s))?.state, "refused");
        assert.equal(bg.hosted, 0);

        const r2 = await call(startBody(s));
        assert.equal(r2.status, 402, JSON.stringify(r2.body));
        assert.equal((await getXhighJob(job_id))?.failure_reason, "charge_refused");
        assert.equal(await hasGrant(job_id), false);
        assert.deepEqual(ledger.calls, [s.session_id, s.session_id], "same ref");
        await assertNeverRan(s, job_id);
      });

      // ═══ FU2 — refusal → abort is an atomic claim, resumable and idempotent ═══

      type CasPatch = {
        compareAndSetExact: (k: string, e: string | null, n: unknown, o?: { ex?: number }) => Promise<boolean>;
        get: <T>(k: string) => Promise<T | null>;
      };
      /** Patch the durable KV for one test; always restored by the returned function. */
      function patchDurable(p: Partial<{ [K in keyof CasPatch]: (orig: CasPatch[K]) => CasPatch[K] }>): () => void {
        const d = durableKv() as unknown as CasPatch;
        const origCas = d.compareAndSetExact;
        const origGet = d.get;
        const boundCas: CasPatch["compareAndSetExact"] = (k, e, n, o) => origCas.call(durableKv(), k, e, n, o);
        const boundGet: CasPatch["get"] = <T,>(k: string) => origGet.call(durableKv(), k) as Promise<T | null>;
        if (p.compareAndSetExact) d.compareAndSetExact = p.compareAndSetExact(boundCas);
        if (p.get) d.get = p.get(boundGet);
        return () => {
          d.compareAndSetExact = origCas;
          d.get = origGet;
        };
      }

      const lockKey = (s: POJUSessionState) => xhighSessionLockKey("decision_report", s.session_id);

      /** Abort fully applied to `job_id` and recorded, nothing charged, run or created. */
      async function assertAbortFinal(s: POJUSessionState, job_id: string, abort_attempt_id: string, label: string): Promise<void> {
        const job = await getXhighJob(job_id);
        assert.equal(job?.status, "failed", `${label}: job failed`);
        assert.equal(job?.failure_reason, "charge_refused", `${label}: charge_refused`);
        assert.equal(job?.retryable, false, `${label}: not retryable`);
        assert.equal(await kv.get(auth.di2ExecutionGrantKey(job_id)), null, `${label}: grant gone`);
        assert.equal(await store.loadDecisionReportDispatch(job_id), null, `${label}: dispatch marker cleared`);
        assert.equal(await kv.get(lockKey(s)), null, `${label}: session lock released`);
        const rec = (await authOf(s))!;
        assert.equal(rec.state, "abort_completed", `${label}: abort_completed`);
        assert.equal(rec.abort_job_id, job_id, `${label}: bound to the original abort_job_id`);
        assert.equal(rec.abort_attempt_id, abort_attempt_id, `${label}: same abort claim`);
        assert.equal(typeof rec.abort_completed_at, "number", `${label}: abort_completed_at`);
        assert.equal(rec.charge_ref, s.session_id, `${label}: same charge_ref`);
        assert.equal(await latestJobId(s), job_id, `${label}: no second job`);
        assert.equal(bg.hosted, 0, `${label}: nothing dispatched`);
        assert.equal(ledger.debits.length, 0, `${label}: nothing debited`);
      }

      await check("FU2-01 refusal wins the abort CAS: a concurrent start / Regenerate / Continue cannot claim, charge, authorize or create a job; A finishes; a later start charges again", async () => {
        reset(0);
        const s = await deviceSession("fu201");
        const hold = deferred();
        let paused = 0;
        service.__setRefusalAbortStepHookForTests(async (step) => {
          if (step === "revoke_grant" && paused === 0) {
            paused += 1;
            await hold.promise;
          }
        });
        const pA = call(startBody(s));
        await until(() => paused === 1, "A claimed the abort and paused before terminating");
        const job_id = await latestJobId(s);
        const claimed = (await authOf(s))!;
        assert.equal(claimed.state, "abort_claimed");
        assert.equal(claimed.abort_job_id, job_id);
        assert.ok(claimed.abort_attempt_id);
        assert.equal(typeof claimed.abort_claimed_at, "number");
        assert.equal(claimed.abort_completed_at, null);

        ledger.balance = 1; // C could pay now: it still must not charge
        for (const regenerate of [false, true]) {
          const rC = await call(startBody(s, regenerate));
          assert.equal(rC.status, 409, `regenerate=${regenerate}: ${JSON.stringify(rC.body)}`);
          assert.equal(rC.body.code, "CHARGE_ABORT_IN_PROGRESS");
          assert.equal(rC.body.job_id, job_id);
        }
        const cC = await call({ action: "continue", session_id: s.session_id, job_id });
        assert.equal(cC.body.code, "CHARGE_ABORT_IN_PROGRESS", JSON.stringify(cC.body));
        await statusOf(s, job_id);
        assert.deepEqual(await authOf(s), claimed, "C neither re-claimed nor touched the abort claim");
        assert.equal(ledger.calls.length, 1, "C did not charge");
        assert.equal(await latestJobId(s), job_id, "C created no job");
        assert.equal(bg.hosted, 0);
        assert.notEqual((await getXhighJob(job_id))?.status, "failed", "A has not terminated yet");

        hold.resolve();
        const rA = await pA;
        assert.equal(rA.status, 402, JSON.stringify(rA.body));
        assert.equal(rA.body.error, "pass_required");
        service.__setRefusalAbortStepHookForTests(null);
        await assertAbortFinal(s, job_id, claimed.abort_attempt_id!, "after A");
        await assertNeverRan(s, job_id);

        const rN = await call(startBody(s));
        assert.equal(rN.status, 200, JSON.stringify(rN.body));
        assert.notEqual(rN.body.job_id, job_id, "a new job for the new charge");
        await drain();
        assert.equal((await getXhighJob(rN.body.job_id as string))?.status, "completed");
        assert.deepEqual(ledger.calls, [s.session_id, s.session_id], "re-charged with the same ref");
        assert.deepEqual(ledger.debits, [s.session_id]);
        assert.equal((await authOf(s))?.state, "authorized");
        assert.equal((await getXhighJob(job_id))?.failure_reason, "charge_refused", "the refused job stays terminated");
      });

      await check("FU2-02 re-claim wins the CAS: A's abort CAS fails (no abort); C charges, authorizes, the worker completes the report", async () => {
        reset(0);
        const s = await deviceSession("fu202");
        const key = auth.di2ChargeAuthorizationKey(s.session_id);
        const casGate = deferred();
        let abortCasArrived = false;
        let abortCasResult: boolean | null = null;
        const restore = patchDurable({
          compareAndSetExact: (orig) => async (k, e, n, o) => {
            if (k === key && (n as ChargeAuthorization).state === "abort_claimed") {
              abortCasArrived = true;
              await casGate.promise;
              abortCasResult = await orig(k, e, n, o);
              return abortCasResult;
            }
            return orig(k, e, n, o);
          },
        });
        try {
          const gateC = deferred();
          ledger.gates.push(Promise.resolve(), gateC.promise);
          const pA = call(startBody(s));
          await until(() => abortCasArrived, "A read refused and is at its abort CAS");
          const job_id = await latestJobId(s);
          const refusedA = (await authOf(s))!;
          assert.equal(refusedA.state, "refused");

          ledger.balance = 1;
          // FU3: inside A's lock window a start only observes — no re-claim, no charge.
          const rC0 = await call(startBody(s));
          assert.equal(rC0.status, 200, JSON.stringify(rC0.body));
          assert.equal(rC0.body.worker, "awaiting_charge");
          assert.equal(ledger.calls.length, 1, "C0 did not charge while A holds the start lock");
          // The CAS race stays reachable only once A's lock is idle past the window (A stalled
          // between its lock touch and its abort CAS): C takes the lock over and re-claims.
          const restoreClock = advanceClock(lockMod.REPORT_START_LOCK_IDLE_MS + 1_000);
          let pC: Promise<{ status: number; body: Json }>;
          try {
            pC = call(startBody(s));
            await until(() => ledger.calls.length === 2, "C re-claimed the refused record and is charging");
          } finally {
            restoreClock();
          }
          const claimC = (await authOf(s))!;
          assert.equal(claimC.state, "pending");
          assert.notEqual(claimC.attempt_id, refusedA.attempt_id);
          assert.equal(claimC.charge_ref, refusedA.charge_ref);

          casGate.resolve();
          const rA = await pA;
          assert.equal(abortCasResult, false, "A's abort CAS lost");
          assert.equal(rA.status, 200, JSON.stringify(rA.body));
          assert.equal(rA.body.worker, "awaiting_charge");
          assert.notEqual((await getXhighJob(job_id))?.status, "failed", "A did not abort");
          assert.equal((await authOf(s))?.attempt_id, claimC.attempt_id);

          gateC.resolve();
          const rC = await pC;
          assert.equal(rC.status, 200, JSON.stringify(rC.body));
          assert.equal(rC.body.worker, "dispatched");
          await drain();
          const job = await getXhighJob(job_id);
          assert.equal(job?.status, "completed");
          assert.notEqual(job?.failure_reason, "charge_refused");
          assert.ok(await store.loadCompletedReport(s.session_id, job_id));
          assert.equal((await store.loadAllPages(job_id)).length, 8);
          const rec = (await authOf(s))!;
          assert.equal(rec.state, "authorized");
          assert.equal(rec.attempt_id, claimC.attempt_id);
          assert.equal(rec.abort_job_id ?? null, null);
          assert.deepEqual(ledger.debits, [s.session_id]);
          assert.equal(analysisCalls, 1);
        } finally {
          restore();
        }
      });

      const STEPS = ["revoke_grant", "fail_job", "clear_dispatch", "release_lock", "mark_completed"] as const;
      const ENTRIES = ["start_regenerate", "status", "continue", "start", "status"] as const;
      for (let i = 0; i < STEPS.length; i++) {
        const crashAt = STEPS[i];
        const entry = ENTRIES[i];
        await check(`FU2-03.${i + 1} abort crashes before ${crashAt} → ${entry} resumes the same abort to abort_completed; no charge, no dispatch, no second job`, async () => {
          reset(0);
          const s = await deviceSession(`fu203_${i}`);
          let crashed = false;
          let planted = false;
          const seen = new Set<string>();
          service.__setRefusalAbortStepHookForTests(async (step, jid) => {
            seen.add(jid);
            if (!planted) {
              // Something for every step to undo: a stray grant and a dispatch marker.
              planted = true;
              await kv.set(auth.di2ExecutionGrantKey(jid), { job_id: jid, session_id: s.session_id, execution_generation: 0, charge_ref: s.session_id, granted_at: Date.now() }, { ex: 3600 });
              await kv.set(store.di2DispatchKey(jid), { stage: "finalize", at: Date.now() }, { ex: 3600 });
            }
            if (step === crashAt && !crashed) {
              crashed = true;
              throw new Error(`test: process died before ${step}`);
            }
          });
          const r1 = await call(startBody(s));
          assert.equal(r1.status, 409, JSON.stringify(r1.body));
          assert.equal(r1.body.code, "CHARGE_ABORT_IN_PROGRESS");
          const job_id = await latestJobId(s);
          const claimed = (await authOf(s))!;
          assert.equal(claimed.state, "abort_claimed");
          assert.equal(claimed.abort_job_id, job_id);

          // The crash left exactly the steps before `crashAt` done.
          const done = STEPS.indexOf(crashAt);
          assert.equal((await kv.get(auth.di2ExecutionGrantKey(job_id))) !== null, done <= 0, "grant at crash");
          assert.equal((await getXhighJob(job_id))?.failure_reason === "charge_refused", done >= 2, "job stamped at crash");
          assert.equal((await store.loadDecisionReportDispatch(job_id)) !== null, done <= 2, "marker at crash");
          assert.equal((await kv.get(lockKey(s))) !== null, done <= 3, "lock at crash");

          // Inside the claim window the abort is still the claimant's: nobody else touches it.
          const early = await call(startBody(s));
          assert.equal(early.body.code, "CHARGE_ABORT_IN_PROGRESS");
          assert.deepEqual(await authOf(s), claimed);

          seen.clear();
          const restoreClock = advanceClock(STALE);
          try {
            if (entry === "status") {
              const st = await statusOf(s, job_id);
              assert.equal(st.status, "failed");
              assert.equal(st.failure_reason, "charge_refused");
            } else if (entry === "continue") {
              const c = await call({ action: "continue", session_id: s.session_id, job_id });
              assert.equal(c.status, 402, JSON.stringify(c.body));
              assert.equal(c.body.code, "CHARGE_REFUSED");
            } else {
              const r = await call(startBody(s, entry === "start_regenerate"));
              assert.equal(r.status, 402, JSON.stringify(r.body));
              assert.equal(r.body.code, "CHARGE_REFUSED");
              assert.equal(r.body.job_id, job_id);
            }
          } finally {
            restoreClock();
          }
          assert.deepEqual([...seen], [job_id], "recovery handled only the original abort_job_id");
          await assertAbortFinal(s, job_id, claimed.abort_attempt_id!, `crash before ${crashAt}`);
          assert.deepEqual(ledger.calls, [s.session_id], "no charge during recovery");
          await assertNeverRan(s, job_id);
        });
      }

      await check("FU2-04 unreadable / unwritable authorization fails closed: no abort, no dispatch, no refusal, no new charge_ref, no job before the record is readable", async () => {
        // (a) the abort CAS fails and the re-read throws
        reset(0);
        let s = await deviceSession("fu204a");
        let key = auth.di2ChargeAuthorizationKey(s.session_id);
        let casLost = false;
        let restore = patchDurable({
          compareAndSetExact: (orig) => async (k, e, n, o) => {
            if (k === key && (n as ChargeAuthorization).state === "abort_claimed") {
              casLost = true;
              return false;
            }
            return orig(k, e, n, o);
          },
          get: (orig) => async <T,>(k: string) => {
            if (k === key && casLost) throw new Error("test: KV read failed");
            return orig<T>(k);
          },
        });
        let r;
        try {
          r = await call(startBody(s));
        } finally {
          restore();
        }
        assert.ok(casLost);
        assert.equal(r.status, 503, JSON.stringify(r.body));
        assert.equal(r.body.code, "CHARGE_UNCONFIRMED", "uncertain, not a refusal");
        let job_id = await latestJobId(s);
        assert.notEqual((await getXhighJob(job_id))?.status, "failed", "no abort");
        assert.equal(bg.hosted, 0);
        assert.equal(await kv.get(auth.di2ExecutionGrantKey(job_id)), null);
        let rec = (await authOf(s))!;
        assert.equal(rec.state, "refused");
        assert.equal(rec.abort_job_id ?? null, null, "no abort claimed");
        assert.equal(rec.charge_ref, s.session_id);
        assert.deepEqual(ledger.calls, [s.session_id]);
        await assertNeverRan(s, job_id);

        // (b) the abort claim's first read throws
        reset(0);
        s = await deviceSession("fu204b");
        key = auth.di2ChargeAuthorizationKey(s.session_id);
        let refusedWritten = false;
        restore = patchDurable({
          compareAndSetExact: (orig) => async (k, e, n, o) => {
            const ok = await orig(k, e, n, o);
            if (ok && k === key && (n as ChargeAuthorization).state === "refused") refusedWritten = true;
            return ok;
          },
          get: (orig) => async <T,>(k: string) => {
            if (k === key && refusedWritten) throw new Error("test: KV read failed");
            return orig<T>(k);
          },
        });
        try {
          r = await call(startBody(s));
        } finally {
          restore();
        }
        assert.equal(r.status, 503, JSON.stringify(r.body));
        job_id = await latestJobId(s);
        assert.notEqual((await getXhighJob(job_id))?.status, "failed");
        rec = (await authOf(s))!;
        assert.equal(rec.state, "refused");
        assert.equal(rec.abort_job_id ?? null, null);
        assert.equal(bg.hosted, 0);

        // (c) the record is unreadable before the start: no job is created at all
        reset(1);
        s = await deviceSession("fu204c");
        key = auth.di2ChargeAuthorizationKey(s.session_id);
        restore = patchDurable({
          get: (orig) => async <T,>(k: string) => {
            if (k === key) throw new Error("test: KV read failed");
            return orig<T>(k);
          },
        });
        try {
          r = await call(startBody(s));
        } finally {
          restore();
        }
        assert.equal(r.status, 503, JSON.stringify(r.body));
        assert.equal(r.body.code, "CHARGE_UNCONFIRMED");
        assert.equal(await findLatestXhighJobForSession("decision_report", s.session_id), null, "no job created");
        assert.equal(ledger.calls.length, 0);
        assert.equal(await authOf(s), null);
        assert.equal(bg.hosted, 0);
      });

      await check("FU2-05 two requests race for the same refusal's abort → one CAS wins, one abort_job_id; the loser only finishes that job's abort", async () => {
        reset(0);
        const s = await deviceSession("fu205");
        const base = startBody(s);
        const startInput = {
          session_id: s.session_id,
          locale: "zh",
          writer_token: base.writer_token,
          freeze_receipt: base.freeze_receipt,
          profile_receipt: base.profile_receipt,
        };
        const st1 = await service.startDecisionReportJob({ ...startInput, regenerate: false });
        const st2 = await service.startDecisionReportJob({ ...startInput, regenerate: true });
        assert.ok(st1.ok && st2.ok);
        const jobs = [st1.ok ? st1.job.job_id : "", st2.ok ? st2.job.job_id : ""];
        assert.notEqual(jobs[0], jobs[1]);
        const refusal = await auth.settleDecisionReportCharge({
          session_id: s.session_id,
          question: "q",
          joint_pass_ref: null,
          allowNewCharge: true,
          charge: async () => ({ ok: false, response: passRefusal() }),
        });
        assert.equal(refusal.state, "refused");

        const key = auth.di2ChargeAuthorizationKey(s.session_id);
        let arrivals = 0;
        const restore = patchDurable({
          compareAndSetExact: (orig) => async (k, e, n, o) => {
            if (k === key && (n as ChargeAuthorization).state === "abort_claimed") {
              arrivals += 1;
              await until(() => arrivals >= 2, "both claimants at the CAS");
            }
            return orig(k, e, n, o);
          },
        });
        let claims;
        try {
          claims = await Promise.all(
            jobs.map((j) => auth.claimDecisionReportRefusalAbort(refusal, j, lockMod.newReportLockOwner(s.session_id))),
          );
        } finally {
          restore();
        }
        assert.equal(arrivals, 2, "both read refused and tried the CAS");
        const kinds = claims.map((c) => c.kind).sort();
        assert.deepEqual(kinds, ["claimed", "in_progress"], JSON.stringify(kinds));
        const winner = claims.find((c) => c.kind === "claimed")! as { kind: "claimed"; record: ChargeAuthorization };
        const loser = claims.find((c) => c.kind === "in_progress")! as { kind: "in_progress"; record: ChargeAuthorization };
        const winnerJob = winner.record.abort_job_id!;
        const loserJob = jobs.find((j) => j !== winnerJob)!;
        assert.equal(loser.record.abort_job_id, winnerJob, "the loser sees the winner's job");
        assert.equal(loser.record.abort_attempt_id, winner.record.abort_attempt_id);

        const before = await getXhighJob(loserJob);
        const outs = await Promise.all([
          service.finishDecisionReportRefusalAbort(winner.record),
          service.finishDecisionReportRefusalAbort(loser.record),
        ]);
        assert.deepEqual(outs, [{ ok: true }, { ok: true }]);
        const rec = (await authOf(s))!;
        assert.equal(rec.state, "abort_completed");
        assert.equal(rec.abort_job_id, winnerJob);
        assert.equal(rec.abort_attempt_id, winner.record.abort_attempt_id);
        assert.equal((await getXhighJob(winnerJob))?.failure_reason, "charge_refused");
        const after = await getXhighJob(loserJob);
        assert.notEqual(after?.failure_reason, "charge_refused", "the other job was not terminated");
        assert.equal(after?.status, before?.status);
        const again = await auth.claimDecisionReportRefusalAbort(refusal, loserJob, lockMod.newReportLockOwner(s.session_id));
        assert.equal(again.kind, "completed");
        assert.equal(again.kind === "completed" && again.record.abort_job_id, winnerJob, "no second abort");
      });

      await check("FU2-06 abandoned abort vs new authorization: before abort_completed no start / Regenerate / Continue gets past it; after it a start re-charges normally", async () => {
        reset(0);
        const s = await deviceSession("fu206");
        let crashed = false;
        service.__setRefusalAbortStepHookForTests((step) => {
          if (step === "fail_job" && !crashed) {
            crashed = true;
            throw new Error("test: process died mid-abort");
          }
        });
        const r1 = await call(startBody(s));
        assert.equal(r1.body.code, "CHARGE_ABORT_IN_PROGRESS");
        const job_id = await latestJobId(s);
        const claimed = (await authOf(s))!;
        ledger.balance = 1;

        for (const body of [startBody(s), startBody(s, true), { action: "continue", session_id: s.session_id, job_id }]) {
          const r = await call(body);
          assert.equal(r.status, 409, JSON.stringify(r.body));
          assert.equal(r.body.code, "CHARGE_ABORT_IN_PROGRESS");
        }
        assert.equal((await statusOf(s, job_id)).status, "pending", "status inside the window leaves the claimant's abort alone");
        assert.deepEqual(await authOf(s), claimed);
        assert.equal(ledger.calls.length, 1, "no charge before abort_completed");
        assert.equal(await latestJobId(s), job_id, "no job before abort_completed");
        assert.equal(bg.hosted, 0);

        const restoreClock = advanceClock(STALE);
        let rRecover;
        try {
          rRecover = await call(startBody(s));
        } finally {
          restoreClock();
        }
        assert.equal(rRecover.status, 402, "the recovering start finishes the abort and does not charge");
        assert.equal(rRecover.body.code, "CHARGE_REFUSED");
        await assertAbortFinal(s, job_id, claimed.abort_attempt_id!, "recovered");
        assert.equal(ledger.calls.length, 1);

        const rN = await call(startBody(s));
        assert.equal(rN.status, 200, JSON.stringify(rN.body));
        const j2 = rN.body.job_id as string;
        assert.notEqual(j2, job_id);
        await drain();
        assert.equal((await getXhighJob(j2))?.status, "completed");
        assert.deepEqual(ledger.calls, [s.session_id, s.session_id], "re-charged with the same ref");
        assert.deepEqual(ledger.debits, [s.session_id]);
        const rec = (await authOf(s))!;
        assert.equal(rec.state, "authorized");
        assert.equal(rec.charge_ref, claimed.charge_ref);
        assert.equal((await getXhighJob(job_id))?.failure_reason, "charge_refused");
      });

      // ═══ FU3 — start / refusal abort / lock ownership share one critical section ═══

      type MemStore = { store: Map<string, { value: unknown; expiresAt: number | null }> };
      type JobFact = { job_id: string; status: string; failure_reason: string | null; grant: boolean; marker: boolean };
      /** Every report job of the session in the (ephemeral) job store, oldest first. */
      async function sessionJobs(s: POJUSessionState): Promise<JobFact[]> {
        const mem = kv as unknown as MemStore;
        const out: Array<JobFact & { created_at: number }> = [];
        for (const [k, e] of mem.store) {
          if (!k.startsWith("poju-xhigh:job:")) continue;
          const j = e.value as { job_id: string; session_id: string; phase: string; status: string; failure_reason?: string; created_at: number };
          if (j.session_id !== s.session_id || j.phase !== "decision_report") continue;
          out.push({
            job_id: j.job_id,
            status: j.status,
            failure_reason: j.failure_reason ?? null,
            grant: (await kv.get(auth.di2ExecutionGrantKey(j.job_id))) != null,
            marker: (await store.loadDecisionReportDispatch(j.job_id)) != null,
            created_at: j.created_at,
          });
        }
        return out.sort((a, b) => a.created_at - b.created_at).map(({ created_at: _c, ...f }) => f);
      }
      async function lockNow(s: POJUSessionState): Promise<import("../lib/poju/decision-intake/decision-report-lock").ReportSessionLock | null> {
        const r = await lockMod.readReportSessionLock(s.session_id);
        return r.kind === "owned" ? r.lock : null;
      }
      /** No job is left pending / running: nothing orphaned, nothing able to advance. */
      async function assertNoLiveJob(s: POJUSessionState, label: string): Promise<void> {
        const live = (await sessionJobs(s)).filter((j) => j.status === "pending" || j.status === "running");
        assert.deepEqual(live, [], `${label}: no pending/running job left`);
      }
      const ownerOfGate = (g: StartGate) => g.owner;

      await check("FU3-01 B prepared but not yet locked while A claims and finishes the refusal abort → B sees the final record; no orphan job; re-charge same ref, one debit", async () => {
        // (a) B waits before the lock for A's entire refusal + abort.
        reset(0);
        let s = await deviceSession("fu301a");
        const gB = gateAt("before_lock");
        const pB = call(startBody(s));
        await until(() => gB.arrived, "B planned, not yet locked");
        const rA = await call(startBody(s));
        assert.equal(rA.status, 402, JSON.stringify(rA.body));
        const jA = await latestJobId(s);
        const done = (await authOf(s))!;
        assert.equal(done.state, "abort_completed");
        assert.equal(done.abort_job_id, jA);
        assert.equal(await lockNow(s), null, "A's abort released A's lock");
        ledger.balance = 1;
        gB.release();
        const rB = await pB;
        assert.equal(rB.status, 200, JSON.stringify(rB.body));
        const jB = rB.body.job_id as string;
        assert.notEqual(jB, jA);
        await drain();
        let jobs = await sessionJobs(s);
        assert.deepEqual(jobs.map((j) => [j.job_id, j.status, j.failure_reason]), [
          [jA, "failed", "charge_refused"],
          [jB, "completed", null],
        ]);
        assert.equal(jobs[0].grant, false);
        assert.equal(jobs[0].marker, false);
        let rec = (await authOf(s))!;
        assert.equal(rec.state, "authorized");
        assert.equal(rec.charge_ref, done.charge_ref, "same charge_ref");
        assert.equal(rec.abort_job_id ?? null, null, "abort fields reset by the re-claim");
        assert.equal(rec.abort_attempt_id ?? null, null);
        assert.deepEqual(ledger.calls, [s.session_id, s.session_id]);
        assert.deepEqual(ledger.debits, [s.session_id], "one debit");
        assert.equal(bg.hosted, 1);
        assert.equal(analysisCalls, 1, "B's worker ran once");
        assert.equal(await lockNow(s), null, "lock released by the finished job");
        await assertNoLiveJob(s, "a");

        // (b) B reaches the lock while A's abort is still terminating (paused): B is held off.
        reset(0);
        s = await deviceSession("fu301b");
        const stepGate = deferred();
        let paused = false;
        service.__setRefusalAbortStepHookForTests(async (step) => {
          if (step === "clear_dispatch" && !paused) {
            paused = true;
            await stepGate.promise;
          }
        });
        const gB2 = gateAt("before_lock");
        const pB2 = call(startBody(s));
        await until(() => gB2.arrived, "B planned");
        const pA2 = call(startBody(s));
        await until(() => paused, "A claimed and is mid-abort");
        const jA2 = await latestJobId(s);
        const claimed = (await authOf(s))!;
        assert.equal(claimed.state, "abort_claimed");
        const lockA = (await lockNow(s))!;
        assert.equal(lockA.lock_token, claimed.abort_lock_token, "the abort is bound to A's lock");
        assert.equal(lockA.owner_attempt_id, claimed.abort_lock_owner_attempt_id);
        ledger.balance = 1;
        gB2.release();
        const rB2 = await pB2;
        assert.equal(rB2.status, 409, JSON.stringify(rB2.body));
        assert.equal(rB2.body.code, "CHARGE_ABORT_IN_PROGRESS");
        assert.deepEqual(await lockNow(s), lockA, "B did not touch A's lock");
        assert.equal((await sessionJobs(s)).length, 1, "B created no job");
        stepGate.resolve();
        assert.equal((await pA2).status, 402);
        rec = (await authOf(s))!;
        assert.equal(rec.state, "abort_completed");
        assert.equal(rec.abort_job_id, jA2);
        assert.equal(rec.abort_attempt_id, claimed.abort_attempt_id);
        jobs = await sessionJobs(s);
        assert.deepEqual(jobs.map((j) => [j.job_id, j.status, j.failure_reason, j.grant, j.marker]), [[jA2, "failed", "charge_refused", false, false]]);
        assert.equal(await lockNow(s), null);
        assert.deepEqual(ledger.calls, [s.session_id], "B did not charge");
        assert.equal(ledger.debits.length, 0);
        assert.equal(bg.hosted, 0);
        assert.equal(analysisCalls, 0);
        await assertNoLiveJob(s, "b");
      });

      await check("FU3-02 B holds the start lock in its window; A's abort recovery neither deletes B's lock nor creates / advances a job", async () => {
        // (a) A recovers an abandoned abort (status) while B holds the lock before its pre-check.
        reset(0);
        let s = await deviceSession("fu302a");
        let crashed = false;
        service.__setRefusalAbortStepHookForTests((step) => {
          if (step === "release_lock" && !crashed) {
            crashed = true;
            throw new Error("test: A0 died before release_lock");
          }
        });
        const r0 = await call(startBody(s));
        assert.equal(r0.body.code, "CHARGE_ABORT_IN_PROGRESS");
        const j0 = await latestJobId(s);
        const claimed = (await authOf(s))!;
        const lockA0 = (await lockNow(s))!;
        assert.equal(lockA0.lock_token, claimed.abort_lock_token);
        ledger.balance = 1;
        const restoreClock = advanceClock(STALE);
        try {
          const gB = gateAt("after_lock");
          const pB = call(startBody(s));
          await until(() => gB.arrived, "B took over the idle lock and holds it");
          const lockB = (await lockNow(s))!;
          assert.equal(lockB.owner_attempt_id, ownerOfGate(gB), "B owns the lock");
          assert.equal(lockB.holder, "start");
          const seen: string[] = [];
          service.__setRefusalAbortStepHookForTests((_step, jid) => {
            seen.push(jid);
          });
          const st = await statusOf(s, j0);
          assert.equal(st.status, "failed");
          assert.ok(seen.length > 0 && seen.every((j) => j === j0), `A recovered only ${j0}: ${seen.join(",")}`);
          assert.deepEqual(await lockNow(s), lockB, "B's lock survived A's release step");
          const rec = (await authOf(s))!;
          assert.equal(rec.state, "abort_completed");
          assert.equal(rec.abort_job_id, j0);
          assert.equal(rec.abort_attempt_id, claimed.abort_attempt_id);
          assert.equal((await sessionJobs(s)).length, 1, "recovery created no job");
          assert.equal(ledger.calls.length, 1, "recovery charged nothing");
          gB.release();
          const rB = await pB;
          assert.equal(rB.status, 200, JSON.stringify(rB.body));
          await drain();
        } finally {
          restoreClock();
        }
        let jobs = await sessionJobs(s);
        assert.equal(jobs.length, 2);
        assert.deepEqual(jobs.map((j) => [j.status, j.failure_reason]), [["failed", "charge_refused"], ["completed", null]]);
        assert.equal(jobs[0].job_id, j0);
        assert.deepEqual(ledger.debits, [s.session_id]);
        assert.deepEqual(ledger.calls, [s.session_id, s.session_id]);
        assert.equal(bg.hosted, 1);
        assert.equal(analysisCalls, 1);
        assert.equal(await lockNow(s), null);
        await assertNoLiveJob(s, "a");

        // (b) A read the abandoned abort and stalled before its resume CAS; C finished it; B is
        // in its create window. A's late resume loses the CAS: no step, B's lock intact.
        reset(0);
        s = await deviceSession("fu302b");
        crashed = false;
        service.__setRefusalAbortStepHookForTests((step) => {
          if (step === "fail_job" && !crashed) {
            crashed = true;
            throw new Error("test: A0 died before fail_job");
          }
        });
        await call(startBody(s));
        const j0b = await latestJobId(s);
        const claimedB = (await authOf(s))!;
        const restore2 = advanceClock(STALE);
        try {
          const gA = gateAt("before_resume_claim");
          const pA = statusOf(s, j0b);
          await until(() => gA.arrived, "A read the abandoned abort");
          const steps: string[] = [];
          service.__setRefusalAbortStepHookForTests((step, jid) => {
            steps.push(`${step}:${jid}`);
          });
          await statusOf(s, j0b); // C takes the resume right and finishes it
          assert.equal((await authOf(s))?.state, "abort_completed");
          const stepsByC = steps.length;
          ledger.balance = 1;
          const gB = gateAt("before_create");
          const pB = call(startBody(s));
          await until(() => gB.arrived, "B locked, passed the pre-check, in its create window");
          const lockB = (await lockNow(s))!;
          gA.release();
          await pA;
          assert.equal(steps.length, stepsByC, "A's late resume ran no termination step");
          assert.deepEqual(await lockNow(s), lockB, "B's lock intact");
          assert.equal((await sessionJobs(s)).length, 1, "nothing created by A");
          const rec = (await authOf(s))!;
          assert.equal(rec.abort_job_id, j0b);
          assert.equal(rec.abort_attempt_id, claimedB.abort_attempt_id);
          gB.release();
          assert.equal((await pB).status, 200);
          await drain();
        } finally {
          restore2();
        }
        jobs = await sessionJobs(s);
        assert.deepEqual(jobs.map((j) => [j.status, j.failure_reason]), [["failed", "charge_refused"], ["completed", null]]);
        assert.deepEqual(ledger.debits, [s.session_id]);
        assert.equal(analysisCalls, 1);
        assert.equal(await lockNow(s), null);
        await assertNoLiveJob(s, "b");
      });

      await check("FU3-03 the old pre-check timing: B (Regenerate) arrives while the record still reads `pending`; its pre-check runs only after it holds the lock → no orphan job", async () => {
        reset(0);
        const s = await deviceSession("fu303");
        const chargeGate = deferred();
        ledger.gates.push(chargeGate.promise);
        const pA = call(startBody(s));
        await until(() => ledger.calls.length === 1, "A inside the charge (record pending)");
        const jA = await latestJobId(s);
        const gB = gateAt("before_lock");
        const pB = call(startBody(s, true));
        await until(() => gB.arrived, "B is where the FU2 pre-check used to pass");
        assert.equal((await authOf(s))?.state, "pending", "a pre-check here would have passed");
        const stepGate = deferred();
        let atMark = false;
        service.__setRefusalAbortStepHookForTests(async (step) => {
          if (step === "mark_completed" && !atMark) {
            atMark = true;
            await stepGate.promise;
          }
        });
        chargeGate.resolve();
        await until(() => atMark, "A refused, claimed, terminated, released its lock; not yet completed");
        assert.equal(await lockNow(s), null, "the lock is free when B proceeds");
        gB.release();
        const rB = await pB;
        assert.equal(rB.status, 409, JSON.stringify(rB.body));
        assert.equal(rB.body.code, "CHARGE_ABORT_IN_PROGRESS");
        const bOwner = gB.owner!;
        const bTrace = startTrace.filter((t) => t.owner === bOwner).map((t) => t.point);
        assert.ok(bTrace.indexOf("after_lock") >= 0 && bTrace.indexOf("after_lock") < bTrace.indexOf("precheck"), `B checked only under its lock: ${bTrace.join(",")}`);
        assert.ok(!bTrace.includes("before_create"), "B never reached job creation");
        assert.equal(await lockNow(s), null, "B released its own lock");
        stepGate.resolve();
        assert.equal((await pA).status, 402);
        const jobs = await sessionJobs(s);
        assert.deepEqual(jobs.map((j) => [j.job_id, j.status, j.failure_reason, j.grant, j.marker]), [[jA, "failed", "charge_refused", false, false]], "only A's job, terminated");
        const rec = (await authOf(s))!;
        assert.equal(rec.state, "abort_completed");
        assert.equal(rec.abort_job_id, jA);
        assert.deepEqual(ledger.calls, [s.session_id]);
        assert.equal(ledger.debits.length, 0);
        assert.equal(bg.hosted, 0);
        assert.equal(analysisCalls, 0);
        await assertNoLiveJob(s, "end");
      });

      await check("FU3-04 A's lock released, B holds a new one; every delayed cleanup of A leaves B's lock alone", async () => {
        reset(1);
        const s = await deviceSession("fu304");
        bg.mode = "queue";
        const rA = await call(startBody(s));
        assert.equal(rA.status, 200);
        const j1 = rA.body.job_id as string;
        const lockA = (await lockNow(s))!;
        assert.equal(lockA.holder, "job");
        assert.equal(lockA.job_id, j1);
        const ownerA = lockMod.reportLockOwnerOf(lockA);
        await bg.queue.shift()!();
        assert.equal((await getXhighJob(j1))?.status, "completed");
        assert.equal(await lockNow(s), null, "A's job released its lock");

        bg.mode = "run";
        const gB = gateAt("before_create");
        const pB = call(startBody(s, true));
        await until(() => gB.arrived, "B holds a new start lock");
        const lockB = (await lockNow(s))!;
        assert.equal(lockB.owner_attempt_id, gB.owner);
        assert.notEqual(lockB.lock_token, lockA.lock_token);

        assert.equal(await lockMod.releaseOwnedReportLock(ownerA), "not_owner", "A's owner-checked release");
        assert.equal(await lockMod.releaseReportJobLock(s.session_id, j1), "not_owner", "A's job-bound release");
        await runner.runDecisionReportStage(j1, "assemble");
        await service.abortDecisionReportJob((await getXhighJob(j1))!, "late cleanup");
        const st = await statusOf(s, j1);
        assert.equal(st.status, "completed");
        assert.deepEqual(await lockNow(s), lockB, "B's lock intact after all of A's cleanups");

        gB.release();
        const rB = await pB;
        assert.equal(rB.status, 200, JSON.stringify(rB.body));
        await drain();
        const jobs = await sessionJobs(s);
        assert.deepEqual(jobs.map((j) => [j.job_id, j.status]), [[j1, "completed"], [rB.body.job_id, "completed"]]);
        assert.equal((await authOf(s))?.state, "authorized");
        assert.deepEqual(ledger.calls, [s.session_id], "Regenerate free");
        assert.deepEqual(ledger.debits, [s.session_id]);
        assert.equal(bg.hosted, 2, "one worker per generation");
        assert.equal(analysisCalls, 1, "the frozen analysis is reused by the Regenerate");
        assert.equal(await lockNow(s), null);
        await assertNoLiveJob(s, "end");
      });

      await check("FU3-05 two starts race for one session (start×start, Regenerate×Regenerate) → one lock holder, one job, one charge, one worker", async () => {
        for (const regen of [false, true]) {
          reset(1);
          const s = await deviceSession(`fu305_${regen}`);
          const chargeGate = deferred();
          ledger.gates.push(chargeGate.promise);
          const g1 = gateAt("before_lock");
          const g2 = gateAt("before_lock");
          const p1 = call(startBody(s, regen));
          const p2 = call(startBody(s, regen));
          await until(() => g1.arrived && g2.arrived, "both planned");
          g1.release();
          g2.release();
          await until(() => ledger.calls.length === 1, "one start inside the charge");
          const loser = await Promise.race([p1.then((r) => r), p2.then((r) => r)]);
          assert.ok(
            loser.body.code === "REPORT_JOB_BUSY" || loser.body.worker === "awaiting_charge",
            `regen=${regen}: ${JSON.stringify(loser.body)}`,
          );
          const held = (await lockNow(s))!;
          assert.equal(held.holder, "start");
          assert.ok([g1.owner, g2.owner].includes(held.owner_attempt_id), "a racer owns the lock");
          assert.equal((await sessionJobs(s)).length, 1, `regen=${regen}: one job while charging`);
          chargeGate.resolve();
          const both = await Promise.all([p1, p2]);
          await drain();
          const ids = new Set(both.map((r) => r.body.job_id).filter(Boolean));
          assert.equal(ids.size, 1, JSON.stringify(both.map((r) => r.body)));
          const jobs = await sessionJobs(s);
          assert.deepEqual(jobs.map((j) => j.status), ["completed"], `regen=${regen}`);
          assert.equal(ledger.calls.length, 1);
          assert.deepEqual(ledger.debits, [s.session_id]);
          assert.equal(bg.hosted, 1);
          assert.equal(analysisCalls, 1);
          assert.equal((await authOf(s))?.state, "authorized");
          assert.equal(await lockNow(s), null);
          await assertNoLiveJob(s, `regen=${regen}`);
        }
      });

      const BOUNDARIES = ["revoke_grant", "fail_job", "clear_dispatch", "release_lock", "mark_completed", "complete_cas"] as const;
      for (const at of BOUNDARIES) {
        await check(`FU3-06.${at} abort dies at ${at}; another start holds the lock; recovery finishes only the original job and keeps that lock`, async () => {
          reset(0);
          const s = await deviceSession(`fu306_${at}`);
          const key = auth.di2ChargeAuthorizationKey(s.session_id);
          let crashed = false;
          service.__setRefusalAbortStepHookForTests((step) => {
            if (step === at && !crashed) {
              crashed = true;
              throw new Error(`test: abort died before ${step}`);
            }
          });
          const restoreCas = patchDurable({
            compareAndSetExact: (orig) => async (k, e, n, o) => {
              if (at === "complete_cas" && !crashed && k === key && (n as ChargeAuthorization).state === "abort_completed") {
                crashed = true;
                throw new Error("test: abort died at the completion CAS");
              }
              return orig(k, e, n, o);
            },
          });
          let r0;
          try {
            r0 = await call(startBody(s));
          } finally {
            restoreCas();
          }
          assert.ok(crashed);
          assert.equal(r0.body.code, "CHARGE_ABORT_IN_PROGRESS", JSON.stringify(r0.body));
          const j0 = await latestJobId(s);
          const claimed = (await authOf(s))!;
          assert.equal(claimed.state, "abort_claimed");
          const lockAtCrash = await lockNow(s);
          const releasedBeforeCrash = BOUNDARIES.indexOf(at) > BOUNDARIES.indexOf("release_lock");
          assert.equal(lockAtCrash === null, releasedBeforeCrash, "lock at crash");

          ledger.balance = 1;
          const restoreClock = advanceClock(STALE);
          try {
            const gB = gateAt("after_lock");
            const pB = call(startBody(s));
            await until(() => gB.arrived, "B holds the lock");
            const lockB = (await lockNow(s))!;
            assert.equal(lockB.owner_attempt_id, gB.owner);
            const seen = new Set<string>();
            service.__setRefusalAbortStepHookForTests((_step, jid) => {
              seen.add(jid);
            });
            const st = await statusOf(s, j0);
            assert.equal(st.status, "failed");
            assert.deepEqual([...seen], [j0], "only the original abort_job_id");
            assert.deepEqual(await lockNow(s), lockB, "recovery kept B's lock");
            const rec = (await authOf(s))!;
            assert.equal(rec.state, "abort_completed");
            assert.equal(rec.abort_job_id, j0);
            assert.equal(rec.abort_attempt_id, claimed.abort_attempt_id);
            assert.equal(rec.abort_lock_token, claimed.abort_lock_token, "still bound to the claimant's lock");
            assert.equal((await sessionJobs(s)).length, 1, "recovery created no job");
            gB.release();
            assert.equal((await pB).status, 200);
            await drain();
          } finally {
            restoreClock();
          }
          const jobs = await sessionJobs(s);
          assert.equal(jobs[0].job_id, j0);
          // A completed job keeps its dispatch marker until the marker TTL; the refused one has none.
          assert.deepEqual(jobs.map((j) => [j.status, j.failure_reason, j.marker]), [["failed", "charge_refused", false], ["completed", null, true]]);
          assert.equal(jobs[0].grant, false);
          assert.deepEqual(ledger.calls, [s.session_id, s.session_id], "same ref, re-charged once");
          assert.deepEqual(ledger.debits, [s.session_id]);
          assert.equal(analysisCalls, 1);
          assert.equal(await lockNow(s), null);
          await assertNoLiveJob(s, at);
        });
      }

      await check("FU3-07 fail closed: lock unwritable / unreadable, lock CAS lost, owner mismatch, resume right unconfirmed → no job, no charge, no dispatch, no foreign lock deleted", async () => {
        const mkProto = (await import("../lib/kv/memory-kv")).MemoryKv.prototype as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
        const patchProto = (name: string, wrap: (orig: (...a: unknown[]) => Promise<unknown>) => (...a: unknown[]) => Promise<unknown>) => {
          const orig = mkProto[name];
          mkProto[name] = wrap(orig);
          return () => {
            mkProto[name] = orig;
          };
        };

        // (a1) the lock cannot be written (NX create throws) → 503; nothing created or charged.
        reset(1);
        let s = await deviceSession("fu307a1");
        let lk = lockKey(s);
        let restore = patchProto("set", (orig) => async function (this: unknown, ...a: unknown[]) {
          if (a[0] === lk) throw new Error("test: lock write failed");
          return orig.apply(this, a);
        });
        let r;
        try {
          r = await call(startBody(s));
        } finally {
          restore();
        }
        assert.equal(r.status, 503, JSON.stringify(r.body));
        assert.equal(r.body.code, "REPORT_LOCK_UNCONFIRMED");
        assert.equal((await sessionJobs(s)).length, 0);
        assert.equal(await authOf(s), null);
        assert.equal(ledger.calls.length, 0);

        // (a2) a lock exists and cannot be read → 503; the lock is left as it was.
        reset(1);
        s = await deviceSession("fu307a2");
        lk = lockKey(s);
        const foreign = { ...lockMod.newReportLockOwner(s.session_id), version: 1, holder: "start", job_id: null, created_at: Date.now(), touched_at: Date.now() };
        await kv.set(lk, foreign, { ex: 3600 });
        restore = patchProto("get", (orig) => async function (this: unknown, ...a: unknown[]) {
          if (a[0] === lk) throw new Error("test: lock read failed");
          return orig.apply(this, a);
        });
        try {
          r = await call(startBody(s));
        } finally {
          restore();
        }
        assert.equal(r.status, 503);
        assert.equal(r.body.code, "REPORT_LOCK_UNCONFIRMED");
        assert.deepEqual(await kv.get(lk), foreign, "unreadable lock not deleted");
        assert.equal((await sessionJobs(s)).length, 0);
        assert.equal(ledger.calls.length, 0);

        // (b1) an idle start's lock, but the takeover CAS keeps losing → busy; nothing created.
        await kv.set(lk, { ...foreign, touched_at: Date.now() - 2 * lockMod.REPORT_START_LOCK_IDLE_MS }, { ex: 3600 });
        const idle = await kv.get(lk);
        restore = patchProto("compareAndSetExact", (orig) => async function (this: unknown, ...a: unknown[]) {
          if (a[0] === lk) return false;
          return orig.apply(this, a);
        });
        try {
          r = await call(startBody(s));
        } finally {
          restore();
        }
        assert.equal(r.status, 409, JSON.stringify(r.body));
        assert.equal(r.body.code, "REPORT_JOB_BUSY");
        assert.deepEqual(await kv.get(lk), idle, "lost CAS changed nothing");
        assert.equal((await sessionJobs(s)).length, 0);
        assert.equal(ledger.calls.length, 0);
        await kv.del(lk);

        // (b2) authorized, but the hand-off CAS is lost → no grant, no dispatch, lock not deleted;
        // a later start (after the idle window) carries the paid job on without a second debit.
        reset(1);
        s = await deviceSession("fu307b2");
        lk = lockKey(s);
        restore = patchProto("compareAndSetExact", (orig) => async function (this: unknown, ...a: unknown[]) {
          if (a[0] === lk && (a[2] as { holder?: string })?.holder === "job") return false;
          return orig.apply(this, a);
        });
        try {
          r = await call(startBody(s));
        } finally {
          restore();
        }
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.worker, "none");
        const jb2 = r.body.job_id as string;
        let jobs = await sessionJobs(s);
        assert.deepEqual(jobs.map((j) => [j.status, j.grant, j.marker]), [["pending", false, false]]);
        assert.equal(bg.hosted, 0);
        assert.equal(analysisCalls, 0);
        assert.equal((await lockNow(s))?.holder, "start", "lock not deleted, not handed off");
        assert.equal((await authOf(s))?.state, "authorized");
        const restoreClock = advanceClock(STALE);
        try {
          r = await call(startBody(s));
        } finally {
          restoreClock();
        }
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.job_id, jb2, "same job carried on");
        await drain();
        jobs = await sessionJobs(s);
        assert.deepEqual(jobs.map((j) => j.status), ["completed"]);
        assert.deepEqual(ledger.debits, [s.session_id], "no second debit");
        assert.equal(ledger.calls.length, 1);
        assert.equal(analysisCalls, 1);
        assert.equal(await lockNow(s), null);

        // (c) owner mismatch: A's lock was taken during its charge → its refusal cannot claim
        // an abort; nothing of the new owner's is deleted.
        reset(0);
        s = await deviceSession("fu307c");
        lk = lockKey(s);
        const gate = deferred();
        ledger.gates.push(gate.promise);
        const pA = call(startBody(s));
        await until(() => ledger.calls.length === 1, "A charging");
        const jc = await latestJobId(s);
        const other = { ...lockMod.newReportLockOwner(s.session_id), version: 1, holder: "start", job_id: null, created_at: Date.now(), touched_at: Date.now() };
        await kv.set(lk, other, { ex: 3600 });
        gate.resolve();
        r = await pA;
        assert.equal(r.status, 503, JSON.stringify(r.body));
        assert.equal(r.body.code, "CHARGE_UNCONFIRMED");
        assert.deepEqual(await kv.get(lk), other, "the other owner's lock is intact");
        const recC = (await authOf(s))!;
        assert.equal(recC.state, "refused", "no abort claimed without the lock");
        assert.equal(recC.abort_job_id ?? null, null);
        assert.equal(recC.abort_attempt_id ?? null, null);
        jobs = await sessionJobs(s);
        assert.deepEqual(jobs.map((j) => [j.job_id, j.status, j.grant, j.marker]), [[jc, "pending", false, false]]);
        assert.equal(bg.hosted, 0);
        assert.equal(lockMod.isReportLockOwnedBy(other as never, lockMod.newReportLockOwner(s.session_id)), false);
        assert.equal(await lockMod.releaseOwnedReportLock(lockMod.newReportLockOwner(s.session_id)), "not_owner");
        assert.equal(await lockMod.releaseReportJobLock(s.session_id, jc), "not_owner");
        assert.deepEqual(await kv.get(lk), other);
        await kv.del(lk);
        // the job is not orphaned: the next start reuses it and the refusal is then claimed
        r = await call(startBody(s));
        assert.equal(r.status, 402, JSON.stringify(r.body));
        await assertNoLiveJob(s, "c");
        assert.equal((await authOf(s))?.abort_job_id, jc);

        // (d) the resume right cannot be confirmed → no termination step, nothing deleted.
        reset(0);
        s = await deviceSession("fu307d");
        lk = lockKey(s);
        let died = false;
        service.__setRefusalAbortStepHookForTests((step) => {
          if (step === "revoke_grant" && !died) {
            died = true;
            throw new Error("test: died before revoke_grant");
          }
        });
        await call(startBody(s));
        const jd = await latestJobId(s);
        const claimedD = (await authOf(s))!;
        const lockD = await kv.get(lk);
        const steps: string[] = [];
        service.__setRefusalAbortStepHookForTests((step) => {
          steps.push(step);
        });
        const akey = auth.di2ChargeAuthorizationKey(s.session_id);
        let resumeWrite = false;
        const restoreD = patchDurable({
          compareAndSetExact: (orig) => async (k, e, n, o) => {
            if (k === akey && (n as ChargeAuthorization).abort_resumer_id) {
              resumeWrite = true;
              throw new Error("test: resume right write failed");
            }
            return orig(k, e, n, o);
          },
          get: (orig) => async <T,>(k: string) => {
            if (k === akey && resumeWrite) throw new Error("test: record unreadable");
            return orig<T>(k);
          },
        });
        const restoreClockD = advanceClock(STALE);
        try {
          await statusOf(s, jd);
          const c = await call({ action: "continue", session_id: s.session_id, job_id: jd });
          assert.equal(c.status, 503, JSON.stringify(c.body));
        } finally {
          restoreClockD();
          restoreD();
        }
        assert.ok(resumeWrite);
        assert.deepEqual(steps, [], "no termination step without the resume right");
        assert.deepEqual(await kv.get(lk), lockD, "the abort's lock untouched");
        assert.deepEqual(await authOf(s), claimedD, "record unchanged");
        assert.equal((await sessionJobs(s)).length, 1);
        assert.equal(ledger.calls.length, 1);
        assert.equal(bg.hosted, 0);
        assert.equal(analysisCalls, 0);
      });

      await check("FU3-08 after a completed abort: start and Regenerate take and release the lock normally; same charge_ref, one debit, one live execution chain", async () => {
        reset(0);
        const s = await deviceSession("fu308");
        const r0 = await call(startBody(s));
        assert.equal(r0.status, 402);
        const j0 = await latestJobId(s);
        const refused = (await authOf(s))!;
        assert.equal(refused.state, "abort_completed");
        assert.equal(await lockNow(s), null);

        ledger.balance = 1;
        bg.mode = "queue";
        const r1 = await call(startBody(s));
        assert.equal(r1.status, 200, JSON.stringify(r1.body));
        const j1 = r1.body.job_id as string;
        const l1 = (await lockNow(s))!;
        assert.equal(l1.holder, "job");
        assert.equal(l1.job_id, j1, "lock handed to the authorized job");
        assert.equal((await sessionJobs(s)).find((j) => j.job_id === j1)?.grant, true);
        await bg.queue.shift()!();
        assert.equal(await lockNow(s), null, "released by its job");

        const r2 = await call(startBody(s, true));
        assert.equal(r2.status, 200);
        const j2 = r2.body.job_id as string;
        assert.equal((await lockNow(s))?.job_id, j2);
        await bg.queue.shift()!();
        assert.equal(bg.queue.length, 0);

        const jobs = await sessionJobs(s);
        assert.deepEqual(jobs.map((j) => [j.job_id, j.status, j.failure_reason]), [
          [j0, "failed", "charge_refused"],
          [j1, "completed", null],
          [j2, "completed", null],
        ]);
        const rec = (await authOf(s))!;
        assert.equal(rec.state, "authorized");
        assert.equal(rec.charge_ref, refused.charge_ref);
        assert.equal(rec.abort_job_id ?? null, null);
        assert.deepEqual(ledger.calls, [s.session_id, s.session_id], "refused once, charged once; Regenerate free");
        assert.deepEqual(ledger.debits, [s.session_id]);
        assert.equal(bg.hosted, 2, "one worker per generation");
        assert.equal(analysisCalls, 1, "the frozen analysis is reused by the Regenerate");
        const fence = await (await import("../lib/poju/xhigh-job-store")).getFdExecutionFence(s.session_id);
        assert.equal(fence?.authorized_job_id, j2, "the fence authorizes only the latest generation");
        assert.equal(await lockNow(s), null);
        await assertNoLiveJob(s, "end");
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
