/**
 * Probe: dyad_continue model cue survives history filter + opening feed includes matrix.
 * Run: pnpm exec tsx scripts/test-dyad-continue-feed.ts
 */
import assert from "node:assert/strict";
import { calculateProfile } from "../lib/calculations/profile";
import { buildStreamLocalDataFromProfile } from "../lib/base-analysis/build-stream-local-data";
import { buildOpeningTaskBlockV6 } from "../lib/llm/phases/opening-phase-v6";
import {
  DYAD_CONTINUE_SYSTEM,
  buildDyadCompatSummary,
  buildDyadContinueModelUserCue,
} from "../lib/poju/dyad-compat";
import { buildDyadMatrixPack } from "../lib/poju/dyad-matrix-pack";
import {
  applyTurnContext,
  formatPhaseMessageHistory,
} from "../lib/poju/shared/transport";
import { slimLabCallTrace, buildLabCallTrace } from "../lib/llm/pro/delivery/lab/call-trace";
import type { BirthInfo } from "../lib/profile/types";

const birthA: BirthInfo = {
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
  minute: 0,
  hour_period: "si",
  gender: "M",
  timezone: "Asia/Shanghai",
  birth_location: {
    name: "Beijing",
    longitude: 116.4,
    latitude: 39.9,
    timezone: "Asia/Shanghai",
    use_defaults: false,
  },
};
const birthB: BirthInfo = {
  year: 1992,
  month: 8,
  day: 20,
  hour: 14,
  minute: 30,
  hour_period: "wei",
  gender: "F",
  timezone: "Asia/Shanghai",
  birth_location: {
    name: "Shanghai",
    longitude: 121.5,
    latitude: 31.2,
    timezone: "Asia/Shanghai",
    use_defaults: false,
  },
};

async function main() {
  const pA = await calculateProfile(birthA);
  const pB = await calculateProfile(birthB);
  const sA = buildStreamLocalDataFromProfile(pA, { output_language: "zh" });
  const sB = buildStreamLocalDataFromProfile(pB, { output_language: "zh" });
  const profileA = { user_profile: pA, base_analysis: { structured: sA.structured } };
  const profileB = { user_profile: pB, base_analysis: { structured: sB.structured } };
  const summary = buildDyadCompatSummary({ profileA, profileB });
  const matrix = buildDyadMatrixPack({ profileA, profileB });

  const cue = buildDyadContinueModelUserCue({
    partner_bazi: "present",
    pivot_chart_path: "dyad",
    locale: "zh",
  });

  const sessionMsgs = [
    {
      role: "user" as const,
      content: "女朋友逼婚我不�?,
      timestamp: new Date().toISOString(),
    },
    {
      role: "assistant" as const,
      content: "二元议题�?,
      timestamp: new Date().toISOString(),
    },
    {
      role: "system" as const,
      content: DYAD_CONTINUE_SYSTEM,
      timestamp: new Date().toISOString(),
    },
    {
      role: "user" as const,
      content: cue,
      timestamp: new Date().toISOString(),
    },
  ];

  const hist = formatPhaseMessageHistory(sessionMsgs);
  assert.equal(hist.length, 3, "system stripped, cue kept");
  assert.equal(hist[2]!.content, cue);

  const session = {
    session_id: "t",
    messages: sessionMsgs,
    original_question: "女朋友逼婚我不�?,
    partner_bazi: "present" as const,
    dyad_compat_summary: summary,
    dyad_matrix_pack: matrix,
    pivot_chart_path: "dyad" as const,
    dyad_offer_status: "collected" as const,
  };

  const task = buildOpeningTaskBlockV6({
    session: session as never,
    locale: "zh",
    user_message: DYAD_CONTINUE_SYSTEM,
    base_analysis: { structured: sA.structured },
    agent_state: {
      current_phase: "opening",
      original_question: "女朋友逼婚我不�?,
    } as never,
  });
  assert.match(task, /partner_bazi=present/);
  assert.match(task, /二元收盘/);
  assert.match(task, /path=dyad/);

  const pad = "PAD_".repeat(4000);
  const transportUser = [
    `user:\n${pad}`,
    `assistant:\n旧回复`,
    `user:\n${task}\n\n---\n\n${cue}`,
  ].join("\n\n---\n\n");
  const slim = slimLabCallTrace(
    buildLabCallTrace({
      phase: "opening",
      system: "sys",
      user: transportUser,
      user_feed: `${task}\n\n---\n\n${cue}`,
    }),
  );
  assert.match(slim.user, /partner_bazi=present|系统续开·二元/);
  assert.match(String(slim.user_feed), /partner_bazi=present|系统续开·二元/);
  console.log("ok dyad-continue probe", {
    cue_chars: cue.length,
    task_chars: task.length,
    slim_user_has_dyad: /partner_bazi=present|系统续开/.test(slim.user),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
