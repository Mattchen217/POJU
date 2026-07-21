/**
 * Offline guards for v2 translate layer (no OpenRouter).
 *   pnpm exec tsx scripts/test-v2-translate-guards.ts
 */
import fs from "node:fs";
import path from "node:path";
import { NARRATIVE_TASKS } from "@/lib/base-analysis-v2/narrative/narrative-call";
import { buildMarkerDictionary } from "@/lib/base-analysis-v2/translate/marker-dictionary";
import {
  buildTranslatePersona,
  buildTranslatePrompt,
  NATIVE_PERSONA,
  resolveNativePersona,
} from "@/lib/base-analysis-v2/translate/translate-prompt";
import {
  extractMarkers,
  findMarkerDrift,
  pickTextPaths,
} from "@/lib/base-analysis-v2/translate/translate-call";
import type { ReportSegmentTextTree } from "@/lib/base-analysis-v2/segment-text";

const failures: string[] = [];
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
};

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

assert("NATIVE_PERSONA en=美国", NATIVE_PERSONA.en?.nationality === "美国");
assert("NATIVE_PERSONA es=西班牙", NATIVE_PERSONA.es?.nationality === "西班牙");
assert("NATIVE_PERSONA de=德国", NATIVE_PERSONA.de?.nationality === "德国");
assert("NATIVE_PERSONA fr=法国", NATIVE_PERSONA.fr?.nationality === "法国");
assert("resolveNativePersona fallback en", resolveNativePersona("pt").nationality === "美国");

const persona = buildTranslatePersona("en");
assert("人设含美国人", persona.includes("美国人"));
assert("人设含英语", persona.includes("英语"));
assert("人设含易经八字", persona.includes("易经") && persona.includes("八字"));

const dict = buildMarkerDictionary("en");
assert("词典含 day_master", dict.includes("⟦t:day_master|⟧"));
assert("词典含 Core", dict.includes("Core"));
assert("词典含本元传统", dict.includes("日主"));

const { system, user } = buildTranslatePrompt(
  "en",
  {
    narrative: { energy_map: { day_master_nature: "你像一株藤蔓。" } },
    evidence: {
      energy_map: { day_master_nature: "因⟦t:day_master|⟧偏弱。" },
    },
  },
  null,
);
assert("translate system 要求标记原样", system.includes("标记原样保留"));
assert("translate system 注入词典", system.includes("⟦t:day_master|⟧"));
assert("translate user 含 payload", user.includes("你像一株藤蔓"));

assert(
  "extractMarkers 排序稳定",
  JSON.stringify(extractMarkers("a⟦t:b|⟧x⟦t:a|⟧")) ===
    JSON.stringify(["⟦t:a|⟧", "⟦t:b|⟧"]),
);

{
  const src = { energy_map: { day_master_nature: "因⟦t:day_master|本元|x⟧弱。" } };
  const ok = { energy_map: { day_master_nature: "Due to ⟦t:day_master|本元|x⟧ weakness." } };
  const bad = { energy_map: { day_master_nature: "Due to Core weakness." } };
  assert(
    "marker 保留通过",
    findMarkerDrift(src, ok, ["energy_map.day_master_nature"]) === null,
  );
  assert(
    "marker 丢失可抓",
    findMarkerDrift(src, bad, ["energy_map.day_master_nature"])?.includes("marker_drift") ===
      true,
  );
}

{
  const tree = {
    energy_map: {
      day_master_nature: "a",
      wuxing_distribution: "b",
      cognitive_archetype: "c",
      regulator: "d",
    },
  } as unknown as ReportSegmentTextTree;
  const picked = pickTextPaths(tree, NARRATIVE_TASKS[0]!.paths);
  assert("pickTextPaths 只含 energy_map", Object.keys(picked).join() === "energy_map");
}

const orch = read("lib/base-analysis-v2/orchestrate/run-report.ts");
assert("orchestrate 固定 PIPELINE_LOCALE=zh", orch.includes('PIPELINE_LOCALE = "zh"'));
assert("orchestrate 调用 runTranslate", orch.includes("runTranslate"));
assert("orchestrate translate 失败 stage", orch.includes('"translate"'));

const computePrompt = read("lib/base-analysis-v2/compute/compute-prompt.ts");
assert("compute 无 COMPUTE_SYSTEM_EN", !computePrompt.includes("COMPUTE_SYSTEM_EN"));
assert("compute 无 Summary block language", !computePrompt.includes("# Summary block language"));

const narPrompt = read("lib/base-analysis-v2/narrative/narrative-prompt.ts");
assert("narrative 无 NARRATIVE_SYSTEM_EN", !narPrompt.includes("NARRATIVE_SYSTEM_EN"));

const evPrompt = read("lib/base-analysis-v2/evidence/evidence-prompt.ts");
assert("evidence 无 EVIDENCE_SYSTEM_EN", !evPrompt.includes("EVIDENCE_SYSTEM_EN"));
assert(
  'evidence 打标块固定 zh',
  evPrompt.includes('buildTermMarkingPromptBlock("zh"'),
);

const stages = read("lib/base-analysis/progress-stages.ts");
assert("progress 含 v2_translate", stages.includes('"v2_translate"'));

console.log(failures.length ? "❌ translate guards failed" : "✅ translate guards ready");
if (failures.length) {
  console.error(failures);
  process.exit(1);
}
