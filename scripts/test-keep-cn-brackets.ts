/**
 * keep_cn empty-bracket repair + audit.
 * Run: pnpm exec tsx scripts/test-keep-cn-brackets.ts
 */
import { encodeTermMarker } from "@/lib/llm/sanitize/term-marking";
import {
  auditEmptyKeepCnBrackets,
  ganzhiForKeepCnSlug,
  repairEmptyKeepCnBrackets,
} from "@/lib/llm/sanitize/keep-cn-brackets";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const structured = {
  day_master: "乙木",
  yong_shen: "庚金",
  pillars_detail: { day: { ganzhi: "乙卯" } },
  da_yun: [{ start_year: 2020, ganzhi: "丙午", index: 3 }],
} as unknown as ProfileStructured;

console.log("\n=== keep_cn bracket guard ===\n");

assert(
  "ganzhiForKeepCnSlug decade",
  ganzhiForKeepCnSlug("decade", structured, new Date("2024-06-01")) === "丙午",
);
assert("ganzhiForKeepCnSlug day_master", ganzhiForKeepCnSlug("day_master", structured) === "乙木");

const emptyMarker = encodeTermMarker("decade", "life phase ()", "This decade pushes outward.");
assert(
  "audit empty marker bracket",
  auditEmptyKeepCnBrackets(emptyMarker).some((h) => h.label === "empty_keep_cn_bracket"),
);

const repaired = repairEmptyKeepCnBrackets(emptyMarker, structured, "en");
assert("repair fills decade ganzhi", repaired.text.includes("life phase (丙午)"));
assert("repair flag set", repaired.repaired === true);
assert(
  "no audit after repair",
  auditEmptyKeepCnBrackets(repaired.text).length === 0,
);

const bareZh = "你当前人生阶段（）里压力最大。";
const repairedZh = repairEmptyKeepCnBrackets(bareZh, structured, "zh");
assert("repair bare zh label", repairedZh.text.includes("人生阶段（丙午）"));

const bareEn = "Your life phase () is the pivot.";
const repairedEn = repairEmptyKeepCnBrackets(bareEn, structured, "en");
assert("repair bare en label", repairedEn.text.includes("life phase (丙午)"));

const noStructured = repairEmptyKeepCnBrackets(bareEn, null, "en");
assert("unfixable without structured", noStructured.unfixable === true);
assert("unchanged when unfixable", noStructured.text === bareEn);

console.log(process.exitCode === 1 ? "\nSome checks failed.\n" : "\nAll checks passed.\n");
