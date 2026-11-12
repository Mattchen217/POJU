/**
 * M6 full lifecycle integration: one fresh Session through adaptive intake,
 * confirmation, server Freeze, report generation, client delivery and recovery.
 * Deterministic interpretation / report model hooks replace network model calls.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { armIdbWriteFault } from "./fixtures/idb-storage-fault";
import {
  di2AnalysisJson,
  di2PageJson,
  DI2_FIXTURE_BIRTH,
} from "./fixtures/di2-report-fixture";

installIntakeR6TestGlobals("dev_m6_di2_lifecycle");
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0),
  configurable: true,
  writable: true,
});

let passed = 0;
let failed = 0;
async function check(label: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  PASS  ${label}`); }
  catch (e) { failed++; console.error(`  FAIL  ${label}`); console.error(e); }
}

async function main() {
  console.log("M6 Decision Intake 2.0 full lifecycle");
  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const sm = await import("../lib/poju/session-manager");
  const { createStoredProfile } = await import("../lib/profile/stored-profiles-service");
  const { loadSessionProfileBundle } = await import("../lib/poju/session-profile");
  const { __setM1rPersistForTests } = await import("../lib/poju/decision-intake");
  const { handleUserMessage: rawHandle } = await import("../lib/poju/agent");
  const { withDeterministicHandleHooks } = await import("./fixtures/test-answer-interpretation-hook");
  const handleUserMessage: typeof rawHandle = (input) => rawHandle(withDeterministicHandleHooks(input));
  const { evaluateDecisionSufficiency } = await import("../lib/poju/decision-context/stop-criteria");
  const { loadFreezeProfileInput } = await import("../lib/poju/decision-authority/client-freeze");
  const { runWithEphemeralXhighKv, getXhighJob } = await import("../lib/poju/xhigh-job-store");
  const pa = await import("../lib/poju/decision-intake/personal-analysis");
  const pages = await import("../lib/poju/decision-intake/decision-report-pages");
  const store = await import("../lib/poju/decision-intake/decision-report-store");
  const runner = await import("../lib/poju/decision-intake/decision-report-runner");
  const api = await import("../lib/poju/decision-intake/decision-report-api");
  const client = await import("../lib/poju/decision-intake/decision-report-client");
  const chargeAuth = await import("../lib/poju/decision-intake/decision-report-charge");
  const authorityTransport = await import("../lib/poju/decision-authority/client-transport");
  const authorityService = await import("../lib/poju/decision-authority/server/service");

  await __resetPojuDbForTests();
  await ensurePojuDbReady();
  type Session = import("../lib/poju/types").POJUSessionState;
  type Json = Record<string, unknown>;
  type PageId = import("../lib/llm/pro/delivery/page-feed-matrix").DecisionPageId;

  let analysisCalls = 0;
  let analysisOutput = di2AnalysisJson();
  let evidenceIdMap: Record<string, string> = {};
  const remapEvidenceIds = (value: unknown): unknown => {
    if (typeof value === "string") return evidenceIdMap[value] ?? value;
    if (Array.isArray(value)) return value.map(remapEvidenceIds);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remapEvidenceIds(v)]));
    return value;
  };
  const pageCalls: PageId[] = [];
  pa.__setPersonalAnalysisModelForTests(async () => {
    analysisCalls++;
    return { content: analysisOutput, model: "m6-test-hook", tokens_used: 1 };
  });
  pages.__setDecisionReportPageModelForTests(async ({ pageId }) => {
    pageCalls.push(pageId);
    return { content: JSON.stringify(remapEvidenceIds(JSON.parse(di2PageJson(pageId)))), model: "m6-test-hook", tokens_used: 1 };
  });

  const charges: string[] = [];
  const inFlight = new Set<Promise<void>>();
  const backgroundQueue: Array<() => Promise<void>> = [];
  let backgroundMode: "run" | "queue" = "run";
  const deps: import("../lib/poju/decision-intake/decision-report-api").DecisionReportApiDeps = {
    background: (task) => {
      if (backgroundMode === "queue") { backgroundQueue.push(task); return; }
      const p = new Promise<void>((resolve) => setTimeout(resolve, 0)).then(task);
      inFlight.add(p); void p.finally(() => inFlight.delete(p));
    },
    attachWaitMs: 50,
    charge: async ({ sessionId }) => { charges.push(sessionId); return { ok: true }; },
    modelConfigured: () => true,
  };
  const authorityCall = async (action: import("../lib/poju/decision-authority/server/service").DecisionAuthorityAction, body: object) =>
    (await authorityService.handleDecisionAuthority(action, body as Record<string, unknown>)).body;
  authorityTransport.setDecisionAuthorityTransport({
    append: async (req) => await authorityCall("append", req) as import("../lib/poju/decision-authority/types").DcLedgerAppendResponse,
    freeze: async (req) => await authorityCall("freeze", req) as import("../lib/poju/decision-authority/types").FreezeSealResponse,
    recoverFreeze: async (req) => await authorityCall("recover_freeze", req) as import("../lib/poju/decision-authority/types").FreezeRecoverResponse,
    registerProfile: async (req) => await authorityCall("register_profile", req) as import("../lib/poju/decision-authority/types").ProfileRegisterResponse,
    head: async (req) => await authorityCall("head", req) as { ok: true; head: import("../lib/poju/decision-authority/types").DcLedgerHeadRef | null },
  });
  const drain = async () => { while (inFlight.size) await Promise.all([...inFlight]); };
  const ENDPOINT = "/api/poju/decision-report";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "/api/poju/chat") return new Response(JSON.stringify({ response: "FREEFORM MUST NOT LEAK", collection_progress: "advancing", question_status: "asked" }), { status: 200 });
    if (url !== ENDPOINT) throw new Error(`unexpected fetch ${url}`);
    const body = JSON.parse(String(init?.body ?? "{}")) as Json;
    const reply = await api.handleDecisionReportAction(body, deps);
    if (reply.kind === "response") return reply.response;
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    await runWithEphemeralXhighKv(async () => {
      const profile = await createStoredProfile({ birth_info: {
        ...DI2_FIXTURE_BIRTH,
        birth_location: { name: "Shanghai", longitude: 121.47, latitude: 31.23, timezone: "Asia/Shanghai" },
      } });
      const sid = await sm.createPOJUSession({ payment_id: "pay_m6_lifecycle", original_question: "要不要离职去创业？", selected_stored_profile_id: profile.profile_id });
      let session = (await sm.loadPOJUSession(sid))!;
      assert.equal(session.decision_context ?? null, null);
      const altId = await sm.createPOJUSession({ payment_id: "pay_m6_alt", original_question: "Should I marry my partner or continue dating?" });
      const alt = (await sm.loadPOJUSession(altId))!;
      const altOut = await handleUserMessage({ session: alt, userMessage: "I am deciding whether to marry my partner or continue dating.", locale: "en" });
      await sm.savePOJUSession(altOut);
      const altStored = (await sm.loadPOJUSession(altId))!;
      assert.ok(altStored.decision_blueprint?.directions.length);

      await check("fresh Session bootstraps DC + Blueprint + authorized first adaptive question", async () => {
        const out = await handleUserMessage({ session, userMessage: "我在犹豫要不要离职去创业，家里还有贷款和孩子。", locale: "zh" });
        await sm.savePOJUSession(out);
        session = (await sm.loadPOJUSession(sid))!;
        assert.ok(session.decision_context && session.decision_blueprint && session.adaptive_ask_plan);
        assert.equal(session.decision_context!.status, "draft");
        const assistant = [...session.messages].reverse().find((m) => m.role === "assistant");
        assert.equal(assistant?.content, session.adaptive_ask_plan!.question_text);
        assert.notEqual(assistant?.content, "FREEFORM MUST NOT LEAK");
        assert.notDeepEqual(
          session.decision_blueprint!.ddr_ids ?? session.decision_blueprint!.topic_tags,
          altStored.decision_blueprint!.ddr_ids ?? altStored.decision_blueprint!.topic_tags,
          `topic scope should differ: work=${JSON.stringify(session.decision_blueprint)} housing=${JSON.stringify(altStored.decision_blueprint)}`,
        );
        const profileBundle = await loadSessionProfileBundle(session);
        assert.equal(profileBundle.resolved_profile_id, profile.profile_id);
        assert.ok(profileBundle.profile?.birth, "stored birth profile is available even before base analysis exists");
         assert.equal(profileBundle.base_analysis, null, "the selected stored profile intentionally has no base analysis");
      });

      await check("Fresh Session DC persistence failure is fail-closed without a freeform question", async () => {
        const failedId = await sm.createPOJUSession({ payment_id: "pay_m6_dc_fail", original_question: "Should I accept a job offer?" });
        const failedSession = (await sm.loadPOJUSession(failedId))!;
        __setM1rPersistForTests(async (previous) => ({ session: previous, committed: false, error: "m6_forced_dc_write_failure" }));
        try {
          const out = await handleUserMessage({ session: failedSession, userMessage: "我正在考虑是否接受新的工作邀请。", locale: "zh" });
          const assistant = [...out.messages].reverse().find((m) => m.role === "assistant");
          assert.ok(assistant);
          assert.notEqual(assistant!.content, "FREEFORM MUST NOT LEAK");
          assert.equal(out.decision_context ?? null, null);
          assert.equal((assistant as { meta?: { m1_fail_closed?: boolean } }).meta?.m1_fail_closed, true);
        } finally { __setM1rPersistForTests(null); }
      });

      await check("multi-turn answers update DC/Understanding and replan without repeating", async () => {
        let previousPlan = session.adaptive_ask_plan;
        let previousQuestionText = [...session.messages].reverse().find((m) => m.role === "assistant")?.content;
        assert.ok(previousPlan && previousQuestionText);
        assert.equal(previousQuestionText, previousPlan!.question_text);
        const answerCounts: Record<string, number> = {};
        const targetedAnswers: Record<string, (count: number) => string> = {
          biz_model: () => "企业咨询按项目收费，先从运营改善和现金流诊断切入；已有两名潜在客户意向，启动成本主要是时间和差旅。",
          desired_outcome: () => "期望三年内形成稳定的独立咨询收入，同时家庭现金流和照护安排保持稳定。",
          goal_priority: () => "目标优先顺序是先保家庭现金流，再看成长空间，最后才考虑名义职位。",
          stakes: (count) => count === 1
            ? "如果判断错，可能损失六个月生活储备，还会影响孩子学费和父母照护。"
            : "具体来说，最坏是储蓄耗尽后仍没有客户收入，届时要停止创业并恢复受雇收入。",
          unacceptable: () => "不可接受家庭现金流中断、孩子学费断供，或拿住房抵押去赌创业。",
          exit_criterion: () => "退出条件是连续六个月入不敷出，或核心客户全丢就立刻停止并回到受雇工作。",
          hard_constraint: () => "硬约束是存款仅够撑六个月，孩子学费不能中断，父母照护必须落实。",
          option: () => "现实选项是继续留任、申请内部转岗、先兼职试做企业咨询再考虑离职。",
          risk_tolerance: () => "明确的风险上限是家庭月收入最多下降一半、持续不超过十二个月；若低于月开支底线就立即回撤。",
          status_quo: () => "目前大厂工作稳定、月薪覆盖房贷与家用但成长停滞；维持一年大概还能继续储蓄。",
          timing_window: () => "公司下季度会完成转岗评估，我需要在季度末前决定是否启动创业试点。",
          past_attempt: () => "过去没有正式创业；做过一次周末咨询试单，花两周找到客户需求但没有收费。",
          irreversibility: () => "离职会失去固定工资和福利；先不辞职、用周末做付费试点，仍然可以撤回。",
          validation_capacity: () => "我可以用四周分别访谈两名意向客户，争取拿到一份付费小单，投入上限两万元。",
        };
        const assertPlanHasBlueprintTarget = (plan: NonNullable<typeof session.adaptive_ask_plan>) => {
          const blueprint = session.decision_blueprint!;
          const direction = blueprint.directions.find((item) => item.direction_id === plan.direction_id);
          assert.ok(direction, `plan direction ${plan.direction_id} must exist in the current Blueprint`);
          assert.ok(plan.dir_ids.length > 0, "plan must target at least one DIR");
          assert.ok(plan.dir_ids.every((id) => blueprint.dir_ids.includes(id) && direction!.dir_ids.includes(id)),
            `plan DIRs must trace through Blueprint direction: ${JSON.stringify(plan)}`);
          assert.ok(plan.ddr_ids.length > 0, "plan must target at least one DDR");
          assert.ok(plan.ddr_ids.every((id) => (blueprint.ddr_ids ?? []).includes(id) || (direction!.ddr_ids ?? []).includes(id)),
            `plan DDRs must trace through Blueprint: ${JSON.stringify(plan)}`);
        };
        assertPlanHasBlueprintTarget(previousPlan!);
        for (let turn = 0; turn < 20; turn++) {
          if (session.decision_understanding?.readiness.can_ask === false) break;
          const currentPlan = session.adaptive_ask_plan!;
          const assistantQuestion = [...session.messages].reverse().find((m) => m.role === "assistant");
          assert.equal(assistantQuestion?.content, currentPlan.question_text, "displayed question must match the authorized plan");
          assert.equal(assistantQuestion?.content, previousQuestionText, "carry forward the exact question the user is answering");
          assertPlanHasBlueprintTarget(currentPlan);
          const role = currentPlan.fact_role_codes.map((code) => code.split("/role/").pop() ?? "").find((item) => item in targetedAnswers);
          assert.ok(role, `no targeted answer fixture for ${currentPlan.fact_role_codes.join(",")}; refusing a generic filler answer`);
          const answerCount = answerCounts[role!] ?? 0;
          const answer = targetedAnswers[role!]!(answerCount);
          answerCounts[role!] = answerCount + 1;
          const priorDcVersion = session.decision_context!.version;
          const out = await handleUserMessage({ session, userMessage: answer, locale: "zh" });
          await sm.savePOJUSession(out);
          session = (await sm.loadPOJUSession(sid))!;
          assert.ok(session.decision_context && session.decision_understanding);
          assert.ok(session.decision_context!.version > priorDcVersion, `targeted answer for ${role} must update the DC`);
          const userTurnId = [...session.messages].reverse().find((m) => m.role === "user")?.client_id;
          assert.ok(userTurnId, "each handled user answer must have a stable turn id");
          const writtenFacts = session.decision_context!.reality_facts.filter((fact) => fact.source_turn_id === userTurnId);
          const writtenConstraints = session.decision_context!.constraints.filter((item) => item.source_turn_id === userTurnId);
          assert.ok([...writtenFacts, ...writtenConstraints].some((item) => item.related_dir_ids?.some((id) => currentPlan.dir_ids.includes(id))),
            `answer must write evidence for its active plan target ${currentPlan.dir_ids.join(",")}`);
          assert.equal(session.decision_understanding!.context_version, session.decision_context!.version,
            "Understanding must be rebuilt from the just-updated DC");
          if (session.adaptive_ask_plan) {
            const nextPlan = session.adaptive_ask_plan;
            assert.notEqual(nextPlan.plan_id, currentPlan.plan_id, "replanning must produce a new plan identity");
            const sameQuestionClarification = Boolean(
              nextPlan.conflict_clarification &&
              currentPlan.conflict_clarification?.conflict_id === nextPlan.conflict_clarification.conflict_id,
            );
            assert.ok(nextPlan.question_text !== previousQuestionText || sameQuestionClarification,
              `changed plan_id cannot mask a repeated question outside an explicit same-Conflict clarification: ${nextPlan.question_text}`);
            const assistant = [...session.messages].reverse().find((m) => m.role === "assistant");
            assert.equal(assistant?.content, nextPlan.question_text, "new assistant message must exactly match the new plan question_text");
            assertPlanHasBlueprintTarget(nextPlan);
            previousPlan = nextPlan;
            previousQuestionText = assistant?.content;
          }
        }
        assert.equal(session.agent_v2?.current_phase, "awaiting_confirmation");
        assert.equal(session.decision_understanding?.readiness.can_ask, false);
        assert.equal(session.decision_understanding?.readiness.verdict, "ready_for_final_confirm");
        console.log(`[M6 readiness] verdict=${session.decision_understanding?.readiness.verdict}; can_ask=false; answered_targets=${Object.keys(answerCounts).length}`);
      });

      await check("explicit user confirmation through handleUserMessage reaches authority Freeze", async () => {
        const before = session;
        const freezeProfile = await loadFreezeProfileInput(before);
        assert.equal(freezeProfile?.profile_id, profile.profile_id, "formal Freeze profile loader must resolve the selected stored profile");
        assert.ok(freezeProfile?.birth_info, "formal Freeze profile loader must return birth input without base_analysis");
        assert.equal((await loadSessionProfileBundle(before)).base_analysis, null);
        const out = await handleUserMessage({ session, userMessage: "确认", locale: "zh" });
        assert.equal(out.decision_context?.status, "final", "the confirmation entry itself must complete Freeze");
        assert.ok(out.decision_context?.content_hash);
        const freezeReceipt = out.dc_freeze_receipts?.find((receipt) => receipt.session_id === sid);
        assert.ok(freezeReceipt, "confirmation-returned Session must include its Freeze Receipt");
        const profileReceipt = out.dc_profile_receipts?.find((receipt) => receipt.freeze_id === freezeReceipt!.freeze_id);
        assert.ok(profileReceipt, "confirmation-returned Session must include the Profile Receipt for that Freeze");
        assert.equal(freezeReceipt!.session_id, sid);
        assert.equal(profileReceipt!.session_id, sid);
        assert.equal(profileReceipt!.freeze_id, freezeReceipt!.freeze_id);
        assert.equal(profileReceipt!.profile_id, profile.profile_id,
          "Profile Receipt must bind the originally selected stored profile");
        console.log(`[M6 confirmation] Freeze=${freezeReceipt!.freeze_id}; Profile=${profileReceipt!.profile_id}; Session=${profileReceipt!.session_id}; sufficiency=${evaluateDecisionSufficiency(out.decision_context!).canStop}`);
        await sm.savePOJUSession(out);
        session = (await sm.loadPOJUSession(sid))!;
        assert.ok(session.decision_context);
        assert.equal(session.decision_context!.status, "final");
        assert.ok(session.decision_context!.content_hash);
        assert.ok(session.confirmation_events!.length > (before.confirmation_events?.length ?? 0));
        assert.ok(session.dc_freeze_receipts?.length && session.dc_profile_receipts?.length);
        assert.ok(session.dc_freeze_receipts!.some((receipt) => receipt.freeze_id === freezeReceipt!.freeze_id));
        assert.ok(session.dc_profile_receipts!.some((receipt) =>
          receipt.session_id === sid && receipt.freeze_id === freezeReceipt!.freeze_id && receipt.profile_id === profile.profile_id));
        assert.equal(evaluateDecisionSufficiency(session.decision_context!).canStop, true);
        const dc = session.decision_context!;
        const factIds = dc.reality_facts.map((f) => f.fact_id);
        const estimateId = dc.reality_facts.find((f) => f.verification_level === "user_estimate")?.fact_id ?? factIds[0]!;
        const confirmedId = dc.reality_facts.find((f) => f.status === "confirmed")?.fact_id ?? factIds[0]!;
        const constraintId = dc.constraints[0]?.constraint_id ?? confirmedId;
        const hypothesisId = dc.hypotheses[0]?.hypothesis_id ?? confirmedId;
        const dirId = dc.dirs[0]?.dir_id ?? confirmedId;
        evidenceIdMap = { f_unv: estimateId, f_conf: confirmedId, f_est: estimateId, c1: constraintId, h1: hypothesisId, dir_options: dirId, cf1: dirId };
        const analysisDraft = JSON.parse(di2AnalysisJson()) as {
          decision_tendencies: Array<{ basis_class: string; evidence_refs: string[] }>;
          decision_path_implications: Array<{ basis_class: string; evidence_refs: string[] }>;
        };
        analysisDraft.decision_tendencies[0]!.basis_class = "user_estimate";
        analysisDraft.decision_tendencies[0]!.evidence_refs = ["f_est"];
        analysisDraft.decision_path_implications[0]!.basis_class = "user_estimate";
        analysisDraft.decision_path_implications[0]!.evidence_refs = ["f_est"];
        analysisOutput = JSON.stringify(remapEvidenceIds(analysisDraft));
        assert.ok(dc.reality_facts.some((f) => f.verification_level === "user_estimate" && f.status !== "confirmed"));
      });

      await check("report client starts one authorized job and completes eight bound pages", async () => {
        backgroundMode = "queue";
        const ac = new AbortController();
        const interrupted = await client.runDecisionReportForSession(session, "zh", {
          pollMs: 5,
          signal: ac.signal,
          onProgress: (p) => { if (p.job_id) ac.abort(); },
        });
        const pending = (await sm.loadPOJUSession(sid))!;
        const jobId = pending.pending_decision_report_job_id;
        assert.ok(jobId, "client interruption persists the active job id");
        assert.notEqual(interrupted.main_delivery_done, true);
        assert.equal(charges.length, 1);
        assert.ok(backgroundQueue.length, "worker is queued while the client is interrupted");
        let turns = 0;
        while (backgroundQueue.length && turns++ < 30) await backgroundQueue.shift()!();
        assert.ok(turns < 30, "queued report worker drains without runaway dispatch");
        const completedJob = await getXhighJob(jobId!);
        assert.equal(completedJob?.status, "completed");

        // The server has a complete immutable record, but the client's final IndexedDB
        // transaction aborts. It must not mark the local Session delivered.
        let writeFaultHits = 0;
        await assert.rejects(client.runDecisionReportForSession(pending, "zh", {
          pollMs: 5,
          persist: async (candidate) => {
            if (candidate.main_delivery_done) {
              const fault = armIdbWriteFault("pojuSessionRecords");
              try { await sm.savePOJUSession(candidate); writeFaultHits = fault.hits(); }
              finally { writeFaultHits = fault.hits(); fault.restore(); }
            } else await sm.savePOJUSession(candidate);
          },
        }));
        assert.ok(writeFaultHits > 0, "final local delivery transaction was faulted");
        const afterFault = (await sm.loadPOJUSession(sid))!;
        assert.notEqual(afterFault.main_delivery_done, true);
        assert.equal(afterFault.pending_decision_report_job_id, jobId);

        // Refresh/reopen selects the same completed server job and commits it locally.
        backgroundMode = "run";
        const completed = await client.runDecisionReportForSession(afterFault, "zh", { pollMs: 5 });
        await drain();
        session = (await sm.loadPOJUSession(sid))!;
        assert.equal(completed.main_delivery_done, true);
        const row = client.latestDi2ReportRow(session, client.currentDi2FreezeId(session)!);
        assert.equal(row?.status, "completed");
        assert.equal(row?.pages.length, 8);
        assert.equal(new Set(row!.pages.map((p) => p.pageId)).size, 8);
        assert.ok(row!.pages.every((p) => p.status === "completed" && p.content.trim()));
        assert.equal(charges.length, 1);
        assert.equal(analysisCalls, 1);
        assert.equal(new Set(pageCalls).size, pageCalls.length, "a page model was never called twice");
        assert.ok(pageCalls.length >= 7, "all model-backed page sections were generated");
        const reportJobId = row!.xhigh_job_id;
        assert.ok(typeof reportJobId === "string");
        const stored = await store.loadCompletedReport(sid, reportJobId);
        assert.ok(stored);
        assert.equal(stored!.job_id, row!.xhigh_job_id);
        assert.equal(stored!.context_hash, session.decision_context!.content_hash);
        assert.equal(stored!.execution_generation, row!.execution_generation);
        assert.equal(stored!.freeze_id, client.currentDi2FreezeId(session));
        assert.equal(stored!.analysis.status, "completed");
        assert.ok(stored!.pages.length === 8);
        assert.ok(stored!.pages.every((p) => p.status === "completed" &&
          p.job_id === stored!.job_id &&
          p.execution_generation === stored!.execution_generation &&
          p.freeze_id === stored!.freeze_id &&
          p.context_hash === stored!.context_hash &&
          p.analysis_id === stored!.analysis.analysis_id));
        const job = await getXhighJob(reportJobId);
        assert.equal(job?.status, "completed");
        assert.equal((await chargeAuth.verifyDecisionReportDelivery(job!)).ok, true);
        const paRecord = (session.personal_analysis_records ?? []).find((r) => r.analysis_id === stored!.analysis_id);
        assert.equal(paRecord?.status, "completed");
        assert.ok(paRecord?.analysis_result);
        assert.ok(paRecord!.analysis_result!.decision_path_implications.some((i) => i.basis_class === "user_estimate"));
        const evidenceIds = new Set(paRecord!.analysis_result!.evidence_references.map((r) => r.ref_id));
        for (const section of [paRecord!.analysis_result!.personal_pattern_analysis, paRecord!.analysis_result!.personal_strengths,
          paRecord!.analysis_result!.personal_risks, paRecord!.analysis_result!.decision_tendencies,
          paRecord!.analysis_result!.constraint_interaction, paRecord!.analysis_result!.decision_path_implications]) {
          for (const item of section) for (const ref of item.evidence_refs) assert.ok(evidenceIds.has(ref), `missing evidence ${ref}`);
        }
        assert.equal(session.decision_context!.reality_facts.some((f) => f.source_stage === "personal_analysis"), false);
      });

      await check("delivered Session does not auto-start again or regenerate analysis/pages", async () => {
        const priorCharges = charges.length;
        const priorAnalysis = analysisCalls;
        const priorPages = pageCalls.length;
        const deliveredHtml = session.deliverable_html?.delivery;
        assert.ok(deliveredHtml, "client delivery must persist the filled report HTML");
        const { decisionReportSlotIds } = await import("../lib/deliverables/fill-delivery");
        const { deliveryTopicFromSignals } = await import("../lib/llm/pro/delivery/slice-for-page");
        const topic = deliveryTopicFromSignals({
          question: session.agent_v2?.original_question ?? session.original_question,
        });
        const expectedPaneIds = decisionReportSlotIds(topic);
        const deliveredPaneIds = Array.from(deliveredHtml!.matchAll(/<section\b[^>]*data-slot-pane="([^"]+)"/g), (match) => match[1]);
        const deliveredTocIds = Array.from(deliveredHtml!.matchAll(/<button\b[^>]*data-slot="([^"]+)"/g), (match) => match[1]);
        assert.deepEqual(deliveredPaneIds, expectedPaneIds, "delivered HTML must retain the expected report page order");
        assert.deepEqual(deliveredTocIds, expectedPaneIds, "delivered contents must link each page exactly once");
        assert.equal(client.di2ReportNeedsAutoStart(session), false);
        const again = await client.runDecisionReportForSession(session, "zh", { pollMs: 5 });
        await drain();
        assert.equal(again.main_delivery_done, true);
        assert.equal(charges.length, priorCharges);
        assert.equal(analysisCalls, priorAnalysis);
        assert.equal(pageCalls.length, priorPages);
      });

      await check("status after refresh returns the completed report bound to the same Job", async () => {
        const row = client.latestDi2ReportRow(session, client.currentDi2FreezeId(session)!);
        const before = { charge: charges.length, analysis: analysisCalls, pages: pageCalls.length };
        const status = await api.handleDecisionReportAction({ action: "status", session_id: sid, job_id: row!.xhigh_job_id }, deps);
        assert.equal(status.kind, "json");
        if (status.kind === "json") assert.equal((status.body as Json).status, "completed");
        assert.deepEqual({ charge: charges.length, analysis: analysisCalls, pages: pageCalls.length }, before);
      });
    });
  } finally {
    globalThis.fetch = originalFetch;
    pa.__setPersonalAnalysisModelForTests(null);
    pages.__setDecisionReportPageModelForTests(null);
  }
  console.log(`\nM6 result: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
