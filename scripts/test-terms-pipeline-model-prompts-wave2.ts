/**
 * TERMS-PIPELINE-SPEC-v1 — model-prompt wave2.
 * Asserts model-facing builders omit marker format / soft-output teaching.
 *
 *   pnpm exec tsx scripts/test-terms-pipeline-model-prompts-wave2.ts
 */
import { buildEvidencePrompt } from "@/lib/base-analysis-v2/evidence/evidence-prompt";
import { buildDualLayerDeliveryPromptBlock } from "@/lib/llm/prompts/dual-layer-delivery";
import {
  buildChatPhaseTermBindingBlock,
  buildClosedSetConstraintPromptBlock,
} from "@/lib/llm/prompts/term-closed-set-constraint";
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/term-marking";
import {
  buildTermContextForFacts,
  formatTermContextForPrompt,
  type TermFactRef,
} from "@/lib/glossary/term-context-for-facts";

const failures: string[] = [];
function assert(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures.push(label + (detail ? ` — ${detail}` : ""));
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function bansMarkerTeaching(text: string): boolean {
  // Allow mentioning forbidden shells inside explicit bans; fail only on emit/format teaching.
  if (/⟦t:<slug>/.test(text)) return false;
  if (/⟦t:<id>/.test(text)) return false;
  if (/格式[：:].*`⟦t:/.test(text)) return false;
  if (/Format:\s*`⟦t:/.test(text)) return false;
  if (/(必须打标|要求打标|需要打标|应当打标)/.test(text) && /⟦t:/.test(text)) return false;
  if (/must be marked/i.test(text) && /⟦t:/.test(text)) return false;
  if (/打成\s*`⟦t:/.test(text)) return false;
  if (/mark it\s*`⟦t:/.test(text)) return false;
  return true;
}

function main(): void {
  console.log("\n========== terms-pipeline model prompts wave2 ==========\n");

  const block = buildTermMarkingPromptBlock("zh", {
    neutralBase: true,
    traditionalInventory: ["驿马", "天德贵人", "月德", "正印"],
  });
  assert("inventory keeps 驿马", block.includes("驿马"));
  assert("inventory keeps 天德贵人", block.includes("天德贵人"));
  assert("no soft column header", !block.includes("官方术语") && !/\|\s*软译/.test(block));
  assert("teaches free traditional", /自由传统|传统真词/.test(block));
  assert("bans markers in rules", /禁止.*打标|不要打标/.test(block));
  assert("no marker format teaching", bansMarkerTeaching(block));
  assert("mentions code-side soft", /代码层|autoMark|SSOT/.test(block));

  const blockEn = buildTermMarkingPromptBlock("en", {
    neutralBase: true,
    traditionalInventory: ["驿马", "正印"],
  });
  assert("EN free traditional title", /free traditional/i.test(blockEn));
  assert("EN no marker teaching", bansMarkerTeaching(blockEn));

  const closed = buildClosedSetConstraintPromptBlock("zh");
  assert("closed-set bans markers", /禁止.*⟦t:|禁止.*\?t:/.test(closed));
  assert("closed-set free traditional (evidence)", /自由传统|依据层/.test(closed));
  assert("closed-set reminds body ban", /正文.*零传统|白话层零传统/.test(closed));
  assert("closed-set does not require marker wrap", !/必须.*⟦t:/.test(closed));

  const chat = buildChatPhaseTermBindingBlock("zh");
  assert("chat binding bans markers", /严禁.*⟦t:|严禁.*\?t:/.test(chat));
  assert("chat binding body vernacular ban", /白话正文|禁止.*传统命理/.test(chat));
  assert("chat binding evidence-only traditional", /依据与推理/.test(chat));
  assert("chat binding does not license body traditional", !/直接写传统真词/.test(chat));

  const dual = buildDualLayerDeliveryPromptBlock("zh");
  assert("dual-layer bans marker format", /禁止.*⟦t:/.test(dual));
  assert("dual-layer no soft-fill teaching as model job", !/你只需：① 从注入清单选对 slug/.test(dual));
  assert("dual-layer free traditional evidence", /传统真词/.test(dual));

  const { system, user } = buildEvidencePrompt(
    {
      energy_map: {
        day_master_nature: {
          core_conclusion: "能量偏稳",
          bazi_basis: ["日主乙木得正印生扶", "驿马动"],
        },
      },
    },
    "zh",
  );
  assert("evidence system no marker format teaching", bansMarkerTeaching(system));
  assert("evidence user forbids marker emit", /禁止.*⟦t:|禁止.*\?t:/.test(user));
  assert("evidence inventory from basis", system.includes("正印") || system.includes("驿马") || system.includes("日主"));
  assert("evidence asks free traditional", /传统真词|自由/.test(system));

  const facts: TermFactRef[] = [
    { namespace: "bazi", traditional: "正印", source: "test.pillar" },
    { namespace: "bazi", traditional: "驿马", source: "test.sha" },
  ];
  const ctx = buildTermContextForFacts(facts, "zh");
  const prompt = formatTermContextForPrompt(ctx, { task: "wave2" });
  assert("fact prompt has traditional 正印", prompt.includes("正印"));
  assert("fact prompt has 驿马", prompt.includes("驿马"));
  assert("fact prompt no soft-as-write-target header", !/只许用 slug 或自造软译/.test(prompt));
  assert("fact prompt bans markers", /禁止.*⟦t:|never markers/i.test(prompt));
  assert("fact prompt no soft column dump", !/\|\s*\*\*/.test(prompt));

  // Category fallback must not dump hundreds of soft rows
  const lean = buildTermMarkingPromptBlock("zh", { principlesOnly: true, neutralBase: true });
  const softStars = (lean.match(/\|\s*\*\*/g) || []).length;
  assert("lean prompt no soft bold column", softStars === 0, String(softStars));
  assert("lean prompt row count modest", (lean.match(/^\| /gm) || []).length < 80);

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(" | "));
    process.exit(1);
  }
  console.log("All model-prompt wave2 checks passed.\n");
}

main();
