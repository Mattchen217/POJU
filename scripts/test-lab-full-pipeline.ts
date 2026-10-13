/**
 * LAB full_pipeline smoke — solo path lock + dyad skip + seed unlock (no LLM).
 * Run: pnpm exec tsx scripts/test-lab-full-pipeline.ts
 */

import assert from "node:assert/strict";
import { createDeliveryLab, loadDeliveryLab, saveDeliveryLab } from "../lib/llm/pro/delivery/lab/store";
import { labPublicView } from "../lib/llm/pro/delivery/lab/public-view";
import {
  derivePipelineCursor,
  pipelineNextHint,
} from "../lib/llm/pro/delivery/lab/pipeline-cursor";
import { labDyadSkip, seedLabSourceFromChat } from "../lib/llm/pro/delivery/lab/pipeline-jobs";
import { createLabChatSession } from "../lib/llm/pro/delivery/lab/lab-chat-session";
import { createInitialAgentState } from "../lib/poju/agent-state";
import type { DeliveryLabSession } from "../lib/llm/pro/delivery/lab/types";

const minimalBase = {
  structured: {
    day_master: "甲木",
    pattern: "lab_pipeline_smoke",
    yong_shen: "水",
    xi_shen: ["金"],
    ji_shen: ["火"],
    strength: "weak",
    four_pillars: { year: "甲子", month: "丙寅", day: "戊午", hour: "癸亥" },
    pillars_detail: {
      year: {
        ganzhi: "甲子",
        stem: "甲",
        branch: "子",
        ten_god: "比肩",
        hidden_stems: ["癸"],
        shen_sha: [],
      },
      month: {
        ganzhi: "丙寅",
        stem: "丙",
        branch: "寅",
        ten_god: "食神",
        hidden_stems: ["甲", "丙", "戊"],
        shen_sha: [],
      },
      day: {
        ganzhi: "戊午",
        stem: "戊",
        branch: "午",
        ten_god: "偏财",
        hidden_stems: ["丁", "己"],
        shen_sha: [],
      },
      hour: {
        ganzhi: "癸亥",
        stem: "癸",
        branch: "亥",
        ten_god: "正印",
        hidden_stems: ["壬", "甲"],
        shen_sha: [],
      },
    },
    da_yun: [{ ganzhi: "己未", start_age: 8 }],
  },
};

async function main() {
  // 1) create full_pipeline lab
  const lab = await createDeliveryLab({
    ops_user: "smoke",
    mode: "full_pipeline",
    source: {
      locale: "zh",
      original_question: "(lab pipeline)",
      base_analysis: minimalBase,
      breakthrough_core: null,
      covered_agenda: [],
    },
  });
  assert.equal(lab.mode, "full_pipeline");
  assert.ok(lab.chat_session, "chat_session seeded");
  assert.equal(lab.pipeline_delivery_unlocked, false);
  assert.equal(derivePipelineCursor(lab), "opening");

  const pub = labPublicView(lab) as {
    mode?: string;
    delivery_steps_locked?: boolean;
    chat_session?: { session_id?: string } | null;
    pipeline_cursor?: string;
  };
  assert.equal(pub.mode, "full_pipeline");
  assert.equal(pub.delivery_steps_locked, true);
  assert.ok(pub.chat_session?.session_id?.startsWith("lab-chat-"));

  // 2) solo path via dyad skip
  const skipped = await labDyadSkip({
    ...lab,
    chat_session: {
      ...lab.chat_session!,
      dyad_offer_status: "offered",
    },
  });
  assert.equal(skipped.chat_session?.pivot_chart_path, "solo");
  assert.equal(skipped.chat_session?.dyad_offer_status, "skipped");
  assert.ok(
    (skipped.pipeline_turns ?? []).some((t) => t.gate?.action === "dyad_skip"),
    "gate turn recorded",
  );

  // 3) seed unlocks delivery (simulate post-synthesis chat_session)
  const agent = createInitialAgentState({
    original_question: "要不要辞职做自由职业？",
  });
  agent.current_phase = "awaiting_confirmation";
  agent.breakthrough_core = {
    response: "",
    situation_summary: "smoke",
    structural_root: "smoke",
    multi_dimension_reckoning: [
      {
        dimension: "timing",
        finding: "ok",
        implication: "ok",
      },
    ],
    modern_action_frames: [],
    primary_path: {
      frame_id: "p",
      title: "主",
      means: "做",
      timing: "现在",
      risk: "低",
      why: "因为",
    },
    backup_path: {
      frame_id: "b",
      title: "辅",
      means: "缓",
      timing: "后",
      risk: "低",
      why: "因为",
    },
  } as never;
  agent.desired_direction = { wants: "稳住现金流再跳", priority: "cash" };
  agent.investigation_agenda = [
    {
      id: "a1",
      label: "现金流缓冲",
      status: "covered",
      captured_answer: "还有六个月",
      critical: true,
    },
  ];

  const preSeed: DeliveryLabSession = {
    ...skipped,
    chat_session: {
      ...skipped.chat_session!,
      original_question: "要不要辞职做自由职业？",
      agent_v2: agent,
      pivot_chart_path: "solo",
      charts_locked_at: new Date().toISOString(),
    },
  };
  const seeded = seedLabSourceFromChat(preSeed);
  assert.equal(seeded.pipeline_delivery_unlocked, true);
  assert.equal(derivePipelineCursor(seeded), "ready_for_delivery");
  assert.ok(seeded.source.breakthrough_core, "core seeded");
  assert.equal(seeded.source.original_question, "要不要辞职做自由职业？");
  assert.ok((seeded.source.covered_agenda?.length ?? 0) >= 1);
  assert.equal(seeded.source.pivot_chart_path, "solo");

  await saveDeliveryLab(seeded);
  const reloaded = await loadDeliveryLab(lab.lab_id);
  assert.ok(reloaded);
  assert.equal(reloaded!.pipeline_delivery_unlocked, true);
  const pub2 = labPublicView(reloaded!) as { delivery_steps_locked?: boolean };
  assert.equal(pub2.delivery_steps_locked, false);

  // 4) in-memory session helper
  const mem = createLabChatSession({
    lab_id: "x",
    original_question: "",
    locale: "zh",
  });
  assert.ok(mem.session_id.startsWith("lab-chat-"));
  assert.equal(mem.has_profile, true);

  // 5) hint string
  const hint = pipelineNextHint("opening", mem);
  assert.ok(hint.includes("Opening"));

  console.log("ok · lab full_pipeline smoke", {
    lab_id: lab.lab_id,
    solo_path: skipped.chat_session?.pivot_chart_path,
    unlocked: seeded.pipeline_delivery_unlocked,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
