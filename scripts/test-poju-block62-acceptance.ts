/**
 * Block 62 — 回归原始设计：模型自由算 + 打标 + UI 软译（只守两条红线）
 *
 *   pnpm exec tsx scripts/test-poju-block62-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { computeLocalShenShaForPillars } from "@/lib/calculations/bazi-shensha-local";
import { detectOutputPolicyViolations } from "@/lib/llm/compliance/audit-output";
import {
  CLOSED_SET_SLUG,
  CLOSED_SHEN_SHA,
} from "@/lib/glossary/term-closed-set";
import { CLOSED_SET_GLOSSARY_ENTRIES } from "@/lib/glossary/term-glossary-closed";
import { POJU_V6_STATIC_SYSTEM } from "@/lib/llm/prompts/poju-base-v6";
import {
  autoMarkBareTerms,
  prepareTextForGlossaryRender,
} from "@/lib/llm/sanitize/term-marking";
import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";
import {
  HIGH_RISK_COMPLIANCE_HAN,
  isValidSexagenaryGanzhi,
  SEXAGENARY_GANZHI,
} from "@/lib/glossary/term-closed-set";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

function main(): void {
  console.log("\n=== Block 62 acceptance ===\n");

  const btRoute = read("app/api/poju/breakthrough-core/route.ts");
  const fdRoute = read("app/api/poju/final-delivery/route.ts");
  const auditOut = read("lib/llm/compliance/audit-output.ts");
  const regen = read("lib/llm/services/delivery-audit-regen.ts");
  const glossaryText = read("components/cross-product/GlossaryText.tsx");

  console.log("=== Part 1 · no closed-set guard on core routes ===\n");
  assert("breakthrough-core no generateWithClosedSetGuard", !btRoute.includes("generateWithClosedSetGuard"));
  assert("final-delivery no generateWithClosedSetGuard", !fdRoute.includes("generateWithClosedSetGuard"));
  assert("final-delivery no stripOutOfSetFactTerms", !fdRoute.includes("stripOutOfSetFactTerms"));
  assert("final-delivery direct callLLM", fdRoute.includes("await callLLM"));

  console.log("\n=== Part 2 · identity + marking ===\n");
  assert("v6 identity: real 命理顾问", POJU_V6_STATIC_SYSTEM.includes("真正的命理决策顾问"));
  assert("v6 identity: term marking", POJU_V6_STATIC_SYSTEM.includes("⟦t:<id>|"));

  console.log("\n=== Part 3 · two hard redlines only ===\n");
  assert("audit-output Block 62 comment", auditOut.includes("Block 62"));
  const baziFree = detectOutputPolicyViolations("当前食神透出，流年大运第三步。", "zh");
  assert(
    "食神/流年/大运 not policy violations",
    !baziFree.some((v) => v.label.includes("bazi")),
  );
  const divination = detectOutputPolicyViolations("我来给你占卜一下命运吉凶。", "zh");
  assert(
    "占卜/命运 still blocked",
    divination.some((v) => v.category === "compliance_redline" || v.category === "divination"),
  );
  const pointPred = detectOutputPolicyViolations("明年下半年一定会迎来事业突破。", "zh");
  assert(
    "point prediction still blocked",
    pointPred.some((v) => v.label.includes("point_prediction")),
  );
  assert("regen hint mentions two redlines", regen.includes("两条硬红线") || regen.includes("Hard redlines only"));

  console.log("\n=== Part 3 · UI auto-mark fallback ===\n");
  assert("GlossaryText uses prepareTextForGlossaryRender", glossaryText.includes("prepareTextForGlossaryRender"));
  assert("AssistantMessageActions uses toCompliantPlainText", read("components/poju/AssistantMessageActions.tsx").includes("toCompliantPlainText"));
  assert("chat copy uses compliant export", read("components/chat/chat-page-client.tsx").includes("toCompliantPlainText"));
  assert("toCompliantPlainText module exists", fs.existsSync(path.join(ROOT, "lib/glossary/to-compliant-plain-text.ts")));

  const bare = "流年里驿马动，注意节奏。";
  const marked = autoMarkBareTerms(bare, "zh");
  assert("autoMarkBareTerms wraps 流年", marked.includes("⟦t:") && marked.includes("year"));
  assert("autoMarkBareTerms wraps 驿马", marked.includes("yi_ma"));
  const prepared = prepareTextForGlossaryRender(bare, "zh");
  assert("prepareTextForGlossaryRender produces markers", prepared.includes("⟦t:"));

  const modelLeak = "今年流年丙午，走大运。";
  const softPlain = toCompliantPlainText(modelLeak, "zh");
  assert("export strips 流年", !softPlain.includes("流年"), softPlain);
  assert("export strips 大运", !softPlain.includes("大运"), softPlain);
  assert("export strips 丙午", !softPlain.includes("丙午"), softPlain);
  assert("export uses soft labels", softPlain.includes("当前时空效能") || softPlain.includes("阶段"), softPlain);

  for (const hr of HIGH_RISK_COMPLIANCE_HAN) {
    const out = toCompliantPlainText(`这里出现${hr}词汇。`, "zh");
    assert(`export strips ${hr}`, !out.includes(hr), out);
  }

  const alreadyMarked = "⟦t:year|当前时空效能|年度窗口⟧里不动";
  const remarked = autoMarkBareTerms(alreadyMarked, "zh");
  assert("marker interior not double-wrapped", remarked === alreadyMarked);

  const twice = prepareTextForGlossaryRender(prepareTextForGlossaryRender(modelLeak, "zh"), "zh");
  assert("idempotent prepare", twice === prepareTextForGlossaryRender(modelLeak, "zh"));

  assert("sexagenary list has 60 pairs", SEXAGENARY_GANZHI.length === 60);
  assert("丙午 is valid ganzhi", isValidSexagenaryGanzhi("丙午"));
  assert("甲丑 is invalid ganzhi", !isValidSexagenaryGanzhi("甲丑"));

  console.log("\n=== Part 4 · shensha 20+ with soft translations ===\n");
  assert("CLOSED_SHEN_SHA count >= 20", CLOSED_SHEN_SHA.length >= 20, `count=${CLOSED_SHEN_SHA.length}`);
  for (const han of CLOSED_SHEN_SHA) {
    const slug = CLOSED_SET_SLUG[han];
    const glossary = CLOSED_SET_GLOSSARY_ENTRIES.find((e) => e.id === han);
    assert(`slug for ${han}`, Boolean(slug), slug ?? "missing");
    assert(`glossary for ${han}`, Boolean(glossary), glossary ? "ok" : "missing");
  }

  const engineOut = computeLocalShenShaForPillars({
    dayMasterStem: "甲",
    branches: { year: "寅", month: "午", day: "辰", hour: "子" },
    stems: { year: "丙", month: "庚", day: "戊", hour: "甲" },
    yearBranch: "寅",
    dayBranch: "辰",
    monthBranch: "午",
  });
  const engineTerms = new Set(Object.values(engineOut).flat());
  for (const term of engineTerms) {
    if (!CLOSED_SHEN_SHA.includes(term as (typeof CLOSED_SHEN_SHA)[number])) continue;
    assert(`engine term ${term} has slug`, Boolean(CLOSED_SET_SLUG[term]));
    assert(`engine term ${term} has glossary`, CLOSED_SET_GLOSSARY_ENTRIES.some((e) => e.id === term));
  }

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log(`All Block 62 checks passed (${CLOSED_SHEN_SHA.length} shensha).\n`);
}

main();
