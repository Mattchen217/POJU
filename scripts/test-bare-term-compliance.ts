/**
 * Bare-term compliance regression — render + copy/TTS export must never leak 裸词/干支.
 *
 *   pnpm exec tsx scripts/test-bare-term-compliance.ts
 */
import {
  HIGH_RISK_COMPLIANCE_HAN,
  SEXAGENARY_GANZHI,
  isValidSexagenaryGanzhi,
} from "@/lib/glossary/term-closed-set";
import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";
import { prepareTextForGlossaryRender } from "@/lib/llm/sanitize/term-marking";
import { stripMarkersForPrompt } from "@/lib/llm/sanitize/term-marking";

const failures: string[] = [];

function assert(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

const SAMPLE = "今年流年丙午，走大运，日主偏弱";
const BARE_TERMS = ["流年", "大运", "丙午", "日主", ...HIGH_RISK_COMPLIANCE_HAN];
const MARKER_RE = /⟦t:|⟧/;

/** Visible soft labels after render prep (markers still present). */
function renderVisiblePlain(text: string, locale: string): string {
  const prepared = prepareTextForGlossaryRender(text, locale);
  return stripMarkersForPrompt(prepared);
}

function assertNoBareTerms(label: string, text: string, forbidden: string[]): void {
  for (const term of forbidden) {
    assert(`${label} no bare 「${term}」`, !text.includes(term), text.slice(0, 80));
  }
}

function main(): void {
  console.log("\n=== Bare-term compliance ===\n");

  const locale = "zh";
  const renderPlain = renderVisiblePlain(SAMPLE, locale);
  const copyPlain = toCompliantPlainText(SAMPLE, locale);

  console.log("=== Render path (prepareTextForGlossaryRender → soft visible) ===\n");
  assertNoBareTerms("render", renderPlain, BARE_TERMS);
  assert("render uses soft labels", renderPlain.includes("当前时空效能") || renderPlain.includes("核心特质"), renderPlain);

  console.log("\n=== Copy/TTS path (toCompliantPlainText) ===\n");
  assertNoBareTerms("copy", copyPlain, BARE_TERMS);
  assert("copy no marker tokens", !MARKER_RE.test(copyPlain), copyPlain);
  assert("copy uses soft labels", copyPlain.includes("当前时空效能"), copyPlain);

  console.log("\n=== 60 干支 — auto-mark + export ===\n");
  assert("sexagenary list length", SEXAGENARY_GANZHI.length === 60);
  let ganzhiLeaks = 0;
  for (const ganzhi of SEXAGENARY_GANZHI) {
    assert(`valid ${ganzhi}`, isValidSexagenaryGanzhi(ganzhi));
    const out = toCompliantPlainText(`阶段${ganzhi}窗口`, locale);
    if (out.includes(ganzhi)) ganzhiLeaks += 1;
  }
  assert("all 60 ganzhi export-scrubbed", ganzhiLeaks === 0, `leaks=${ganzhiLeaks}`);

  console.log("\n=== No substring damage on innocuous prose ===\n");
  const innocent = "我们团队在项目实施中推进节奏，保持沟通。";
  const innocentOut = toCompliantPlainText(innocent, locale);
  assert("innocent prose unchanged", innocentOut === innocent.trim(), innocentOut);

  console.log("\n=== Marker interior not double-processed ===\n");
  const marked = "⟦t:year|当前时空效能|年度窗口。⟧里继续。";
  assert(
    "marked interior preserved",
    toCompliantPlainText(marked, locale).includes("当前时空效能"),
  );

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All bare-term compliance checks passed.\n");
}

main();
