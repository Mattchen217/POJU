/**
 * Step A — Glyph prompt 6-detail verification + prompt sample dump.
 *
 *   pnpm exec tsx scripts/test-glyph-prompt-step-a.ts
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculateProfile } from "@/lib/calculations";
import {
  GLYPH_GUANYIN_INTERPRETATION_METHOD,
  GLYPH_OUTPUT_BRANDING,
} from "@/lib/llm/prompts/glyph-guanyin-base";
import { buildGlyphReadingPrompt } from "@/lib/llm/prompts/glyph-deepseek-prompt";
import { signDataToPromptGlyph } from "@/lib/glyph/sign-to-prompt";
import type { SignData } from "@/types/oracle";
import type { BirthInfo } from "@/lib/profile/types";

const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, ".data", "glyph-step-a-prompt-sample.txt");
const failures: string[] = [];

function assert(name: string, ok: boolean): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
  if (!ok) failures.push(name);
}

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

async function main(): Promise<void> {
  const deep = read("lib/llm/prompts/glyph-deepseek-prompt.ts");
  const method = GLYPH_GUANYIN_INTERPRETATION_METHOD;
  const branding = GLYPH_OUTPUT_BRANDING;

  console.log("\n=== Step A: Glyph prompt 6-detail static checks ===\n");

  assert("1a 日主天干及五行", method.includes("日主天干及五行"));
  assert("1b 当前大运", method.includes("当前大运"));
  assert("1c 用神", method.includes("用神"));
  assert("1d deepseek 命理看此事三字段", deep.includes("①日主天干及五行 ②当前大运 ③用神"));

  assert("2a 引用诗句", method.includes("引用诗句一两句"));
  assert("2b 核心意象", method.includes("引用核心意象"));
  assert("2c 典故角色", method.includes("引用典故角色"));

  for (const w of ["观音", "菩萨", "南无", "灵签", "求签", "抽签"]) {
    assert(`3 禁用 ${w} (branding)`, branding.includes(w));
  }
  assert("3 替换 古典智慧", branding.includes("古典智慧") || method.includes("古典智慧"));

  assert("4 禁用 上上签", branding.includes("上上签"));
  assert("4 只用五风类", branding.includes("五风类"));

  assert("5 method §2.3", method.includes("modern_translation"));
  assert("5 branding 禁令", branding.includes("不得"));
  assert("5 deepseek 禁止抄写", deep.includes("禁止抄写 modern_translation"));

  assert("6 invalid_input 中性引导", deep.includes("禁止留空字符串"));
  assert("6 invalid_input true 仍须填写", deep.includes('"invalid_input": true'));

  const birth: BirthInfo = {
    year: 1990,
    month: 5,
    day: 15,
    hour_period: "si",
    gender: "M",
    timezone: "America/Los_Angeles",
  };
  const profile = await calculateProfile(birth);
  profile.id = "glyph-step-a-test";

  const signs = JSON.parse(read("lib/glyph/data/signs.json")) as SignData[];
  const signStub = signs.find((s) => s.sign_number === 42) ?? signs[0]!;

  const mockBaseAnalysis = {
    day_master: { stem: "甲", element: "木", summary: "日主甲木，阳木参天，性直而韧" },
    current_major_luck: { name: "丁丑大运", period: "2020-2030", theme: "财印相杂，务实沉淀" },
    useful_god: { primary: "水", secondary: "木", avoid: "金过旺", note: "用神取水木以润局" },
    pattern: "正官格",
  };

  const glyph = signDataToPromptGlyph(signStub);
  const { system, user } = buildGlyphReadingPrompt({
    profile,
    base_analysis: mockBaseAnalysis,
    question: "我在考虑是否接受这份新工作，该不该现在跳槽？",
    glyph,
    locale: "zh",
  });

  const sample = [
    "========== GLYPH STEP A — SYSTEM PROMPT (head) ==========",
    system.slice(0, 3200),
    "\n...[middle omitted]...\n",
    "========== GLYPH STEP A — SYSTEM PROMPT (tail: schema + rules) ==========",
    system.slice(-2800),
    "\n========== USER PROMPT ==========\n",
    user,
  ].join("\n");

  if (!existsSync(resolve(ROOT, ".data"))) mkdirSync(resolve(ROOT, ".data"));
  writeFileSync(OUT, sample, "utf8");

  console.log(`\nPrompt sample: ${OUT}`);
  console.log(`System length: ${system.length} chars`);

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll Step A static checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
