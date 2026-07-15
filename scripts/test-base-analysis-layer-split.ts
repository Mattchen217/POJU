/**
 * Block BA-v5 — Layer1/Layer2 split: core_judgments + no narrative injection
 *
 *   pnpm exec tsx scripts/test-base-analysis-layer-split.ts
 */
import { getBaziChart } from "shunshi-bazi-core";
import { buildCoreJudgmentsFromStructured } from "@/lib/base-analysis/core-judgments";
import { buildProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  formatBaseAnalysisForPrompt,
  resolveCoreJudgments,
} from "@/lib/llm/prompts/base-analysis-context";
import { buildBaseAnalysisStreamPrompt } from "@/lib/llm/prompts/base-analysis-stream-prompt";
import { buildBreakthroughCorePrompt } from "@/lib/llm/deepseek/breakthrough-core";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo, UserProfile } from "@/lib/profile/types";
import { createInitialAgentState } from "@/lib/poju/agent-state";

const failures: string[] = [];

function assert(label: string, ok: boolean, detail?: string): void {
  if (!ok) failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function buildProfile(year: number, month: number, day: number): {
  profile: UserProfile;
  structured: ReturnType<typeof buildProfileStructured>;
} {
  const birth: BirthInfo = {
    year,
    month,
    day,
    hour_period: "si",
    gender: "M",
    timezone: "Asia/Shanghai",
    birth_location: {
      name: "Guangzhou",
      longitude: 113.2644,
      latitude: 23.1291,
      timezone: "Asia/Shanghai",
      use_defaults: false,
    },
  };
  const params = shunshiParamsFromBirthInfo(birth);
  const chart = getBaziChart({
    ...params,
    useTrueSolarTime: true,
    sect: 1,
  });
  const pillars = chart.八字?.柱位详细;
  const profile: UserProfile = {
    id: `t_${year}`,
    birth,
    bazi: {
      yearPillar: pillars?.年柱?.干支 ?? "?",
      monthPillar: pillars?.月柱?.干支 ?? "?",
      dayPillar: pillars?.日柱?.干支 ?? "?",
      hourPillar: pillars?.时柱?.干支 ?? "?",
    },
    diagnosis: {
      dayMaster: chart.八字?.日主 ?? "?",
      favorableElements: [String(chart.八字?.五行分值?.日主五行 ?? "土")],
      challengingElements: ["金"],
      patternSummary: `日主 ${chart.八字?.日主}`,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: "shunshi",
  };
  const structured = buildProfileStructured({ profile, chart });
  return { profile, structured };
}

function main(): void {
  console.log("\n========== Base Analysis · Layer1/Layer2 split ==========\n");

  const { system } = buildBaseAnalysisStreamPrompt({
    local_data: {
      structured: buildProfile(1990, 3, 24).structured,
      output_language: "zh",
    },
  });

  assert("Layer2 has 能量交换", system.includes("你和外部的能量交换"));
  assert(
    "四柱 not a required output section",
    !system.includes("5. **## 四柱命盘数据") && !/# 输出分区[\s\S]*## 四柱命盘数据/.test(system.split("反例")[0] ?? ""),
  );
  assert(
    "大运 not a required output section",
    !system.includes("6. **## 大运能量气候") &&
      !(system.split("反例")[0] ?? "").includes("## 大运能量气候概览\n\n"),
  );
  const engineIdx = system.indexOf("持续燃烧的引擎");
  const engineWindow =
    engineIdx < 0 ? "" : system.slice(Math.max(0, engineIdx - 48), engineIdx + 24);
  assert(
    "engine metaphor only as ban/anti",
    engineIdx < 0 || /黑名单|禁止|禁用|✗|勿抄/.test(engineWindow),
  );
  assert("SaaS report name", system.includes("个人能量分析报告"));
  assert("blacklist present", system.includes("手机散热片") || system.includes("散热缺口"));
  const a = buildProfile(1990, 3, 24);
  const b = buildProfile(1985, 8, 8);
  const c = buildProfile(2000, 1, 15);
  const ja = buildCoreJudgmentsFromStructured(a.structured, "zh");
  const jb = buildCoreJudgmentsFromStructured(b.structured, "zh");
  const jc = buildCoreJudgmentsFromStructured(c.structured, "zh");

  assert("core_judgments identity present", !!ja.identity_anchor && !!jb.identity_anchor);
  assert(
    "different charts → different identity (or at least refs)",
    ja.refs.day_master !== jb.refs.day_master ||
      ja.identity_anchor !== jb.identity_anchor ||
      jc.refs.day_master !== ja.refs.day_master,
  );
  assert("climate_now has no calendar year", !/20\d{2}/.test(ja.climate_now));
  assert("climate_now has no age band", !/\d{2}\s*[-–]\s*\d{2}\s*岁/.test(ja.climate_now));

  const narrative =
    "## 你的核心配置（强项）\n\n别抄这句话到下游：像持续燃烧的引擎散热缺口参考书";
  const injected = formatBaseAnalysisForPrompt(
    {
      structured: a.structured,
      core_judgments: ja,
      display_text: narrative,
      content: narrative,
    },
    "zh",
  );
  assert("downstream has core_judgments", injected.includes("core_judgments") || injected.includes("identity_anchor"));
  assert("downstream does NOT inject narrative text", !injected.includes("持续燃烧的引擎"));
  assert("downstream does NOT include 用户向白榜", !injected.includes("用户向白榜"));

  const resolved = resolveCoreJudgments({ structured: a.structured }, "zh");
  assert("resolve builds from structured alone", !!resolved?.identity_anchor);

  const agent = createInitialAgentState({ original_question: "我该怎么走" });
  const { user } = buildBreakthroughCorePrompt({
    base_analysis: {
      structured: a.structured,
      core_judgments: ja,
      display_text: narrative,
    },
    agent_v2: agent,
    original_question: "我该怎么走",
    locale: "zh",
  });
  assert("Call A prompt Layer1 label", user.includes("Layer1") || user.includes("core_judgments"));
  assert("Call A does not carry engine narrative", !user.includes("持续燃烧的引擎"));
  assert("Call A prompt shorter than old 12k dump", user.length < 14000, `len=${user.length}`);

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All Layer1/Layer2 checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
