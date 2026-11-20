/**
 * DI2 Personalized Understanding — full-path evidence (not product PASS).
 *
 * Proves:
 * 1) Two real local profiles → distinct profile_hash + field coverage
 * 2) Fresh Session adaptive turn receives full ProfileStructured in Understanding model
 * 3) ≥3 turns: model_response_text + exactly 3 suggested replies on assistant options
 * 4) Optional live OpenRouter call with non-null ProfileStructured
 *
 * Run: pnpm exec tsx scripts/test-di2-personalized-understanding-full-path.ts
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getBaziChart } from "shunshi-bazi-core";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { withDeterministicHandleHooks } from "./fixtures/test-answer-interpretation-hook";

installIntakeR6TestGlobals("dev_di2_personalized_full");
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0),
  configurable: true,
  writable: true,
});

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2] ?? "";
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]!]) process.env[m[1]!] = val;
  }
}
loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "di2-personalized-full-test-secret";
}

let passed = 0;
let failed = 0;
const evidence: Record<string, unknown> = {
  started_at: new Date().toISOString(),
  checks: [] as string[],
};

async function check(label: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    (evidence.checks as string[]).push(`PASS ${label}`);
    console.log(`  PASS  ${label}`);
  } catch (e) {
    failed += 1;
    (evidence.checks as string[]).push(`FAIL ${label}`);
    console.error(`  FAIL  ${label}`);
    console.error(e);
  }
}

function buildUserProfile(id: string, birth: {
  year: number;
  month: number;
  day: number;
  hour: number;
  gender: "M" | "F";
  timezone: string;
}) {
  const { shunshiParamsFromBirthInfo } = require("../lib/profile/birth-info-utils") as typeof import("../lib/profile/birth-info-utils");
  const params = shunshiParamsFromBirthInfo(birth as never);
  const chart = getBaziChart({
    year: params.year,
    month: params.month,
    day: params.day,
    hour: params.hour,
    minute: params.minute,
    gender: params.gender,
    longitude: params.longitude,
    latitude: params.latitude,
    standardMeridian: params.standardMeridian,
    useTrueSolarTime: true,
    sect: 1,
  });
  const pillars = chart.八字?.柱位详细;
  return {
    id,
    birth: { ...birth, minute: 0 },
    bazi: {
      yearPillar: pillars?.年柱?.干支 ?? "?",
      monthPillar: pillars?.月柱?.干支 ?? "?",
      dayPillar: pillars?.日柱?.干支 ?? "?",
      hourPillar: pillars?.时柱?.干支 ?? "?",
    },
    diagnosis: {
      dayMaster: chart.八字?.日主 ?? "?",
      favorableElements: [String(chart.八字?.五行分值?.日主五行 ?? "unknown")],
      challengingElements: [],
      patternSummary: `日主 ${chart.八字?.日主}`,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: "shunshi" as const,
    used_true_solar_time: params.usedTrueSolarTime,
  };
}

async function main() {
  console.log("DI2 Personalized Understanding full-path");

  const { buildMatrixPayloadFromProfile } = await import("../lib/poju/build-matrix-payload");
  const { buildPersonalProfileContext } = await import(
    "../lib/poju/decision-intake/personal-profile-context"
  );
  const { generateDecisionUnderstandingTurn } = await import(
    "../lib/poju/decision-intake/understanding-response-model"
  );
  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession, savePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { handleUserMessage: handleRaw } = await import("../lib/poju/agent");
  const { __setM1rPersistForTests } = await import("../lib/poju/decision-intake");

  const profileA = buildUserProfile("profile_a_1990", {
    year: 1990,
    month: 5,
    day: 15,
    hour: 10,
    gender: "F",
    timezone: "Asia/Shanghai",
  });
  const profileB = buildUserProfile("profile_b_1985", {
    year: 1985,
    month: 7,
    day: 15,
    hour: 2,
    gender: "M",
    timezone: "Asia/Shanghai",
  });
  const matrixA = buildMatrixPayloadFromProfile("profile_a_1990", profileA as never, {
    locale: "zh",
  });
  const matrixB = buildMatrixPayloadFromProfile("profile_b_1985", profileB as never, {
    locale: "zh",
  });

  await check("two real profiles have distinct day_master / hash", () => {
    const now = new Date().toISOString();
    const ctxA = buildPersonalProfileContext(
      {
        session_id: "sA",
        matrix_payload: matrixA,
        selected_stored_profile_id: "profile_a_1990",
      } as never,
      now,
    );
    const ctxB = buildPersonalProfileContext(
      {
        session_id: "sB",
        matrix_payload: matrixB,
        selected_stored_profile_id: "profile_b_1985",
      } as never,
      now,
    );
    assert.equal(ctxA.data_availability.bazi, "available");
    assert.equal(ctxB.data_availability.bazi, "available");
    assert.equal(ctxA.personalization_incomplete, false);
    assert.equal(ctxB.personalization_incomplete, false);
    assert.ok(ctxA.field_coverage.four_pillars);
    assert.ok(ctxA.field_coverage.day_master);
    assert.ok(ctxA.field_coverage.da_yun);
    assert.ok(ctxA.profile_hash);
    assert.ok(ctxB.profile_hash);
    assert.notEqual(ctxA.profile_hash, ctxB.profile_hash);
    assert.notEqual(ctxA.structured?.day_master, ctxB.structured?.day_master);
    evidence.profile_a = {
      day_master: ctxA.structured?.day_master,
      hash: ctxA.profile_hash,
      coverage: ctxA.field_coverage,
      ziwei: Boolean(ctxA.ziwei_closed_set),
    };
    evidence.profile_b = {
      day_master: ctxB.structured?.day_master,
      hash: ctxB.profile_hash,
      coverage: ctxB.field_coverage,
      ziwei: Boolean(ctxB.ziwei_closed_set),
    };
  });

  await check("rebuild from birth when structured stripped", () => {
    const now = new Date().toISOString();
    const stripped = {
      ...matrixA,
      structured: { day_master: "", pattern: "", yong_shen: "", xi_shen: [], ji_shen: [], strength: "balanced", four_pillars: { year: "", month: "", day: "", hour: "" }, da_yun: [], data_availability: {} },
    };
    const ctx = buildPersonalProfileContext(
      {
        session_id: "sRebuild",
        matrix_payload: stripped,
        selected_stored_profile_id: "profile_a_1990",
      } as never,
      now,
    );
    assert.equal(ctx.data_availability.bazi, "available");
    assert.ok(ctx.structured?.day_master?.trim());
    assert.equal(ctx.personalization_incomplete, false);
  });

  // Multi-turn Fresh Session with Understanding model hook + real Profile A.
  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.includes("/api/poju/chat")) {
      return new Response(
        JSON.stringify({
          response: "GENERIC_CHAT_MUST_NOT_APPEAR",
          collection_progress: "advancing",
          question_status: "asked",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (originalFetch) return originalFetch(input, init);
    return new Response("{}", { status: 500 });
  };

  let turnCount = 0;
  const understandingHook = async (input: {
    plan: { candidate_id: string; question_text: string } | null;
    profile: { profile_hash: string | null; structured: { day_master?: string } | null };
  }) => {
    turnCount += 1;
    assert.ok(input.profile.profile_hash, "profile_hash required each turn");
    assert.ok(input.profile.structured?.day_master, "structured.day_master required each turn");
    const q =
      input.plan?.question_text?.replace(/^模板[:：]?/, "").trim() ||
      `第${turnCount}个调查问题：你目前最想优先解决什么？`;
    return {
      current_understanding_narrative: `综合理解（第${turnCount}轮）：结合你的能量画像与现实处境，当前优先弄清目标与约束。日主锚点已读取。`,
      understood_labels: [],
      need_to_understand: [
        {
          label: "优先目标尚未确认",
          priority: "P0" as const,
          necessity: "required" as const,
          why_it_matters: "影响选项排序",
          related_dir_ids: [],
        },
      ],
      personal_pattern_insight: { status: "none" as const, insights: [] },
      next_question: {
        selected_candidate_id: input.plan?.candidate_id ?? null,
        question_text: input.plan ? `模型问：${q}` : null,
        rationale: "hook",
      },
      suggested_replies: [
        { label: `选项A${turnCount}`, value: `回答A：我想尽快恢复收入（回合${turnCount}）` },
        { label: `选项B${turnCount}`, value: `回答B：我想先找长期方向（回合${turnCount}）` },
        { label: `选项C${turnCount}`, value: `回答C：我还不清楚自己适合什么（回合${turnCount}）` },
      ],
      response_text: `我听到了你的处境（第${turnCount}轮）。\n\n模型问：${q}`,
    };
  };

  try {
    const sid = await createPOJUSession({
      payment_id: "pay_di2_personalized_full",
      original_question:
        "我从上个项目失败后，已经好几年没有任何收入了，都不知道做什么好，我该怎么办？",
    });
    let session = await loadPOJUSession(sid);
    assert.ok(session);
    session = {
      ...session!,
      matrix_payload: matrixA,
      selected_stored_profile_id: "profile_a_1990",
      birth_submitted_in_session: true,
    };
    await savePOJUSession(session);

    // Commit DC without bumping IndexedDB CAS revision out of band.
    __setM1rPersistForTests(async (_prev, next) => ({
      session: next,
      committed: true,
    }));

    const answers = [
      "我从上个项目失败后，已经好几年没有任何收入了，都不知道做什么好，我该怎么办？",
      "回答A：我想尽快恢复收入（回合1）",
      "回答B：我想先找长期方向（回合2）",
    ];

    let live = session;
    for (let i = 0; i < answers.length; i++) {
      await check(`turn ${i + 1} model reply + 3 options (no generic chat)`, async () => {
        const out = await handleRaw(
          withDeterministicHandleHooks({
            session: {
              ...live,
              matrix_payload: matrixA,
              selected_stored_profile_id: "profile_a_1990",
              birth_submitted_in_session: true,
            },
            userMessage: answers[i]!,
            locale: "zh",
            __testOnlyM1Hooks: {
              understandingResponseModel: understandingHook as never,
            },
          }),
        );
        live = {
          ...out,
          matrix_payload: matrixA,
          selected_stored_profile_id: "profile_a_1990",
          birth_submitted_in_session: true,
        };
        try {
          await savePOJUSession(live);
        } catch {
          // CAS may disagree in shimmed persist tests; keep in-memory chain.
        }
        const asst = [...out.messages].reverse().find((m) => m.role === "assistant" && !m.is_rejected);
        assert.ok(asst, "assistant missing");
        assert.notEqual(asst!.content, "GENERIC_CHAT_MUST_NOT_APPEAR");
        assert.ok(
          asst!.content.includes("我听到了你的处境") || asst!.content.includes("模型问"),
          `unexpected assistant: ${asst!.content.slice(0, 120)}`,
        );
        assert.ok(Array.isArray(asst!.options) && asst!.options.length === 3, "need 3 options");
        assert.equal(new Set(asst!.options).size, 3);
        assert.ok(out.decision_understanding?.current_understanding.summary);
        assert.ok(
          !/^Decision:/i.test(out.decision_understanding!.current_understanding.summary),
        );
        evidence[`turn_${i + 1}`] = {
          content_preview: asst!.content.slice(0, 160),
          options: asst!.options,
          understanding: out.decision_understanding?.current_understanding.summary.slice(0, 120),
          profile_meta: (asst!.meta as { di2_profile_hash?: string } | undefined)?.di2_profile_hash ?? null,
        };
      });
    }

    await check("understanding hook saw profile every turn", () => {
      assert.ok(turnCount >= 3, `expected ≥3 understanding calls, got ${turnCount}`);
    });
  } finally {
    globalThis.fetch = originalFetch;
    __setM1rPersistForTests(null);
  }

  // Live OpenRouter with real ProfileStructured (optional if key present).
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    await check("live OpenRouter with non-null ProfileStructured", async () => {
      const now = new Date().toISOString();
      const session = {
        session_id: `di2_live_profile_${Date.now()}`,
        original_question: "创业失败后没收入，下一步怎么办？",
        locked_output_locale: "zh",
        messages: [],
        matrix_payload: matrixA,
        selected_stored_profile_id: "profile_a_1990",
        birth_submitted_in_session: true,
        decision_context: null,
        decision_blueprint: null,
      } as never;
      const ctx = buildPersonalProfileContext(session, now);
      assert.ok(ctx.profile_hash);
      assert.equal(ctx.personalization_incomplete, false);

      const understanding = {
        understanding_id: "u_live_p",
        session_id: (session as { session_id: string }).session_id,
        context_id: "c",
        context_version: 1,
        blueprint_version: 1,
        built_at: now,
        current_understanding: {
          summary: "Decision: placeholder",
          decision_question: "创业失败后没收入，下一步怎么办？",
          confirmed_briefs: [],
          unconfirmed_briefs: [],
          analysis_briefs: [],
          conflict_briefs: [],
          confidence: "low" as const,
        },
        understood: { items: [] },
        need_to_understand: { items: [] },
        personal_pattern_insight: { status: "none" as const, insights: [] },
        next_question_plan: null,
        readiness: { verdict: "continue" as const, can_ask: true, reasons: [] },
        budget: {
          soft_budget_limit: 12,
          hard_budget_limit: 15,
          session_asked_count: 0,
          review_cycle: 1,
          cycle_base_asked: 0,
          remaining_hard_budget: 15,
          depth_by_dir: {},
          refunded_plan_ids: [],
        },
        last_answer_event_id: null,
        last_sent_question: null,
      };
      const plan = {
        plan_id: "qp_live_p",
        candidate_id: "cand_1",
        direction_id: "DIRN",
        ddr_ids: ["DDR"],
        dir_ids: ["DIR"],
        fact_role_codes: ["role"],
        missing_info: "unknown",
        decision_value: "decision_critical",
        ask_now_reason: "p0",
        expected_info: "期望结果",
        depth: 1,
        budget_cost: 1,
        remaining_hard_budget: 14,
        gate_class: "P0" as const,
        scope_boundary: "t",
        rationale: "t",
        question_text: "模板：你最希望先实现什么？",
        built_at: now,
        scoring_path: "live",
      };
      const result = await generateDecisionUnderstandingTurn({
        session: session as never,
        understanding: understanding as never,
        plan: plan as never,
        legal_candidate_ids: [plan.candidate_id],
        legal_candidates: [
          {
            candidate_id: plan.candidate_id,
            direction_id: plan.direction_id,
            dir_ids: plan.dir_ids,
            missing_info: plan.missing_info,
            decision_value: plan.decision_value,
            expected_info: plan.expected_info,
            template_question: plan.question_text,
          },
        ],
        locale: "zh",
        init_only: true,
        user_statement: "创业失败后没收入，下一步怎么办？",
      });
      evidence.live_openrouter = {
        ok: result.ok,
        reason: result.ok ? null : result.reason,
        provider: result.call_meta.provider,
        model: result.call_meta.model,
        latency_ms: result.call_meta.latency_ms,
        profile_hash: result.profile.profile_hash,
        coverage: result.profile.field_coverage,
        narrative: result.ok
          ? result.output.current_understanding_narrative.slice(0, 180)
          : null,
        suggested: result.ok
          ? result.output.suggested_replies.map((r) => r.label)
          : null,
      };
      assert.equal(result.ok, true, result.ok ? "" : `${result.reason}:${result.detail ?? ""}`);
      assert.ok(result.profile.profile_hash);
      assert.ok(result.profile.structured?.day_master);
      if (result.ok) {
        assert.equal(result.output.suggested_replies.length, 3);
        assert.ok(!/^Decision:/i.test(result.output.current_understanding_narrative));
      }
    });
  } else {
    console.log("  SKIP  live OpenRouter (no OPENROUTER_API_KEY)");
  }

  evidence.finished_at = new Date().toISOString();
  evidence.passed = passed;
  evidence.failed = failed;
  const outDir = resolve(
    process.cwd(),
    "docs/evidence/di2-personalized-understanding-driven-2026-11-20",
  );
  mkdirSync(resolve(outDir, "logs"), { recursive: true });
  writeFileSync(
    resolve(outDir, "logs/full-path-evidence.json"),
    JSON.stringify(evidence, null, 2),
    "utf8",
  );

  console.log(`\nDone. PASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
  console.log("FULL_PATH_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
