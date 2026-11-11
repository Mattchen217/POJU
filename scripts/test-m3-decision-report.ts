/**
 * M3 — Decision Intake 2.0 Personal Analysis + Freeze-bound eight-page report.
 *
 *   pnpm test:m3-decision-report
 *
 * Real: Freeze / profile registries, local chart calculation, validators, job store,
 * execution fence, stage relay (inline under ephemeral KV), checkpoints, assembly.
 * Replaced: only the network model call (test hooks feed raw JSON into the
 * production validators). This is NOT a real OpenRouter / model validation.
 */
import assert from "node:assert/strict";

import { STRUCTURED_STRONG, STRUCTURED_WEAK } from "./_v2-fixtures";

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
  console.log("M3 Decision Intake 2.0 — Personal Analysis + eight-page report");

  const { computeContentHash } = await import("../lib/poju/decision-context/content-hash");
  const { DECISION_PAGE_IDS } = await import("../lib/llm/pro/delivery/page-feed-matrix");
  const { DECISION_PAGE_SCHEMAS } = await import("../lib/llm/pro/delivery/page-schema/decision-pages");
  const { runWithEphemeralXhighKv, getXhighJob, updateXhighJobStatus } = await import(
    "../lib/poju/xhigh-job-store"
  );
  const pa = await import("../lib/poju/decision-intake/personal-analysis");
  const pages = await import("../lib/poju/decision-intake/decision-report-pages");
  const store = await import("../lib/poju/decision-intake/decision-report-store");
  const service = await import("../lib/poju/decision-intake/decision-report-service");
  const runner = await import("../lib/poju/decision-intake/decision-report-runner");
  const types = await import("../lib/poju/decision-intake/decision-report-types");
  const fbr = await import("../lib/poju/decision-intake/freeze-bound-report");
  const client = await import("../lib/poju/decision-intake/decision-report-client");

  type DecisionContext = import("../lib/poju/decision-context/types").DecisionContext;
  type DecisionPageId = import("../lib/llm/pro/delivery/page-feed-matrix").DecisionPageId;

  const NOW = "2026-11-10T10:00:00.000Z";

  function makeDc(opts: { context_id: string; version: number; question: string; extraFact?: string }): DecisionContext {
    const dc: DecisionContext = {
      context_id: opts.context_id,
      version: opts.version,
      status: "final",
      definition: {
        concrete_event: "收到一份新的工作邀请，需要在两周内答复",
        stakes: "收入与家庭节奏",
        desired_outcome: "在不拖垮家庭节奏的前提下提升收入",
        decision_question: opts.question,
        goal_priorities: ["收入", "家庭节奏"],
        unacceptable_outcomes: ["半年内被迫再次换工作"],
      },
      reality_facts: [
        {
          fact_id: "f_conf",
          statement: "现岗位月收入已确认",
          status: "confirmed",
          verification_level: "user_asserted",
          source_stage: "collecting",
          source_turn_id: "t1",
          user_confirmed: true,
        },
        {
          fact_id: "f_unv",
          statement: "新公司团队氛围据说不错",
          status: "unverified",
          verification_level: "user_asserted",
          source_stage: "collecting",
          source_turn_id: "t2",
          user_confirmed: false,
        },
        {
          fact_id: "f_est",
          statement: "通勤大约多出四十分钟",
          status: "unverified",
          verification_level: "user_estimate",
          source_stage: "collecting",
          source_turn_id: "t3",
          user_confirmed: false,
        },
        ...(opts.extraFact
          ? [
              {
                fact_id: "f_extra",
                statement: opts.extraFact,
                status: "confirmed" as const,
                verification_level: "user_asserted" as const,
                source_stage: "user_supplement",
                source_turn_id: "t9",
                user_confirmed: true,
              },
            ]
          : []),
      ],
      constraints: [
        {
          constraint_id: "c1",
          statement: "两周内必须答复",
          category: "time",
          status: "confirmed",
          verification_level: "user_asserted",
          source_stage: "collecting",
          source_turn_id: "t1",
          rigidity: "hard",
          user_confirmed: true,
        },
      ],
      hypotheses: [
        {
          hypothesis_id: "h1",
          statement: "新岗位的成长空间可能高于现岗",
          supporting_evidence: [],
          counter_evidence: [],
          validation_need: "需要与未来上级谈一次",
          state: "proposed",
          related_dir_ids: ["dir_options"],
        },
      ],
      dirs: [
        {
          dir_id: "dir_options",
          need: "新岗位的真实职责范围",
          why: "决定路径排序",
          required_fact_roles: ["option"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          may_affect_p5_ranking: true,
          id_lifecycle: "active",
        },
        {
          dir_id: "dir_status_quo",
          need: "现岗位的稳定性",
          why: "对照基线",
          required_fact_roles: ["status_quo"],
          current_state: "known",
          partial_satisfaction: false,
          agenda_item_ids: [],
          may_affect_p5_ranking: false,
          id_lifecycle: "active",
        },
      ],
      conflicts: [
        {
          conflict_id: "cf1",
          fact_ids: ["f_unv"],
          conflict_field: "团队氛围",
          statements_snapshot: ["据说不错", "面试官显得急躁"],
          source_refs: [{ fact_id: "f_unv", source_stage: "collecting", source_turn_id: "t2" }],
          state: "unresolved_in_final",
          resolution: null,
          user_confirmation: false,
          affects_preferred_path: false,
        },
      ],
      content_hash: null,
      created_at: NOW,
      updated_at: NOW,
      information_boundaries: ["未见到正式合同条款"],
    };
    dc.content_hash = computeContentHash(dc);
    return dc;
  }

  const QUESTION_PLAIN = "要不要接受新公司的工作邀请";
  const QUESTION_TOPIC = "要不要迁移到另一座城市接受新工作";

  // ─── fake model (network replacement only) ────────────────────────────────

  let analysisCalls = 0;
  let analysisFailNext = 0;
  let analysisVariant: "good" | "upgrade" = "good";
  const pageCalls: DecisionPageId[] = [];
  const pageFailures = new Map<DecisionPageId, number>();

  function goodAnalysisJson(variant: "good" | "upgrade" = "good"): string {
    const item = (text: string, cls: string, refs: string[], basis = "日主得令，比劫帮身，行动偏主动") => ({
      text,
      traditional_basis: basis,
      science_note: null,
      basis_class: cls,
      evidence_refs: refs,
    });
    return JSON.stringify({
      personal_pattern_analysis: [
        item("你在压力下习惯先稳住节奏再出手，速度不是你的第一反应", "pattern_judgment", ["CFP-01"]),
        item("你更容易被长期确定性打动，而不是短期的额外回报", "pattern_judgment", ["CFP-02"]),
      ],
      personal_strengths: [item("你在需要耐心推进的局面里通常能守住质量", "pattern_judgment", ["CFP-01"])],
      personal_risks: [
        item("在信息不全时你可能因为想稳而错过窗口", "pattern_judgment", ["CFP-02", "f_unv"]),
      ],
      decision_tendencies: [
        item(
          "你倾向用别人口中的团队印象来补足自己没核实的部分",
          variant === "upgrade" ? "confirmed_fact" : "user_stated_unverified",
          ["f_unv", "CFP-01"],
        ),
      ],
      constraint_interaction: [
        item("两周的答复期限会放大你想稳的倾向，需要提前安排核实", "confirmed_fact", ["c1", "f_conf"]),
      ],
      decision_path_implications: [
        item("如果成长空间属实，接受邀请更符合你的长期偏好", "analysis_hypothesis", ["h1"]),
        item("多出的通勤时间可能侵蚀家庭节奏，这是估计值需要核实", "user_estimate", ["f_est"]),
      ],
      unresolved_conditions: [
        item("新岗位的职责范围与团队氛围仍未核实，会影响路径排序", "pattern_judgment", ["dir_options", "cf1"]),
      ],
      confidence: { overall: "medium", limits: ["合同条款未见，结论对薪资结构敏感"] },
    });
  }

  function pageJson(pageId: DecisionPageId, opts?: { scheduleLeak?: boolean; skipUnknown?: boolean }): string {
    const blocks = DECISION_PAGE_SCHEMAS[pageId].segments.map((seg) => ({
      segment_id: seg.id,
      heading: "",
      body: "这一段给出与当前决策直接相关的白话结论和理由，并说明它依赖哪些已确认的情况。",
      basis: "依据冻结事实与个人分析",
      evidence_refs: ["DEF", "PA-pattern-1"],
    }));
    const out: Record<string, unknown> = { title: `${DECISION_PAGE_SCHEMAS[pageId].title}`, blocks };
    if (pageId === "05") {
      const refs = opts?.skipUnknown ? ["f_conf"] : ["f_conf", "dir_options", "cf1"];
      out.paths = [
        {
          path_id: "P1",
          rank: 1,
          label: "先核实再接受",
          conditions: "职责范围与团队情况核实后仍符合预期",
          cost: "需要额外两次沟通",
          risk: "核实期间对方失去耐心",
          reversibility: "答复前可随时撤回",
          exit_condition: "核实结果与描述明显不符",
          ranking_basis: "兼顾收入目标与不可接受结果",
          evidence_refs: refs,
        },
        {
          path_id: "P2",
          rank: 2,
          label: "维持现岗再观察",
          conditions: "现岗稳定性保持不变",
          cost: "放弃这次收入提升",
          risk: "长期收入停滞",
          reversibility: "可在下个机会出现时再评估",
          exit_condition: "现岗出现裁员信号",
          ranking_basis: "稳定性已知但收入目标落空",
          evidence_refs: ["f_conf", "c1"],
        },
      ];
    }
    if (pageId === "06") {
      out.experiment = {
        hypothesis: "新岗位的职责与描述一致",
        action: opts?.scheduleLeak ? "第1天联系，第2天面谈，第3天复盘" : "约未来上级做一次三十分钟的职责确认",
        observe: "对方能否具体说出前三个月的交付",
        window: "答复期限之前",
        success: "职责描述具体且与预期一致",
        if_fail: "转向维持现岗路径",
        defer_costs: "等待正式合同再做职责确认",
        evidence_refs: ["dir_options", "c1"],
      };
    }
    if (pageId === "08") {
      out.review = {
        core_metrics: ["职责确认是否完成", "家庭节奏是否被打乱"],
        continue_when: "核实结果符合预期",
        adjust_when: "通勤成本高于估计",
        stop_when: "出现不可接受结果的迹象",
        rerun_when: "出现新的工作邀请或家庭情况变化",
        evidence_refs: ["c1", "dir_options"],
      };
    }
    return JSON.stringify(out);
  }

  pa.__setPersonalAnalysisModelForTests(async () => {
    analysisCalls += 1;
    if (analysisFailNext > 0) {
      analysisFailNext -= 1;
      return { content: "{\"not\":\"valid\"}", model: "test-hook", tokens_used: 1 };
    }
    return { content: goodAnalysisJson(analysisVariant), model: "test-hook", tokens_used: 10 };
  });
  pages.__setDecisionReportPageModelForTests(async ({ pageId }) => {
    pageCalls.push(pageId);
    const left = pageFailures.get(pageId) ?? 0;
    if (left > 0) {
      pageFailures.set(pageId, left - 1);
      return { content: "not json", model: "test-hook", tokens_used: 1 };
    }
    return { content: pageJson(pageId), model: "test-hook", tokens_used: 5 };
  });

  const projectionStrong = pa.buildProfileProjection(
    {
      profile_id: "p_strong",
      profile_hash: pa.computeProfileHash({ structured: STRUCTURED_STRONG, ziwei_closed_set: null }),
      structured: STRUCTURED_STRONG,
      ziwei_closed_set: null,
      registered_at: NOW,
    },
    { as_of: new Date(NOW) },
  );

  // ─── Part 1: Personal Analysis validator ──────────────────────────────────

  await check("chart projection is real local calculation with citeable lines", () => {
    assert.ok(projectionStrong.chart_lines.length >= 2, "need ≥2 chart lines");
    assert.equal(projectionStrong.chart_lines[0]!.ref_id, "CFP-01");
  });

  await check("valid analysis → artifact with deterministic target, refs and boundaries", () => {
    const dc = makeDc({ context_id: "ctx_a", version: 1, question: QUESTION_PLAIN });
    const before = JSON.stringify(dc);
    const v = pa.validatePersonalAnalysisOutput({
      raw: goodAnalysisJson(),
      dc,
      projection: projectionStrong,
      locale: "zh",
    });
    assert.ok(v.ok, v.ok ? "" : v.reason);
    if (!v.ok) return;
    assert.equal(v.artifact.decision_target.decision_question, QUESTION_PLAIN);
    const statuses = new Map(v.artifact.evidence_references.map((r) => [r.ref_id, r.status]));
    assert.equal(statuses.get("f_conf"), "confirmed_fact");
    assert.equal(statuses.get("f_unv"), "user_stated_unverified");
    assert.equal(statuses.get("f_est"), "user_estimate");
    assert.equal(statuses.get("h1"), "hypothesis");
    assert.equal(statuses.get("dir_options"), "dir_unknown");
    assert.equal(statuses.get("cf1"), "conflict_open");
    assert.ok(v.artifact.confidence_and_limits.information_boundaries.some((b) => b.includes("合同")));
    assert.equal(JSON.stringify(dc), before, "validator must not mutate the frozen DC");
    assert.equal(computeContentHash(dc), dc.content_hash);
  });

  await check("analysis may not upgrade an unverified statement to confirmed_fact", () => {
    const dc = makeDc({ context_id: "ctx_a", version: 1, question: QUESTION_PLAIN });
    const v = pa.validatePersonalAnalysisOutput({
      raw: goodAnalysisJson("upgrade"),
      dc,
      projection: projectionStrong,
      locale: "zh",
    });
    assert.equal(v.ok, false);
    assert.match(!v.ok ? v.reason : "", /confirmed_fact_upgrades:f_unv/);
  });

  await check("unresolved DIR / conflict must be carried into unresolved_conditions", () => {
    const dc = makeDc({ context_id: "ctx_a", version: 1, question: QUESTION_PLAIN });
    const raw = JSON.parse(goodAnalysisJson()) as Record<string, unknown>;
    raw.unresolved_conditions = [];
    const v = pa.validatePersonalAnalysisOutput({ raw: JSON.stringify(raw), dc, projection: projectionStrong, locale: "zh" });
    assert.equal(v.ok, false);
    assert.match(!v.ok ? v.reason : "", /unresolved_not_covered/);
  });

  await check("hypothesis class without a hypothesis ref is refused", () => {
    const dc = makeDc({ context_id: "ctx_a", version: 1, question: QUESTION_PLAIN });
    const raw = JSON.parse(goodAnalysisJson()) as Record<string, Array<Record<string, unknown>>>;
    raw.decision_path_implications![0]!.evidence_refs = ["f_conf"];
    const v = pa.validatePersonalAnalysisOutput({ raw: JSON.stringify(raw), dc, projection: projectionStrong, locale: "zh" });
    assert.equal(v.ok, false);
    assert.match(!v.ok ? v.reason : "", /hypothesis_class_without_hypothesis_ref/);
  });

  await check("pattern sections must anchor to the local chart", () => {
    const dc = makeDc({ context_id: "ctx_a", version: 1, question: QUESTION_PLAIN });
    const raw = JSON.parse(goodAnalysisJson()) as Record<string, Array<Record<string, unknown>>>;
    raw.personal_strengths![0]!.evidence_refs = ["f_conf"];
    raw.personal_strengths![0]!.basis_class = "confirmed_fact";
    const v = pa.validatePersonalAnalysisOutput({ raw: JSON.stringify(raw), dc, projection: projectionStrong, locale: "zh" });
    assert.equal(v.ok, false);
    assert.match(!v.ok ? v.reason : "", /no_chart_anchor/);
  });

  // ─── Part 3/4: page validators (P5 / P6 / P8 + no DC JSON in body) ────────

  const dcA = makeDc({ context_id: "ctx_a", version: 1, question: QUESTION_PLAIN });
  const artifactA = (() => {
    const v = pa.validatePersonalAnalysisOutput({ raw: goodAnalysisJson(), dc: dcA, projection: projectionStrong, locale: "zh" });
    assert.ok(v.ok);
    return v.ok ? v.artifact : (null as never);
  })();
  const idxA = pages.buildReportEvidenceIndex({ dc: dcA, projection: projectionStrong, artifact: artifactA });

  await check("P5 paths validate with conditions/cost/risk/reversibility/exit/ranking", () => {
    const v = pages.validateDecisionReportPage({ raw: pageJson("05"), pageId: "05", idx: idxA, dc: dcA, locale: "zh" });
    assert.ok(v.ok, v.ok ? "" : v.reason);
    if (v.ok) assert.equal(v.page.paths?.length, 2);
  });

  await check("P5 must cite unresolved items that may change ranking", () => {
    const v = pages.validateDecisionReportPage({
      raw: pageJson("05", { skipUnknown: true }),
      pageId: "05",
      idx: idxA,
      dc: dcA,
      locale: "zh",
    });
    assert.equal(v.ok, false);
    assert.match(!v.ok ? v.reason : "", /p5_unknowns_not_cited/);
  });

  await check("P6 is one experiment, not a day-by-day schedule", () => {
    const ok = pages.validateDecisionReportPage({ raw: pageJson("06"), pageId: "06", idx: idxA, dc: dcA, locale: "zh" });
    assert.ok(ok.ok, ok.ok ? "" : ok.reason);
    const bad = pages.validateDecisionReportPage({
      raw: pageJson("06", { scheduleLeak: true }),
      pageId: "06",
      idx: idxA,
      dc: dcA,
      locale: "zh",
    });
    assert.equal(bad.ok, false);
    assert.match(!bad.ok ? bad.reason : "", /checklist_schedule/);
  });

  await check("P8 needs continue / adjust / stop / rerun", () => {
    const raw = JSON.parse(pageJson("08")) as { review: Record<string, unknown> };
    raw.review.stop_when = "";
    const v = pages.validateDecisionReportPage({ raw: JSON.stringify(raw), pageId: "08", idx: idxA, dc: dcA, locale: "zh" });
    assert.equal(v.ok, false);
    assert.match(!v.ok ? v.reason : "", /review\.stop_when/);
  });

  await check("visible body may not carry raw DC JSON", () => {
    const raw = JSON.parse(pageJson("04")) as { blocks: Array<Record<string, unknown>> };
    raw.blocks[0]!.body = JSON.stringify({ reality_facts: dcA.reality_facts.slice(0, 1) });
    const v = pages.validateDecisionReportPage({ raw: JSON.stringify(raw), pageId: "04", idx: idxA, dc: dcA, locale: "zh" });
    assert.equal(v.ok, false);
    assert.match(!v.ok ? v.reason : "", /raw_structure/);
  });

  // ─── Parts 2–5: job, persistence, checkpoints, fence, recovery ────────────

  const SID = "sess_m3_main";
  const birth = { year: 1985, month: 7, day: 15, hour_period: "chou", gender: "M", timezone: "Asia/Shanghai" };

  async function start(opts: {
    dc: DecisionContext;
    regenerate?: boolean;
    structured?: unknown;
    session_id?: string;
  }) {
    const r = await service.startDecisionReportJob({
      session_id: opts.session_id ?? SID,
      locale: "zh",
      decision_context: opts.dc,
      blueprint: null,
      profile_id: "p_strong",
      base_analysis: { structured: opts.structured ?? STRUCTURED_STRONG },
      birth_info: birth,
      regenerate: opts.regenerate === true,
    });
    assert.ok(r.ok, r.ok ? "" : `${r.code}: ${r.error}`);
    return r.ok ? r : (null as never);
  }

  async function pagesOf(job_id: string) {
    return (await store.loadAllPages(job_id)).map((p) => p.record);
  }

  await runWithEphemeralXhighKv(
    async () => {
      let firstJobId = "";
      let firstJobPagesSnapshot = "";

      await check("Freeze → Personal Analysis → eight pages → fenced completion (inline relay)", async () => {
        analysisCalls = 0;
        pageCalls.length = 0;
        const dc = makeDc({ context_id: "ctx_a", version: 1, question: QUESTION_PLAIN });
        const started = await start({ dc });
        assert.equal(started.reused, false);
        firstJobId = started.job.job_id;
        const input = started.job.input as import("../lib/poju/decision-intake/decision-report-types").DecisionReportJobInput;
        assert.equal(input.kind, "decision_intake_report");
        assert.equal(input.freeze_id, "ctx_a@v1");
        assert.equal(input.page07_applies, false);
        assert.equal(input.analysis_key, types.personalAnalysisIdempotencyKey({
          session_id: SID,
          freeze_id: "ctx_a@v1",
          context_hash: dc.content_hash!,
          profile_hash: input.profile_hash,
        }));

        await runner.runDecisionReportStage(firstJobId, "finalize");

        const job = await getXhighJob(firstJobId);
        assert.equal(job?.status, "completed", `job status=${job?.status} err=${job?.error}`);
        const result = job!.result as import("../lib/poju/decision-intake/decision-report-types").DecisionReportJobResult;
        assert.equal(result.kind, "decision_intake_report");
        assert.equal(result.freeze_id, "ctx_a@v1");
        assert.equal(result.context_hash, dc.content_hash);
        assert.equal(analysisCalls, 1);
        assert.deepEqual([...pageCalls].sort(), ["01", "02", "04", "05", "06", "08"]);

        const recs = await pagesOf(firstJobId);
        assert.equal(recs.length, 8);
        for (const r of recs) {
          assert.equal(r.status, "completed", `page ${r.page_id}`);
          assert.equal(r.freeze_id, "ctx_a@v1");
          assert.equal(r.context_hash, dc.content_hash);
          assert.equal(r.job_id, firstJobId);
          assert.equal(r.execution_generation, job!.execution_generation);
          assert.ok(r.content_markdown.trim().length > 0);
          assert.ok(!r.content_markdown.includes("```"), `page ${r.page_id} leaked a code fence`);
          assert.ok(!r.content_markdown.includes("\"reality_facts\""), `page ${r.page_id} leaked DC JSON`);
        }
        assert.equal(recs.find((r) => r.page_id === "07")?.applicability, "not_applicable");
        const p03 = recs.find((r) => r.page_id === "03")!;
        assert.ok(p03.content_markdown.includes("CFP-01") || p03.content_markdown.length > 20);

        assert.ok(result.full_text.includes("05") || result.full_text.length > 200);
        const order = types.DI2_READING_ORDER.filter((id) => id !== "07");
        let last = -1;
        for (const id of order) {
          const heading = DECISION_PAGE_SCHEMAS[id].title;
          const at = result.full_text.indexOf(heading);
          assert.ok(at > last, `page ${id} (${heading}) out of reading order`);
          last = at;
        }
        firstJobPagesSnapshot = JSON.stringify(recs);

        const analysis = await store.loadAnalysis(input.analysis_key);
        assert.equal(analysis?.record.status, "completed");
        assert.equal(analysis?.record.freeze_id, "ctx_a@v1");
        assert.equal(analysis?.record.profile_hash, input.profile_hash);
        assert.ok(analysis?.record.analysis_result?.personal_pattern_analysis.length);
      });

      await check("status payload exposes analysis + pages + result for client mirroring", async () => {
        const st = await service.buildDecisionReportStatus({ job_id: firstJobId, session_id: SID });
        assert.equal(st.status, "completed");
        assert.equal(st.analysis.status, "completed");
        assert.equal(st.pages.length, 8);
        assert.ok(st.result?.full_text);
        const other = await service.buildDecisionReportStatus({ job_id: firstJobId, session_id: "someone_else" });
        assert.equal(other.status, "missing");
      });

      await check("same Freeze + profile start is idempotent (no duplicate job)", async () => {
        const dc = makeDc({ context_id: "ctx_a", version: 1, question: QUESTION_PLAIN });
        const again = await start({ dc });
        assert.equal(again.reused, true);
        assert.equal(again.job.job_id, firstJobId);
      });

      await check("regenerate → new generation, analysis reused, old Freeze report untouched", async () => {
        analysisCalls = 0;
        pageCalls.length = 0;
        const dc = makeDc({ context_id: "ctx_a", version: 1, question: QUESTION_PLAIN });
        const old = await getXhighJob(firstJobId);
        const regen = await start({ dc, regenerate: true });
        assert.equal(regen.reused, false);
        assert.notEqual(regen.job.job_id, firstJobId);
        assert.ok((regen.job.execution_generation ?? 0) > (old!.execution_generation ?? 0));
        await runner.runDecisionReportStage(regen.job.job_id, "finalize");
        const done = await getXhighJob(regen.job.job_id);
        assert.equal(done?.status, "completed", `regen status=${done?.status} err=${done?.error}`);
        assert.equal(analysisCalls, 0, "same Freeze + profile must reuse the completed analysis");
        assert.equal(pageCalls.length, 6);
        const oldAfter = await getXhighJob(firstJobId);
        assert.equal(oldAfter?.status, "completed");
        assert.equal(JSON.stringify(await pagesOf(firstJobId)), firstJobPagesSnapshot);
        const oldIn = old!.input as { report_job_id: string };
        const newIn = done!.input as { report_job_id: string };
        assert.notEqual(oldIn.report_job_id, newIn.report_job_id);
      });

      await check("profile change → new profile hash → new analysis (no stale reuse)", async () => {
        analysisCalls = 0;
        const dc = makeDc({ context_id: "ctx_a", version: 1, question: QUESTION_PLAIN });
        const r = await start({ dc, structured: STRUCTURED_WEAK });
        assert.equal(r.reused, false);
        const input = r.job.input as { analysis_key: string; profile_hash: string };
        const strongHash = pa.computeProfileHash({ structured: STRUCTURED_STRONG, ziwei_closed_set: null });
        assert.notEqual(input.profile_hash, strongHash);
        await runner.runDecisionReportStage(r.job.job_id, "finalize");
        assert.equal((await getXhighJob(r.job.job_id))?.status, "completed");
        assert.equal(analysisCalls, 1);
      });

      await check("new Freeze version never reuses the previous Freeze's analysis or pages", async () => {
        analysisCalls = 0;
        const dc2 = makeDc({ context_id: "ctx_a", version: 2, question: QUESTION_PLAIN, extraFact: "家人支持换工作" });
        const r = await start({ dc: dc2 });
        const input = r.job.input as { freeze_id: string; analysis_key: string };
        assert.equal(input.freeze_id, "ctx_a@v2");
        assert.equal(await store.loadAnalysis(input.analysis_key), null);
        await runner.runDecisionReportStage(r.job.job_id, "finalize");
        assert.equal((await getXhighJob(r.job.job_id))?.status, "completed");
        assert.equal(analysisCalls, 1);
        for (const p of await pagesOf(r.job.job_id)) assert.equal(p.freeze_id, "ctx_a@v2");
      });

      await check("Freeze registry is write-once: same Freeze id with different content is refused", async () => {
        const dc = makeDc({ context_id: "ctx_a", version: 1, question: QUESTION_PLAIN, extraFact: "被篡改的内容" });
        const r = await service.startDecisionReportJob({
          session_id: SID,
          locale: "zh",
          decision_context: dc,
          blueprint: null,
          profile_id: "p_strong",
          base_analysis: { structured: STRUCTURED_STRONG },
          birth_info: birth,
          regenerate: true,
        });
        assert.equal(r.ok, false);
        assert.equal(!r.ok ? r.code : "", "FREEZE_CONFLICT");
      });

      await check("draft DC / broken hash cannot start a report", async () => {
        const draft = { ...makeDc({ context_id: "ctx_d", version: 1, question: QUESTION_PLAIN }), status: "draft" as const };
        const r1 = await service.startDecisionReportJob({
          session_id: "sess_m3_draft",
          locale: "zh",
          decision_context: draft,
          blueprint: null,
          profile_id: null,
          base_analysis: { structured: STRUCTURED_STRONG },
          birth_info: null,
          regenerate: false,
        });
        assert.equal(!r1.ok ? r1.code : "", "FREEZE_NOT_FINAL");
        const broken = makeDc({ context_id: "ctx_e", version: 1, question: QUESTION_PLAIN });
        broken.definition.stakes = "changed after freeze";
        const r2 = await service.startDecisionReportJob({
          session_id: "sess_m3_broken",
          locale: "zh",
          decision_context: broken,
          blueprint: null,
          profile_id: null,
          base_analysis: { structured: STRUCTURED_STRONG },
          birth_info: null,
          regenerate: false,
        });
        assert.equal(!r2.ok ? r2.code : "", "FREEZE_INTEGRITY");
      });

      await check("missing chart structure fails explicitly (no model-made profile)", async () => {
        const r = await service.startDecisionReportJob({
          session_id: "sess_m3_noprof",
          locale: "zh",
          decision_context: makeDc({ context_id: "ctx_np", version: 1, question: QUESTION_PLAIN }),
          blueprint: null,
          profile_id: null,
          base_analysis: { nothing: true },
          birth_info: null,
          regenerate: false,
        });
        assert.equal(!r.ok ? r.code : "", "PROFILE_STRUCTURE_UNAVAILABLE");
      });

      await check("topic-gated 07 is generated when the decision topic applies", async () => {
        pageCalls.length = 0;
        const sid = "sess_m3_topic";
        const dc = makeDc({ context_id: "ctx_t", version: 1, question: QUESTION_TOPIC });
        const r = await start({ dc, session_id: sid });
        assert.equal((r.job.input as { page07_applies: boolean }).page07_applies, true);
        await runner.runDecisionReportStage(r.job.job_id, "finalize");
        assert.equal((await getXhighJob(r.job.job_id))?.status, "completed");
        assert.ok(pageCalls.includes("07"));
        const p07 = (await pagesOf(r.job.job_id)).find((p) => p.page_id === "07");
        assert.equal(p07?.applicability, "applies");
      });

      await check("analysis 1+1: first invalid output retried once, then completes", async () => {
        analysisCalls = 0;
        analysisFailNext = 1;
        const sid = "sess_m3_retry_analysis";
        const r = await start({ dc: makeDc({ context_id: "ctx_r", version: 1, question: QUESTION_PLAIN }), session_id: sid });
        await runner.runDecisionReportStage(r.job.job_id, "finalize");
        assert.equal((await getXhighJob(r.job.job_id))?.status, "completed");
        assert.equal(analysisCalls, 2);
        const a = await store.loadAnalysis((r.job.input as { analysis_key: string }).analysis_key);
        assert.equal(a?.record.attempts, 2);
      });

      await check("page failure exhausts 1+1 → retryable stop; Continue resumes from checkpoints", async () => {
        pageCalls.length = 0;
        pageFailures.set("05", 2);
        const sid = "sess_m3_continue";
        const r = await start({ dc: makeDc({ context_id: "ctx_c", version: 1, question: QUESTION_PLAIN }), session_id: sid });
        await runner.runDecisionReportStage(r.job.job_id, "finalize");
        const failedJob = await getXhighJob(r.job.job_id);
        assert.equal(failedJob?.status, "failed");
        assert.equal(failedJob?.retryable, true);
        const st = await service.buildDecisionReportStatus({ job_id: r.job.job_id, session_id: sid });
        assert.equal(st.status, "failed");
        assert.equal(st.retryable, true);
        assert.ok(!st.result, "failed job never exposes a result");
        const doneBefore = st.pages.filter((p) => p.status === "completed").map((p) => p.page_id).sort();
        // Wave 1 siblings of the failed page keep their checkpoints; 07 (not applicable) is deterministic.
        assert.deepEqual(doneBefore, ["02", "04", "07"]);
        const p02Before = JSON.stringify(st.pages.find((p) => p.page_id === "02"));

        pageCalls.length = 0;
        const cont = await service.continueDecisionReportJob({ job_id: r.job.job_id, session_id: sid });
        assert.ok(cont.ok, cont.ok ? "" : `${cont.code}: ${cont.error}`);
        if (!cont.ok) return;
        assert.equal(cont.stage, "segments");
        assert.equal(cont.job.job_id, r.job.job_id);
        await runner.runDecisionReportStage(r.job.job_id, cont.stage);
        const done = await getXhighJob(r.job.job_id);
        assert.equal(done?.status, "completed", `after continue status=${done?.status} err=${done?.error}`);
        assert.ok(!pageCalls.includes("02") && !pageCalls.includes("04"), "completed pages must not regenerate");
        const p02After = JSON.stringify((await pagesOf(r.job.job_id)).find((p) => p.page_id === "02"));
        assert.equal(p02After, p02Before, "checkpointed page must not be overwritten");
      });

      await check("superseded generation cannot write pages or complete", async () => {
        pageCalls.length = 0;
        analysisCalls = 0;
        const sid = "sess_m3_fence";
        const dc = makeDc({ context_id: "ctx_f", version: 1, question: QUESTION_PLAIN });
        const a = await start({ dc, session_id: sid });
        const b = await start({ dc, session_id: sid, regenerate: true });
        assert.notEqual(a.job.job_id, b.job.job_id);
        const aJob = await getXhighJob(a.job.job_id);
        assert.equal(aJob?.failure_reason, "superseded_by_regenerate");
        await runner.runDecisionReportStage(a.job.job_id, "finalize");
        assert.equal(analysisCalls, 0);
        assert.equal((await pagesOf(a.job.job_id)).length, 0);
        const cont = await service.continueDecisionReportJob({ job_id: a.job.job_id, session_id: sid });
        assert.equal(cont.ok, false);
        await runner.runDecisionReportStage(b.job.job_id, "finalize");
        assert.equal((await getXhighJob(b.job.job_id))?.status, "completed");
      });

      await check("stale running job with no live lease → interrupted + retryable (never shown complete)", async () => {
        const sid = "sess_m3_stale";
        const r = await start({ dc: makeDc({ context_id: "ctx_s", version: 1, question: QUESTION_PLAIN }), session_id: sid });
        await updateXhighJobStatus(r.job.job_id, "running", { current_stage: "segments" });
        const { kv } = await import("../lib/kv/client");
        const { xhighJobKey } = await import("../lib/poju/xhigh-job-types");
        const raw = await kv.get<Record<string, unknown>>(xhighJobKey(r.job.job_id));
        assert.ok(raw);
        await kv.set(xhighJobKey(r.job.job_id), { ...raw, updated_at: Date.now() - 10 * 60_000 });
        const st = await service.buildDecisionReportStatus({ job_id: r.job.job_id, session_id: sid });
        assert.equal(st.status, "failed");
        assert.equal(st.retryable, true);
        assert.equal(st.failure_reason, "interrupted");
        assert.equal(st.result, null);
      });
    },
    { deadlineMs: 15 * 60_000 },
  );

  // ─── legacy / DI2 boundary + client selectors ─────────────────────────────

  await check("legacy delivery write-back refuses DI2 report rows", async () => {
    const dc = makeDc({ context_id: "ctx_l", version: 1, question: QUESTION_PLAIN });
    const binding = { context_id: dc.context_id, context_version: dc.version, context_hash: dc.content_hash! };
    const snapshot = fbr.createFrozenReportSnapshot({ sessionId: "sess_l", frozen: dc, binding });
    const session = {
      session_id: "sess_l",
      freeze_bound_report_jobs: [
        {
          job_id: "row_di2",
          idempotency_key: "row_di2",
          status: "generating",
          binding: {
            sessionId: "sess_l",
            freezeId: "ctx_l@v1",
            decisionContextVersion: 1,
            contentHash: dc.content_hash!,
            snapshotSchemaVersion: fbr.M22_SNAPSHOT_SCHEMA_VERSION,
            reportSchemaVersion: types.DI2_REPORT_SCHEMA_VERSION,
            contextId: "ctx_l",
          },
          pages: [],
          created_at: NOW,
          updated_at: NOW,
          source: "decision_intake_v2",
        },
      ],
    } as unknown as import("../lib/poju/types").POJUSessionState;
    const res = await fbr.completeFreezeBoundReportFromDeliveryPages({
      session,
      snapshot,
      jobId: "row_di2",
      pages: DECISION_PAGE_IDS.map((pageId) => ({ pageId, content: `page ${pageId}` })),
    });
    assert.equal(res.ok, false);
    assert.equal(!res.ok ? res.code : "", "SOURCE_MISMATCH");
  });

  await check("client selectors: DI2 detection, auto-start only once per Freeze, resume when pending", () => {
    const dc = makeDc({ context_id: "ctx_ui", version: 1, question: QUESTION_PLAIN });
    const base = {
      session_id: "sess_ui",
      decision_blueprint: { context_id: "ctx_ui", session_id: "sess_ui" },
      decision_context: dc,
      freeze_bound_report_jobs: [],
      pending_decision_report_job_id: null,
    } as unknown as import("../lib/poju/types").POJUSessionState;
    assert.equal(client.isDecisionIntakeV2Session(base), true);
    assert.equal(client.currentDi2FreezeId(base), "ctx_ui@v1");
    assert.equal(client.di2ReportNeedsAutoStart(base), true);
    const pending = { ...base, pending_decision_report_job_id: "dr_x" };
    assert.equal(client.di2ReportNeedsAutoStart(pending), false);
    assert.equal(client.di2ReportShouldResume(pending), true);
    const legacy = { ...base, decision_blueprint: null };
    assert.equal(client.isDecisionIntakeV2Session(legacy), false);
    assert.equal(client.di2ReportNeedsAutoStart(legacy), false);
    const draft = { ...base, decision_context: { ...dc, status: "draft" } } as typeof base;
    assert.equal(client.di2ReportNeedsAutoStart(draft), false);
  });

  pa.__setPersonalAnalysisModelForTests(null);
  pages.__setDecisionReportPageModelForTests(null);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
