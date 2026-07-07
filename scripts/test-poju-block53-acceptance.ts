/**
 * Block 53 — circuit-breaker degrade (no 500) + anti-repeat macro principle
 *
 *   pnpm exec tsx scripts/test-poju-block53-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  detectShenShaPollution,
  generateWithClosedSetGuard,
} from "@/lib/llm/sanitize/closed-set-circuit-breaker";
import { POJU_V6_STATIC_SYSTEM } from "@/lib/llm/prompts/poju-base-v6";
import { stripOutOfSetFactTerms } from "@/lib/llm/sanitize/term-marking";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function makeProfile(four: { year: string; month: string; day: string; hour: string }): ProfileStructured {
  const pillar = (gz: string) => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god: "",
    hidden_stems: [] as string[],
    shen_sha: [] as string[],
  });
  return {
    day_master: four.day.charAt(0),
    pattern: "",
    yong_shen: "",
    xi_shen: [],
    ji_shen: [],
    strength: "balanced",
    four_pillars: four,
    pillars_detail: {
      year: pillar(four.year),
      month: pillar(four.month),
      day: pillar(four.day),
      hour: pillar(four.hour),
    },
    da_yun: [],
    data_availability: { pillars_detail: true, da_yun: false, bazi_enrichment: false },
  };
}

async function main(): Promise<void> {
  console.log("\n=== Block 53 acceptance ===\n");

  const breakerSrc = read("lib/llm/sanitize/closed-set-circuit-breaker.ts");
  assert("circuit breaker does not throw on exhaust", !breakerSrc.includes("throw new Error"));
  assert(
    "circuit breaker calls stripOutOfSetFactTerms on hit",
    breakerSrc.includes("stripOutOfSetFactTerms(text"),
  );
  assert(
    "circuit breaker logs direct strip (no retry loop)",
    breakerSrc.includes("集外命中，直接剥离"),
  );
  assert(
    "circuit breaker has no retry loop",
    !breakerSrc.includes("熔断重试"),
  );

  assert(
    "anti-repeat macro in identity",
    POJU_V6_STATIC_SYSTEM.includes("每轮必须向前推进，不做原地复读"),
  );
  assert(
    "anti-repeat has no test-case quotes",
    !POJU_V6_STATIC_SYSTEM.includes("藤蔓") && !POJU_V6_STATIC_SYSTEM.includes("时与位"),
  );

  const structured = makeProfile({
    year: "甲子",
    month: "丙午",
    day: "戊辰",
    hour: "甲寅",
  });
  const dirty = "你的结构里寅巳相害，需要留意暗耗。";
  const { polluted } = detectShenShaPollution(dirty, structured, "zh");
  assert("fabricated 寅巳相害 detected as pollution", polluted);

  const stripped = stripOutOfSetFactTerms(dirty, structured);
  assert("stripOutOfSetFactTerms removes fabricated relation", !stripped.includes("寅巳相害"));
  const recheck = detectShenShaPollution(stripped, structured, "zh");
  assert("stripped text passes pollution audit", !recheck.polluted);

  let attempts = 0;
  const out = await generateWithClosedSetGuard({
    label: "block53-test",
    locale: "zh",
    structured,
    generate: async () => {
      attempts++;
      return dirty;
    },
  });
  assert("generateWithClosedSetGuard returns without throw (single attempt)", attempts === 1);
  assert("guard output is clean after strip", !out.includes("寅巳相害"));

  assert(
    "final-delivery no strip degrade (Block 56/62)",
    !read("app/api/poju/final-delivery/route.ts").includes("stripOutOfSetFactTerms"),
  );
  assert(
    "final-delivery no delivery_audit_exhausted (Block 56/62)",
    !read("app/api/poju/final-delivery/route.ts").includes("delivery_audit_exhausted"),
  );

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 53 checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
