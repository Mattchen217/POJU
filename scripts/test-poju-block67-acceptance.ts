/**
 * Block 67 — 矩阵链路对齐 + OpenRouter slug + 神煞动态计数
 *
 *   pnpm exec tsx scripts/test-poju-block67-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  DEFAULT_OPENROUTER_MODEL,
  getOpenRouterDefaultModel,
} from "@/lib/llm/openrouter-shared";
import {
  buildMatrixNarrativeInput,
  buildMatrixNarrativeRelationAppendix,
  MATRIX_NARRATIVE_DATA_DISCIPLINE,
} from "@/lib/llm/prompts/matrix-narrative-prompt";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";

const ROOT = path.join(__dirname, "..");

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function makeStructured(): ProfileStructured {
  const pillar = (gz: string, ten_god: string, shen_sha: string[] = ["华盖"]) => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god,
    hidden_stems: [] as string[],
    shen_sha,
  });
  return {
    day_master: "甲",
    pattern: "偏印格",
    yong_shen: "水",
    xi_shen: ["金"],
    ji_shen: ["火"],
    strength: "weak",
    four_pillars: { year: "丙寅", month: "辛巳", day: "甲寅", hour: "丙寅" },
    pillars_detail: {
      year: pillar("丙寅", "食神", ["华盖", "文昌"]),
      month: pillar("辛巳", "正官", ["驿马"]),
      day: pillar("甲寅", "比肩"),
      hour: pillar("丙寅", "食神"),
    },
    da_yun: [{ ganzhi: "癸酉", start_age: 3, start_year: 1993 }],
    data_availability: { pillars_detail: true, da_yun: true, bazi_enrichment: true },
  };
}

function makePayload(structured: ProfileStructured): PojuMatrixPayload {
  return {
    profile_id: "test",
    structured,
    user_profile: {
      birth: {
        year: 1990,
        month: 1,
        day: 1,
        hour: 12,
        minute: 0,
        gender: "male",
        city: "Shanghai",
        latitude: 31.2,
        longitude: 121.5,
        standardMeridian: 120,
      },
      bazi: {
        yearPillar: "丙寅",
        monthPillar: "辛巳",
        dayPillar: "甲寅",
        hourPillar: "丙寅",
      },
    } as unknown as PojuMatrixPayload["user_profile"],
    wuxing_scores: [
      { element: "Wood", element_zh: "木", count: 3, pct: 40 },
      { element: "Fire", element_zh: "火", count: 2, pct: 30 },
      { element: "Metal", element_zh: "金", count: 1, pct: 15 },
      { element: "Water", element_zh: "水", count: 1, pct: 10 },
      { element: "Earth", element_zh: "土", count: 0, pct: 5 },
    ],
    strength: "weak",
    day_master_en: "Yang Wood",
    matrix_id: "PJ-TEST",
  };
}

console.log("\n=== Block 67 acceptance ===\n");

// Fix 1 — live slug constant (no dated dead slug)
assert("DEFAULT_OPENROUTER_MODEL is live slug", DEFAULT_OPENROUTER_MODEL === "deepseek/deepseek-v4-pro");
assert("getOpenRouterDefaultModel uses live slug", getOpenRouterDefaultModel() === "deepseek/deepseek-v4-pro");
assert("no dated slug in codebase resolver", !DEFAULT_OPENROUTER_MODEL.includes("20260423"));
const routerTs = read("lib/llm/router.ts");
const sharedTs = read("lib/llm/openrouter-shared.ts");
assert("router imports shared default", !routerTs.includes('"deepseek/deepseek-v4-pro-20260423"'));
assert("404 hint helper", sharedTs.includes("logOpenRouterModelSlug404Hint"));
assert(".env.example live slug", read(".env.example").includes("deepseek/deepseek-v4-pro") && !read(".env.example").includes("20260423"));

// Fix 4 — dynamic shensha count
const inventory = buildStructuredInstanceInventory(makeStructured());
assert("inventory dynamic shensha count", inventory.includes("本盘实算 3 项"));
assert("no 9选N", !inventory.includes("9 选") && !inventory.includes("闭集 9"));
assert("breakthrough-core no 闭集 9", !read("lib/llm/deepseek/breakthrough-core.ts").includes("闭集 9"));

// Fix 2+3 — matrix alignment
const matrixPromptTs = read("lib/llm/prompts/matrix-narrative-prompt.ts");
const matrixRouteTs = read("app/api/poju/matrix-narrative/route.ts");
assert("matrix input uses focusHints", matrixPromptTs.includes("extractRelationFocusHintsFromText"));
assert("matrix poju relation appendix not empty", !matrixPromptTs.includes('if (product === "poju") return ""'));
assert("matrix data discipline block", matrixPromptTs.includes("MATRIX_NARRATIVE_DATA_DISCIPLINE"));
assert("matrix 三段位", MATRIX_NARRATIVE_DATA_DISCIPLINE.includes("三段位"));
assert("matrix 用足数据", MATRIX_NARRATIVE_DATA_DISCIPLINE.includes("不要只反复用日主"));
assert("route injects discipline user-side", matrixRouteTs.includes("MATRIX_NARRATIVE_DATA_DISCIPLINE"));

const payload = makePayload(makeStructured());
const wealthAppendix = buildMatrixNarrativeRelationAppendix(payload, "poju", {
  focusText: "融资 收入 变现",
});
const teamAppendix = buildMatrixNarrativeRelationAppendix(payload, "poju", {
  focusText: "团队 合伙 员工",
});
assert("poju appendix has 优先锚定", wealthAppendix.includes("优先锚定"));
assert("poju appendix has fact guard", wealthAppendix.includes("fact guard") || wealthAppendix.includes("神煞"));
assert(
  "focus shifts directed block",
  wealthAppendix.includes("focus=wealth") && teamAppendix.includes("focus=team"),
);

const inputWealth = buildMatrixNarrativeInput(payload, undefined, "zh", {
  focusText: "融资 收入",
});
const inputTeam = buildMatrixNarrativeInput(payload, undefined, "zh", {
  focusText: "团队 合伙",
});
assert(
  "matrix liunian_relations differ by focus",
  JSON.stringify(inputWealth.liunian_relations) !== JSON.stringify(inputTeam.liunian_relations) ||
    wealthAppendix !== teamAppendix,
);

console.log("\nDone.\n");
