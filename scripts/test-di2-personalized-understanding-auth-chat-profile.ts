/**
 * Prove production handoff: UserProfile without matrix_payload still yields
 * full ProfileStructured for Understanding on handleUserMessage / M1.
 *
 * Run: pnpm exec tsx scripts/test-di2-personalized-understanding-auth-chat-profile.ts
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getBaziChart } from "shunshi-bazi-core";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { withDeterministicHandleHooks } from "./fixtures/test-answer-interpretation-hook";

installIntakeR6TestGlobals("dev_di2_auth_chat_profile");
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0),
  configurable: true,
  writable: true,
});
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "di2-auth-chat-profile-secret";
}

function buildUserProfile(id: string) {
  const birth = {
    year: 1990,
    month: 5,
    day: 15,
    hour: 10,
    minute: 0,
    gender: "F" as const,
    timezone: "Asia/Shanghai",
  };
  const { shunshiParamsFromBirthInfo } =
    require("../lib/profile/birth-info-utils") as typeof import("../lib/profile/birth-info-utils");
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
    birth,
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
  console.log("DI2 auth-chat Profile → Understanding handoff");

  const { ensureMatrixPayloadOnSession, buildPersonalProfileContext } = await import(
    "../lib/poju/decision-intake/personal-profile-context"
  );
  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession } = await import("../lib/poju/session-manager");
  const { handleUserMessage } = await import("../lib/poju/agent");
  const { __setM1rPersistForTests } = await import("../lib/poju/decision-intake");
  const { runWithAuthoritativeChatTestHooks } = await import(
    "../lib/poju/session-authority/chat-hooks"
  );

  const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const profile = buildUserProfile(profileId);
  const evidence: Record<string, unknown> = { checks: [] as string[] };

  // Unit: ensureMatrixPayloadOnSession from bare UserProfile
  {
    const bare = {
      session_id: "s_bare",
      selected_stored_profile_id: profileId,
      birth_submitted_in_session: true,
      messages: [],
    } as never;
    const withMatrix = ensureMatrixPayloadOnSession(bare, profile as never, "zh");
    assert.ok(withMatrix.matrix_payload?.structured?.day_master?.trim());
    const ctx = buildPersonalProfileContext(withMatrix, new Date().toISOString());
    assert.equal(ctx.personalization_incomplete, false);
    assert.ok(ctx.profile_hash);
    assert.ok(ctx.field_coverage.four_pillars);
    (evidence.checks as string[]).push("PASS ensureMatrixPayloadOnSession");
    evidence.ensured = {
      day_master: ctx.structured?.day_master,
      hash: ctx.profile_hash,
      coverage: ctx.field_coverage,
    };
    console.log("  PASS  ensureMatrixPayloadOnSession from UserProfile");
  }

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  let seenHash: string | null = null;
  let seenDayMaster: string | null = null;
  const understandingHook = async (input: {
    profile: {
      profile_hash: string | null;
      structured: { day_master?: string } | null;
      personalization_incomplete?: boolean;
    };
    plan: { candidate_id: string; question_text: string } | null;
  }) => {
    assert.equal(input.profile.personalization_incomplete, false);
    assert.ok(input.profile.profile_hash);
    assert.ok(input.profile.structured?.day_master?.trim());
    seenHash = input.profile.profile_hash;
    seenDayMaster = input.profile.structured?.day_master ?? null;
    const q = input.plan?.question_text || "你最希望先实现什么？";
    return {
      current_understanding_narrative:
        "综合理解：你正处在收入中断后的方向选择中，需要先确认优先目标。",
      understood_labels: [],
      need_to_understand: [
        {
          label: "优先目标",
          priority: "P0",
          necessity: "required",
          why_it_matters: "排序",
          related_dir_ids: [],
        },
      ],
      personal_pattern_insight: { status: "none", insights: [] },
      next_question: {
        selected_candidate_id: input.plan?.candidate_id ?? null,
        question_text: input.plan ? `模型问：${q}` : null,
        rationale: "auth",
      },
      suggested_replies: [
        { label: "收入", value: "我想尽快恢复收入" },
        { label: "方向", value: "我想先找长期方向" },
        { label: "不清楚", value: "我还不清楚适合做什么" },
      ],
      response_text: `已读取你的能量画像（日主已绑定）。\n\n模型问：${q}`,
    };
  };

  __setM1rPersistForTests(async (_prev, next) => ({ session: next, committed: true }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ response: "GENERIC_MUST_NOT_APPEAR" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const sid = await createPOJUSession({
      payment_id: "pay_di2_auth_profile",
      original_question: "创业失败后没收入怎么办？",
      selected_stored_profile_id: profileId,
    });
    const before = (await loadPOJUSession(sid))!;
    // Critical: no matrix_payload on session — only UserProfile via server_invoke.
    assert.equal(before.matrix_payload, undefined);

    const out = await runWithAuthoritativeChatTestHooks(
      { understandingResponseModel: understandingHook as never },
      () =>
        handleUserMessage(
          withDeterministicHandleHooks({
            session: {
              ...before,
              selected_stored_profile_id: profileId,
              birth_submitted_in_session: true,
              matrix_payload: undefined,
            },
            userMessage: "我从上个项目失败后好几年没收入了，不知道做什么好。",
            locale: "zh",
            server_invoke: {
              profile: profile as never,
              base_analysis: null,
            },
            __testOnlyM1Hooks: {
              understandingResponseModel: understandingHook as never,
            },
          }),
        ),
    );

    const asst = [...out.messages].reverse().find((m) => m.role === "assistant");
    assert.ok(asst);
    assert.notEqual(asst!.content, "GENERIC_MUST_NOT_APPEAR");
    assert.ok(asst!.content.includes("能量画像") || asst!.content.includes("模型问"));
    assert.ok(Array.isArray(asst!.options) && asst!.options.length === 3);
    assert.ok(seenHash);
    assert.ok(seenDayMaster);
    assert.ok(out.matrix_payload?.structured?.day_master?.trim(), "sessionOut must keep matrix");
    assert.equal(
      (asst!.meta as { di2_profile_hash?: string } | undefined)?.di2_profile_hash,
      seenHash,
    );
    (evidence.checks as string[]).push("PASS handleUserMessage without preloaded matrix");
    evidence.turn = {
      seenHash,
      seenDayMaster,
      options: asst!.options,
      content_preview: asst!.content.slice(0, 160),
      session_matrix_day_master: out.matrix_payload?.structured?.day_master ?? null,
    };
    console.log("  PASS  handleUserMessage attaches matrix + Understanding sees Profile");
  } finally {
    globalThis.fetch = originalFetch;
    __setM1rPersistForTests(null);
  }

  const outDir = resolve(
    process.cwd(),
    "docs/evidence/di2-personalized-understanding-driven-2026-11-20/logs",
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, "auth-chat-profile-handoff.json"),
    JSON.stringify(evidence, null, 2),
    "utf8",
  );
  console.log("AUTH_CHAT_PROFILE_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
