/**
 * Probe: dyad_continue model cue survives history filter + opening feed includes matrix.
 * Run: pnpm exec tsx scripts/test-dyad-continue-feed.ts
 *
 * Keep this file ASCII-only so CI/Windows shells cannot corrupt string literals.
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
import { formatPhaseMessageHistory } from "../lib/poju/shared/transport";
import { slimLabCallTrace, buildLabCallTrace } from "../lib/llm/pro/delivery/lab/call-trace";
import type { PhaseLLMInput } from "../lib/llm/phases/types";
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
    locale: "en",
  });

  const question = "My girlfriend is pushing marriage and I am not ready";
  const sessionMsgs = [
    {
      role: "user" as const,
      content: question,
      timestamp: new Date().toISOString(),
    },
    {
      role: "assistant" as const,
      content: "dyad gate copy",
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

  const phaseInput = {
    session: {
      session_id: "t",
      messages: sessionMsgs,
      original_question: question,
      partner_bazi: "present" as const,
      dyad_compat_summary: summary,
      dyad_matrix_pack: matrix,
      pivot_chart_path: "dyad" as const,
      dyad_offer_status: "collected" as const,
    },
    locale: "en",
    user_message: DYAD_CONTINUE_SYSTEM,
    base_analysis: { structured: sA.structured },
    agent_state: {
      current_phase: "opening",
      original_question: question,
    },
  } as unknown as PhaseLLMInput;

  const task = buildOpeningTaskBlockV6(phaseInput);
  assert.match(task, /partner_bazi=present/);
  assert.match(task, /path=dyad/);
  assert.match(task, /synergy_type=/);

  const pad = "PAD_".repeat(4000);
  const transportUser = [
    `user:\n${pad}`,
    `assistant:\nold reply`,
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
  assert.match(slim.user, /partner_bazi=present|path=dyad|SYSTEM CONTINUE/);
  assert.match(String(slim.user_feed), /partner_bazi=present|path=dyad|SYSTEM CONTINUE/);
  console.log("ok dyad-continue feed", {
    cue_chars: cue.length,
    task_chars: task.length,
    slim_user_has_dyad: /partner_bazi=present|path=dyad|SYSTEM CONTINUE/.test(slim.user),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
