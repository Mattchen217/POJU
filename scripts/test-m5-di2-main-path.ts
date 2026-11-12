/**
 * M5 — Decision Intake 2.0 main-path integration: durable report commit, worker
 * scheduling recovery, client recovery state machine, one local completion write.
 *
 *   pnpm test:m5-di2-main-path
 *
 * Real: the route body (`handleDecisionReportAction`, JSON round-trip through a fetch
 * stub), service / runner / dispatch / store, execution fence, continue lease, dispatch
 * marker, M4 Freeze authority (in-process transport), production device Freeze wire,
 * session-manager CAS writes on IndexedDB (fake-indexeddb), the browser report client.
 * Replaced: the model network call (test hooks feed raw JSON into the production
 * validators), the background host (`after()` → a test scheduler that can run, drop,
 * queue or throw), `inngest.send`, the charge call.
 * Storage faults: process-memory KV (`durableKv()` MemoryKv / ephemeral MemoryKv)
 * method patches and fake-indexeddb transaction aborts. This is NOT an Upstash, real
 * Inngest/QStash, real HTTP, multi-browser or real OpenRouter validation.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";

import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { armIdbWriteFault } from "./fixtures/idb-storage-fault";
import {
  di2AnalysisJson,
  di2Blueprint,
  di2ConfirmationEvents,
  di2DraftDc,
  di2PageJson,
  DI2_FIXTURE_BIRTH,
  DI2_FIXTURE_QUESTION,
} from "./fixtures/di2-report-fixture";

installIntakeR6TestGlobals("dev_m5_di2_main_path");

const SESSION_STORE = "pojuSessionRecords";
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

async function main() {
  console.log("M5 Decision Intake 2.0 — main-path integration closure");

  const { kv, durableKv } = await import("../lib/kv/client");
  const { MemoryKv } = await import("../lib/kv/memory-kv");
  const { runWithEphemeralXhighKv, getXhighJob, failXhighJob, updateXhighJobStatus } = await import(
    "../lib/poju/xhigh-job-store"
  );
  const { xhighJobKey, xhighSessionLockKey } = await import("../lib/poju/xhigh-job-types");
  const stageStore = await import("../lib/llm/pro/delivery/delivery-stage-store");
  const pa = await import("../lib/poju/decision-intake/personal-analysis");
  const pagesMod = await import("../lib/poju/decision-intake/decision-report-pages");
  const store = await import("../lib/poju/decision-intake/decision-report-store");
  const service = await import("../lib/poju/decision-intake/decision-report-service");
  const runner = await import("../lib/poju/decision-intake/decision-report-runner");
  const api = await import("../lib/poju/decision-intake/decision-report-api");
  const client = await import("../lib/poju/decision-intake/decision-report-client");
  const { inngest } = await import("../lib/inngest/client");
  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const sm = await import("../lib/poju/session-manager");
  const wire = await import("../lib/poju/decision-context/production-freeze-wire");

  type POJUSessionState = import("../lib/poju/types").POJUSessionState;
  type DecisionPageId = import("../lib/llm/pro/delivery/page-feed-matrix").DecisionPageId;
  type JobInput = import("../lib/poju/decision-intake/decision-report-types").DecisionReportJobInput;
  type JobResult = import("../lib/poju/decision-intake/decision-report-types").DecisionReportJobResult;
  type StatusPayload = import("../lib/poju/decision-intake/decision-report-types").DecisionReportStatusPayload;
  type ApiDeps = import("../lib/poju/decision-intake/decision-report-api").DecisionReportApiDeps;
  type Json = Record<string, unknown>;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  // ─── model hooks (network replacement only) ───────────────────────────────

  let analysisCalls = 0;
  const pageCalls: DecisionPageId[] = [];
  const pageFailures = new Map<DecisionPageId, number>();
  pa.__setPersonalAnalysisModelForTests(async () => {
    analysisCalls += 1;
    return { content: di2AnalysisJson(), model: "test-hook", tokens_used: 10 };
  });
  pagesMod.__setDecisionReportPageModelForTests(async ({ pageId }) => {
    pageCalls.push(pageId);
    const left = pageFailures.get(pageId) ?? 0;
    if (left > 0) {
      pageFailures.set(pageId, left - 1);
      return { content: "not json", model: "test-hook", tokens_used: 1 };
    }
    return { content: di2PageJson(pageId), model: "test-hook", tokens_used: 5 };
  });

  // ─── background host (the route's `after()`) + charge ─────────────────────

  type BgMode = "run" | "drop" | "queue" | "throw";
  const bg = { mode: "run" as BgMode, hosted: 0, queue: [] as Array<() => Promise<void>> };
  const inflight = new Set<Promise<void>>();
  const charges: string[] = [];
  const deps: ApiDeps = {
    background: (task) => {
      if (bg.mode === "throw") throw new Error("test: background host unavailable");
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
    charge: async ({ sessionId }) => {
      charges.push(sessionId);
      return { ok: true };
    },
    modelConfigured: () => true,
  };
  async function drain(): Promise<void> {
    while (inflight.size) await Promise.all([...inflight]);
  }

  // ─── fetch → route body (JSON round-trip) ─────────────────────────────────

  const actions: string[] = [];
  let tamperStatus: ((p: Json) => Json) | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url !== ENDPOINT) throw new Error(`unexpected fetch ${url}`);
    const body = JSON.parse(String(init?.body ?? "{}")) as Json;
    actions.push(String(body.action));
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
    const sid = await sm.createPOJUSession({ payment_id: `pay_m5_${tag}`, original_question: DI2_FIXTURE_QUESTION });
    const s = (await sm.loadPOJUSession(sid))!;
    const dc = di2DraftDc(`ctx_${tag}`);
    await sm.savePOJUSessionCore({
      ...s,
      decision_blueprint: di2Blueprint(sid, dc),
      confirmation_events: di2ConfirmationEvents(dc),
      selected_stored_profile_id: "p_m5",
      has_profile: true,
      decision_context: dc,
    } as POJUSessionState);
    const r = await wire.ensureSessionFrozenForDelivery((await sm.loadPOJUSession(sid))!, {
      trigger: "sufficiency_end_confirm",
      profile: { profile_id: "p_m5", birth_info: DI2_FIXTURE_BIRTH },
    });
    assert.ok(r.ok && !r.skipped, JSON.stringify(r).slice(0, 400));
    const out = (await sm.loadPOJUSession(sid))!;
    assert.equal(out.decision_context?.status, "final");
    assert.equal(out.dc_freeze_receipts?.length, 1);
    assert.equal(out.dc_profile_receipts?.length, 1);
    return out;
  }

  function startBody(s: POJUSessionState, regenerate = false): Json {
    return {
      action: "start",
      session_id: s.session_id,
      locale: "zh",
      regenerate,
      writer_token: s.dc_ledger!.writer_token,
      freeze_receipt: s.dc_freeze_receipts![0],
      profile_receipt: s.dc_profile_receipts![0],
    };
  }

  async function status(s: POJUSessionState, job_id: string): Promise<StatusPayload> {
    return (await call({ action: "status", session_id: s.session_id, job_id })).body as unknown as StatusPayload;
  }

  function freezeIdOf(s: POJUSessionState): string {
    return client.currentDi2FreezeId(s)!;
  }

  /** Client start whose first progress tick aborts it (tab closed right after start). */
  async function startThenClose(s: POJUSessionState): Promise<{ session: POJUSessionState; job_id: string }> {
    const ac = new AbortController();
    await client.runDecisionReportForSession(s, "zh", {
      pollMs: 5,
      signal: ac.signal,
      onProgress: (p) => {
        if (p.job_id) ac.abort();
      },
    });
    const stored = (await sm.loadPOJUSession(s.session_id))!;
    const job_id = stored.pending_decision_report_job_id;
    assert.ok(job_id, "pending job id persisted before the tab closed");
    return { session: stored, job_id };
  }

  /** Kill the process right after the durable report write (fence CAS never runs). */
  async function runKilledAfterRecordWrite(job_id: string): Promise<void> {
    const d = durableKv() as unknown as { set: (...a: unknown[]) => Promise<unknown> };
    const origSet = d.set;
    const proto = MemoryKv.prototype as unknown as { compareAndSetJobGeneration: (...a: unknown[]) => Promise<unknown> };
    const origCas = proto.compareAndSetJobGeneration;
    let armed = false;
    d.set = async function patched(this: unknown, ...a: unknown[]) {
      const r = await origSet.apply(durableKv(), a);
      if (String(a[0]).startsWith("poju-di2:report:")) armed = true;
      return r;
    };
    proto.compareAndSetJobGeneration = async function patched(this: unknown, ...a: unknown[]) {
      if (armed) throw new Error("test: process killed");
      return origCas.apply(this, a);
    };
    let killed: unknown = null;
    try {
      await runner.runDecisionReportStage(job_id, "finalize");
    } catch (e) {
      killed = e;
    } finally {
      d.set = origSet;
      proto.compareAndSetJobGeneration = origCas;
    }
    assert.ok(armed, "durable record was written before the kill");
    assert.match(String(killed), /process killed/);
  }

  /** The dead worker's lease runs out (TTL semantics: expires_at in the past). */
  async function expireLease(job_id: string): Promise<void> {
    const key = stageStore.deliveryContinueLeaseKey(job_id);
    const lease = await kv.get<Json>(key);
    assert.ok(lease, "dead worker left its lease");
    await kv.set(key, { ...lease, expires_at: Date.now() - 1 });
  }

  /** The dispatch marker's grace window has elapsed (TTL expiry). */
  async function expireDispatchMarker(job_id: string): Promise<void> {
    await kv.del(store.di2DispatchKey(job_id));
  }

  async function assertDelivered(session_id: string, job_id: string): Promise<POJUSessionState> {
    const s = (await sm.loadPOJUSession(session_id))!;
    const rec = await store.loadCompletedReport(session_id, job_id);
    assert.ok(rec, "server record exists");
    const row = client.latestDi2ReportRow(s, freezeIdOf(s));
    assert.equal(row?.status, "completed");
    assert.equal(row?.xhigh_job_id, job_id);
    assert.equal(row?.execution_generation, rec!.execution_generation);
    assert.equal(row?.analysis_id, rec!.analysis_id);
    assert.equal(row?.profile_hash, rec!.profile_hash);
    assert.equal(row?.binding.contentHash, rec!.context_hash);
    assert.equal(row?.pages.length, 8);
    for (const p of row!.pages) {
      assert.equal(p.status, "completed", `page ${p.pageId}`);
      assert.ok(p.content.trim().length > 0, `page ${p.pageId} content`);
    }
    const a = (s.personal_analysis_records ?? []).find((r) => r.analysis_id === rec!.analysis_id);
    assert.equal(a?.status, "completed");
    assert.equal(s.main_delivery_done, true);
    assert.equal(s.pending_decision_report_job_id ?? null, null);
    assert.deepEqual(s.last_delivery_context_binding, {
      context_id: rec!.context_id,
      context_version: rec!.context_version,
      context_hash: rec!.context_hash,
    });
    assert.equal(client.di2ReportNeedsAutoStart(s), false, "a complete report never auto-starts");
    assert.equal(client.di2ReportShouldResume(s), false);
    return s;
  }

  function assertNotDelivered(s: POJUSessionState, job_id: string): void {
    assert.equal(s.pending_decision_report_job_id, job_id, "pending job id kept");
    assert.ok(!s.main_delivery_done, "not delivered");
    const row = client.latestDi2ReportRow(s, freezeIdOf(s));
    assert.notEqual(row?.status, "completed");
  }

  function reset(): void {
    analysisCalls = 0;
    pageCalls.length = 0;
    pageFailures.clear();
    actions.length = 0;
    bg.mode = "run";
    bg.queue.length = 0;
    tamperStatus = null;
  }

  await runWithEphemeralXhighKv(
    async () => {
      // ═══ A. persistence ═══════════════════════════════════════════════════

      let a1: { s: POJUSessionState; job_id: string } = null as never;

      await check("A1 durable write: job completes only after the record commits; record carries full identity", async () => {
        reset();
        const s = await deviceSession("a1");
        const r = await call(startBody(s));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const job_id = r.body.job_id as string;
        await drain();
        const job = await getXhighJob(job_id);
        assert.equal(job?.status, "completed", `${job?.status} ${job?.error}`);
        const rec = await store.loadCompletedReport(s.session_id, job_id);
        assert.ok(rec);
        store.verifyCompletedReportRecord(rec!);
        const input = job!.input as JobInput;
        assert.equal(rec!.freeze_id, input.freeze_id);
        assert.equal(rec!.context_hash, s.decision_context!.content_hash);
        assert.equal(rec!.profile_hash, input.profile_hash);
        assert.equal(rec!.freeze_receipt_id, s.dc_freeze_receipts![0]!.receipt_id);
        assert.equal(rec!.profile_receipt_id, s.dc_profile_receipts![0]!.receipt_id);
        assert.equal(rec!.execution_generation, job!.execution_generation);
        assert.equal(rec!.analysis.status, "completed");
        assert.equal(rec!.analysis.analysis_id, rec!.analysis_id);
        assert.equal(rec!.pages.length, 8);
        assert.deepEqual(job!.result, rec!.result, "job result is the committed record result");
        const st = await status(s, job_id);
        assert.equal(st.status, "completed");
        assert.equal(st.result?.full_text, rec!.result.full_text);
        assert.equal(analysisCalls, 1);
        assert.equal(charges.filter((x) => x === s.session_id).length, 1);
        a1 = { s, job_id };
      });

      await check("A2 durable write failure → never completed, retryable; Continue commits without model calls", async () => {
        reset();
        const s = await deviceSession("a2");
        const d = durableKv() as unknown as { set: (...a: unknown[]) => Promise<unknown> };
        const origSet = d.set;
        let blocked = 0;
        d.set = async function patched(this: unknown, ...a: unknown[]) {
          if (String(a[0]).startsWith("poju-di2:report:")) {
            blocked += 1;
            throw new Error("test: durable store write rejected");
          }
          return origSet.apply(durableKv(), a);
        };
        let job_id = "";
        try {
          job_id = (await call(startBody(s))).body.job_id as string;
          await drain();
        } finally {
          d.set = origSet;
        }
        assert.ok(blocked >= 1, "the durable write was attempted and failed");
        const job = await getXhighJob(job_id);
        assert.equal(job?.status, "failed");
        assert.equal(job?.failure_reason, "report_persist_failed");
        assert.equal(job?.retryable, true);
        const st = await status(s, job_id);
        assert.equal(st.status, "failed");
        assert.equal(st.retryable, true);
        assert.equal(st.failure_reason, "report_persist_failed");
        assert.equal(st.result, null, "no result before the record exists");
        assert.equal(await store.loadCompletedReport(s.session_id, job_id), null);

        const calls = { a: analysisCalls, p: pageCalls.length };
        const c = await call({ action: "continue", session_id: s.session_id, job_id });
        assert.equal(c.body.ok, true, JSON.stringify(c.body));
        assert.equal(c.body.stage, "assemble");
        await drain();
        assert.equal((await getXhighJob(job_id))?.status, "completed");
        assert.ok(await store.loadCompletedReport(s.session_id, job_id));
        assert.deepEqual({ a: analysisCalls, p: pageCalls.length }, calls, "no analysis / page regenerated");
      });

      await check("A3 repeated final commit reuses the record; divergent content refused; replay is a no-op", async () => {
        const { s, job_id } = a1;
        const job = (await getXhighJob(job_id))!;
        const input = job.input as JobInput;
        const rec = (await store.loadCompletedReport(s.session_id, job_id))!;
        const analysis = (await store.loadAnalysis(input.analysis_key))!;
        const pages = (await store.loadAllPages(job_id)).map((p) => p.record);
        const draft = runner.completedReportDraft(
          input,
          job_id,
          job.execution_generation!,
          analysis.record,
          pages,
          job.result as JobResult,
          new Date().toISOString(),
        );
        const again = await store.commitCompletedReport(draft);
        assert.equal(again.outcome, "existing");
        assert.equal(again.record.record_hash, rec.record_hash);
        const altered = {
          ...draft,
          pages: draft.pages.map((p, i) => (i === 0 ? { ...p, content_markdown: `${p.content_markdown}\n(altered)` } : p)),
        };
        await assert.rejects(store.commitCompletedReport(altered), (e: { code?: string }) =>
          ["REPORT_RECORD_CONFLICT", "REPORT_RECORD_INVALID"].includes(e.code ?? ""),
        );
        reset();
        await runner.runDecisionReportStage(job_id, "assemble");
        assert.equal(analysisCalls + pageCalls.length, 0);
        assert.equal((await store.loadCompletedReport(s.session_id, job_id))!.record_hash, rec.record_hash);
      });

      let a4: { s: POJUSessionState; job_id: string; record_hash: string } = null as never;

      await check("A4 process killed after the record write → running, never completed; recovery reuses the record", async () => {
        reset();
        bg.mode = "drop";
        const s = await deviceSession("a4");
        const job_id = (await call(startBody(s))).body.job_id as string;
        await runKilledAfterRecordWrite(job_id);
        const job = await getXhighJob(job_id);
        assert.equal(job?.status, "running", "killed job stays running");
        assert.equal(job?.current_stage, "assemble");
        const rec = await store.loadCompletedReport(s.session_id, job_id);
        assert.ok(rec, "record survived the kill");
        const st = await status(s, job_id);
        assert.equal(st.status, "running", "status never reports completed for a job that did not complete");
        assert.equal(st.result, null);
        assert.equal(st.worker, "live", "dead worker's lease has not expired yet");
        a4 = { s, job_id, record_hash: rec!.record_hash };
      });

      await check("A5 job completed, client never received it, execution job expired → status serves the record", async () => {
        const { s, job_id } = a1;
        const rec = (await store.loadCompletedReport(s.session_id, job_id))!;
        await kv.del(xhighJobKey(job_id));
        const st = await status(s, job_id);
        assert.equal(st.status, "completed");
        assert.equal(st.result?.full_text, rec.result.full_text);
        assert.equal(st.pages.length, 8);
        assert.equal(st.analysis.record?.status, "completed");
        const c = await call({ action: "continue", session_id: s.session_id, job_id });
        assert.equal(c.status, 409);
        assert.equal(c.body.code, "ALREADY_COMPLETED");
      });

      await check("A5b completed job whose record went missing → status rebuilds the record from the job", async () => {
        reset();
        const s = await deviceSession("a5b");
        const job_id = (await call(startBody(s))).body.job_id as string;
        await drain();
        const before = (await store.loadCompletedReport(s.session_id, job_id))!;
        await durableKv().del(store.di2CompletedReportKey(s.session_id, job_id));
        const st = await status(s, job_id);
        assert.equal(st.status, "completed");
        assert.equal(st.result?.full_text, before.result.full_text);
        const after = await store.loadCompletedReport(s.session_id, job_id);
        assert.ok(after);
        store.verifyCompletedReportRecord(after!);
        assert.equal(analysisCalls, 1, "rebuild needed no model call");
      });

      await check("A6 old generation loses the fence after its record write → record withdrawn; new generation intact", async () => {
        reset();
        bg.mode = "drop";
        const s = await deviceSession("a6");
        const jobA = (await call(startBody(s))).body.job_id as string;
        const d = durableKv() as unknown as { set: (...a: unknown[]) => Promise<unknown> };
        const origSet = d.set;
        let jobB = "";
        d.set = async function patched(this: unknown, ...a: unknown[]) {
          const r = await origSet.apply(durableKv(), a);
          if (!jobB && a[0] === store.di2CompletedReportKey(s.session_id, jobA)) {
            const regen = await service.startDecisionReportJob({
              session_id: s.session_id,
              locale: "zh",
              writer_token: s.dc_ledger!.writer_token,
              freeze_receipt: s.dc_freeze_receipts![0],
              profile_receipt: s.dc_profile_receipts![0],
              regenerate: true,
            });
            assert.ok(regen.ok, regen.ok ? "" : regen.code);
            if (regen.ok) jobB = regen.job.job_id;
          }
          return r;
        };
        try {
          await runner.runDecisionReportStage(jobA, "finalize");
        } finally {
          d.set = origSet;
        }
        assert.ok(jobB, "regenerate ran between record write and job completion");
        assert.notEqual((await getXhighJob(jobA))?.status, "completed");
        assert.equal(await store.loadCompletedReport(s.session_id, jobA), null, "old generation withdrew its record");
        assert.notEqual((await status(s, jobA)).status, "completed");
        await runner.runDecisionReportStage(jobB, "finalize");
        const b = await getXhighJob(jobB);
        assert.equal(b?.status, "completed");
        const recB = (await store.loadCompletedReport(s.session_id, jobB))!;
        assert.ok(recB.execution_generation > ((await getXhighJob(jobA))?.execution_generation ?? 0));
        assert.equal(analysisCalls, 1, "new generation reused the completed analysis");
      });

      // ═══ B. scheduling ═════════════════════════════════════════════════════

      await check("B1 first dispatch failed → second start re-dispatches the same job; one charge", async () => {
        reset();
        const s = await deviceSession("b1");
        bg.mode = "throw";
        const r1 = await call(startBody(s));
        assert.equal(r1.status, 200);
        assert.equal(r1.body.reused, false);
        const job_id = r1.body.job_id as string;
        assert.equal(await store.loadDecisionReportDispatch(job_id), null, "failed dispatch cleared its marker");
        assert.equal((await status(s, job_id)).worker, "none");
        bg.mode = "run";
        const r2 = await call(startBody(s));
        assert.equal(r2.body.reused, true);
        assert.equal(r2.body.job_id, job_id);
        assert.equal(r2.body.worker, "dispatched");
        await drain();
        assert.equal((await getXhighJob(job_id))?.status, "completed");
        assert.equal(charges.filter((x) => x === s.session_id).length, 1);
        assert.equal(analysisCalls, 1);
      });

      await check("B2 Inngest published but no worker attached → hosted fallback; dead host → recovered after grace", async () => {
        reset();
        const target = inngest as unknown as { send: (...a: unknown[]) => Promise<unknown> };
        const origSend = target.send;
        const sends: unknown[] = [];
        target.send = async (ev: unknown) => {
          sends.push(ev);
          return { ids: ["test"] };
        };
        const prevKey = process.env.INNGEST_EVENT_KEY;
        process.env.INNGEST_EVENT_KEY = "test-key";
        try {
          const s1 = await deviceSession("b2a");
          const j1 = (await call(startBody(s1))).body.job_id as string;
          await drain();
          assert.equal(sends.length, 1, "relay published once");
          assert.equal((await getXhighJob(j1))?.status, "completed", "no attach → this invoke hosted the worker");

          bg.mode = "drop";
          const s2 = await deviceSession("b2b");
          const j2 = (await call(startBody(s2))).body.job_id as string;
          assert.equal((await status(s2, j2)).worker, "dispatching");
          const hosted = bg.hosted;
          const c1 = await call({ action: "continue", session_id: s2.session_id, job_id: j2 });
          assert.equal(c1.body.worker, "dispatch_in_flight", "inside the grace window nothing is re-dispatched");
          assert.equal(bg.hosted, hosted);
          await expireDispatchMarker(j2);
          assert.equal((await status(s2, j2)).worker, "none");
          bg.mode = "run";
          const c2 = await call({ action: "continue", session_id: s2.session_id, job_id: j2 });
          assert.equal(c2.body.worker, "dispatched");
          assert.equal(c2.body.stage, "finalize");
          await drain();
          assert.equal((await getXhighJob(j2))?.status, "completed");
          assert.equal(charges.filter((x) => x === s2.session_id).length, 1);
        } finally {
          target.send = origSend;
          if (prevKey === undefined) delete process.env.INNGEST_EVENT_KEY;
          else process.env.INNGEST_EVENT_KEY = prevKey;
        }
      });

      await check("B3 live lease → no second worker (continue / start / status)", async () => {
        reset();
        bg.mode = "drop";
        const s = await deviceSession("b3");
        const job_id = (await call(startBody(s))).body.job_id as string;
        await expireDispatchMarker(job_id);
        const lease = await stageStore.tryAcquireDeliveryContinueLease(job_id, "finalize");
        assert.ok(lease.ok);
        const hosted = bg.hosted;
        assert.equal((await status(s, job_id)).worker, "live");
        const c = await call({ action: "continue", session_id: s.session_id, job_id });
        assert.equal(c.body.worker, "worker_live");
        const again = await call(startBody(s));
        assert.equal(again.body.reused, true);
        assert.equal(again.body.worker, "worker_live");
        assert.equal(bg.hosted, hosted, "no dispatch while the lease is live");
        await runner.runDecisionReportStage(job_id, "finalize");
        assert.equal(analysisCalls, 0, "an overlapping invoke skips while the lease is held");
        await stageStore.forceReleaseDeliveryContinueLease(job_id);
      });

      await check("B4 expired lease of a killed worker → re-dispatch from checkpoints, same generation, no model calls", async () => {
        const { s, job_id, record_hash } = a4;
        reset();
        const gen = (await getXhighJob(job_id))!.execution_generation;
        const c1 = await call({ action: "continue", session_id: s.session_id, job_id });
        assert.equal(c1.body.worker, "worker_live", "lease still live → no steal");
        await expireLease(job_id);
        await expireDispatchMarker(job_id);
        assert.equal((await status(s, job_id)).worker, "none");
        const c2 = await call({ action: "continue", session_id: s.session_id, job_id });
        assert.equal(c2.body.worker, "dispatched");
        assert.equal(c2.body.stage, "assemble");
        await drain();
        const job = await getXhighJob(job_id);
        assert.equal(job?.status, "completed");
        assert.equal(job?.execution_generation, gen, "no new generation");
        assert.equal(analysisCalls + pageCalls.length, 0, "analysis and pages kept");
        assert.equal((await store.loadCompletedReport(s.session_id, job_id))!.record_hash, record_hash, "same record");
      });

      await check("B5 no double charge: reuse / continue / regenerate / second job after the first charge", async () => {
        const { s } = a1;
        const before = charges.length;
        const regen = await call(startBody(s, true));
        assert.equal(regen.body.ok, true, JSON.stringify(regen.body));
        assert.equal(regen.body.reused, false);
        await drain();
        assert.equal(charges.length, before, "regenerate is free");
        const counts = new Map<string, number>();
        for (const c of charges) counts.set(c, (counts.get(c) ?? 0) + 1);
        for (const [sid, n] of counts) assert.equal(n, 1, `session ${sid} charged ${n}×`);
        assert.equal(await store.hasDecisionReportCharge(s.session_id), true);
      });

      await check("B6 concurrent recovery requests → one dispatch; racing workers → one commit", async () => {
        reset();
        bg.mode = "queue";
        const s = await deviceSession("b6");
        const job_id = (await call(startBody(s))).body.job_id as string;
        bg.queue.length = 0; // the first host died before running
        await expireDispatchMarker(job_id);
        const replies = await Promise.all(
          Array.from({ length: 5 }, () => call({ action: "continue", session_id: s.session_id, job_id })),
        );
        const dispatched = replies.filter((r) => r.body.worker === "dispatched").length;
        assert.equal(dispatched, 1, JSON.stringify(replies.map((r) => r.body.worker)));
        assert.equal(bg.queue.length, 1);
        const task = bg.queue.shift()!;
        await Promise.all([
          task(),
          runner.runDecisionReportStage(job_id, "finalize"),
          runner.runDecisionReportStage(job_id, "finalize"),
        ]);
        assert.equal((await getXhighJob(job_id))?.status, "completed");
        assert.equal(analysisCalls, 1);
        assert.equal(new Set(pageCalls).size, pageCalls.length, `a page ran twice: ${pageCalls.join(",")}`);
        assert.ok(await store.loadCompletedReport(s.session_id, job_id));
      });

      await check("B7 session lock with no live job: young lock is respected, aged lock is reclaimed", async () => {
        reset();
        bg.mode = "drop";
        const s = await deviceSession("b7");
        const job_id = (await call(startBody(s))).body.job_id as string;
        await kv.del(xhighJobKey(job_id));
        const lockKey = xhighSessionLockKey("decision_report", s.session_id);
        await kv.set(lockKey, Date.now() - 10_000);
        const young = await call(startBody(s, true));
        assert.equal(young.body.code, "REPORT_JOB_BUSY", "a lock inside the create window is a concurrent start");
        await kv.set(lockKey, Date.now() - 3 * 60_000);
        const aged = await call(startBody(s, true));
        assert.equal(aged.body.ok, true, JSON.stringify(aged.body));
        assert.notEqual(aged.body.job_id, job_id);
        assert.equal(charges.filter((x) => x === s.session_id).length, 1);
      });

      // ═══ C. client recovery ════════════════════════════════════════════════

      let c1: { session_id: string; job_id: string } = { session_id: "", job_id: "" };

      await check("C1 refresh while running → polls the same job; no new job, no charge; delivered + persisted", async () => {
        reset();
        bg.mode = "queue";
        const s = await deviceSession("c1");
        const { session, job_id } = await startThenClose(s);
        assertNotDelivered(session, job_id);
        assert.equal(client.di2ReportShouldResume(session), true);
        assert.equal(client.di2ReportNeedsAutoStart(session), false);
        const worker = bg.queue.shift()!(); // the worker dispatched before the refresh
        bg.mode = "run";
        actions.length = 0;
        const done = await client.runDecisionReportForSession(session, "zh", { pollMs: 5 });
        await worker;
        assert.ok(!actions.includes("start"), actions.join(","));
        assert.equal(done.main_delivery_done, true);
        await assertDelivered(s.session_id, job_id);
        assert.equal(charges.filter((x) => x === s.session_id).length, 1);
        assert.equal(analysisCalls, 1);
        c1 = { session_id: s.session_id, job_id };
      });

      await check("C2 refresh after the worker was killed (lease expired) → client gets a worker; no restart", async () => {
        reset();
        bg.mode = "drop";
        const s = await deviceSession("c2");
        const { session, job_id } = await startThenClose(s);
        await runKilledAfterRecordWrite(job_id);
        await expireLease(job_id);
        await expireDispatchMarker(job_id);
        const calls = { a: analysisCalls, p: pageCalls.length };
        bg.mode = "run";
        actions.length = 0;
        await client.runDecisionReportForSession(session, "zh", { pollMs: 5 });
        await drain();
        assert.ok(!actions.includes("start"));
        assert.ok(actions.includes("continue"), "idle job got a worker via continue");
        assert.deepEqual({ a: analysisCalls, p: pageCalls.length }, calls);
        await assertDelivered(s.session_id, job_id);
      });

      await check("C3 retryable interruption → automatic Continue from checkpoints (same job)", async () => {
        reset();
        bg.mode = "drop";
        const s = await deviceSession("c3");
        const { session, job_id } = await startThenClose(s);
        await updateXhighJobStatus(job_id, "running", { current_stage: "segments" });
        const raw = (await kv.get<Json>(xhighJobKey(job_id)))!;
        await kv.set(xhighJobKey(job_id), { ...raw, updated_at: Date.now() - 10 * 60_000 });
        await expireDispatchMarker(job_id);
        const st = await status(s, job_id);
        assert.equal(st.status, "failed");
        assert.equal(st.failure_reason, "interrupted");
        bg.mode = "run";
        actions.length = 0;
        await client.runDecisionReportForSession(session, "zh", { pollMs: 5 });
        await drain();
        assert.equal(actions.filter((a) => a === "continue").length, 1);
        assert.ok(!actions.includes("start"));
        await assertDelivered(s.session_id, job_id);
        assert.equal(charges.filter((x) => x === s.session_id).length, 1);
      });

      await check("C4 permanent failure → explicit error, no automatic retry; identifiers kept", async () => {
        reset();
        bg.mode = "drop";
        const s = await deviceSession("c4");
        const { session, job_id } = await startThenClose(s);
        await failXhighJob(job_id, "test: unrecoverable", { retryable: false, failure_reason: "parse_failed" });
        actions.length = 0;
        await assert.rejects(client.runDecisionReportForSession(session, "zh", { pollMs: 5 }), (e: { code?: string; retryable?: boolean }) =>
          e.code === "REPORT_FAILED" && e.retryable === false,
        );
        assert.ok(!actions.includes("continue") && !actions.includes("start"), actions.join(","));
        const stored = (await sm.loadPOJUSession(s.session_id))!;
        assertNotDelivered(stored, job_id);
        const row = client.latestDi2ReportRow(stored, freezeIdOf(stored));
        assert.equal(row?.xhigh_job_id, job_id);
        assert.equal(typeof row?.execution_generation, "number");
      });

      await check("C4b quality 1+1 spent → stops without auto-Continue; user Continue resumes only the failed unit", async () => {
        reset();
        pageFailures.set("05", 2);
        const s = await deviceSession("c4b");
        await assert.rejects(client.runDecisionReportForSession(s, "zh", { pollMs: 5 }), (e: { code?: string; retryable?: boolean }) =>
          e.code === "REPORT_QUALITY_EXHAUSTED" && e.retryable === true,
        );
        await drain();
        assert.ok(!actions.includes("continue"), "no automatic quality retry");
        const stored = (await sm.loadPOJUSession(s.session_id))!;
        const job_id = stored.pending_decision_report_job_id!;
        assert.equal((await getXhighJob(job_id))?.failure_reason, "quality_exhausted");
        const doneBefore = (await store.loadAllPages(job_id))
          .filter((p) => p.record.status === "completed")
          .map((p) => p.record.page_id);
        pageCalls.length = 0;
        await client.continueDecisionReportForSession(stored, "zh", { pollMs: 5 });
        await drain();
        for (const id of doneBefore) assert.ok(!pageCalls.includes(id), `completed page ${id} regenerated`);
        assert.ok(pageCalls.includes("05"));
        await assertDelivered(s.session_id, job_id);
      });

      await check("C5 job completed but never received, job expired → refresh reads the committed report", async () => {
        reset();
        const s = await deviceSession("c5");
        bg.mode = "queue";
        const { session, job_id } = await startThenClose(s);
        await bg.queue.shift()!();
        assert.equal((await getXhighJob(job_id))?.status, "completed");
        await kv.del(xhighJobKey(job_id));
        const calls = { a: analysisCalls, p: pageCalls.length };
        actions.length = 0;
        await client.runDecisionReportForSession(session, "zh", { pollMs: 5 });
        assert.deepEqual(actions, ["status"]);
        assert.deepEqual({ a: analysisCalls, p: pageCalls.length }, calls);
        await assertDelivered(s.session_id, job_id);
      });

      await check("C5b job lost early (no report, session lock left behind) → one new generation, no new charge", async () => {
        reset();
        bg.mode = "drop";
        const s = await deviceSession("c5b");
        const { session, job_id } = await startThenClose(s);
        await kv.del(xhighJobKey(job_id));
        // The lock outlived its job and is past any create window.
        await kv.set(xhighSessionLockKey("decision_report", s.session_id), Date.now() - 3 * 60_000);
        bg.mode = "run";
        actions.length = 0;
        await client.runDecisionReportForSession(session, "zh", { pollMs: 5 });
        await drain();
        assert.equal(actions.filter((a) => a === "start").length, 1);
        const stored = (await sm.loadPOJUSession(s.session_id))!;
        const row = client.latestDi2ReportRow(stored, freezeIdOf(stored))!;
        assert.notEqual(row.xhigh_job_id, job_id);
        await assertDelivered(s.session_id, row.xhigh_job_id!);
        assert.equal(charges.filter((x) => x === s.session_id).length, 1);
      });

      await check("C6 complete report on the device → reload neither starts nor resumes generation", async () => {
        reset();
        const delivered = await assertDelivered(c1.session_id, c1.job_id);
        assert.equal(client.di2ReportNeedsAutoStart(delivered), false);
        assert.equal(client.di2ReportShouldResume(delivered), false);
        assert.equal(actions.length + analysisCalls + pageCalls.length, 0);
      });

      await check("C7 two tabs resume the same interrupted job → one Continue; both end delivered", async () => {
        reset();
        bg.mode = "drop";
        const s = await deviceSession("c7");
        const { session, job_id } = await startThenClose(s);
        await updateXhighJobStatus(job_id, "running", { current_stage: "segments" });
        const raw = (await kv.get<Json>(xhighJobKey(job_id)))!;
        await kv.set(xhighJobKey(job_id), { ...raw, updated_at: Date.now() - 10 * 60_000 });
        await expireDispatchMarker(job_id);
        bg.mode = "run";
        actions.length = 0;
        const results = await Promise.allSettled([
          client.runDecisionReportForSession(session, "zh", { pollMs: 5 }),
          client.runDecisionReportForSession(session, "zh", { pollMs: 5 }),
        ]);
        await drain();
        assert.equal(actions.filter((a) => a === "continue").length, 1, actions.join(","));
        assert.ok(!actions.includes("start"));
        assert.deepEqual(
          results.map((r) => r.status),
          ["fulfilled", "fulfilled"],
          JSON.stringify(results.map((r) => (r.status === "rejected" ? String(r.reason) : "ok"))),
        );
        for (const r of results) if (r.status === "fulfilled") assert.equal(r.value.main_delivery_done, true);
        await assertDelivered(s.session_id, job_id);
        assert.equal(analysisCalls, 1, "one worker ran the analysis");
      });

      // ═══ D. consistency ════════════════════════════════════════════════════

      /** Server-complete job the device has not received yet. */
      async function completedButNotReceived(tag: string): Promise<{ session: POJUSessionState; job_id: string }> {
        reset();
        const s = await deviceSession(tag);
        bg.mode = "queue";
        const out = await startThenClose(s);
        await bg.queue.shift()!();
        assert.equal((await getXhighJob(out.job_id))?.status, "completed");
        bg.mode = "run";
        return out;
      }

      async function refusedThenRefetched(
        tag: string,
        tamper: (p: Json) => Json,
        code: string,
      ): Promise<void> {
        const { session, job_id } = await completedButNotReceived(tag);
        tamperStatus = (p) => (p.status === "completed" ? tamper(JSON.parse(JSON.stringify(p)) as Json) : p);
        await assert.rejects(client.runDecisionReportForSession(session, "zh", { pollMs: 5 }), (e: { code?: string }) => e.code === code);
        tamperStatus = null;
        const stored = (await sm.loadPOJUSession(session.session_id))!;
        assertNotDelivered(stored, job_id);
        const calls = { a: analysisCalls, p: pageCalls.length };
        await client.runDecisionReportForSession(stored, "zh", { pollMs: 5 });
        assert.deepEqual({ a: analysisCalls, p: pageCalls.length }, calls);
        await assertDelivered(session.session_id, job_id);
      }

      await check("D1 missing page → not completed locally; refetch delivers", async () => {
        await refusedThenRefetched(
          "d1",
          (p) => ({ ...p, pages: (p.pages as Json[]).filter((x) => x.page_id !== "05") }),
          "REPORT_INCOMPLETE",
        );
      });

      await check("D2 Freeze binding mismatch (page / payload) → not completed", async () => {
        await refusedThenRefetched(
          "d2a",
          (p) => ({ ...p, pages: (p.pages as Json[]).map((x, i) => (i === 0 ? { ...x, freeze_id: "ctx_other@v1" } : x)) }),
          "REPORT_BINDING_MISMATCH",
        );
        await refusedThenRefetched("d2b", (p) => ({ ...p, context_hash: "0".repeat(64) }), "REPORT_BINDING_MISMATCH");
        await refusedThenRefetched(
          "d2c",
          (p) => ({ ...p, pages: (p.pages as Json[]).map((x, i) => (i === 1 ? { ...x, execution_generation: 999 } : x)) }),
          "REPORT_BINDING_MISMATCH",
        );
      });

      await check("D3 incomplete / foreign Personal Analysis → not completed", async () => {
        await refusedThenRefetched(
          "d3a",
          (p) => {
            const a = p.analysis as Json;
            return { ...p, analysis: { ...a, record: { ...(a.record as Json), status: "running" } } };
          },
          "REPORT_ANALYSIS_INCOMPLETE",
        );
        await refusedThenRefetched(
          "d3b",
          (p) => {
            const a = p.analysis as Json;
            return { ...p, analysis: { ...a, record: { ...(a.record as Json), analysis_id: "pa_other" } } };
          },
          "REPORT_ANALYSIS_INCOMPLETE",
        );
      });

      await check("D4 delivered Session survives a reload (one write: analysis, 8 pages, body, binding, pending cleared)", async () => {
        const { session, job_id } = await completedButNotReceived("d4");
        await client.runDecisionReportForSession(session, "zh", { pollMs: 5 });
        const reloaded = await assertDelivered(session.session_id, job_id);
        const deliveryMsgs = (reloaded.messages ?? []).filter((m) => m.meta?.contains_delivery);
        assert.ok(deliveryMsgs.length >= 1, "delivery body in the existing display path");
      });

      await check("D5 local save failure → not delivered, job id kept; next open refetches the full report", async () => {
        const { session, job_id } = await completedButNotReceived("d5");
        let hits = 0;
        const persist = async (next: POJUSessionState) => {
          if (next.main_delivery_done && !next.pending_decision_report_job_id) {
            const fault = armIdbWriteFault(SESSION_STORE, 1);
            try {
              await sm.savePOJUSession(next);
            } finally {
              hits += fault.hits();
              fault.restore();
            }
            return;
          }
          await sm.savePOJUSession(next);
        };
        await assert.rejects(client.runDecisionReportForSession(session, "zh", { pollMs: 5, persist }), (e: { code?: string; retryable?: boolean }) =>
          e.code === "LOCAL_SAVE_FAILED" && e.retryable === true,
        );
        assert.equal(hits, 1, "the final device write hit the storage fault");
        const stored = (await sm.loadPOJUSession(session.session_id))!;
        assertNotDelivered(stored, job_id);
        assert.equal(client.di2ReportShouldResume(stored), true);
        const calls = { a: analysisCalls, p: pageCalls.length };
        actions.length = 0;
        await client.runDecisionReportForSession(stored, "zh", { pollMs: 5 });
        assert.deepEqual(actions, ["status"]);
        assert.deepEqual({ a: analysisCalls, p: pageCalls.length }, calls);
        await assertDelivered(session.session_id, job_id);
      });

      await check("D6 final write loses a revision race (another writer) → re-applied onto the latest Session", async () => {
        const { session, job_id } = await completedButNotReceived("d6");
        const other = (await sm.loadPOJUSession(session.session_id))!;
        await sm.savePOJUSession({ ...other, m5_other_writer: true } as POJUSessionState);
        await client.runDecisionReportForSession(session, "zh", { pollMs: 5 });
        const reloaded = await assertDelivered(session.session_id, job_id);
        assert.equal((reloaded as unknown as { m5_other_writer?: boolean }).m5_other_writer, true, "other writer's change kept");
      });
    },
    { deadlineMs: 20 * 60_000 },
  );

  globalThis.fetch = originalFetch;
  pa.__setPersonalAnalysisModelForTests(null);
  pagesMod.__setDecisionReportPageModelForTests(null);
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
