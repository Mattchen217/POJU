/**
 * Block 103 — Segment 2 marker closed-set slug injection + normalize
 *
 *   pnpm exec tsx scripts/test-poju-block103-segment2-marker-slug-normalize.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  normalizeTermMarkerIds,
  prepareTextForGlossaryRender,
  uiTermById,
  parseTermMarkers,
  plainByTermId,
} from "@/lib/llm/sanitize/compliance-terms";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean, detail?: string): void {
  if (!ok) failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 103 · marker slug normalize ==========\n");

  const core = read("lib/llm/deepseek/breakthrough-core.ts");
  const marking = read("lib/llm/sanitize/term-marking.ts");
  const glossary = read("components/cross-product/GlossaryText.tsx");

  assert("prompt injects buildTermMarkingPromptBlock", core.includes("buildTermMarkingPromptBlock(locale)"));
  assert("prompt has id hard rules", core.includes("打标 id 硬规则") || core.includes("严禁自造 id"));
  assert("prompt bans self-parens", core.includes("不要】自己在标记外再套括号") || core.includes("标记外再套括号"));
  assert("normalizeTermMarkerIds exported", marking.includes("export function normalizeTermMarkerIds"));
  assert("aliases include da_yun→decade", marking.includes("da_yun: \"decade\""));
  assert("aliases include ji_shen", marking.includes("ji_shen: \"unfavorable_element\""));
  assert("GlossaryText uses plainByTermId fallback", glossary.includes("plainByTermId(termId"));

  const leaky =
    "你正处在（⟦t:da_yun|当前阶段|这段时期外界压力升温⟧），同时⟦t:ji_shen|需留意的火能量|代表消耗性的热情与急躁⟧在耗你。还有⟦t:wu_yin_ban_he|午寅半合火局|临时组合⟧。";
  const normalized = normalizeTermMarkerIds(leaky, "zh");
  assert("normalized drops outer parens around markers", !/（⟦t:/.test(normalized), normalized);
  assert("da_yun → decade", normalized.includes("⟦t:decade|"), normalized);
  assert(
    "ji_shen → unfavorable_element",
    normalized.includes("⟦t:unfavorable_element|"),
    normalized,
  );
  assert(
    "unknown compound demoted to soft text",
    !normalized.includes("wu_yin_ban_he") && normalized.includes("午寅半合火局"),
    normalized,
  );
  assert("no double parens", !normalized.includes("（（"), normalized);

  const prepared = prepareTextForGlossaryRender(normalized, "zh");
  const markers = parseTermMarkers(prepared);
  assert("prepared still has markers", markers.length >= 2, prepared);
  for (const m of markers) {
    assert(
      `marker ${m.id} is renderable`,
      Boolean(uiTermById(m.id, "zh") || m.id.startsWith("shensha_")),
      m.raw,
    );
  }

  const twoPart = normalizeTermMarkerIds("先稳住⟦t:yong_shen|平衡能量⟧再动。", "zh");
  const filled = prepareTextForGlossaryRender(twoPart, "zh");
  const yong = parseTermMarkers(filled).find((m) => m.id === "yong_shen");
  assert(
    "missing 3rd field gets gloss via prepare/fill",
    Boolean(yong?.plain?.trim() || plainByTermId("yong_shen", "zh")),
    filled,
  );

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All Block 103 checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
