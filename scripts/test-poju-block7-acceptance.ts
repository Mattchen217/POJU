/**
 * Block 7 acceptance — 深测算立体化 (A) + 聊天回复丰满 (B)
 * Run: pnpm exec tsx scripts/test-poju-block7-acceptance.ts
 */

import fs from "node:fs";
import path from "node:path";

import {
  DEEP_RECKONING_TASK,
  mapBreakthroughCorePayload,
} from "@/lib/llm/deepseek/breakthrough-core";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 7 Acceptance ==========\n");

  console.log("=== A · 深测算立体化 ===\n");

  assert("DEEP_RECKONING has timing field", DEEP_RECKONING_TASK.includes("timing:"));
  assert("DEEP_RECKONING has 维度织入", DEEP_RECKONING_TASK.includes("# 维度织入"));
  assert("DEEP_RECKONING requires 2+ dimensions", DEEP_RECKONING_TASK.includes("至少 2 个不同维度"));
  assert("DEEP_RECKONING mentions da_yun timing", DEEP_RECKONING_TASK.includes("至少有 1 条 direction 必须带出 timing"));
  assert("DEEP_RECKONING mentions shen_sha", DEEP_RECKONING_TASK.includes("pillars_detail.*.shen_sha"));
  assert("DEEP_RECKONING mentions life_stage", DEEP_RECKONING_TASK.includes("pillars_detail.*.life_stage"));
  assert("DEEP_RECKONING JSON example has timing", DEEP_RECKONING_TASK.includes('"timing": "..."'));

  const mapped = mapBreakthroughCorePayload({
    relationship_conclusion: "test rc",
    breakthrough_directions: [
      {
        direction: "守势",
        structural_basis: "month.ten_god=七杀 + strength=weak",
        timing: "当前大运宜守不宜进",
        what_would_confirm: "是否已有退路",
      },
      {
        direction: "转势",
        structural_basis: "yong_shen=水 + hour.life_stage=衰",
        timing: "下一步大运窗口转进",
        what_would_confirm: "外部机会信号",
      },
    ],
    investigation_agenda: [
      {
        id: "a1",
        label: "退路",
        critical: true,
        status: "unexplored",
        supports: "验证 direction 守势",
      },
      {
        id: "a2",
        label: "机会",
        critical: true,
        status: "unexplored",
        supports: "验证 direction 转势",
      },
      {
        id: "a3",
        label: "节奏",
        critical: false,
        status: "unexplored",
        supports: "验证 timing",
      },
    ],
  });
  assert(
    "mapBreakthroughCorePayload parses timing",
    mapped.breakthrough_core.breakthrough_directions.every((d) => d.timing?.length),
  );

  const spine = read("lib/llm/phases/spine-block.ts");
  assert("spine-block surfaces timing", spine.includes("d.timing"));

  console.log("\n=== B · 聊天回复丰满 ===\n");

  const collecting = read("lib/llm/phases/collecting-phase.ts");
  assert("collecting has 每轮的分量 block", collecting.includes("## 每轮的分量"));
  assert("collecting has 150–320 字 guidance", collecting.includes("150–320"));
  assert("collecting has 110–230 word guidance", collecting.includes("110–230"));
  assert("collecting max_tokens >= 8000", /max_tokens:\s*8000/.test(collecting));

  console.log("\n=== C · 统一活动指示器 ===\n");

  assert("activity.ts exists", fs.existsSync(path.join(ROOT, "lib/poju/activity.ts")));
  const indicator = read("components/poju/PojuActivityIndicator.tsx");
  assert("PojuActivityIndicator uses Spline", indicator.includes("@splinetool/react-spline"));
  assert("PojuActivityIndicator scene path", indicator.includes("/spline/POJUCHAT.splinecode"));
  const chatUi = read("components/poju/POJUChatUI.tsx");
  assert("POJUChatUI slotActivity", chatUi.includes("slotActivity"));
  assert("POJUChatUI trailingActivity", chatUi.includes("trailingActivity"));
  assert("POJUChatUI no onStream", !chatUi.includes("onStream:"));
  const pojuChat = read("components/poju/PojuChat.tsx");
  assert("PojuChat pendingActivityLines", pojuChat.includes("pendingActivityLines"));
  assert("PojuChat no ThinkingEnergyPulse", !pojuChat.includes("ThinkingEnergyPulse"));
  const zh = read("messages/zh.json");
  assert("zh poju.activity.understanding", zh.includes('"understanding"') && zh.includes("正在解析你当前的物理困境"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 7 acceptance checks passed.\n");
}

main();
